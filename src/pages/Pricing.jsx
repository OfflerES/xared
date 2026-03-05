import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'

const PLANES_BASE = {
  es: [
    { id:'gratuito',    configKey: null,                    color:'var(--text-muted)', label:'Gratuito',    desc:'Para empezar',       features:['3 productos','1 foto/producto','Perfil básico','Solicitudes de presupuesto','Con publicidad'] },
    { id:'basico',      configKey:'plan_precio_basico',     color:'var(--orange)',     label:'Básico',      desc:'Para crecer',        features:['10 productos','3 fotos/producto','Perfil destacado','Sin publicidad','Soporte email'] },
    { id:'profesional', configKey:'plan_precio_profesional',color:'var(--gold)',       label:'Profesional', desc:'Para profesionales', features:['20 productos','5 fotos/producto','Badge verificado prioritario','Sin publicidad','Soporte prioritario'] },
    { id:'maximo',      configKey:'plan_precio_maximo',     color:'var(--navy)',       label:'Máximo',      desc:'Para líderes',       features:['50 productos','10 fotos/producto','Posición privilegiada','Sin publicidad','Account manager dedicado'] },
  ],
  en: [
    { id:'gratuito',    configKey: null,                    color:'var(--text-muted)', label:'Free',        desc:'To get started',     features:['3 products','1 photo/product','Basic profile','Quote requests','With ads'] },
    { id:'basico',      configKey:'plan_precio_basico',     color:'var(--orange)',     label:'Basic',       desc:'To grow',            features:['10 products','3 photos/product','Featured profile','Ad-free','Email support'] },
    { id:'profesional', configKey:'plan_precio_profesional',color:'var(--gold)',       label:'Professional',desc:'For professionals',   features:['20 products','5 photos/product','Priority verified badge','Ad-free','Priority support'] },
    { id:'maximo',      configKey:'plan_precio_maximo',     color:'var(--navy)',       label:'Maximum',     desc:'For market leaders', features:['50 products','10 photos/product','Premium placement','Ad-free','Dedicated account manager'] },
  ]
}

export default function Pricing() {
  const { lang } = useApp()
  const es     = lang !== 'en'
  const planes = PLANES_BASE[lang] || PLANES_BASE.es
  const popular = es ? 'MÁS POPULAR' : 'MOST POPULAR'

  const [precios,     setPrecios]     = useState({})
  const [usdRatio,    setUsdRatio]    = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(null)  // id del plan en proceso
  const [checkoutMsg, setCheckoutMsg] = useState(null)  // mensaje tras volver de Stripe

  // Leer ?checkout= param al volver de Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('checkout')
    const plan   = params.get('plan')
    if (status === 'cancel') {
      setCheckoutMsg({ type: 'info', text: es ? 'Pago cancelado. Puedes intentarlo cuando quieras.' : 'Payment cancelled. You can try again anytime.' })
    }
    // Limpiar params de la URL sin recargar
    if (status) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    supabase.from('config').select('clave,valor')
      .in('clave', [
        'plan_precio_basico', 'plan_precio_profesional', 'plan_precio_maximo',
        'usd_eur_ratio',
        'stripe_price_basico', 'stripe_price_profesional', 'stripe_price_maximo',
      ])
      .then(({ data }) => {
        const c = {}
        ;(data || []).forEach(r => c[r.clave] = r.valor)
        setPrecios(c)
        setUsdRatio(parseFloat(c.usd_eur_ratio || 1.08))
      })
  }, [])

  const formatEur = (val) => {
    const n = parseFloat(val)
    if (isNaN(n)) return '—'
    return es
      ? n.toFixed(2).replace('.', ',') + '€/año'
      : '€' + n.toFixed(2) + '/year'
  }

  const formatUsd = (val) => {
    if (!usdRatio) return null
    const n = parseFloat(val)
    if (isNaN(n)) return null
    const usd = (n * usdRatio).toFixed(2)
    return es ? `aprox. $${usd}/año` : `approx. $${usd}/year`
  }

  const handleContratar = async (plan) => {
    setCheckoutMsg(null)

    // Verificar sesión
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/registro?redirect=precios'
      return
    }

    // Obtener empresa
    const { data: empresa } = await supabase
      .from('empresas')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!empresa) {
      window.location.href = '/registro?redirect=precios'
      return
    }

    // Verificar que tenemos el Price ID configurado
    const priceId = precios[`stripe_price_${plan.id}`]
    if (!priceId) {
      setCheckoutMsg({
        type: 'error',
        text: es
          ? 'Este plan aún no está disponible. Escríbenos a hola@xared.com'
          : 'This plan is not yet available. Email us at hola@xared.com'
      })
      return
    }

    setLoadingPlan(plan.id)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          empresaId: empresa.id,
          email:     user.email,
          planLabel: plan.id,
        },
      })

      if (error) throw new Error(error.message)
      if (!data?.url) throw new Error('No se recibió URL de pago')

      // Redirigir a Stripe Checkout
      window.location.href = data.url

    } catch (e) {
      console.error('Checkout error:', e)
      setCheckoutMsg({
        type: 'error',
        text: es
          ? `Error al iniciar el pago: ${e.message}`
          : `Error starting payment: ${e.message}`
      })
      setLoadingPlan(null)
    }
  }

  return (
    <div>
      {/* Hero */}
      <div style={{background:'var(--navy)',padding:'56px 24px 72px',textAlign:'center'}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'white',
                    fontSize:'clamp(1.8rem,4vw,2.8rem)',marginBottom:12}}>
          {t('pricing_title', lang)}
        </h1>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'.95rem'}}>
          {t('pricing_sub', lang)}
        </p>
      </div>

      {/* Mensaje de estado checkout */}
      {checkoutMsg && (
        <div style={{
          maxWidth:600, margin:'24px auto 0', padding:'12px 20px', borderRadius:8,
          background: checkoutMsg.type === 'error' ? '#fee2e2' : '#e0f2fe',
          color:      checkoutMsg.type === 'error' ? '#991b1b' : '#0369a1',
          fontSize:'.88rem', textAlign:'center',
        }}>
          {checkoutMsg.text}
        </div>
      )}

      {/* Cards */}
      <div style={{maxWidth:1100,margin:'-40px auto 0',padding:'0 24px 60px',
                   display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>
        {planes.map(p => {
          const eurVal  = p.configKey ? precios[p.configKey] : null
          const eurText = eurVal ? formatEur(eurVal) : (p.id === 'gratuito' ? (es ? 'Gratis' : 'Free') : '…')
          const usdText = eurVal ? formatUsd(eurVal) : null
          const isLoading = loadingPlan === p.id

          return (
            <div key={p.id} style={{
              background:'white',
              border:'2px solid ' + (p.id==='profesional' ? 'var(--gold)' : 'var(--border)'),
              borderRadius:16, padding:28, display:'flex', flexDirection:'column',
              position:'relative',
              boxShadow: p.id==='profesional' ? '0 8px 32px rgba(201,153,42,0.15)' : 'none'
            }}>

              {p.id === 'profesional' && (
                <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',
                             background:'var(--gold)',color:'white',fontSize:'.68rem',fontWeight:700,
                             padding:'3px 14px',borderRadius:20,letterSpacing:'.06em',whiteSpace:'nowrap'}}>
                  {popular}
                </div>
              )}

              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'1.05rem',
                           color:'var(--navy)',marginBottom:4}}>
                {p.label}
              </div>
              <div style={{fontSize:'.82rem',color:'var(--text-muted)',marginBottom:20}}>
                {p.desc}
              </div>

              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,
                           fontSize: p.id === 'gratuito' ? '1.5rem' : '1.35rem',
                           color:p.color, lineHeight:1.15, marginBottom: usdText ? 4 : 20,
                           wordBreak:'keep-all', whiteSpace:'nowrap'}}>
                {eurText}
              </div>

              {usdText && (
                <div style={{fontSize:'.75rem',color:'var(--text-muted)',marginBottom:20,fontStyle:'italic'}}>
                  {usdText}
                </div>
              )}

              <ul style={{listStyle:'none',flex:1,marginBottom:24,padding:0}}>
                {p.features.map(f => {
                  const isNeg = f === 'Con publicidad' || f === 'With ads'
                  return (
                    <li key={f} style={{padding:'7px 0',borderBottom:'1px solid var(--cream-dark)',
                                        fontSize:'.83rem',color:isNeg?'var(--text-muted)':'var(--text)',
                                        display:'flex',alignItems:'center',gap:8}}>
                      <span style={{color:isNeg?'var(--border)':'var(--success)',flexShrink:0}}>
                        {isNeg ? '·' : '✔'}
                      </span>
                      {f}
                    </li>
                  )
                })}
              </ul>

              {/* CTA */}
              {p.id === 'gratuito'
                ? <Link to="/registro" style={{display:'block',textAlign:'center',padding:'11px',
                    borderRadius:8,border:'1px solid var(--border)',fontSize:'.88rem',fontWeight:700,
                    fontFamily:"'Syne',sans-serif",color:'var(--text-muted)',textDecoration:'none'}}>
                    {es ? 'Empezar gratis' : 'Start for free'}
                  </Link>
                : <button
                    onClick={() => handleContratar(p)}
                    disabled={!!loadingPlan}
                    style={{
                      display:'block', width:'100%', textAlign:'center', padding:'11px',
                      borderRadius:8, border:'none', cursor: loadingPlan ? 'not-allowed' : 'pointer',
                      background: isLoading ? 'var(--text-muted)' : p.color,
                      color:'white', fontSize:'.88rem', fontWeight:700,
                      fontFamily:"'Syne',sans-serif",
                      transition:'background .2s, opacity .2s',
                      opacity: (loadingPlan && !isLoading) ? 0.5 : 1,
                    }}>
                    {isLoading
                      ? (es ? 'Redirigiendo…' : 'Redirecting…')
                      : (es ? 'Contratar →' : 'Get started →')
                    }
                  </button>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}
