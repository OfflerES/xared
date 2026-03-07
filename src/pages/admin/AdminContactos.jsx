import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ESTADO_COLOR = {
  pendiente:   { bg:'rgba(234,179,8,0.1)',  color:'#854d0e', border:'rgba(234,179,8,0.3)'  },
  visto:       { bg:'rgba(96,165,250,0.1)', color:'#1d4ed8', border:'rgba(96,165,250,0.3)' },
  contestado:  { bg:'rgba(34,197,94,0.1)',  color:'#166534', border:'rgba(34,197,94,0.3)'  },
  cerrado:     { bg:'rgba(107,114,128,0.1)','color':'#374151', border:'rgba(107,114,128,0.3)' },
}

export default function AdminContactos() {
  const [mensajes,  setMensajes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filtro,    setFiltro]    = useState('pendiente')
  const [selected,  setSelected]  = useState(null)
  const [respuesta, setRespuesta] = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { cargar() }, [filtro])

  const cargar = async () => {
    setLoading(true)
    let q = supabase.from('contactos_admin').select('*').order('created_at', { ascending: true })
    if (filtro !== 'todos') q = q.eq('estado', filtro)
    const { data } = await q
    setMensajes(data || [])
    setLoading(false)
  }

  const abrir = async (m) => {
    setSelected(m)
    setRespuesta(m.respuesta || '')
    // Marcar como visto si estaba pendiente
    if (m.estado === 'pendiente') {
      await supabase.from('contactos_admin').update({ estado:'visto', updated_at: new Date().toISOString() }).eq('id', m.id)
      setMensajes(p => p.map(x => x.id===m.id ? {...x, estado:'visto'} : x))
    }
  }

  const cambiarEstado = async (estado) => {
    if (!selected) return
    setSaving(true)
    const updates: Record<string, unknown> = { estado, updated_at: new Date().toISOString() }
    if (respuesta.trim()) {
      updates.respuesta     = respuesta.trim()
      updates.respondido_at = new Date().toISOString()
      if (estado === 'visto') updates.estado = 'contestado'
    }
    await supabase.from('contactos_admin').update(updates).eq('id', selected.id)
    setMensajes(p => p.map(x => x.id===selected.id ? {...x, ...updates} : x))
    setSelected(null)
    setSaving(false)
  }

  const pendientes = mensajes.filter(m => m.estado === 'pendiente').length

  return (
    <div>
      {/* Filtros */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        {['pendiente','visto','contestado','cerrado','todos'].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',fontSize:'.82rem',fontWeight:600,
              background: filtro===e ? 'var(--navy)' : 'var(--cream-dark)',
              color: filtro===e ? 'white' : 'var(--text)',
              position: 'relative'}}>
            {e.charAt(0).toUpperCase()+e.slice(1)}
            {e === 'pendiente' && pendientes > 0 && (
              <span style={{position:'absolute',top:-6,right:-6,background:'var(--danger)',color:'white',borderRadius:'50%',width:18,height:18,fontSize:'.65rem',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>Cargando...</div>
      ) : mensajes.length === 0 ? (
        <div style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:'.9rem'}}>
          No hay mensajes {filtro !== 'todos' ? filtro+'s' : ''}.
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {mensajes.map(m => {
            const ec = ESTADO_COLOR[m.estado] || ESTADO_COLOR.pendiente
            return (
              <div key={m.id} onClick={() => abrir(m)}
                style={{background:'white',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',cursor:'pointer',
                  display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',
                  boxShadow: m.estado==='pendiente' ? '0 2px 8px rgba(234,179,8,0.15)' : '0 1px 4px rgba(0,0,0,0.04)'}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                    <strong style={{fontSize:'.88rem',color:'var(--navy)'}}>{m.nombre}</strong>
                    <span style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{m.email}</span>
                  </div>
                  <div style={{fontSize:'.85rem',fontWeight:600,color:'var(--text)',marginBottom:4}}>{m.asunto}</div>
                  <div style={{fontSize:'.78rem',color:'var(--text-muted)',lineHeight:1.5}}>
                    {m.mensaje.slice(0,100)}{m.mensaje.length>100?'...':''}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                  <span style={{fontSize:'.75rem',fontWeight:700,padding:'3px 10px',borderRadius:6,
                    background:ec.bg,color:ec.color,border:'1px solid '+ec.border}}>
                    {m.estado}
                  </span>
                  <span style={{fontSize:'.72rem',color:'var(--text-muted)'}}>
                    {new Date(m.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e => { if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{background:'white',borderRadius:14,padding:28,maxWidth:560,width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,0.18)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <strong style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)'}}>{selected.asunto}</strong>
              <button onClick={() => setSelected(null)} style={{background:'none',border:'none',fontSize:'1.2rem',cursor:'pointer',color:'var(--text-muted)'}}>✕</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',marginBottom:16,fontSize:'.83rem'}}>
              <div><span style={{color:'var(--text-muted)'}}>De:</span> <strong>{selected.nombre}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Email:</span> <a href={'mailto:'+selected.email} style={{color:'var(--orange)'}}>{selected.email}</a></div>
              <div><span style={{color:'var(--text-muted)'}}>Fecha:</span> {new Date(selected.created_at).toLocaleString('es-ES')}</div>
              <div><span style={{color:'var(--text-muted)'}}>Estado:</span> <strong>{selected.estado}</strong></div>
            </div>

            <div style={{background:'var(--cream)',borderRadius:8,padding:'12px 16px',fontSize:'.88rem',lineHeight:1.7,marginBottom:20}}>
              {selected.mensaje}
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:'.78rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>
                Respuesta / Nota interna
              </label>
              <textarea value={respuesta} onChange={e=>setRespuesta(e.target.value)} rows={4}
                placeholder="Escribe tu respuesta o nota..."
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:'.85rem',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}} />
              <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:4}}>
                💡 La respuesta se guarda internamente. Para responder al usuario usa el enlace de email de arriba.
              </div>
            </div>

            <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
              <button onClick={() => setSelected(null)}
                style={{padding:'8px 16px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>
                Cerrar
              </button>
              <button onClick={() => cambiarEstado('visto')} disabled={saving}
                style={{padding:'8px 16px',background:'rgba(96,165,250,0.1)',color:'#1d4ed8',border:'1px solid rgba(96,165,250,0.3)',borderRadius:8,cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>
                Marcar visto
              </button>
              <button onClick={() => cambiarEstado('contestado')} disabled={saving}
                style={{padding:'8px 16px',background:'rgba(34,197,94,0.1)',color:'#166534',border:'1px solid rgba(34,197,94,0.3)',borderRadius:8,cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>
                {saving ? 'Guardando...' : 'Contestado ✓'}
              </button>
              <button onClick={() => cambiarEstado('cerrado')} disabled={saving}
                style={{padding:'8px 16px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:'.82rem',fontWeight:600}}>
                Cerrar ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
