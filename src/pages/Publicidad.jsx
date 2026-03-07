import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

const PAQUETES = [
  { id: 'banner_1000',  imps: 1000,  configKey: 'banner_precio_1000',  stripeKey: 'stripe_price_banner_1000'  },
  { id: 'banner_5000',  imps: 5000,  configKey: 'banner_precio_5000',  stripeKey: 'stripe_price_banner_5000'  },
  { id: 'banner_10000', imps: 10000, configKey: 'banner_precio_10000', stripeKey: 'stripe_price_banner_10000' },
]

const ZONAS = [
  { id: 'espana',  label: '🇪🇸 España',        moneda: '€' },
  { id: 'latam',   label: '🌎 Latinoamérica',  moneda: '$' },
  { id: 'europa',  label: '🌍 Europa',          moneda: '€' },
  { id: 'global',  label: '🌐 Global',          moneda: '$' },
]

export default function Publicidad() {
  const { lang, user, empresa, loading } = useApp()
  const navigate = useNavigate()
  const es = lang !== 'en'

  const [config,      setConfig]      = useState({})
  const [categorias,  setCategorias]  = useState([])
  const [categoria,   setCategoria]   = useState('')
  const [campana,     setCampana]     = useState(null)
  const [zona,        setZona]        = useState('espana')
  const [paquete,     setPaquete]     = useState('banner_1000')
  const [loadingPago, setLoadingPago] = useState(false)
  const [err,         setErr]         = useState('')
  const [checkoutMsg, setCheckoutMsg] = useState(null)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('checkout')
    if (status === 'cancel') {
      setCheckoutMsg({ type: 'info', text: es ? 'Pago cancelado. Puedes intentarlo cuando quieras.' : 'Payment cancelled. You can try again anytime.' })
    }
    if (status === 'success') {
      setCheckoutMsg({ type: 'success', text: es ? '✅ ¡Pago recibido! Tus impresiones se acreditarán en breve.' : '✅ Payment received! Your impressions will be credited shortly.' })
    }
    if (status) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    supabase.from('categorias').select('id,nombre,icono').eq('visible',true).order('orden')
      .then(({ data }) => setCategorias(data || []))
  }, [])

  useEffect(() => {
    supabase.from('config').select('clave,valor')
      .in('clave', [
        'banner_precio_1000', 'banner_precio_5000', 'banner_precio_10000',
        'stripe_price_banner_1000', 'stripe_price_banner_5000', 'stripe_price_banner_10000',
      ])
      .then(({ data }) => {
        const c = {}
        ;(data || []).forEach(r => c[r.clave] = r.valor)
        setConfig(c)
      })
  }, [])

  useEffect(() => {
    if (!empresa) return
    supabase.from('campanas').select('*').eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => setCampana(data || null))
  }, [empresa?.id])

  if (loading || !user) return null

  const paqueteSeleccionado = PAQUETES.find(p => p.id === paquete)
  const precio = config[paqueteSeleccionado?.configKey]
  const zonaSeleccionada = ZONAS.find(z => z.id === zona)

  // Determinar estado del usuario para mostrar el CTA correcto
  const empresaVerificada = empresa?.verificada
  const bannerEstado = campana?.estado  // pendiente, aprobada, rechazada, pausada, agotada
  const tieneBanner = !!campana?.banner_url
  const puedeContratar = empresaVerificada && tieneBanner && bannerEstado === 'aprobada'

  const handleContratar = async () => {
    setErr('')
    if (!empresa) return
    const priceId = config[paqueteSeleccionado?.stripeKey]
    if (!priceId) {
      setErr(es ? 'Este paquete no está disponible aún.' : 'This package is not available yet.')
      return
    }
    setLoadingPago(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-banner-checkout', {
        body: {
          priceId,
          empresaId: empresa.id,
          email: user.email,
          paqueteId: paquete,
          impresiones: paqueteSeleccionado.imps,
          zona,
          categoria: categoria || null,
          urlDestino: empresa.slug ? `https://xared.com/site/${empresa.slug}` : null,
        },
      })
      if (error) throw new Error(error.message)
      if (!data?.url) throw new Error('No se recibió URL de pago')
      window.location.href = data.url
    } catch (e) {
      setErr(es ? `Error al iniciar el pago: ${e.message}` : `Error starting payment: ${e.message}`)
      setLoadingPago(false)
    }
  }

  const beneficios = es ? [
    ['📊', 'Estadísticas reales',  'Impresiones y clicks en tiempo real'],
    ['🎯', 'Targeting preciso',    'Por país y categoría de producto'],
    ['🔄', 'Rotación justa',       'Varios anunciantes rotan equitativamente'],
    ['⏳', 'Sin caducidad',        'Usas las impresiones a tu ritmo'],
  ] : [
    ['📊', 'Real statistics',      'Live impressions and click tracking'],
    ['🎯', 'Precise targeting',    'By country and product category'],
    ['🔄', 'Fair rotation',        'Multiple advertisers rotate equitably'],
    ['⏳', 'No expiry',            'Use impressions at your own pace'],
  ]

  return (
    <div>
      {/* Hero */}
      <div style={{background:'var(--navy)',padding:'56px 24px',textAlign:'center'}}>
        <span style={{display:'inline-block',background:'rgba(244,96,12,0.15)',color:'var(--orange-light)',border:'1px solid rgba(244,96,12,0.3)',padding:'5px 16px',borderRadius:20,fontSize:'.78rem',fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:20}}>
          {es ? 'Publicidad' : 'Advertising'}
        </span>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'white',fontSize:'clamp(1.8rem,4vw,2.8rem)',marginBottom:16}}>
          {es ? 'Llega a miles de compradores B2B' : 'Reach thousands of B2B buyers'}
        </h1>
        <p style={{color:'rgba(255,255,255,0.55)',maxWidth:600,margin:'0 auto',lineHeight:1.7}}>
          {es
            ? 'Muestra tu banner a compradores profesionales de España, Latinoamérica y todo el mundo. Solo pagas por impresiones reales.'
            : 'Show your banner to professional buyers from Spain, Latin America and worldwide. You only pay for real impressions.'}
        </p>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'56px 24px'}}>

        {/* Mensaje checkout */}
        {checkoutMsg && (
          <div style={{
            padding:'14px 20px', borderRadius:10, marginBottom:24,
            background: checkoutMsg.type === 'success' ? '#dcfce7' : '#e0f2fe',
            color:      checkoutMsg.type === 'success' ? '#15803d' : '#0369a1',
            fontSize:'.88rem', textAlign:'center',
          }}>
            {checkoutMsg.text}
          </div>
        )}

        {/* Mock banner */}
        <div style={{marginBottom:40,textAlign:'center'}}>
          <p style={{fontSize:'.75rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>
            {es ? 'Así se ve tu banner' : 'How your banner looks'}
          </p>
          <div style={{width:'100%',maxWidth:728,height:90,background:'linear-gradient(135deg,var(--navy),var(--navy-mid))',borderRadius:10,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'1.1rem',gap:16}}>
            {campana?.banner_url
              ? <img src={campana.banner_url} alt="Tu banner" style={{width:'100%',height:90,objectFit:'cover',borderRadius:10}} />
              : <><span style={{color:'var(--orange)'}}>{es ? 'Tu empresa aquí' : 'Your company here'}</span><span style={{fontSize:'.8rem',opacity:.6}}>728 × 90 px</span></>
            }
          </div>
        </div>

        {/* Beneficios */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:48}}>
          {beneficios.map(([icon,title,desc]) => (
            <div key={title} style={{textAlign:'center',padding:24,background:'white',borderRadius:12,border:'1px solid var(--border)'}}>
              <div style={{fontSize:'2rem',marginBottom:12}}>{icon}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:6}}>{title}</div>
              <div style={{fontSize:'.82rem',color:'var(--text-muted)',lineHeight:1.5}}>{desc}</div>
            </div>
          ))}
        </div>

        {/* CTA según estado */}
        <div style={{background:'var(--navy)',borderRadius:16,padding:40,textAlign:'center'}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'white',fontSize:'1.4rem',marginBottom:12}}>
            {es ? '¿Listo para anunciarte?' : 'Ready to advertise?'}
          </h3>

          {/* Empresa no verificada */}
          {!empresaVerificada && (
            <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:20,marginBottom:16}}>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:'.9rem',marginBottom:12}}>
                ⏳ {es
                  ? 'Tu empresa está pendiente de verificación. Una vez verificada podrás contratar publicidad.'
                  : 'Your company is pending verification. Once verified you will be able to purchase advertising.'}
              </p>
            </div>
          )}

          {/* Empresa verificada pero sin banner */}
          {empresaVerificada && !tieneBanner && (
            <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:20,marginBottom:16}}>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:'.9rem',marginBottom:16}}>
                🖼️ {es
                  ? 'Primero sube tu banner desde tu panel de empresa. Una vez aprobado podrás contratar impresiones.'
                  : 'First upload your banner from your company dashboard. Once approved you can purchase impressions.'}
              </p>
              <button onClick={() => navigate('/dashboard')}
                style={{background:'var(--orange)',color:'white',border:'none',padding:'11px 28px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.9rem',cursor:'pointer'}}>
                {es ? 'Ir a mi panel →' : 'Go to my dashboard →'}
              </button>
            </div>
          )}

          {/* Banner pendiente de aprobación */}
          {empresaVerificada && tieneBanner && bannerEstado === 'pendiente' && (
            <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:20,marginBottom:16}}>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:'.9rem'}}>
                🔍 {es
                  ? 'Tu banner está siendo revisado por nuestro equipo. Te avisaremos por email cuando esté aprobado.'
                  : 'Your banner is being reviewed by our team. We will notify you by email once approved.'}
              </p>
            </div>
          )}

          {/* Banner rechazado */}
          {empresaVerificada && tieneBanner && bannerEstado === 'rechazada' && (
            <div style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:10,padding:20,marginBottom:16}}>
              <p style={{color:'#fca5a5',fontSize:'.9rem',marginBottom:8}}>
                ❌ {es ? 'Tu banner fue rechazado.' : 'Your banner was rejected.'}
              </p>
              {campana?.estado_motivo && (
                <p style={{color:'rgba(255,255,255,0.6)',fontSize:'.82rem',marginBottom:16}}>
                  {es ? 'Motivo: ' : 'Reason: '}{campana.estado_motivo}
                </p>
              )}
              <button onClick={() => navigate('/dashboard')}
                style={{background:'var(--orange)',color:'white',border:'none',padding:'11px 28px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.9rem',cursor:'pointer'}}>
                {es ? 'Subir nuevo banner →' : 'Upload new banner →'}
              </button>
            </div>
          )}

          {/* Banner aprobado — formulario de compra */}
          {puedeContratar && (
            <div>
              <p style={{color:'rgba(255,255,255,0.6)',marginBottom:24,fontSize:'.9rem'}}>
                {es ? 'Selecciona la zona y el paquete de impresiones.' : 'Select the zone and impressions package.'}
              </p>

              <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center',marginBottom:20}}>
                {/* Selector zona */}
                <select value={zona} onChange={e => setZona(e.target.value)}
                  style={{padding:'10px 16px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:'.88rem',fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
                  {ZONAS.map(z => <option key={z.id} value={z.id} style={{color:'var(--navy)'}}>{z.label}</option>)}
                </select>

                {/* Selector categoría */}
                <select value={categoria} onChange={e => setCategoria(e.target.value)}
                  style={{padding:'10px 16px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:'.88rem',fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
                  <option value="" style={{color:'var(--navy)'}}>{es ? '📂 Todas las categorías' : '📂 All categories'}</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id} style={{color:'var(--navy)'}}>{cat.icono || ''} {cat.nombre}</option>
                  ))}
                </select>

                {/* Selector paquete */}
                <select value={paquete} onChange={e => setPaquete(e.target.value)}
                  style={{padding:'10px 16px',borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'white',fontSize:'.88rem',fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
                  {PAQUETES.map(p => {
                    const precio = config[p.configKey]
                    const label = precio
                      ? `${p.imps.toLocaleString('es-ES')} imp — ${zonaSeleccionada?.moneda}${parseFloat(precio).toFixed(2)}`
                      : `${p.imps.toLocaleString('es-ES')} imp`
                    return <option key={p.id} value={p.id} style={{color:'var(--navy)'}}>{label}</option>
                  })}
                </select>
              </div>

              {precio && (
                <div style={{color:'white',fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'1.5rem',marginBottom:20}}>
                  {zonaSeleccionada?.moneda}{parseFloat(precio).toFixed(2)}
                  <span style={{fontSize:'.8rem',fontWeight:400,opacity:.6,marginLeft:8}}>
                    {paqueteSeleccionado?.imps.toLocaleString('es-ES')} {es ? 'impresiones' : 'impressions'}
                  </span>
                </div>
              )}

              {err && (
                <div style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:8,padding:'10px 16px',marginBottom:16,color:'#fca5a5',fontSize:'.85rem'}}>
                  {err}
                </div>
              )}

              <button onClick={handleContratar} disabled={loadingPago}
                style={{background: loadingPago ? 'rgba(255,255,255,0.2)' : 'var(--orange)',color:'white',border:'none',padding:'13px 40px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.95rem',cursor: loadingPago ? 'not-allowed' : 'pointer',transition:'background .2s'}}>
                {loadingPago
                  ? <>{es ? 'Redirigiendo…' : 'Redirecting…'}</>
                  : <>{es ? 'Contratar impresiones →' : 'Purchase impressions →'}</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}