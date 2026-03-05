import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ACCION_ICON = {
  login:                     'L',
  guardar_perfil:            'G',
  nuevo_producto:            'P',
  editar_producto:           'E',
  eliminar_producto:         'X',
  subir_banner:              'B',
  solicitar_campana:         'C',
  moderar_empresa_activar:   'ok',
  moderar_empresa_rechazar:  'no',
  moderar_producto_aprobar:  'ok',
  moderar_producto_rechazar: 'no',
}

export default function AdminAudit() {
  const [logs,   setLogs]   = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [filtro])

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('audit_log')
      .select('*, empresas(razon_social)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (filtro !== 'todos') q = q.eq('tipo', filtro)

    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }

  const filtrados = logs.filter(l => {
    if (!buscar.trim()) return true
    const term = buscar.toLowerCase()
    return (
      l.accion?.toLowerCase().includes(term) ||
      l.ip?.includes(term) ||
      l.empresas?.razon_social?.toLowerCase().includes(term) ||
      l.metadata?.email?.toLowerCase().includes(term) ||
      l.metadata?.nombre?.toLowerCase().includes(term)
    )
  })

  const fmt = (ts) => new Date(ts).toLocaleString('es-ES', { dateStyle:'short', timeStyle:'short' })

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)'}}>Registro de actividad</h3>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {['todos','login','accion'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{padding:'5px 14px',borderRadius:6,border:'1px solid var(--border)',background:filtro===f?'var(--navy)':'white',color:filtro===f?'white':'var(--text-muted)',fontSize:'.78rem',fontWeight:600,cursor:'pointer'}}>
              {f === 'todos' ? 'Todos' : f === 'login' ? '🔐 Logins' : '⚙ Acciones'}
            </button>
          ))}
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar empresa, IP, acción..."
            style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:6,fontSize:'.82rem',minWidth:200}}
          />
          <button onClick={load} style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:6,fontSize:'.82rem',cursor:'pointer',background:'white'}}>
            🔄
          </button>
        </div>
      </div>

      {loading
        ? <div style={{textAlign:'center',padding:32,color:'var(--text-muted)'}}>Cargando...</div>
        : <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'90px 110px 1fr 120px 100px',background:'var(--cream-dark)',padding:'8px 14px',fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',gap:8}}>
              <span>Tipo</span><span>Acción</span><span>Empresa / Email</span><span>IP</span><span>Fecha</span>
            </div>
            {filtrados.length === 0
              ? <div style={{textAlign:'center',padding:24,color:'var(--text-muted)',fontSize:'.85rem'}}>Sin registros</div>
              : filtrados.map(l => (
                <div key={l.id} style={{display:'grid',gridTemplateColumns:'90px 110px 1fr 120px 100px',padding:'10px 14px',borderBottom:'1px solid var(--cream-dark)',fontSize:'.82rem',gap:8,alignItems:'center'}}>
                  <span style={{padding:'2px 8px',borderRadius:4,fontSize:'.72rem',fontWeight:700,background:l.tipo==='login'?'rgba(37,99,235,0.1)':'rgba(244,96,12,0.1)',color:l.tipo==='login'?'#2563EB':'var(--orange)'}}>
                    {l.tipo === 'login' ? '🔐 Login' : '⚙ Acción'}
                  </span>
                  <span style={{color:'var(--navy)',fontWeight:500}}>
                    {ACCION_ICON[l.accion] || '·'} {l.accion?.replace(/_/g,' ')}
                  </span>
                  <span style={{color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {l.empresas?.razon_social || l.metadata?.email || '—'}
                    {l.metadata?.nombre && <span style={{color:'var(--text-muted)',marginLeft:6}}>· {l.metadata.nombre}</span>}
                  </span>
                  <span style={{color:'var(--text-muted)',fontFamily:'monospace',fontSize:'.78rem'}}>{l.ip || '—'}</span>
                  <span style={{color:'var(--text-muted)',fontSize:'.78rem'}}>{fmt(l.created_at)}</span>
                </div>
              ))
            }
          </div>
      }
      <div style={{marginTop:10,fontSize:'.75rem',color:'var(--text-muted)'}}>
        Se conservan los últimos 3 logins y las últimas 10 acciones por usuario · {filtrados.length} registros mostrados
      </div>
    </div>
  )
}
