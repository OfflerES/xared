import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
})

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
      const customer = await stripe.customers.create({
        email,
        metadata: { empresaId: String(empresaId) },
      })
      customerId = customer.id
      await supabase.from('empresas')
        .update({ stripe_customer_id: customerId })
        .eq('id', empresaId)
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://xared.com'

    // Crear sesión de Checkout para suscripción
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?checkout=success&plan=${planLabel}`,
      cancel_url:  `${siteUrl}/precios?checkout=cancel`,
      subscription_data: {
        metadata: {
          empresaId: String(empresaId),
          planLabel,
        },
      },
      locale: 'es',
      allow_promotion_codes: true,
    })

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
