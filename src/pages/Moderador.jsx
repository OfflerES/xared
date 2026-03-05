import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { logAction } from '../lib/audit'

const TABS = [
  { id:'verificar',  label:'Sin verificar' },
  { id:'empresas',   label:'Empresas pendientes' },
  { id:'productos',  label:'Productos pendientes' },
  { id:'actividad',  label:'Mi actividad' },
]

const MOTIVOS_PRESET = [
  { es: 'La web indicada no existe o no responde',        en: 'The provided website does not exist or does not respond' },
  { es: 'La web no corresponde a la empresa registrada',  en: 'The website does not match the registered company' },
  { es: 'El país indicado no coincide con la empresa',    en: "The country doesn't match the company" },
  { es: 'Información insuficiente para verificar',        en: 'Insufficient information to verify' },
  { es: 'Posible duplicado de otra empresa',              en: 'Possible duplicate of another company' },
  { es: 'Enlace incorrecto o roto',                       en: 'Wrong or broken link' },
]

export default function Moderador() {
  const { user, moderador, lang } = useApp()
  const navigate    = useNavigate()
  const es          = lang !== 'en'

  const [tab,           setTab]           = useState('verificar')
  const [sinVerificar,  setSinVerificar]  = useState([])
  const [empresas,      setEmpresas]      = useState([])
  const [productos,     setProductos]     = useState([])
  const [actividad,     setActividad]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [msg,           setMsg]           = useState('')

  // Modal de rechazo
  const [rechazando,    setRechazando]    = useState(null)   // empresa object
  const [motivo,        setMotivo]        = useState('')
  const [enviando,      setEnviando]      = useState(false)

  useEffect(() => {
    if (!moderador) { navigate('/'); return }
    loadSinVerificar(); loadEmpresas(); loadProductos(); loadActividad()
  }, [moderador])

  const loadSinVerificar = async () => {
    setLoading(true)
    const { data } = await supabase.from('empresas')
      .select('id,razon_social,nif,email,web,sector,pais,origen,created_at,estado,slug,verificacion_metodo')
      .eq('verificada', false).eq('estado', 'activa')
      .order('created_at', { ascending: true })
    setSinVerificar(data || [])
    setLoading(false)
  }

  const loadEmpresas = async () => {
    const { data } = await supabase.from('empresas')
      .select('id,razon_social,sector,pais,nif,email,web,created_at,estado,slug')
      .eq('estado', 'pendiente').order('created_at', { ascending: true })
    setEmpresas(data || [])
  }

  const loadProductos = async () => {
    const { data } = await supabase.from('productos')
      .select('id,nombre,descripcion,estado,created_at,slug,empresas(razon_social,slug),categorias(nombre,icono)')
      .eq('estado', 'pendiente').order('created_at', { ascending: true })
    setProductos(data || [])
  }

  const loadActividad = async () => {
    const { data } = await supabase.from('audit_log')
      .select('id,accion,metadata,ip,created_at')
      .eq('user_id', user.id).eq('tipo', 'accion')
      .in('accion', ['moderar_empresa_activar','moderar_empresa_rechazar','moderar_producto_aprobar',
                     'moderar_producto_rechazar','moderar_empresa_verificar','moderar_empresa_desverificar'])
      .order('created_at', { ascending: false }).limit(100)
    setActividad(data || [])
  }

  const verificarEmpresa = async (empresa) => {
    await supabase.from('empresas').update({ verificada: true, verificacion_metodo: 'manual_admin' }).eq('id', empresa.id)
    logAction('accion', 'moderar_empresa_verificar', { userId: user.id, metadata: { empresa_id: empresa.id, razon_social: empresa.razon_social } })
    setSinVerificar(p => p.filter(e => e.id !== empresa.id))
    flash('✔ ' + empresa.razon_social + (es ? ' verificada' : ' verified'))
    loadActividad()
  }

  // Abre modal de rechazo
  const abrirRechazo = (empresa) => {
    setRechazando(empresa)
    setMotivo('')
  }

  // Confirma rechazo con motivo y envía email
  const confirmarRechazo = async () => {
    if (!motivo.trim()) return
    setEnviando(true)
    try {
      await supabase.from('empresas').update({ estado: 'bloqueada', verificacion_metodo: null }).eq('id', rechazando.id)
      logAction('accion', 'moderar_empresa_desverificar', {
        userId: user.id,
        metadata: { empresa_id: rechazando.id, razon_social: rechazando.razon_social, motivo }
      })
      // Enviar email con motivo
      await supabase.functions.invoke('enviar-rechazo', {
        body: { email: rechazando.email, razon_social: rechazando.razon_social, motivo, lang }
      })
      setSinVerificar(p => p.filter(e => e.id !== rechazando.id))
      setEmpresas(p => p.filter(e => e.id !== rechazando.id))
      flash('✕ ' + rechazando.razon_social + (es ? ' rechazada — email enviado' : ' rejected — email sent'))
      loadActividad()
    } finally {
      setEnviando(false)
      setRechazando(null)
      setMotivo('')
    }
  }

  const accionEmpresa = async (empresa, nuevoEstado) => {
    if (nuevoEstado === 'bloqueada') { abrirRechazo(empresa); return }
    await supabase.from('empresas').update({ estado: nuevoEstado }).eq('id', empresa.id)
    logAction('accion', 'moderar_empresa_activar', { userId: user.id, metadata: { empresa_id: empresa.id, razon_social: empresa.razon_social } })
    setEmpresas(p => p.filter(e => e.id !== empresa.id))
    flash(es ? 'Empresa activada' : 'Company activated')
    loadActividad()
  }

  const accionProducto = async (producto, nuevoEstado) => {
    await supabase.from('productos').update({ estado: nuevoEstado }).eq('id', producto.id)
    const accion = nuevoEstado === 'activo' ? 'moderar_producto_aprobar' : 'moderar_producto_rechazar'
    logAction('accion', accion, { userId: user.id, metadata: { producto_id: producto.id, nombre: producto.nombre } })
    setProductos(p => p.filter(x => x.id !== producto.id))
    flash(nuevoEstado === 'activo' ? (es ? 'Producto aprobado' : 'Product approved') : (es ? 'Producto rechazado' : 'Product rejected'))
    loadActividad()
  }

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3500) }
  const fmt     = (ts) => new Date(ts).toLocaleDateString(es ? 'es-ES' : 'en-GB')
  const fmtHora = (ts) => new Date(ts).toLocaleString(es ? 'es-ES' : 'en-GB', { dateStyle:'short', timeStyle:'short' })

  const labelAccion = (accion, meta) => {
    const n = meta?.razon_social || meta?.empresa_id || meta?.nombre || meta?.producto_id
    if (accion === 'moderar_empresa_activar')      return (es?'Activó':'Activated') + ' empresa: ' + n
    if (accion === 'moderar_empresa_rechazar')     return (es?'Rechazó':'Rejected') + ' empresa: ' + n
    if (accion === 'moderar_empresa_verificar')    return (es?'Verificó':'Verified') + ' empresa: ' + n
    if (accion === 'moderar_empresa_desverificar') return (es?'Bloqueó':'Blocked') + ' empresa: ' + n + (meta?.motivo ? ' — ' + meta.motivo : '')
    if (accion === 'moderar_producto_aprobar')     return (es?'Aprobó':'Approved') + ' producto: ' + n
    if (accion === 'moderar_producto_rechazar')    return (es?'Rechazó':'Rejected') + ' producto: ' + n
    return accion
  }

  if (!moderador) return null

  const btnAprobar  = {padding:'7px 14px',border:'none',borderRadius:6,background:'rgba(5,150,105,0.1)',color:'#059669',fontSize:'.8rem',fontWeight:700,cursor:'pointer'}
  const btnRechazar = {padding:'7px 14px',border:'none',borderRadius:6,background:'rgba(220,38,38,0.08)',color:'var(--danger)',fontSize:'.8rem',fontWeight:700,cursor:'pointer'}
  const btnVer      = {padding:'7px 12px',border:'1px solid var(--border)',borderRadius:6,background:'white',fontSize:'.8rem',cursor:'pointer',color:'var(--navy)',textDecoration:'none',display:'inline-block'}

  const TarjetaVerif = ({ e }) => {
    const webUrl = e.web ? (e.web.startsWith('http') ? e.web : 'https://' + e.web) : null
    return (
      <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,padding:'16px 20px',display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:4}}>{e.razon_social}</div>
          <div style={{fontSize:'.75rem',color:'var(--text-muted)',display:'flex',gap:10,flexWrap:'wrap',marginBottom:6}}>
            <span>NIF: {e.nif}</span><span>{e.email}</span><span>{e.pais}</span><span>{fmt(e.created_at)}</span>
          </div>
          {webUrl
            ? <a href={webUrl} target="_blank" rel="noopener"
                style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:'.8rem',fontWeight:600,
                        color:'white',background:'var(--orange)',padding:'5px 12px',borderRadius:6,textDecoration:'none'}}>
                🔗 {es ? 'Visitar web' : 'Visit website'} →
              </a>
            : <div style={{fontSize:'.78rem',color:'#d97706',fontWeight:600,padding:'5px 10px',background:'#fef3c7',borderRadius:6,display:'inline-block'}}>
                ⚠ {es ? 'Sin web declarada' : 'No website provided'}
              </div>
          }
        </div>
        <div style={{display:'flex',gap:8,flexShrink:0}}>
          <button style={btnAprobar} onClick={() => verificarEmpresa(e)}>✔ {es?'Verificar':'Verify'}</button>
          <button style={btnRechazar} onClick={() => abrirRechazo(e)}>✕ {es?'Rechazar':'Reject'}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'32px 24px'}}>
      {/* Modal de rechazo con motivo */}
      {rechazando && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'white',borderRadius:16,padding:28,maxWidth:500,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',marginBottom:6,fontSize:'1.1rem'}}>
              {es ? 'Rechazar empresa' : 'Reject company'}
            </h3>
            <p style={{fontSize:'.85rem',color:'var(--text-muted)',marginBottom:16}}>
              <strong>{rechazando.razon_social}</strong> · {rechazando.email}
            </p>

            {/* Motivos preset */}
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
              {MOTIVOS_PRESET.map((m, i) => (
                <button key={i} onClick={() => setMotivo(es ? m.es : m.en)}
                  style={{textAlign:'left',padding:'8px 12px',borderRadius:8,border:'1px solid',fontSize:'.8rem',cursor:'pointer',
                    borderColor: motivo === (es?m.es:m.en) ? 'var(--orange)' : 'var(--border)',
                    background:  motivo === (es?m.es:m.en) ? 'rgba(244,96,12,0.06)' : 'white',
                    color:       motivo === (es?m.es:m.en) ? 'var(--orange)' : 'var(--text)',
                    fontWeight:  motivo === (es?m.es:m.en) ? 600 : 400}}>
                  {es ? m.es : m.en}
                </button>
              ))}
            </div>

            {/* Motivo personalizado */}
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={es ? 'O escribe un motivo personalizado...' : 'Or write a custom reason...'}
              rows={2}
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:'.85rem',
                      resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:16}}
            />

            <p style={{fontSize:'.75rem',color:'var(--text-muted)',marginBottom:16}}>
              📧 {es ? 'Se enviará un email a' : 'An email will be sent to'} <strong>{rechazando.email}</strong> {es ? 'con este motivo.' : 'with this reason.'}
            </p>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setRechazando(null)}
                style={{...btnVer, padding:'9px 18px'}}>
                {es ? 'Cancelar' : 'Cancel'}
              </button>
              <button onClick={confirmarRechazo} disabled={!motivo.trim() || enviando}
                style={{...btnRechazar, padding:'9px 18px',
                  opacity: !motivo.trim() || enviando ? 0.5 : 1,
                  cursor: !motivo.trim() || enviando ? 'not-allowed' : 'pointer'}}>
                {enviando ? '...' : (es ? '✕ Confirmar rechazo' : '✕ Confirm rejection')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',fontSize:'1.4rem'}}>
          {es ? 'Panel de moderación' : 'Moderation panel'}
        </h1>
        <span style={{background:'rgba(244,96,12,0.1)',color:'var(--orange)',borderRadius:20,padding:'3px 12px',fontSize:'.72rem',fontWeight:700}}>
          Moderador
        </span>
      </div>

      {msg && <div className="alert alert-success" style={{marginBottom:16}}>{msg}</div>}

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'2px solid var(--border)',flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'10px 18px',border:'none',background:'none',fontFamily:"'Syne',sans-serif",fontWeight:700,
              fontSize:'.85rem',cursor:'pointer',
              color:        tab===t.id ? 'var(--orange)' : 'var(--text-muted)',
              borderBottom: tab===t.id ? '2px solid var(--orange)' : '2px solid transparent',
              marginBottom: -2}}>
            {t.id === 'verificar'  ? (es ? 'Sin verificar'        : 'Unverified')  : ''}
            {t.id === 'empresas'   ? (es ? 'Empresas pendientes'  : 'Pending companies') : ''}
            {t.id === 'productos'  ? (es ? 'Productos pendientes' : 'Pending products') : ''}
            {t.id === 'actividad'  ? (es ? 'Mi actividad'         : 'My activity') : ''}
            {t.id==='verificar'  && sinVerificar.length > 0 && <span style={{marginLeft:6,background:'#d97706',color:'white',borderRadius:10,padding:'1px 6px',fontSize:'.65rem'}}>{sinVerificar.length}</span>}
            {t.id==='empresas'   && empresas.length    > 0 && <span style={{marginLeft:6,background:'var(--orange)',color:'white',borderRadius:10,padding:'1px 6px',fontSize:'.65rem'}}>{empresas.length}</span>}
            {t.id==='productos'  && productos.length   > 0 && <span style={{marginLeft:6,background:'var(--orange)',color:'white',borderRadius:10,padding:'1px 6px',fontSize:'.65rem'}}>{productos.length}</span>}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{textAlign:'center',padding:48,color:'var(--text-muted)'}}>Loading...</div>
        : tab === 'verificar'
          ? sinVerificar.length === 0
            ? <div style={{textAlign:'center',padding:48,color:'var(--text-muted)',fontSize:'.9rem'}}>
                ✅ {es ? 'No hay empresas pendientes de verificación.' : 'No companies pending verification.'}
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:'.78rem',color:'var(--text-muted)',marginBottom:4}}>
                  {es ? 'Visita la web de cada empresa y pulsa Verificar si confirmas que es un negocio real.'
                      : 'Visit each company\'s website and click Verify if you confirm it is a real business.'}
                </div>
                {sinVerificar.map(e => <TarjetaVerif key={e.id} e={e} />)}
              </div>

        : tab === 'empresas'
          ? empresas.length === 0
            ? <div style={{textAlign:'center',padding:48,color:'var(--text-muted)',fontSize:'.9rem'}}>
                {es ? 'No hay empresas pendientes.' : 'No pending companies.'}
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {empresas.map(e => (
                  <div key={e.id} style={{background:'white',border:'1px solid var(--border)',borderRadius:12,padding:'16px 20px',display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:4}}>{e.razon_social}</div>
                      <div style={{fontSize:'.78rem',color:'var(--text-muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
                        <span>NIF: {e.nif}</span><span>{e.email}</span><span>{fmt(e.created_at)}</span>
                      </div>
                      {e.web && <a href={e.web.startsWith('http')?e.web:'https://'+e.web} target="_blank" rel="noopener" style={{...btnVer,marginTop:8,fontSize:'.75rem'}}>🔗 {e.web.replace(/^https?:\/\//,'')}</a>}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button style={btnAprobar}  onClick={() => accionEmpresa(e, 'activa')}>{es?'Activar':'Activate'}</button>
                      <button style={btnRechazar} onClick={() => abrirRechazo(e)}>{es?'Rechazar':'Reject'}</button>
                    </div>
                  </div>
                ))}
              </div>

        : tab === 'productos'
          ? productos.length === 0
            ? <div style={{textAlign:'center',padding:48,color:'var(--text-muted)',fontSize:'.9rem'}}>
                {es ? 'No hay productos pendientes.' : 'No pending products.'}
              </div>
            : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {productos.map(p => (
                  <div key={p.id} style={{background:'white',border:'1px solid var(--border)',borderRadius:12,padding:'16px 20px',display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:4}}>{p.categorias?.icono} {p.nombre}</div>
                      <div style={{fontSize:'.78rem',color:'var(--text-muted)',display:'flex',gap:12,flexWrap:'wrap'}}>
                        <span>{p.empresas?.razon_social}</span><span>{p.categorias?.nombre}</span><span>{fmt(p.created_at)}</span>
                      </div>
                      {p.descripcion && <div style={{fontSize:'.78rem',color:'var(--text)',marginTop:6,lineHeight:1.5}}>{p.descripcion.slice(0,150)}{p.descripcion.length>150?'...':''}</div>}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button style={btnAprobar}  onClick={() => accionProducto(p, 'activo')}>{es?'Aprobar':'Approve'}</button>
                      <button style={btnRechazar} onClick={() => accionProducto(p, 'rechazado')}>{es?'Rechazar':'Reject'}</button>
                    </div>
                  </div>
                ))}
              </div>

        : actividad.length === 0
          ? <div style={{textAlign:'center',padding:48,color:'var(--text-muted)',fontSize:'.9rem'}}>
              {es ? 'Aún no has realizado acciones de moderación.' : 'No moderation actions yet.'}
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <div style={{fontSize:'.78rem',color:'var(--text-muted)',marginBottom:8}}>
                {es ? 'Últimas' : 'Last'} {actividad.length} {es ? 'acciones' : 'actions'}
              </div>
              {actividad.map(a => {
                const meta = a.metadata || {}
                const esPos = a.accion.includes('activar') || a.accion.includes('aprobar') || a.accion.includes('verificar')
                return (
                  <div key={a.id} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 16px',background:'white',border:'1px solid var(--border)',borderRadius:8}}>
                    <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem',fontWeight:700,flexShrink:0,
                      background: esPos?'rgba(5,150,105,0.1)':'rgba(220,38,38,0.08)',
                      color:      esPos?'#059669':'var(--danger)'}}>
                      {esPos?'✔':'✕'}
                    </div>
                    <div style={{flex:1,fontSize:'.82rem',color:'var(--navy)'}}>{labelAccion(a.accion, meta)}</div>
                    <div style={{fontSize:'.72rem',color:'var(--text-muted)',flexShrink:0,textAlign:'right'}}>
                      {fmtHora(a.created_at)}{a.ip && <div>{a.ip}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
      }
    </div>
  )
}
