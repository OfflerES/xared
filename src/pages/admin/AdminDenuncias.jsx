import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'

const ESTADO_COLOR = {
  pendiente:  { bg:'rgba(234,179,8,0.1)',  color:'#854d0e', border:'rgba(234,179,8,0.3)'  },
  aceptada:   { bg:'rgba(34,197,94,0.1)',  color:'#166534', border:'rgba(34,197,94,0.3)'  },
  rechazada:  { bg:'rgba(239,68,68,0.1)',  color:'#991b1b', border:'rgba(239,68,68,0.3)'  },
}

const MOTIVO_LABEL = {
  slug_inapropiado:    'URL/nombre inapropiado',
  contenido_ilegal:    'Contenido ilegal',
  empresa_falsa:       'Empresa falsa',
  producto_fraudulento:'Producto fraudulento',
  otro:                'Otro',
}

export default function AdminDenuncias() {
  const { user, empresa: myEmpresa } = useApp()
  const navigate = useNavigate()
  const [denuncias,   setDenuncias]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filtroEstado,setFiltroEstado]= useState('pendiente')
  const [selected,    setSelected]    = useState(null)
  const [resolucion,  setResolucion]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  useEffect(() => { cargar() }, [filtroEstado])

  const cargar = async () => {
    setLoading(true)
    let q = supabase.from('denuncias').select('*').order('created_at', { ascending: false })
    if (filtroEstado !== 'todas') q = q.eq('estado', filtroEstado)
    const { data } = await q
    setDenuncias(data || [])
    setLoading(false)
  }

  const abrirDetalle = (d) => { setSelected(d); setResolucion(d.resolucion || '') }

  const resolver = async (estado) => {
    if (!selected) return
    setSaving(true); setErr('')
    try {
      const { error } = await supabase.from('denuncias').update({
        estado,
        resolucion:   resolucion.trim() || null,
        resuelta_at:  new Date().toISOString(),
        resuelta_por: user.id,
      }).eq('id', selected.id)
      if (error) throw error
      setSelected(null)
      await cargar()
    } catch(e) {
      setErr('❌ ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const verReferencia = (d) => {
    if (d.tipo === 'empresa') window.open('/site/' + d.ref_id, '_blank')
    // para producto necesitamos el slug — por ahora abrimos por id
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'32px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)',margin:0}}>⚑ Denuncias</h2>
        <button onClick={() => navigate('/admin')}
          style={{padding:'8px 16px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>
          ← Panel admin
        </button>
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {['pendiente','aceptada','rechazada','todas'].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',fontSize:'.82rem',fontWeight:600,
              background: filtroEstado===e ? 'var(--navy)' : 'var(--cream-dark)',
              color: filtroEstado===e ? 'white' : 'var(--text)'}}>
            {e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>Cargando...</div>
      ) : denuncias.length === 0 ? (
        <div style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:'.9rem'}}>
          No hay denuncias {filtroEstado !== 'todas' ? filtroEstado + 's' : ''}.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {denuncias.map(d => {
            const ec = ESTADO_COLOR[d.estado] || ESTADO_COLOR.pendiente
            return (
              <div key={d.id} onClick={() => abrirDetalle(d)}
                style={{background:'white',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',cursor:'pointer',
                  display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                    <span style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',
                      background: d.tipo==='empresa' ? 'rgba(37,99,235,0.1)' : 'rgba(244,96,12,0.1)',
                      color: d.tipo==='empresa' ? '#1d4ed8' : 'var(--orange)',
                      padding:'2px 8px',borderRadius:4}}>
                      {d.tipo}
                    </span>
                    <span style={{fontSize:'.8rem',fontWeight:600,color:'var(--navy)'}}>
                      {MOTIVO_LABEL[d.motivo] || d.motivo}
                    </span>
                  </div>
                  <div style={{fontSize:'.8rem',color:'var(--text-muted)',lineHeight:1.5}}>
                    {d.descripcion?.slice(0,120)}{d.descripcion?.length > 120 ? '...' : ''}
                  </div>
                  {d.email && <div style={{fontSize:'.75rem',color:'var(--text-muted)',marginTop:4}}>✉ {d.email}</div>}
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                  <span style={{fontSize:'.75rem',fontWeight:700,padding:'3px 10px',borderRadius:6,
                    background:ec.bg,color:ec.color,border:'1px solid '+ec.border}}>
                    {d.estado}
                  </span>
                  <span style={{fontSize:'.72rem',color:'var(--text-muted)'}}>
                    {new Date(d.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detalle modal */}
      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e => { if (e.target===e.currentTarget) setSelected(null) }}>
          <div style={{background:'white',borderRadius:14,padding:28,maxWidth:520,width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,0.18)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <strong style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)'}}>Detalle de denuncia</strong>
              <button onClick={() => setSelected(null)} style={{background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'var(--text-muted)'}}>✕</button>
            </div>

            {err && <div style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:8,padding:'8px 12px',fontSize:'.82rem',color:'#dc2626',marginBottom:12}}>{err}</div>}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px',marginBottom:16,fontSize:'.83rem'}}>
              <div><span style={{color:'var(--text-muted)'}}>Tipo:</span> <strong>{selected.tipo}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Estado:</span> <strong>{selected.estado}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Motivo:</span> <strong>{MOTIVO_LABEL[selected.motivo]}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Fecha:</span> {new Date(selected.created_at).toLocaleString('es-ES')}</div>
              {selected.email && <div style={{gridColumn:'1/-1'}}><span style={{color:'var(--text-muted)'}}>Email:</span> {selected.email}</div>}
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:'.78rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>Descripción</div>
              <div style={{background:'var(--cream)',borderRadius:8,padding:'10px 14px',fontSize:'.85rem',lineHeight:1.6}}>{selected.descripcion}</div>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:'.78rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>ID referencia</div>
              <div style={{fontFamily:'monospace',fontSize:'.8rem',color:'var(--navy)',wordBreak:'break-all'}}>{selected.ref_id}</div>
              <button onClick={() => verReferencia(selected)}
                style={{marginTop:8,padding:'6px 12px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',fontSize:'.78rem',fontWeight:600}}>
                Ver {selected.tipo} →
              </button>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:'.78rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>
                Resolución / Nota interna
              </label>
              <textarea value={resolucion} onChange={e=>setResolucion(e.target.value)} rows={3}
                placeholder="Describe la acción tomada..."
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:'.85rem',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}} />
            </div>

            {selected.estado === 'pendiente' && (
              <div style={{display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap'}}>
                <button onClick={() => setSelected(null)}
                  style={{padding:'9px 16px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
                  Cancelar
                </button>
                <button onClick={() => resolver('rechazada')} disabled={saving}
                  style={{padding:'9px 16px',background:'rgba(239,68,68,0.1)',color:'#991b1b',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
                  Rechazar denuncia
                </button>
                <button onClick={() => resolver('aceptada')} disabled={saving}
                  style={{padding:'9px 16px',background:'var(--navy)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
                  {saving ? 'Guardando...' : 'Aceptar denuncia'}
                </button>
              </div>
            )}
            {selected.estado !== 'pendiente' && (
              <div style={{textAlign:'right'}}>
                <button onClick={() => setSelected(null)}
                  style={{padding:'9px 18px',background:'var(--navy)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
