import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'

const PLAN_ORDER = ['gratuito', 'basico', 'profesional', 'maximo']

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
  const { lang, user, empresa } = useApp()
  const navigate  = useNavigate()
  const es        = lang !== 'en'
  const todosPlanes = PLANES_BASE[lang] || PLANES_BASE.es
  const popular   = es ? 'MÁS POPULAR' : 'MOST POPULAR'

  const [precios,     setPrecios]     = useState({})
  const [usdRatio,    setUsdRatio]    = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [checkoutMsg, setCheckoutMsg] = useState(null)

  // Plan actual del usuario (si está identificado)
  const planActual = empresa?.plan || 'gratuito'
  const planActualIdx = PLAN_ORDER.indexOf(planActual)

  // Qué planes mostrar:
  // - No identificado: solo gratuito
  // - Identificado: solo los planes superiores al actual (no el actual ni los inferiores)
  const planesVisibles = !user
    ? todosPlanes.filter(p => p.id === 'gratuito')
    : todosPlanes.filter(p => PLAN_ORDER.indexOf(p.id) > planActualIdx)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('checkout')
    if (status === 'cancel') {
      setCheckoutMsg({ type: 'info', text: es ? 'Pago cancelado. Puedes intentarlo cuando quieras.' : 'Payment cancelled. You can try again anytime.' })
    }
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
    return es ? n.toFixed(2).replace('.', ',') + '€/año' : '€' + n.toFixed(2) + '/year'
  }

  const formatUsd = (val) => {
    if (!usdRatio) return null
    const n = parseFloat(val)
    if (isNaN(n)) return null
    return es ? `aprox. $${(n * usdRatio).toFixed(2)}/año` : `approx. $${(n * usdRatio).toFixed(2)}/year`
  }

  const handleContratar = async (plan) => {
    setCheckoutMsg(null)
    if (!user) { navigate('/registro?redirect=precios'); return }

    const priceId = precios[`stripe_price_${plan.id}`]
    if (!priceId) {
      setCheckoutMsg({ type:'error', text: es ? 'Este plan aún no está disponible. Escríbenos a hola@xared.com' : 'This plan is not yet available. Email us at hola@xared.com' })
      return
    }

    setLoadingPlan(plan.id)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId, empresaId: empresa.id, email: user.email, planLabel: plan.id }
      })
      if (error) throw new Error(error.message)
      if (!data?.url) throw new Error('No se recibió URL de pago')
      window.location.href = data.url
    } catch(e) {
      setCheckoutMsg({ type:'error', text: es ? `Error al iniciar el pago: ${e.message}` : `Error starting payment: ${e.message}` })
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

        {/* Indicador plan actual para usuarios identificados */}
        {user && empresa && (
          <div style={{marginTop:20,display:'inline-block',background:'rgba(255,255,255,0.1)',
                       border:'1px solid rgba(255,255,255,0.2)',borderRadius:20,
                       padding:'6px 18px',fontSize:'.82rem',color:'rgba(255,255,255,0.8)'}}>
            {es ? `Tu plan actual: ` : `Your current plan: `}
            <strong style={{color:'white'}}>{planActual.charAt(0).toUpperCase() + planActual.slice(1)}</strong>
          </div>
        )}
      </div>

      {/* Mensaje checkout */}
      {checkoutMsg && (
        <div style={{maxWidth:600,margin:'24px auto 0',padding:'12px 20px',borderRadius:8,
                     background: checkoutMsg.type==='error'?'#fee2e2':'#e0f2fe',
                     color: checkoutMsg.type==='error'?'#991b1b':'#0369a1',
                     fontSize:'.88rem',textAlign:'center'}}>
          {checkoutMsg.text}
        </div>
      )}

      {/* Caso: usuario en plan máximo */}
      {user && planActual === 'maximo' && (
        <div style={{maxWidth:600,margin:'40px auto',padding:'32px',borderRadius:16,
                     background:'white',border:'2px solid var(--navy)',textAlign:'center'}}>
          <div style={{fontSize:'2rem',marginBottom:12}}>👑</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',fontSize:'1.2rem',marginBottom:8}}>
            {es ? '¡Ya estás en el plan Máximo!' : 'You are already on the Maximum plan!'}
          </div>
          <p style={{color:'var(--text-muted)',fontSize:'.88rem'}}>
            {es ? 'Tienes acceso a todas las funcionalidades de Xared.' : 'You have access to all Xared features.'}
          </p>
        </div>
      )}

      {/* Cards de planes */}
      {planesVisibles.length > 0 && (
        <div style={{maxWidth:1100,margin:'-40px auto 0',padding:'0 24px 60px',
                     display:'grid',
                     gridTemplateColumns:`repeat(${Math.min(planesVisibles.length, 3)},minmax(240px,1fr))`,
                     gap:16}}>
          {planesVisibles.map(p => {
            const eurVal   = p.configKey ? precios[p.configKey] : null
            const eurText  = eurVal ? formatEur(eurVal) : (p.id==='gratuito' ? (es?'Gratis':'Free') : '…')
            const usdText  = eurVal ? formatUsd(eurVal) : null
            const isLoading = loadingPlan === p.id

            return (
              <div key={p.id} style={{
                background:'white',
                border:'2px solid '+(p.id==='profesional'?'var(--gold)':'var(--border)'),
                borderRadius:16,padding:28,display:'flex',flexDirection:'column',
                position:'relative',
                boxShadow:p.id==='profesional'?'0 8px 32px rgba(201,153,42,0.15)':'none'
              }}>
                {p.id==='profesional' && (
                  <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',
                               background:'var(--gold)',color:'white',fontSize:'.68rem',fontWeight:700,
                               padding:'3px 14px',borderRadius:20,letterSpacing:'.06em',whiteSpace:'nowrap'}}>
                    {popular}
                  </div>
                )}

                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'1.05rem',
                             color:'var(--navy)',marginBottom:4}}>{p.label}</div>
                <div style={{fontSize:'.82rem',color:'var(--text-muted)',marginBottom:20}}>{p.desc}</div>

                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,
                             fontSize:p.id==='gratuito'?'1.5rem':'1.35rem',
                             color:p.color,lineHeight:1.15,marginBottom:usdText?4:20,
                             wordBreak:'keep-all',whiteSpace:'nowrap'}}>
                  {eurText}
                </div>

                {usdText && (
                  <div style={{fontSize:'.75rem',color:'var(--text-muted)',marginBottom:20,fontStyle:'italic'}}>
                    {usdText}
                  </div>
                )}

                <ul style={{listStyle:'none',flex:1,marginBottom:24,padding:0}}>
                  {p.features.map(f => {
                    const isNeg = f==='Con publicidad' || f==='With ads'
                    return (
                      <li key={f} style={{padding:'7px 0',borderBottom:'1px solid var(--cream-dark)',
                                          fontSize:'.83rem',color:isNeg?'var(--text-muted)':'var(--text)',
                                          display:'flex',alignItems:'center',gap:8}}>
                        <span style={{color:isNeg?'var(--border)':'var(--success)',flexShrink:0}}>
                          {isNeg?'·':'✔'}
                        </span>
                        {f}
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                {p.id === 'gratuito' ? (
                  <Link to="/registro" style={{display:'block',textAlign:'center',padding:'11px',
                      borderRadius:8,border:'1px solid var(--border)',fontSize:'.88rem',fontWeight:700,
                      fontFamily:"'Syne',sans-serif",color:'var(--text-muted)',textDecoration:'none'}}>
                    {es ? 'Empezar gratis' : 'Start for free'}
                  </Link>
                ) : (
                  <button onClick={() => handleContratar(p)} disabled={!!loadingPlan}
                    style={{display:'block',width:'100%',textAlign:'center',padding:'11px',
                            borderRadius:8,border:'none',cursor:loadingPlan?'not-allowed':'pointer',
                            background:isLoading?'var(--text-muted)':p.color,
                            color:'white',fontSize:'.88rem',fontWeight:700,
                            fontFamily:"'Syne',sans-serif",transition:'background .2s,opacity .2s',
                            opacity:(loadingPlan&&!isLoading)?0.5:1}}>
                    {isLoading
                      ? (es?'Redirigiendo…':'Redirecting…')
                      : (es?'Contratar →':'Get started →')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CTA para no identificados — invitación a registrarse */}
      {!user && (
        <div style={{maxWidth:600,margin:'0 auto 60px',padding:'32px',borderRadius:16,
                     background:'var(--cream)',border:'1px solid var(--border)',textAlign:'center'}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',
                       fontSize:'1.1rem',marginBottom:8}}>
            {es ? '¿Ya tienes cuenta?' : 'Already have an account?'}
          </div>
          <p style={{color:'var(--text-muted)',fontSize:'.88rem',marginBottom:16}}>
            {es
              ? 'Inicia sesión para ver los planes disponibles para tu empresa.'
              : 'Log in to see the plans available for your company.'}
          </p>
          <Link to="/login" style={{display:'inline-block',padding:'10px 28px',borderRadius:8,
                                     background:'var(--navy)',color:'white',fontWeight:700,
                                     fontFamily:"'Syne',sans-serif",fontSize:'.88rem',textDecoration:'none'}}>
            {es ? 'Iniciar sesión' : 'Log in'}
          </Link>
        </div>
      )}
    </div>
  )
}
