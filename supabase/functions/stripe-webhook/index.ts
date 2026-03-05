import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
})
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message)
    return new Response(`Webhook error: ${e.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Idempotencia
  const { error: dupError } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, data: event.data })

  if (dupError?.code === '23505') {
    console.log('Evento ya procesado:', event.id)
    return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 })
  }

  console.log('Procesando evento:', event.type, event.id)

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Solo procesamos pagos únicos de banners (mode: payment)
        // Los de suscripción (mode: subscription) los gestiona customer.subscription.created
        if (session.mode !== 'payment') break

        // Recuperar metadata del PaymentIntent
        const paymentIntentId = session.payment_intent as string
        if (!paymentIntentId) {
          console.error('checkout.session.completed sin payment_intent')
          break
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        const meta = paymentIntent.metadata

        if (!meta?.campanaId || !meta?.impresiones) {
          console.log('checkout.session.completed sin metadata de campaña — ignorado')
          break
        }

        const campanaId  = parseInt(meta.campanaId)
        const impresiones = parseInt(meta.impresiones)
        const zona        = meta.zona || 'espana'

        // Obtener campaña actual
        const { data: campana, error: campErr } = await supabase
          .from('campanas')
          .select('id, impresiones_total, target_zona, estado')
          .eq('id', campanaId)
          .single()

        if (campErr || !campana) {
          console.error('Campaña no encontrada:', campanaId)
          break
        }

        const nuevasImpresiones = (campana.impresiones_total || 0) + impresiones

        // Sumar impresiones y activar campaña
        await supabase.from('campanas').update({
          impresiones_total: nuevasImpresiones,
          target_zona:       zona,
          activo:            true,
          updated_at:        new Date().toISOString(),
        }).eq('id', campanaId)

        await supabase.from('audit_log').insert({
          tabla:  'campanas',
          accion: 'banner_impresiones_compradas',
          datos:  {
            campanaId,
            impresiones,
            nuevasImpresiones,
            zona,
            sessionId:       session.id,
            paymentIntentId,
          },
          fecha: new Date().toISOString(),
        })

        console.log(`Campaña ${campanaId} → +${impresiones} imp (total: ${nuevasImpresiones}), zona: ${zona}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub       = event.data.object as Stripe.Subscription
        const empresaId = sub.metadata?.empresaId
        const planLabel = sub.metadata?.planLabel || 'basico'
        const status    = sub.status
        const expiraAt  = new Date(sub.current_period_end * 1000).toISOString()

        if (!empresaId) {
          console.error('Subscription sin empresaId en metadata:', sub.id)
          break
        }

        const planActivo = status === 'active' || status === 'trialing'

        await supabase.from('empresas').update({
          plan:                   planActivo ? planLabel : 'gratuito',
          plan_status:            status,
          stripe_subscription_id: sub.id,
          plan_expira_at:         expiraAt,
        }).eq('id', empresaId)

        await supabase.from('audit_log').insert({
          tabla:  'empresas',
          accion: `stripe_subscription_${event.type.split('.').pop()}`,
          datos:  { empresaId, planLabel, status, expiraAt, subscriptionId: sub.id },
          fecha:  new Date().toISOString(),
        })

        console.log(`Empresa ${empresaId} → plan ${planActivo ? planLabel : 'gratuito'} (${status})`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub       = event.data.object as Stripe.Subscription
        const empresaId = sub.metadata?.empresaId

        if (!empresaId) {
          console.error('Subscription deleted sin empresaId:', sub.id)
          break
        }

        await supabase.from('empresas').update({
          plan:                   'gratuito',
          plan_status:            'canceled',
          stripe_subscription_id: null,
          plan_expira_at:         null,
        }).eq('id', empresaId)

        await supabase.from('audit_log').insert({
          tabla:  'empresas',
          accion: 'stripe_subscription_canceled',
          datos:  { empresaId, subscriptionId: sub.id },
          fecha:  new Date().toISOString(),
        })

        console.log(`Empresa ${empresaId} → plan gratuito (cancelado)`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string
        if (!subId) break

        const { data: empresa } = await supabase
          .from('empresas')
          .select('id')
          .eq('stripe_subscription_id', subId)
          .single()

        if (empresa) {
          await supabase.from('empresas')
            .update({ plan_status: 'past_due' })
            .eq('id', empresa.id)

          await supabase.from('audit_log').insert({
            tabla:  'empresas',
            accion: 'stripe_payment_failed',
            datos:  { empresaId: empresa.id, invoiceId: invoice.id, amount: invoice.amount_due },
            fecha:  new Date().toISOString(),
          })

          console.log(`Pago fallido empresa ${empresa.id}, invoice ${invoice.id}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string
        if (!subId) break

        const { data: empresa } = await supabase
          .from('empresas')
          .select('id, plan_status')
          .eq('stripe_subscription_id', subId)
          .single()

        if (empresa && empresa.plan_status === 'past_due') {
          await supabase.from('empresas')
            .update({ plan_status: 'active' })
            .eq('id', empresa.id)

          console.log(`Pago recuperado empresa ${empresa.id}`)
        }
        break
      }

      default:
        console.log('Evento no manejado:', event.type)
    }

  } catch (e) {
    console.error('Error procesando evento:', event.type, e.message)
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})