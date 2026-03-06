import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const STRIPE_API = 'https://api.stripe.com/v1'

async function stripePost(path: string, params: Record<string, string>, secretKey: string) {
  const body = new URLSearchParams(params).toString()
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  return res.json()
}

async function stripeGet(path: string, secretKey: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { 'Authorization': `Bearer ${secretKey}` },
  })
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, empresaId, email, planLabel } = await req.json()

    if (!priceId || !empresaId || !email || !planLabel) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros: priceId, empresaId, email, planLabel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const siteUrl   = Deno.env.get('SITE_URL') || 'https://xared.com'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar empresa
    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('id, stripe_customer_id, plan, stripe_subscription_id')
      .eq('id', empresaId)
      .single()

    if (empErr || !empresa) {
      return new Response(
        JSON.stringify({ error: 'Empresa no encontrada.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener o crear customer en Stripe
    let customerId = empresa.stripe_customer_id

    if (!customerId) {
      const customer = await stripePost('/customers', {
        email,
        'metadata[empresaId]': String(empresaId),
      }, secretKey)
      customerId = customer.id
      await supabase.from('empresas').update({ stripe_customer_id: customerId }).eq('id', empresaId)
    }

    // Si tiene suscripción activa → hacer upgrade directo (sin nueva sesión de checkout)
    if (empresa.stripe_subscription_id && empresa.plan !== 'gratuito') {
      // Obtener suscripción actual para saber el subscription_item id
      const sub = await stripeGet(`/subscriptions/${empresa.stripe_subscription_id}`, secretKey)

      if (sub.status === 'active' || sub.status === 'trialing') {
        const itemId = sub.items?.data?.[0]?.id

        if (itemId) {
          // Actualizar el plan de la suscripción existente con prorrateo
          const updated = await stripePost(`/subscriptions/${empresa.stripe_subscription_id}`, {
            'items[0][id]':    itemId,
            'items[0][price]': priceId,
            'proration_behavior': 'create_prorations',
            'metadata[empresaId]': String(empresaId),
            'metadata[planLabel]': planLabel,
          }, secretKey)

          if (updated.error) throw new Error(updated.error.message)

          // Actualizar empresa en Supabase inmediatamente
          await supabase.from('empresas').update({
            plan:                   planLabel,
            plan_status:            'active',
            stripe_subscription_id: updated.id,
            plan_expira_at:         new Date(updated.current_period_end * 1000).toISOString(),
          }).eq('id', empresaId)

          return new Response(
            JSON.stringify({ upgraded: true, url: `${siteUrl}/dashboard?checkout=success&plan=${planLabel}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Sin suscripción activa → crear sesión de Checkout normal
    const sessionParams: Record<string, string> = {
      customer:                      customerId,
      mode:                          'subscription',
      'line_items[0][price]':        priceId,
      'line_items[0][quantity]':     '1',
      success_url:                   `${siteUrl}/dashboard?checkout=success&plan=${planLabel}`,
      cancel_url:                    `${siteUrl}/precios?checkout=cancel`,
      'subscription_data[metadata][empresaId]': String(empresaId),
      'subscription_data[metadata][planLabel]': planLabel,
      locale:                        'es',
      allow_promotion_codes:         'true',
    }

    const session = await stripePost('/checkout/sessions', sessionParams, secretKey)

    if (session.error) throw new Error(session.error.message)

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    console.error('create-checkout-session error:', e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
