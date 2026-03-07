import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Verificación de firma Stripe sin SDK - usa Web Crypto API nativa de Deno
async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(',').reduce((acc: Record<string, string>, part) => {
      const [key, val] = part.split('=')
      acc[key] = val
      return acc
    }, {})

    const timestamp = parts['t']
    const v1 = parts['v1']
    if (!timestamp || !v1) return false

    const payload = `${timestamp}.${body}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(payload)

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    return expectedSig === v1
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')
  const secret    = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const valid = await verifyStripeSignature(body, signature, secret)
  if (!valid) {
    console.error('Invalid stripe signature')
    return new Response('Invalid signature', { status: 400 })
  }

  let event: { type: string; id: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
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
    const obj = event.data.object as Record<string, unknown>

    switch (event.type) {

      case 'checkout.session.completed': {
        if (obj.mode !== 'payment') break

        const paymentIntentId = obj.payment_intent as string
        if (!paymentIntentId) break

        const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
          headers: { 'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` }
        })
        const pi = await piRes.json()
        const meta = pi.metadata || {}

        if (!meta.campanaId || !meta.impresiones) {
          console.log('checkout.session.completed sin metadata de campaña — ignorado')
          break
        }

        const campanaId   = parseInt(meta.campanaId)
        const impresiones = parseInt(meta.impresiones)
        const zona        = meta.zona || 'espana'
        const categoria   = meta.categoria   || null
        const urlDestino  = meta.urlDestino  || null

        const { data: campana } = await supabase
          .from('campanas').select('id, impresiones_total').eq('id', campanaId).single()

        if (!campana) { console.error('Campaña no encontrada:', campanaId); break }

        const updatePayload: Record<string, unknown> = {
          impresiones_total: (campana.impresiones_total || 0) + impresiones,
          target_zona: zona,
          activo: true,
          updated_at: new Date().toISOString(),
        }
        if (categoria)  updatePayload.target_categoria = parseInt(categoria)
        if (urlDestino) updatePayload.url_destino      = urlDestino

        await supabase.from('campanas').update(updatePayload).eq('id', campanaId)

        console.log(`Campaña ${campanaId} → +${impresiones} imp`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const meta      = (obj.metadata || {}) as Record<string, string>
        const empresaId = meta.empresaId
        const planLabel = meta.planLabel || 'basico'
        const status    = obj.status as string
        const expiraAt = obj.current_period_end ? new Date(Number(obj.current_period_end) * 1000).toISOString() : null

        if (!empresaId) { console.error('Subscription sin empresaId:', obj.id); break }

        const planActivo = status === 'active' || status === 'trialing'

        await supabase.from('empresas').update({
          plan:                   planActivo ? planLabel : 'gratuito',
          plan_status:            status,
          stripe_subscription_id: obj.id as string,
          plan_expira_at:         expiraAt,
        }).eq('id', empresaId)

        console.log(`Empresa ${empresaId} → plan ${planActivo ? planLabel : 'gratuito'} (${status})`)
        break
      }

      case 'customer.subscription.deleted': {
        const meta      = (obj.metadata || {}) as Record<string, string>
        const empresaId = meta.empresaId
        if (!empresaId) break

        await supabase.from('empresas').update({
          plan: 'gratuito', plan_status: 'canceled',
          stripe_subscription_id: null, plan_expira_at: null,
        }).eq('id', empresaId)

        console.log(`Empresa ${empresaId} → plan gratuito (cancelado)`)
        break
      }

      case 'invoice.payment_succeeded': {
        const subId = obj.subscription as string
        if (!subId) break

        const parent     = obj.parent as Record<string, unknown> | null
        const subDetails = parent?.subscription_details as Record<string, unknown> | null
        const meta       = (subDetails?.metadata || {}) as Record<string, string>
        const empresaId  = meta.empresaId
        const planLabel  = meta.planLabel || 'basico'

        if (!empresaId) { console.log('invoice.payment_succeeded sin empresaId, ignorado'); break }

        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { 'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` }
        })
        const sub = await subRes.json()
        const expiraAt = new Date(sub.current_period_end * 1000).toISOString()

        await supabase.from('empresas').update({
          plan: planLabel, plan_status: 'active',
          plan_expira_at: expiraAt, stripe_subscription_id: subId,
        }).eq('id', empresaId)

        console.log(`Empresa ${empresaId} → plan ${planLabel} activado (invoice paid)`)
        break
      }

      case 'invoice.payment_failed': {
        const subId = obj.subscription as string
        if (!subId) break

        const { data: empresa } = await supabase
          .from('empresas').select('id').eq('stripe_subscription_id', subId).single()

        if (empresa) {
          await supabase.from('empresas').update({ plan_status: 'past_due' }).eq('id', empresa.id)
          console.log(`Pago fallido empresa ${empresa.id}`)
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
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
})
