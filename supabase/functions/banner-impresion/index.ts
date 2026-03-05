import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campanaId, tipo, pais, ciudad, userAgent, referer } = await req.json()

    if (!campanaId || !tipo || !['impresion', 'click'].includes(tipo)) {
      return new Response(
        JSON.stringify({ error: 'Parámetros inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Registrar evento
    await supabase.from('banner_eventos').insert({
      campana_id: campanaId,
      tipo,
      pais:       pais || null,
      ciudad:     ciudad || null,
      user_agent: userAgent || null,
      referer:    referer || null,
    })

    // Si es impresión, actualizar contadores y timestamp de rotación
    if (tipo === 'impresion') {
      const { data: campana } = await supabase
        .from('campanas')
        .select('impresiones_usadas, impresiones_total')
        .eq('id', campanaId)
        .single()

      if (campana) {
        const nuevasUsadas = (campana.impresiones_usadas || 0) + 1
        const agotada = nuevasUsadas >= campana.impresiones_total

        await supabase.from('campanas').update({
          impresiones_usadas:   nuevasUsadas,
          ultima_impresion_at:  new Date().toISOString(),
          estado:               agotada ? 'agotada' : 'aprobada',
          updated_at:           new Date().toISOString(),
        }).eq('id', campanaId)
      }
    }

    // Si es click, incrementar clics_total
    if (tipo === 'click') {
      await supabase.rpc('increment_clics', { campana_id_param: campanaId })
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    console.error('banner-impresion error:', e)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})