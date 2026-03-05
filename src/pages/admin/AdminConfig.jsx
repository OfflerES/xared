import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const CAMPOS_CPM = [
  { clave:'banner_cpm_spain',  label:'CPM España (€)',        moneda:'€' },
  { clave:'banner_cpm_latam',  label:'CPM Latinoamérica ($)', moneda:'$' },
  { clave:'banner_cpm_global', label:'CPM Global ($)',         moneda:'$' },
]
const CAMPOS_PLANES = [
  { clave:'plan_precio_basico',      label:'Precio plan Básico (€/año)' },
  { clave:'plan_precio_profesional', label:'Precio plan Profesional (€/año)' },
  { clave:'plan_precio_maximo',      label:'Precio plan Máximo (€/año)' },
]
const CAMPOS_STRIPE = [
  { clave:'stripe_price_basico',      label:'Price ID — Básico',      placeholder:'price_test_...' },
  { clave:'stripe_price_profesional', label:'Price ID — Profesional', placeholder:'price_test_...' },
  { clave:'stripe_price_maximo',      label:'Price ID — Máximo',      placeholder:'price_test_...' },
]

export default function AdminConfig() {
  const [cfg,    setCfg]    = useState({})
  const [ok,     setOk]     = useState('')
  const [err,    setErr]    = useState('')
  const [saving, setSaving] = useState(false)
  const [stripeMode, setStripeMode] = useState('test') // 'test' | 'live'

  useEffect(() => {
    supabase.from('config').select('*').then(({ data }) => {
      const c = {}
      ;(data || []).forEach(r => c[r.clave] = r.valor)
      setCfg(c)
      // Detectar si ya hay price IDs de live
      const hasLive = Object.values(c).some(v => typeof v === 'string' && v.startsWith('price_live_'))
      setStripeMode(hasLive ? 'live' : 'test')
    })
  }, [])

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const guardar = async () => {
    setOk(''); setErr(''); setSaving(true)
    try {
      const upserts = Object.entries(cfg).map(([clave, valor]) =>
        supabase.from('config').upsert({
          clave,
          valor: String(valor),
          updated_at: new Date().toISOString(),
        })
      )
      await Promise.all(upserts)
      setOk('Configuración guardada.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const media     = parseFloat(cfg.visitas_diarias_media || 0)
  const capacidad = media * 30
  const umbral    = capacidad * parseFloat(cfg.banner_umbral_reapertura || 0.8)

  // Validar formato de Price IDs
  const stripePriceValid = (val) => {
    if (!val) return null
    if (val.startsWith('price_test_') || val.startsWith('price_live_')) return 'ok'
    if (val.startsWith('price_')) return 'warn' // formato válido pero ambiguo
    return 'error'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:720 }}>
      {ok  && <div className="alert alert-success">{ok}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {/* Tráfico y capacidad */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', marginBottom:4, fontSize:'.95rem' }}>
          📊 Tráfico y capacidad de banners
        </h3>
        <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:20 }}>
          Define la media diaria de visitas. La capacidad máxima de impresiones contratables es media × 30 días.
          Cuando se agota, la opción de contratar desaparece hasta recuperar el {Math.round(parseFloat(cfg.banner_umbral_reapertura || 0.8) * 100)}%.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Media diaria de visitas</label>
            <input type="number" className="form-control" value={cfg.visitas_diarias_media || ''} onChange={e => set('visitas_diarias_media', e.target.value)} placeholder="5000" />
          </div>
          <div className="form-group">
            <label>Umbral de reapertura (%)</label>
            <input type="number" className="form-control" min="0" max="100"
              value={Math.round(parseFloat(cfg.banner_umbral_reapertura || 0.8) * 100)}
              onChange={e => set('banner_umbral_reapertura', parseFloat(e.target.value) / 100)}
              placeholder="80" />
            <div style={{ fontSize:'.72rem', color:'var(--text-muted)', marginTop:3 }}>Porcentaje de impresiones libres para reabrir ventas</div>
          </div>
        </div>
        {media > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:8, padding:14, background:'var(--cream)', borderRadius:8 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:'var(--navy)', fontSize:'1.1rem' }}>{media.toLocaleString('es-ES')}</div>
              <div style={{ fontSize:'.7rem', color:'var(--text-muted)' }}>Visitas/día</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:'var(--orange)', fontSize:'1.1rem' }}>{capacidad.toLocaleString('es-ES')}</div>
              <div style={{ fontSize:'.7rem', color:'var(--text-muted)' }}>Capacidad máx. (30d)</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:'#059669', fontSize:'1.1rem' }}>{umbral.toLocaleString('es-ES')}</div>
              <div style={{ fontSize:'.7rem', color:'var(--text-muted)' }}>Umbral reapertura ({Math.round(parseFloat(cfg.banner_umbral_reapertura || 0.8) * 100)}%)</div>
            </div>
          </div>
        )}
      </div>

      {/* CPM */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', marginBottom:4, fontSize:'.95rem' }}>
          💰 Tarifas por 1.000 impresiones (CPM)
        </h3>
        <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:20 }}>
          Precio base por cada 1.000 impresiones. El sistema calcula el coste de cada campaña multiplicando por el número de impresiones solicitadas.
        </p>
        <div className="form-row">
          {CAMPOS_CPM.map(f => (
            <div key={f.clave} className="form-group">
              <label>{f.label}</label>
              <input type="number" step="0.01" className="form-control" value={cfg[f.clave] || ''} onChange={e => set(f.clave, e.target.value)} placeholder="10.00" />
            </div>
          ))}
        </div>
      </div>

      {/* Precios de planes */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', marginBottom:4, fontSize:'.95rem' }}>
          📋 Precios de planes de suscripción
        </h3>
        <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:20 }}>
          Precios anuales mostrados en la página de precios y usados para calcular upgrades proporcionales.
        </p>
        <div className="form-row">
          {CAMPOS_PLANES.map(f => (
            <div key={f.clave} className="form-group">
              <label>{f.label}</label>
              <input type="number" step="0.01" className="form-control" value={cfg[f.clave] || ''} onChange={e => set(f.clave, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Stripe */}
      <div style={{ background:'white', border:'2px solid ' + (stripeMode === 'live' ? '#059669' : '#f59e0b'), borderRadius:12, padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', fontSize:'.95rem', margin:0 }}>
            💳 Stripe — Price IDs
          </h3>
          <span style={{
            fontSize:'.7rem', fontWeight:700, padding:'3px 10px', borderRadius:20,
            background: stripeMode === 'live' ? '#d1fae5' : '#fef3c7',
            color:      stripeMode === 'live' ? '#065f46' : '#92400e',
          }}>
            {stripeMode === 'live' ? '✅ MODO LIVE' : '🧪 MODO TEST'}
          </span>
        </div>
        <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:20 }}>
          Copia los Price IDs desde{' '}
          <a href="https://dashboard.stripe.com/test/products" target="_blank" rel="noopener" style={{ color:'var(--orange)' }}>
            Stripe Dashboard → Products
          </a>. En modo test empiezan por <code>price_test_</code>, en live por <code>price_live_</code>.
        </p>
        <div className="form-row">
          {CAMPOS_STRIPE.map(f => {
            const val    = cfg[f.clave] || ''
            const status = stripePriceValid(val)
            return (
              <div key={f.clave} className="form-group">
                <label>{f.label}</label>
                <input
                  type="text"
                  className="form-control"
                  value={val}
                  onChange={e => set(f.clave, e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    borderColor:
                      status === 'ok'    ? '#059669' :
                      status === 'warn'  ? '#f59e0b' :
                      status === 'error' ? '#dc2626' :
                      'var(--border)',
                    fontFamily: 'monospace',
                    fontSize:   '.82rem',
                  }}
                />
                {status === 'error' && (
                  <div style={{ fontSize:'.7rem', color:'#dc2626', marginTop:2 }}>
                    Formato incorrecto. Debe empezar por <code>price_</code>
                  </div>
                )}
                {status === 'ok' && (
                  <div style={{ fontSize:'.7rem', color:'#059669', marginTop:2 }}>
                    ✔ {val.startsWith('price_test_') ? 'Test' : 'Live'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ marginTop:12, padding:'10px 14px', background:'var(--cream)', borderRadius:8, fontSize:'.78rem', color:'var(--text-muted)' }}>
          💡 Tarjeta de prueba Stripe: <code style={{ color:'var(--navy)', fontWeight:600 }}>4242 4242 4242 4242</code> · cualquier fecha futura · cualquier CVV
        </div>
      </div>

      {/* Estado de la web */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', marginBottom:4, fontSize:'.95rem' }}>
          🌐 Estado de la web
        </h3>
        <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:16 }}>
          En modo mantenimiento todos los visitantes ven la página de mantenimiento. El administrador puede acceder normalmente a <strong>/admin</strong>.
        </p>
        <div className="form-row" style={{ alignItems:'flex-start' }}>
          <div className="form-group" style={{ flex:'0 0 auto' }}>
            <label>Estado del sitio</label>
            <select className="form-control" value={cfg.site_estado || 'activo'} onChange={e => set('site_estado', e.target.value)}
              style={{
                borderColor: cfg.site_estado === 'mantenimiento' ? '#d97706' : 'var(--border)',
                color:       cfg.site_estado === 'mantenimiento' ? '#92400e' : 'inherit',
                fontWeight:  cfg.site_estado === 'mantenimiento' ? 700 : 400,
              }}>
              <option value="activo">✅ Activo — web funcionando con normalidad</option>
              <option value="mantenimiento">🔧 Mantenimiento — mostrar página de aviso</option>
            </select>
          </div>
        </div>
        {cfg.site_estado === 'mantenimiento' && (
          <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:'.8rem', color:'#92400e', fontWeight:600 }}>
            ⚠ La web está en modo mantenimiento. Solo tú puedes acceder a /admin.
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="form-group">
            <label>Mensaje en español</label>
            <textarea className="form-control" rows={3} value={cfg.site_maint_msg_es || ''} onChange={e => set('site_maint_msg_es', e.target.value)}
              placeholder="Estamos realizando tareas de mantenimiento..." />
          </div>
          <div className="form-group">
            <label>Message in English</label>
            <textarea className="form-control" rows={3} value={cfg.site_maint_msg_en || ''} onChange={e => set('site_maint_msg_en', e.target.value)}
              placeholder="We are performing scheduled maintenance..." />
          </div>
        </div>
      </div>

      {/* Ratio EUR/USD */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', marginBottom:4, fontSize:'.95rem' }}>
          💱 Tipo de cambio EUR → USD
        </h3>
        <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:16 }}>
          Usado para mostrar los precios de los planes en dólares a empresas fuera de la Unión Europea.
        </p>
        <div className="form-row" style={{ alignItems:'flex-end' }}>
          <div className="form-group" style={{ flex:'0 0 180px' }}>
            <label>1 EUR = _ USD</label>
            <input type="number" step="0.001" className="form-control" value={cfg.usd_eur_ratio || '1.08'}
              onChange={e => set('usd_eur_ratio', e.target.value)} placeholder="1.08" />
          </div>
          {cfg.usd_eur_ratio && (
            <div style={{ flex:1, padding:'10px 14px', background:'var(--cream)', borderRadius:8, fontSize:'.82rem', color:'var(--text-muted)', marginBottom:1 }}>
              Ejemplo: 100€ = <strong style={{ color:'var(--navy)' }}>{(100 * parseFloat(cfg.usd_eur_ratio || 1.08)).toFixed(2)}$</strong>
              {' · '} Plan Básico {cfg.plan_precio_basico}€ = <strong style={{ color:'var(--navy)' }}>{(parseFloat(cfg.plan_precio_basico || 0) * parseFloat(cfg.usd_eur_ratio || 1.08)).toFixed(0)}$</strong>
            </div>
          )}
        </div>
        <p style={{ fontSize:'.72rem', color:'var(--text-muted)', marginTop:6 }}>
          Actualiza este valor periódicamente. Referencia:{' '}
          <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/" target="_blank" rel="noopener" style={{ color:'var(--orange)' }}>BCE tipo oficial →</a>
        </p>
      </div>

      {/* AdSense */}
      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--navy)', marginBottom:4, fontSize:'.95rem' }}>
          🔧 AdSense (fallback)
        </h3>
        <div className="form-group">
          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', textTransform:'none', letterSpacing:'normal', fontWeight:600 }}>
            <input type="checkbox" checked={cfg.adsense_activo === 'true'} onChange={e => set('adsense_activo', e.target.checked ? 'true' : 'false')} style={{ width:16, height:16 }} />
            Mostrar AdSense cuando no hay campaña activa
          </label>
          <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:6 }}>Solo se muestra a usuarios del plan gratuito y cuando no hay campaña Xared activa.</p>
        </div>
        <div className="form-group">
          <label>Código AdSense completo (script)</label>
          <textarea className="form-control" rows={6} value={cfg.adsense_code || ''} onChange={e => set('adsense_code', e.target.value)}
            placeholder='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"...'
            style={{ fontFamily:'monospace', fontSize:'.78rem' }} />
        </div>
      </div>

      <button className="submit-btn" onClick={guardar} disabled={saving} style={{ alignSelf:'flex-start' }}>
        {saving ? <><span className="spinner" />Guardando...</> : 'Guardar toda la configuración →'}
      </button>
    </div>
  )
}
