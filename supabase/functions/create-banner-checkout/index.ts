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
    const { priceId, empresaId, email, paqueteId, impresiones, zona } = await req.json()

    if (!priceId || !empresaId || !email || !impresiones || !zona) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar empresa y banner aprobado
    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('id, stripe_customer_id, banner_estado, verificada')
      .eq('id', empresaId)
      .single()

    if (empErr || !empresa) {
      return new Response(
        JSON.stringify({ error: 'Empresa no encontrada.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!empresa.verificada) {
      return new Response(
        JSON.stringify({ error: 'Tu empresa no está verificada.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (empresa.banner_estado !== 'aprobado') {
      return new Response(
        JSON.stringify({ error: 'Tu banner no está aprobado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar campaña existente
    const { data: campana } = await supabase
      .from('campanas')
      .select('id')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!campana) {
      return new Response(
        JSON.stringify({ error: 'No se encontró campaña. Contacta con soporte.' }),
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

    // Crear sesión de Checkout (pago único)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${Deno.env.get('SITE_URL')}/publicidad?checkout=success`,
      cancel_url:  `${Deno.env.get('SITE_URL')}/publicidad?checkout=cancel`,
      payment_intent_data: {
        metadata: {
          empresaId:   String(empresaId),
          campanaId:   String(campana.id),
          paqueteId,
          impresiones: String(impresiones),
          zona,
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
    console.error('create-banner-checkout error:', e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})