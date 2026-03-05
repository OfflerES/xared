import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function MensajesSection({ empresa }) {
  const [mensajes, setMensajes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  useEffect(() => { load() }, [empresa?.id])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('mensajes')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('verificado', true)
      .order('created_at', { ascending: false })
    setMensajes(data || [])
    setLoading(false)
  }

  const marcarLeido = async (id) => {
    await supabase.from('mensajes').update({ leido: true }).eq('id', id)
    setMensajes(p => p.map(m => m.id === id ? {...m, leido: true} : m))
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este mensaje? No se puede deshacer.')) return
    await supabase.from('mensajes').delete().eq('id', id)
    setMensajes(p => p.filter(m => m.id !== id))
  }

  const noLeidos = mensajes.filter(m => !m.leido).length
  const fmt = (ts) => new Date(ts).toLocaleString('es-ES', { dateStyle:'short', timeStyle:'short' })

  return (
    <div className="dash-section">
      <div className="dash-section-title">
        Buzón de mensajes
        {noLeidos > 0 && (
          <span style={{marginLeft:10,background:'var(--orange)',color:'white',borderRadius:20,padding:'2px 10px',fontSize:'.72rem',fontWeight:700}}>
            {noLeidos} nuevo{noLeidos > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{background:'var(--cream)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:'.82rem',color:'var(--text-muted)',display:'flex',gap:16,flexWrap:'wrap'}}>
        <span>📨 {mensajes.length}/5 mensajes</span>
        <span>· Capacidad máxima: 5 mensajes por remitente</span>
        <span>· Solo se muestran mensajes verificados</span>
      </div>

      {loading
        ? <div style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>Cargando...</div>
        : mensajes.length === 0
          ? <div style={{textAlign:'center',padding:32,color:'var(--text-muted)',fontSize:'.85rem'}}>
              No tienes mensajes verificados aún.
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {mensajes.map(m => (
                <div key={m.id} style={{background: m.leido ? 'white' : 'rgba(244,96,12,0.04)', border: '1px solid ' + (m.leido ? 'var(--border)' : 'rgba(244,96,12,0.25)'), borderRadius:10, padding:16, position:'relative'}}>
                  {!m.leido && (
                    <span style={{position:'absolute',top:12,right:12,background:'var(--orange)',color:'white',fontSize:'.65rem',fontWeight:700,padding:'2px 8px',borderRadius:10}}>
                      NUEVO
                    </span>
                  )}
                  <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:8}}>
                    <span style={{fontWeight:700,fontSize:'.85rem',color:'var(--navy)'}}>✉ {m.remitente_email}</span>
                    <span style={{fontSize:'.75rem',color:'var(--text-muted)',marginLeft:'auto',paddingRight: m.leido ? 0 : 60}}>{fmt(m.created_at)}</span>
                  </div>
                  <p style={{fontSize:'.88rem',color:'var(--text)',lineHeight:1.6,margin:'0 0 12px'}}>{m.contenido}</p>
                  <div style={{display:'flex',gap:8}}>
                    {!m.leido && (
                      <button onClick={() => marcarLeido(m.id)}
                        style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:6,background:'white',fontSize:'.78rem',cursor:'pointer',color:'var(--text-muted)'}}>
                        ✓ Marcar leído
                      </button>
                    )}
                    <a href={`mailto:${m.remitente_email}`}
                      style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:6,background:'white',fontSize:'.78rem',cursor:'pointer',color:'var(--navy)',textDecoration:'none'}}>
                      ↩ Responder
                    </a>
                    <button onClick={() => eliminar(m.id)}
                      style={{padding:'5px 12px',border:'1px solid rgba(220,38,38,0.2)',borderRadius:6,background:'rgba(220,38,38,0.04)',fontSize:'.78rem',cursor:'pointer',color:'var(--danger)',marginLeft:'auto'}}>
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  )
}
