import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminModeradores() {
  const [moderadores, setModeradores] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [emailNuevo,  setEmailNuevo]  = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [err,         setErr]         = useState('')
  const [ok,          setOk]          = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('moderadores')
      .select('id,nombre,activo,created_at,user_id,auth_users:user_id(email)')
      .order('created_at', { ascending: false })
    setModeradores(data || [])
    setLoading(false)
  }

  const addModerador = async () => {
    setErr(''); setOk('')
    if (!emailNuevo.trim()) { setErr('Introduce un email.'); return }

    // Buscar el user_id por email en auth.users via RPC o en empresas
    const { data: emp } = await supabase
      .from('empresas')
      .select('user_id,razon_social')
      .eq('email', emailNuevo.toLowerCase().trim())
      .maybeSingle()

    if (!emp) { setErr('No se encontro ningun usuario registrado con ese email.'); return }

    const { error } = await supabase.from('moderadores').insert({
      user_id: emp.user_id,
      nombre:  nombreNuevo.trim() || emp.razon_social || emailNuevo,
      activo:  true,
    })

    if (error) {
      if (error.code === '23505') setErr('Este usuario ya es moderador.')
      else setErr('Error: ' + error.message)
      return
    }

    setOk('Moderador creado. En el proximo login tendra acceso al panel.')
    setEmailNuevo('')
    setNombreNuevo('')
    load()
  }

  const toggleActivo = async (id, activo) => {
    await supabase.from('moderadores').update({ activo: !activo }).eq('id', id)
    setModeradores(p => p.map(m => m.id === id ? {...m, activo: !activo} : m))
  }

  const eliminar = async (id) => {
    if (!confirm('Eliminar este moderador?')) return
    await supabase.from('moderadores').delete().eq('id', id)
    setModeradores(p => p.filter(m => m.id !== id))
  }

  const fmt = (ts) => new Date(ts).toLocaleDateString('es-ES')

  return (
    <div>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:20,fontSize:'1.05rem'}}>
        Moderadores
      </h2>

      {/* Formulario nuevo moderador */}
      <div style={{background:'var(--cream)',border:'1px solid var(--border)',borderRadius:12,padding:20,marginBottom:28}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:12,fontSize:'.9rem'}}>
          Asignar nuevo moderador
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:200}}>
            <label style={{fontSize:'.78rem',color:'var(--text-muted)',display:'block',marginBottom:4}}>Email del usuario (debe estar registrado en Xared)</label>
            <input className="form-control" type="email" value={emailNuevo}
              onChange={e => setEmailNuevo(e.target.value)}
              placeholder="usuario@ejemplo.com"
              onKeyDown={e => e.key === 'Enter' && addModerador()} />
          </div>
          <div style={{flex:1,minWidth:160}}>
            <label style={{fontSize:'.78rem',color:'var(--text-muted)',display:'block',marginBottom:4}}>Nombre (opcional)</label>
            <input className="form-control" value={nombreNuevo}
              onChange={e => setNombreNuevo(e.target.value)}
              placeholder="Ej: Maria Garcia" />
          </div>
          <button onClick={addModerador}
            style={{padding:'10px 20px',background:'var(--orange)',color:'white',border:'none',borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
            Asignar moderador
          </button>
        </div>
        {err && <div className="alert alert-error"   style={{marginTop:10}}>{err}</div>}
        {ok  && <div className="alert alert-success" style={{marginTop:10}}>{ok}</div>}
        <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:8,lineHeight:1.5}}>
          El usuario debe tener una cuenta activa en Xared. Al asignarlo podra acceder a /moderador para validar empresas y productos.
        </div>
      </div>

      {/* Lista de moderadores */}
      {loading
        ? <div style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Cargando...</div>
        : moderadores.length === 0
          ? <div style={{textAlign:'center',padding:32,color:'var(--text-muted)',fontSize:'.9rem'}}>No hay moderadores asignados.</div>
          : <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {moderadores.map(m => (
                <div key={m.id} style={{background:'white',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background: m.activo ? 'rgba(5,150,105,0.1)' : 'var(--cream)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>
                    {m.activo ? 'ok' : 'off'}
                  </div>
                  <div style={{flex:1,minWidth:150}}>
                    <div style={{fontWeight:700,color:'var(--navy)',fontSize:'.9rem'}}>{m.nombre || 'Sin nombre'}</div>
                    <div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>
                      Desde {fmt(m.created_at)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{padding:'3px 10px',borderRadius:12,fontSize:'.72rem',fontWeight:700,background: m.activo ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)',color: m.activo ? '#059669' : 'var(--text-muted)'}}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <button onClick={() => toggleActivo(m.id, m.activo)}
                      style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:6,background:'white',fontSize:'.75rem',cursor:'pointer',color:'var(--navy)'}}>
                      {m.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => eliminar(m.id)}
                      style={{padding:'5px 12px',border:'1px solid rgba(220,38,38,0.2)',borderRadius:6,background:'rgba(220,38,38,0.05)',fontSize:'.75rem',cursor:'pointer',color:'var(--danger)'}}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  )
}
