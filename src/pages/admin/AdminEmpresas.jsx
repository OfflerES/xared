import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const MOTIVOS_PRESET = [
  { es: 'La web indicada no existe o no responde',        en: 'The provided website does not exist or does not respond' },
  { es: 'La web no corresponde a la empresa registrada',  en: 'The website does not match the registered company' },
  { es: 'El país indicado no coincide con la empresa',    en: "The country doesn't match the company" },
  { es: 'Información insuficiente para verificar',        en: 'Insufficient information to verify' },
  { es: 'Posible duplicado de otra empresa',              en: 'Possible duplicate of another company' },
  { es: 'Enlace incorrecto o roto',                       en: 'Wrong or broken link' },
]

const PLANES = ['gratuito','basico','profesional','maximo']

export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState([])
  const [filtro,   setFiltro]   = useState('todas')
  const [rechazando, setRechazando] = useState(null)
  const [motivo,     setMotivo]     = useState('')
  const [enviando,   setEnviando]   = useState(false)
  const [verif,    setVerif]    = useState('todas')   // todas | verificadas | pendientes
  const [origen,   setOrigen]   = useState('todas')

  useEffect(() => { load() }, [filtro, verif, origen])

  const load = async () => {
    let q = supabase.from('empresas').select('*').order('created_at', { ascending: false })
    if (filtro !== 'todas')    q = q.eq('estado', filtro)
    if (verif  === 'verificadas') q = q.eq('verificada', true)
    if (verif  === 'pendientes')  q = q.eq('verificada', false)
    if (origen === 'spain') q = q.eq('pais', 'ES')
    if (origen === 'latam') q = q.neq('pais', 'ES')
    const { data } = await q
    setEmpresas(data || [])
  }

  const cambiarEstado = async (id, estado) => {
    await supabase.from('empresas').update({ estado }).eq('id', id)
    setEmpresas(p => p.map(e => e.id===id ? {...e, estado} : e))
  }

  const cambiarPlan = async (id, plan) => {
    const expiraAt = plan !== 'gratuito'
      ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
      : null
    const updates = {
      plan,
      max_productos_override: null,
      plan_status:   plan !== 'gratuito' ? 'active' : null,
      plan_expira_at: expiraAt,
    }
    await supabase.from('empresas').update(updates).eq('id', id)
    setEmpresas(p => p.map(e => e.id===id ? {...e, ...updates} : e))
  }

  const verificar = async (id) => {
    await supabase.from('empresas').update({ verificada: true, verificacion_metodo: 'manual_admin' }).eq('id', id)
    setEmpresas(p => p.map(e => e.id===id ? {...e, verificada: true, verificacion_metodo: 'manual_admin'} : e))
  }

  const desverificar = async (id) => {
    await supabase.from('empresas').update({ verificada: false, verificacion_metodo: null }).eq('id', id)
    setEmpresas(p => p.map(e => e.id===id ? {...e, verificada: false, verificacion_metodo: null} : e))
  }

  const abrirRechazo = (empresa) => { setRechazando(empresa); setMotivo('') }

  const confirmarRechazo = async () => {
    if (!motivo.trim()) return
    setEnviando(true)
    try {
      await supabase.from('empresas').update({ estado: 'bloqueada', verificacion_metodo: null }).eq('id', rechazando.id)
      await supabase.functions.invoke('enviar-rechazo', {
        body: { email: rechazando.email, razon_social: rechazando.razon_social, motivo, lang: 'es' }
      })
      setEmpresas(p => p.filter(e => e.id !== rechazando.id))
    } finally {
      setEnviando(false); setRechazando(null); setMotivo('')
    }
  }

  const estadoColor = { activa:'var(--success)', pendiente:'#d97706', bloqueada:'var(--danger)' }

  const metodoBadge = (m) => {
    if (!m) return { text:'⏳ Pendiente', color:'#d97706', bg:'#fef3c7' }
    if (m === 'auto_dominio')   return { text:'🤖 Auto', color:'#059669', bg:'#dcfce7' }
    if (m === 'auto_cupon_as')  return { text:'🎟 Cupón AS', color:'#2563eb', bg:'#dbeafe' }
    if (m === 'manual_admin')   return { text:'👤 Manual', color:'#7c3aed', bg:'#ede9fe' }
    return { text: m, color:'var(--text-muted)', bg:'var(--cream)' }
  }

  // Empresas sin verificar ordenadas primero en la vista "pendientes"
  const pendientesVerif = empresas.filter(e => !e.verificada)

  return (
    <div>
      {/* Modal rechazo con motivo */}
      {rechazando && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'white',borderRadius:16,padding:28,maxWidth:500,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',marginBottom:6,fontSize:'1.1rem'}}>Rechazar empresa</h3>
            <p style={{fontSize:'.85rem',color:'var(--text-muted)',marginBottom:16}}><strong>{rechazando.razon_social}</strong> · {rechazando.email}</p>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
              {MOTIVOS_PRESET.map((m, i) => (
                <button key={i} onClick={() => setMotivo(m.es)}
                  style={{textAlign:'left',padding:'8px 12px',borderRadius:8,border:'1px solid',fontSize:'.8rem',cursor:'pointer',
                    borderColor: motivo===m.es ? 'var(--orange)' : 'var(--border)',
                    background:  motivo===m.es ? 'rgba(244,96,12,0.06)' : 'white',
                    color:       motivo===m.es ? 'var(--orange)' : 'var(--text)',
                    fontWeight:  motivo===m.es ? 600 : 400}}>
                  {m.es}
                </button>
              ))}
            </div>
            <textarea value={motivo} onChange={e=>setMotivo(e.target.value)}
              placeholder="O escribe un motivo personalizado..." rows={2}
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:'.85rem',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',marginBottom:12}} />
            <p style={{fontSize:'.75rem',color:'var(--text-muted)',marginBottom:16}}>📧 Se enviará un email a <strong>{rechazando.email}</strong> con este motivo.</p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setRechazando(null)} style={{padding:'9px 18px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:'pointer',fontSize:'.8rem'}}>Cancelar</button>
              <button onClick={confirmarRechazo} disabled={!motivo.trim()||enviando}
                style={{padding:'9px 18px',border:'none',borderRadius:6,background:'rgba(220,38,38,0.08)',color:'var(--danger)',fontSize:'.8rem',fontWeight:700,cursor:'pointer',opacity:!motivo.trim()||enviando?0.5:1}}>
                {enviando?'...':'✕ Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Alerta pendientes de revisión manual */}
      {verif !== 'verificadas' && pendientesVerif.length > 0 && (
        <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:'1.3rem'}}>⏳</span>
          <div>
            <div style={{fontWeight:700,color:'#92400e',fontSize:'.88rem'}}>
              {pendientesVerif.length} empresa{pendientesVerif.length>1?'s':''} pendiente{pendientesVerif.length>1?'s':''} de verificación manual
            </div>
            <div style={{fontSize:'.75rem',color:'#b45309',marginTop:2}}>
              Revisa su web y usa el botón "Verificar" para cada una.
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:4}}>
          {['todas','activa','pendiente','bloqueada'].map(f => (
            <button key={f} className={"admin-filter-btn" + (filtro===f?' active':'')} onClick={() => setFiltro(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{width:1,height:20,background:'var(--border)'}} />
        <div style={{display:'flex',gap:4}}>
          {[['todas','Todas'],['pendientes','⏳ Sin verificar'],['verificadas','✔ Verificadas']].map(([k,l]) => (
            <button key={k} className={"admin-filter-btn" + (verif===k?' active':'')} onClick={() => setVerif(k)}
              style={verif===k && k==='pendientes' ? {borderColor:'#d97706',color:'#d97706'} : {}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{flex:1}} />
        {['todas','spain','latam'].map(o => (
          <button key={o} className={"admin-filter-btn" + (origen===o?' active':'')} onClick={() => setOrigen(o)} style={{fontSize:'.75rem'}}>
            {o==='todas'?'🌍 Todas':o==='spain'?'🇪🇸 España':'🌎 LATAM'}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 90px 80px 120px 1fr',gap:10,padding:'10px 16px',background:'var(--cream-dark)',fontSize:'.71rem',fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)'}}>
          <span>Empresa</span><span>Plan</span><span>Estado</span><span>Verificación</span><span>Acciones</span>
        </div>

        {empresas.map(e => {
          const mb = metodoBadge(e.verificacion_metodo)
          return (
            <div key={e.id} style={{display:'grid',gridTemplateColumns:'1fr 90px 80px 120px 1fr',gap:10,alignItems:'start',padding:'12px 16px',borderTop:'1px solid var(--cream-dark)'}}>

              {/* Empresa */}
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.85rem'}}>
                  {e.razon_social}
                </div>
                <div style={{color:'var(--text-muted)',fontSize:'.72rem',marginTop:2}}>{e.nif} · {e.email}</div>
                {e.web && (
                  <a href={e.web.startsWith('http')?e.web:'https://'+e.web} target="_blank" rel="noopener"
                    style={{fontSize:'.72rem',color:'var(--orange)',display:'inline-flex',alignItems:'center',gap:3,marginTop:2}}>
                    🔗 {e.web.replace(/^https?:\/\//,'')}
                  </a>
                )}
                {!e.web && !e.verificada && (
                  <div style={{fontSize:'.7rem',color:'#d97706',marginTop:2}}>⚠ Sin web declarada</div>
                )}
                <div style={{color:'var(--text-muted)',fontSize:'.7rem',marginTop:1}}>{e.sector}{e.provincia?' · '+e.provincia:''}</div>
              </div>

              {/* Plan */}
              <div>
                <select value={e.plan} onChange={ev => cambiarPlan(e.id, ev.target.value)}
                  style={{border:'1px solid var(--border)',borderRadius:6,padding:'3px 6px',fontSize:'.75rem',background:'white',width:'100%'}}>
                  {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Estado */}
              <div>
                <span style={{fontSize:'.75rem',fontWeight:600,color:estadoColor[e.estado]||'var(--text-muted)'}}>
                  {e.estado}
                </span>
              </div>

              {/* Verificación */}
              <div>
                <span style={{fontSize:'.7rem',fontWeight:600,padding:'2px 8px',borderRadius:10,background:mb.bg,color:mb.color,whiteSpace:'nowrap'}}>
                  {mb.text}
                </span>
              </div>

              {/* Acciones */}
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {/* Verificación manual */}
                {!e.verificada ? (
                  <button className="admin-btn admin-btn-approve" onClick={() => verificar(e.id)}
                    title="Marcar como verificada manualmente">
                    ✔ Verificar
                  </button>
                ) : (
                  <button className="admin-btn admin-btn-edit" onClick={() => desverificar(e.id)}
                    title="Retirar verificación" style={{fontSize:'.7rem'}}>
                    ✕ Desverificar
                  </button>
                )}
                {/* Ver perfil público */}
                {e.slug && (
                  <a href={'/site/'+e.slug} target="_blank" rel="noopener" className="admin-btn admin-btn-edit"
                    style={{textDecoration:'none',textAlign:'center'}}>
                    👁
                  </a>
                )}
                {/* Estado */}
                {e.estado !== 'activa'    && <button className="admin-btn admin-btn-approve" onClick={() => cambiarEstado(e.id,'activa')}>Activar</button>}
                {e.estado !== 'bloqueada' && <button className="admin-btn admin-btn-block"   onClick={() => cambiarEstado(e.id,'bloqueada')}>Bloquear</button>}
              </div>
            </div>
          )
        })}

        {!empresas.length && (
          <div style={{padding:24,textAlign:'center',color:'var(--text-muted)',fontSize:'.85rem'}}>
            No hay empresas con este filtro.
          </div>
        )}
      </div>
    </div>
  )
}
