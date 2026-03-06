import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const STRIPE_API = 'https://api.stripe.com/v1'

async function stripePost(path: string, params: Record<string, string>, secretKey: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  return res.json()
}

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

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const siteUrl   = Deno.env.get('SITE_URL') || 'https://xared.com'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: empresa, error: empErr } = await supabase
      .from('empresas')
      .select('id, stripe_customer_id, banner_estado, verificada')
      .eq('id', empresaId)
      .single()

    if (empErr || !empresa) {
      return new Response(JSON.stringify({ error: 'Empresa no encontrada.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!empresa.verificada) {
      return new Response(JSON.stringify({ error: 'Tu empresa no está verificada.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (empresa.banner_estado !== 'aprobado') {
      return new Response(JSON.stringify({ error: 'Tu banner no está aprobado.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: campana } = await supabase.from('campanas').select('id').eq('empresa_id', empresaId).maybeSingle()
    if (!campana) {
      return new Response(JSON.stringify({ error: 'No se encontró campaña.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let customerId = empresa.stripe_customer_id
    if (!customerId) {
      const customer = await stripePost('/customers', { email, 'metadata[empresaId]': String(empresaId) }, secretKey)
      customerId = customer.id
      await supabase.from('empresas').update({ stripe_customer_id: customerId }).eq('id', empresaId)
    }

    const session = await stripePost('/checkout/sessions', {
      customer:                                      customerId,
      mode:                                          'payment',
      'line_items[0][price]':                        priceId,
      'line_items[0][quantity]':                     '1',
      success_url:                                   `${siteUrl}/publicidad?checkout=success`,
      cancel_url:                                    `${siteUrl}/publicidad?checkout=cancel`,
      'payment_intent_data[metadata][empresaId]':    String(empresaId),
      'payment_intent_data[metadata][campanaId]':    String(campana.id),
      'payment_intent_data[metadata][paqueteId]':    paqueteId || '',
      'payment_intent_data[metadata][impresiones]':  String(impresiones),
      'payment_intent_data[metadata][zona]':         zona,
      locale:                                        'es',
      allow_promotion_codes:                         'true',
    }, secretKey)

    if (session.error) throw new Error(session.error.message)

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    console.error('create-banner-checkout error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
