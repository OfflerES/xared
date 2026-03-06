import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { PROVINCIAS_ES, SECTORES, PLAN_LIMITS, sanitize } from '../lib/utils'
import { logAction } from '../lib/audit'
import { t } from '../lib/i18n'
import BannerSection from './dashboard/BannerSection'
import ProductosSection from './dashboard/ProductosSection'
import AnunciosSection from './dashboard/AnunciosSection'
import MensajesSection from './dashboard/MensajesSection'

// ── Upsell banner ─────────────────────────────────────────────────────────────
const PLAN_ORDER  = ['gratuito', 'basico', 'profesional', 'maximo']
const PLAN_NEXT   = { gratuito:'basico', basico:'profesional', profesional:'maximo' }
const PLAN_PRICES = { basico:49.99, profesional:74.99, maximo:99.99 } // fallback; se sobreescribe desde config

function UpsellBanner({ empresa, lang }) {
  const [precios,    setPrecios]    = useState(PLAN_PRICES)
  const [cfgLoaded,  setCfgLoaded]  = useState(false)

  useEffect(() => {
    supabase.from('config').select('clave,valor').then(({ data }) => {
      const c = {}; (data||[]).forEach(r => c[r.clave] = r.valor)
      setPrecios({
        basico:      parseFloat(c.plan_precio_basico      || 49.99),
        profesional: parseFloat(c.plan_precio_profesional || 74.99),
        maximo:      parseFloat(c.plan_precio_maximo      || 99.99),
      })
      setCfgLoaded(true)
    })
  }, [])

  const planActual = empresa.plan || 'gratuito'
  const planSig    = PLAN_NEXT[planActual]
  if (!planSig) return null  // ya está en el plan máximo

  // Calcular precio proporcional si tiene plan activo con fecha de contratación
  let precioFull   = precios[planSig] || 0
  let precioUpgrade = precioFull
  let diasRestantes = null
  let fechaVenc     = null

  if (empresa.plan_contratado_at && planActual !== 'gratuito') {
    const contratado = new Date(empresa.plan_contratado_at)
    const vencimiento = new Date(contratado)
    vencimiento.setFullYear(vencimiento.getFullYear() + 1)
    const hoy = new Date()
    const totalDias = 365
    diasRestantes = Math.max(0, Math.round((vencimiento - hoy) / (1000 * 60 * 60 * 24)))
    fechaVenc = vencimiento

    // Precio upgrade = precio nuevo - crédito proporcional del plan actual
    const precioActual = precios[planActual] || 0
    const creditoRestante = (precioActual / totalDias) * diasRestantes
    const diferencia = precioFull - precioActual
    precioUpgrade = Math.max(0, diferencia + creditoRestante * 0 | 0)
    // Más claro: pagas solo el proporcional del plan nuevo por los días que quedan
    precioUpgrade = ((precioFull / totalDias) * diasRestantes).toFixed(2)
  }

  const planLabels = { gratuito:'Gratuito', basico:'Básico', profesional:'Profesional', maximo:'Máximo' }
  const planLabelsEn = { gratuito:'Free', basico:'Basic', profesional:'Professional', maximo:'Maximum' }
  const lbl = lang === 'en' ? planLabelsEn : planLabels

  const emojis    = { basico:'⭐', profesional:'🚀', maximo:'👑' }

  const featuresEs = {
    basico:      ['10 productos', '3 fotos/producto', 'Perfil destacado', 'Sin publicidad', 'Soporte email'],
    profesional: ['20 productos', '5 fotos/producto', 'Badge verificado prioritario', 'Sin publicidad', 'Soporte prioritario'],
    maximo:      ['50 productos', '10 fotos/producto', 'Posición privilegiada', 'Sin publicidad', 'Account manager dedicado'],
  }
  const featuresEn = {
    basico:      ['10 products', '3 photos/product', 'Featured profile', 'Ad-free', 'Email support'],
    profesional: ['20 products', '5 photos/product', 'Priority verified badge', 'Ad-free', 'Priority support'],
    maximo:      ['50 products', '10 photos/product', 'Premium placement', 'Ad-free', 'Dedicated account manager'],
  }
  const features = (lang === 'en' ? featuresEn : featuresEs)[planSig] || []
  const gradients = {
    basico:      'linear-gradient(135deg,rgba(244,96,12,0.08),rgba(244,96,12,0.02))',
    profesional: 'linear-gradient(135deg,rgba(201,153,42,0.12),rgba(201,153,42,0.03))',
    maximo:      'linear-gradient(135deg,rgba(37,99,235,0.10),rgba(37,99,235,0.02))',
  }
  const borderColors = { basico:'rgba(244,96,12,0.25)', profesional:'rgba(201,153,42,0.35)', maximo:'rgba(37,99,235,0.25)' }

  const [loadingUpgrade, setLoadingUpgrade] = useState(false)

  const handleUpgrade = async () => {
    setLoadingUpgrade(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const priceId = cfgLoaded && precios[`stripe_price_${planSig}`]
        ? precios[`stripe_price_${planSig}`]
        : null

      // Leer price ID desde config si no está en state
      let finalPriceId = priceId
      if (!finalPriceId) {
        const { data } = await supabase.from('config').select('valor').eq('clave', `stripe_price_${planSig}`).single()
        finalPriceId = data?.valor
      }

      if (!finalPriceId) {
        alert(lang==='en' ? 'Plan not available yet. Contact hola@xared.com' : 'Plan no disponible aún. Contacta con hola@xared.com')
        return
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { priceId: finalPriceId, empresaId: empresa.id, email: user.email, planLabel: planSig }
      })
      if (error || !data?.url) throw new Error(error?.message || 'Error al crear sesión')
      window.location.href = data.url
    } catch(e) {
      alert('Error: ' + e.message)
    } finally {
      setLoadingUpgrade(false)
    }
  }

  return (
    <div style={{
      background: gradients[planSig],
      border: '1px solid ' + borderColors[planSig],
      borderRadius: 12, padding: '16px 20px', marginBottom: 20,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 12
    }}>
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.95rem',marginBottom:4}}>
          {emojis[planSig]} {lang==='en'
            ? `Upgrade to ${planLabelsEn[planSig]}!`
            : `¡Actualízate al plan ${planLabels[planSig]}!`}
        </div>
        <div style={{fontSize:'.8rem',color:'var(--text-muted)',lineHeight:1.5}}>
          {diasRestantes !== null ? (
            <>
              {lang==='en'
                ? `Pay only for the time remaining on your current plan: `
                : `Paga solo el proporcional hasta el vencimiento: `}
              <strong style={{color:'var(--navy)'}}>
                {precioUpgrade}€
              </strong>
              {fechaVenc && (
                <span style={{marginLeft:8,fontSize:'.75rem',color:'var(--text-muted)'}}>
                  ({lang==='en'?'until':'hasta'} {fechaVenc.toLocaleDateString(lang==='en'?'en-GB':'es-ES')} · {diasRestantes} {lang==='en'?'days':'días'})
                </span>
              )}
            </>
          ) : (
            <>
              {lang==='en'
                ? `Full plan price: `
                : `Precio del plan: `}
              <strong style={{color:'var(--navy)'}}>{precioFull}€/año</strong>
            </>
          )}
        </div>
        {/* Ventajas del plan siguiente */}
        <ul style={{listStyle:'none',padding:0,margin:'10px 0 0',display:'flex',flexWrap:'wrap',gap:'6px 16px'}}>
          {features.map(f => (
            <li key={f} style={{fontSize:'.78rem',color:'var(--text)',display:'flex',alignItems:'center',gap:5}}>
              <span style={{color:'var(--success)'}}>✔</span>{f}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handleUpgrade}
        disabled={loadingUpgrade}
        style={{
          padding:'9px 20px', borderRadius:8, border:'none', cursor: loadingUpgrade ? 'not-allowed' : 'pointer',
          background: loadingUpgrade ? 'var(--text-muted)' : planSig==='profesional'?'var(--gold)':planSig==='maximo'?'var(--navy)':'var(--orange)',
          color:'white', fontFamily:"'Syne',sans-serif", fontWeight:700,
          fontSize:'.85rem', whiteSpace:'nowrap', transition:'background .2s'
        }}>
        {loadingUpgrade
          ? (lang==='en' ? 'Redirecting…' : 'Redirigiendo…')
          : (lang==='en' ? `Upgrade to ${planLabelsEn[planSig]} →` : `Actualizar a ${planLabels[planSig]} →`)}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const { empresa, setEmpresa, refreshEmpresa, lang } = useApp()
  const [activeTab,      setActiveTab]      = useState('perfil')
  const [form,           setForm]           = useState({})
  const [ok,             setOk]             = useState('')
  const [err,            setErr]            = useState('')
  const [saving,         setSaving]         = useState(false)
  const [productos,      setProductos]      = useState([])
  const [mensajesNew,    setMensajesNew]    = useState(0)
  const [checkoutBanner, setCheckoutBanner] = useState(null) // 'success' | null

  useEffect(() => {
    if (empresa) { setForm({ ...empresa }); loadProductos(); loadMensajesCount() }
  }, [empresa?.id])

  // Detectar retorno desde Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('checkout')
    if (status === 'success') {
      setCheckoutBanner('success')
      // Refrescar empresa para mostrar el nuevo plan
      if (refreshEmpresa) refreshEmpresa()
      // Limpiar URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const loadMensajesCount = async () => {
    if (!empresa) return
    const { count } = await supabase.from('mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa.id).eq('verificado', true).eq('leido', false)
    setMensajesNew(count || 0)
  }

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  const loadProductos = async () => {
    if (!empresa) return
    const { data } = await supabase.from('productos').select('*, categorias(nombre,icono), producto_fotos(url,orden)').eq('empresa_id', empresa.id).order('created_at', { ascending: false })
    setProductos(data || [])
  }

  const saveEmpresa = async () => {
    setOk(''); setErr(''); setSaving(true)
    try {
      const { error } = await supabase.from('empresas').update({
        razon_social: sanitize(form.razon_social),
        descripcion:  sanitize(form.descripcion),
        sector:       sanitize(form.sector),
        provincia:    sanitize(form.provincia),
        zona:         form.zona,
        telefono:     sanitize(form.telefono),
        web:          sanitize(form.web),
        email:        sanitize(form.email),
        instagram:    sanitize(form.instagram) || null,
        linkedin:     sanitize(form.linkedin)  || null,
        whatsapp:     sanitize(form.whatsapp)  || null,
        twitter:      sanitize(form.twitter)   || null,
      }).eq('id', empresa.id)
      if (error) throw error
      await refreshEmpresa()
      logAction('accion', 'guardar_perfil', { userId: empresa.user_id, empresaId: empresa.id })
      setOk('✅ Cambios guardados correctamente.')
    } catch(e) {
      setErr('❌ ' + (e.message || 'Error al guardar.'))
    } finally {
      setSaving(false)
    }
  }

  if (!empresa) return null

  const planLimits  = PLAN_LIMITS
  const limite      = empresa.max_productos_override || planLimits[empresa.plan] || 3
  const planClass   = { gratuito:'plan-gratuito', basico:'plan-basico', profesional:'plan-profesional', maximo:'plan-maximo' }
  const estadoLabel = { pendiente:'⏳ Pendiente', activa:'✅ Activa', bloqueada:'🚫 Bloqueada' }

  return (
    <div className="dashboard-wrap">
      <div className="dashboard-topbar">
        <div>
          <h1 id="dashTitle">{empresa.razon_social}</h1>
          <div className="dashboard-sub">{empresa.email} · {empresa.nif}</div>
        </div>
        <span className={"plan-badge " + (planClass[empresa.plan]||'plan-gratuito')}>
          {empresa.plan.charAt(0).toUpperCase() + empresa.plan.slice(1)}
        </span>
      </div>

      {/* Banner pago exitoso */}
      {checkoutBanner === 'success' && (
        <div style={{
          background:'linear-gradient(135deg,#d1fae5,#a7f3d0)',
          border:'1px solid #6ee7b7', borderRadius:12,
          padding:'16px 20px', marginBottom:20,
          display:'flex', justifyContent:'space-between', alignItems:'center', gap:12
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:'1.8rem'}}>🎉</span>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'#065f46',fontSize:'1rem',marginBottom:2}}>
                {lang==='en' ? 'Payment successful! Your plan has been activated.' : '¡Pago completado! Tu plan ha sido activado.'}
              </div>
              <div style={{fontSize:'.82rem',color:'#047857'}}>
                {lang==='en'
                  ? 'You will receive a confirmation email shortly. Your new features are available now.'
                  : 'Recibirás un email de confirmación en breve. Tus nuevas funcionalidades ya están disponibles.'}
              </div>
            </div>
          </div>
          <button onClick={() => setCheckoutBanner(null)}
            style={{background:'none',border:'none',cursor:'pointer',color:'#065f46',fontSize:'1.2rem',flexShrink:0}}>
            ✕
          </button>
        </div>
      )}

      {empresa.estado === 'pendiente' && (
        <div className="pending-notice">
          ⏳ {lang==='en'?'Your company is pending verification. You will receive an email when it is activated.':'Tu empresa está pendiente de verificación. Recibirás un email cuando sea activada.'}
        </div>
      )}

      {!empresa.verificada && empresa.estado === 'activa' && (
        <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',gap:12,alignItems:'flex-start'}}>
          <span style={{fontSize:'1.3rem',flexShrink:0}}>⏳</span>
          <div>
            <div style={{fontWeight:700,color:'#92400e',fontSize:'.88rem',marginBottom:3}}>
              {lang==='en'?'Your company is not yet visible in the directory':'Tu empresa aún no es visible en el directorio'}
            </div>
            <div style={{fontSize:'.8rem',color:'#b45309',lineHeight:1.5}}>
              {lang==='en'
                ? 'We are reviewing your registration. You can complete your profile and add products in the meantime — they will go live as soon as we verify your account (usually within 24–48h).'
                : 'Estamos revisando tu registro. Mientras tanto puedes completar tu perfil y añadir productos — se publicarán en cuanto verifiquemos tu cuenta (normalmente en 24–48h).'}
            </div>
            {!empresa.web && (
              <div style={{fontSize:'.78rem',color:'#92400e',marginTop:6,fontWeight:600}}>
                💡 {lang==='en'
                  ? 'Adding your company website to your profile helps speed up verification.'
                  : 'Añadir la web de tu empresa en el perfil ayuda a agilizar la verificación.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upsell al siguiente plan */}
      <UpsellBanner empresa={empresa} lang={lang} />

      {/* Stats */}
      <div className="dash-grid">
        <div className="dash-card">
          <div className="dash-card-label">Productos publicados</div>
          <div className="dash-card-num">{productos.length} <span style={{fontSize:'.9rem',color:'var(--text-muted)',fontWeight:400}}>/ {limite}</span></div>
          <div className="dash-card-sub">Plan {empresa.plan}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Estado</div>
          <div className="dash-card-num" style={{fontSize:'1.1rem'}}>{estadoLabel[empresa.estado] || empresa.estado}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">Verificación</div>
          <div className="dash-card-num" style={{fontSize:'1.1rem'}}>{empresa.verificada ? '✅ Verificada' : '⏳ Pendiente'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'2px solid var(--border)',flexWrap:'wrap'}}>
        {['perfil','productos','mensajes','banner','anuncios'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{padding:'10px 18px',border:'none',background:'none',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.85rem',cursor:'pointer',color:activeTab===tab?'var(--orange)':'var(--text-muted)',borderBottom:activeTab===tab?'2px solid var(--orange)':'2px solid transparent',marginBottom:-2,transition:'all .15s',position:'relative'}}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'mensajes' && mensajesNew > 0 && (
              <span style={{position:'absolute',top:6,right:2,background:'var(--orange)',color:'white',borderRadius:10,padding:'1px 5px',fontSize:'.6rem',fontWeight:700}}>{mensajesNew}</span>
            )}
          </button>
        ))}
      </div>

      {/* Perfil */}
      {activeTab === 'perfil' && (
        <div className="dash-section">
          <div className="dash-section-title">
            Perfil de empresa
            <button className="save-btn" onClick={saveEmpresa} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
          {ok  && <div className="alert alert-success">{ok}</div>}
          {err && <div className="alert alert-error">{err}</div>}
          <div className="form-row">
            <div className="form-group"><label>Razón social</label><input className="form-control" value={form.razon_social||''} onChange={e=>set('razon_social',e.target.value)} /></div>
            <div className="form-group"><label>NIF/CIF</label><input className="form-control" value={form.nif||''} disabled /></div>
          </div>
          <div className="form-group"><label>Descripción</label><textarea className="form-control" rows={4} value={form.descripcion||''} onChange={e=>set('descripcion',e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Sector</label>
              <select className="form-control" value={form.sector||''} onChange={e=>set('sector',e.target.value)}>
                <option value="">Selecciona...</option>
                {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Provincia</label>
              <select className="form-control" value={form.provincia||''} onChange={e=>set('provincia',e.target.value)}>
                <option value="">Selecciona...</option>
                {PROVINCIAS_ES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Teléfono</label><input className="form-control" value={form.telefono||''} onChange={e=>set('telefono',e.target.value)} /></div>
            <div className="form-group"><label>Web</label><input className="form-control" value={form.web||''} onChange={e=>set('web',e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Email público</label><input className="form-control" value={form.email||''} onChange={e=>set('email',e.target.value)} /></div>
            <div className="form-group">
              <label>Zona de distribución</label>
              <select className="form-control" value={form.zona||'nacional'} onChange={e=>set('zona',e.target.value)}>
                <option value="local">Local</option>
                <option value="nacional">Nacional</option>
                <option value="global">Global</option>
              </select>
            </div>
          </div>

          {/* Redes sociales */}
          <div style={{marginTop:8,paddingTop:12,borderTop:'1px solid var(--border)'}}>
            <div style={{fontSize:'.78rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>
              Redes sociales
            </div>
            <div className="form-row">
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:'1rem'}}>🔗</span> LinkedIn
                </label>
                <input className="form-control" value={form.linkedin||''} onChange={e=>set('linkedin',e.target.value)}
                  placeholder="https://linkedin.com/company/..." />
              </div>
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:'1rem'}}>📸</span> Instagram
                </label>
                <input className="form-control" value={form.instagram||''} onChange={e=>set('instagram',e.target.value)}
                  placeholder="https://instagram.com/..." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:'1rem'}}>✕</span> X / Twitter
                </label>
                <input className="form-control" value={form.twitter||''} onChange={e=>set('twitter',e.target.value)}
                  placeholder="https://x.com/..." />
              </div>
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:'1rem'}}>💬</span> WhatsApp
                </label>
                <input className="form-control" value={form.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)}
                  placeholder="+34 600 000 000" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'productos'  && <ProductosSection empresa={empresa} productos={productos} loadProductos={loadProductos} />}
      {activeTab === 'mensajes'   && <MensajesSection empresa={empresa} onRead={loadMensajesCount} />}
      {activeTab === 'banner'     && <BannerSection empresa={empresa} refreshEmpresa={refreshEmpresa} />}
      {activeTab === 'anuncios'   && <AnunciosSection empresa={empresa} />}
    </div>
  )
}
