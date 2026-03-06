import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ESTADO_BADGE = {
  pendiente: { bg:'#fef3c7', color:'#d97706' },
  aprobada:  { bg:'#dcfce7', color:'#16a34a' },
  rechazada: { bg:'#fee2e2', color:'#dc2626' },
  pausada:   { bg:'#f3f4f6', color:'#6b7280' },
  agotada:   { bg:'#f3f4f6', color:'#6b7280' },
}

export default function AdminPublicidad() {
  const [campanas,       setCampanas]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filtroEstado,   setFiltroEstado]   = useState('pendiente')
  const [motivoRechazo,  setMotivoRechazo]  = useState({})  // { [id]: texto }
  const [procesando,     setProcesando]     = useState(null)
  const [ok,             setOk]             = useState('')
  const [err,            setErr]            = useState('')

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('campanas')
      .select('*')
      .order('created_at', { ascending: false })

    if (filtroEstado !== 'todas') q = q.eq('estado', filtroEstado)

    const { data: camps } = await q
    if (!camps) { setCampanas([]); setLoading(false); return }

    // Cargar datos de empresas por separado
    const empresaIds = [...new Set(camps.map(c => c.empresa_id).filter(Boolean))]
    let empresaMap = {}
    if (empresaIds.length > 0) {
      const { data: emps } = await supabase
        .from('empresas')
        .select('id, razon_social, email, verificada')
        .in('id', empresaIds)
      ;(emps || []).forEach(e => empresaMap[e.id] = e)
    }

    setCampanas(camps.map(c => ({ ...c, empresas: empresaMap[c.empresa_id] || null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [filtroEstado])

  const aprobar = async (c) => {
    setProcesando(c.id); setOk(''); setErr('')
    const { error } = await supabase.from('campanas').update({
      estado:       'aprobada',
      estado_motivo: null,
      revisado_at:  new Date().toISOString(),
      activo:       true,
      updated_at:   new Date().toISOString(),
    }).eq('id', c.id)

    // Actualizar también empresas.banner_estado
    if (!error) {
      await supabase.from('empresas').update({
        banner_estado: 'aprobado',
        banner_rechazo: null,
      }).eq('id', c.empresa_id)
      setOk(`Banner de ${c.empresas?.razon_social} aprobado.`)
      load()
    } else {
      setErr('Error: ' + error.message)
    }
    setProcesando(null)
  }

  const rechazar = async (c) => {
    const motivo = motivoRechazo[c.id]?.trim()
    if (!motivo) {
      setErr('Debes indicar el motivo del rechazo.')
      return
    }
    setProcesando(c.id); setOk(''); setErr('')
    const { error } = await supabase.from('campanas').update({
      estado:        'rechazada',
      estado_motivo: motivo,
      revisado_at:   new Date().toISOString(),
      activo:        false,
      updated_at:    new Date().toISOString(),
    }).eq('id', c.id)

    if (!error) {
      await supabase.from('empresas').update({
        banner_estado:  'rechazado',
        banner_rechazo: motivo,
      }).eq('id', c.empresa_id)
      setOk(`Banner de ${c.empresas?.razon_social} rechazado.`)
      setMotivoRechazo(m => ({ ...m, [c.id]: '' }))
      load()
    } else {
      setErr('Error: ' + error.message)
    }
    setProcesando(null)
  }

  const toggleActivo = async (c) => {
    const nuevoEstado = c.estado === 'pausada' ? 'aprobada' : 'pausada'
    await supabase.from('campanas').update({
      estado:     nuevoEstado,
      activo:     nuevoEstado === 'aprobada',
      updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    load()
  }

  const pendientes = campanas.filter(c => c.estado === 'pendiente').length

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',margin:0}}>
          Campañas publicitarias
          {pendientes > 0 && (
            <span style={{marginLeft:10,background:'var(--orange)',color:'white',borderRadius:20,
                          padding:'2px 10px',fontSize:'.7rem',fontWeight:700}}>
              {pendientes} pendiente{pendientes > 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {/* Filtro */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['pendiente','aprobada','rechazada','pausada','agotada','todas'].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              style={{padding:'6px 14px',borderRadius:20,border:'1px solid var(--border)',
                      background: filtroEstado === e ? 'var(--navy)' : 'white',
                      color:      filtroEstado === e ? 'white' : 'var(--text-muted)',
                      fontSize:'.78rem',fontWeight:600,cursor:'pointer',
                      textTransform:'capitalize'}}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {ok  && <div className="alert alert-success" style={{marginBottom:16}}>{ok}</div>}
      {err && <div className="alert alert-error"   style={{marginBottom:16}}>{err}</div>}

      {loading && <div style={{color:'var(--text-muted)'}}>Cargando...</div>}

      {!loading && !campanas.length && (
        <p style={{color:'var(--text-muted)'}}>
          No hay campañas {filtroEstado !== 'todas' ? `con estado "${filtroEstado}"` : ''}.
        </p>
      )}

      {campanas.map(c => {
        const badge   = ESTADO_BADGE[c.estado] || ESTADO_BADGE.pausada
        const impPct  = c.impresiones_total
          ? Math.round(((c.impresiones_usadas||0) / c.impresiones_total) * 100)
          : 0

        return (
          <div key={c.id} style={{border:'1px solid var(--border)',borderRadius:12,
                                   padding:20,marginBottom:16,background:'white'}}>
            {/* Cabecera */}
            <div style={{display:'flex',justifyContent:'space-between',
                         alignItems:'start',flexWrap:'wrap',gap:8,marginBottom:14}}>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,
                             color:'var(--navy)',fontSize:'.95rem'}}>
                  {c.empresas?.razon_social}
                  {c.empresas?.verificada
                    ? <span style={{marginLeft:8,fontSize:'.7rem',color:'#16a34a',fontWeight:600}}>✓ Verificada</span>
                    : <span style={{marginLeft:8,fontSize:'.7rem',color:'#d97706',fontWeight:600}}>⚠ No verificada</span>
                  }
                </div>
                <div style={{fontSize:'.75rem',color:'var(--text-muted)',marginTop:2}}>
                  {c.empresas?.email} · Zona: <strong>{c.target_zona}</strong> · ID: {c.id}
                </div>
                <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:2}}>
                  Creada: {new Date(c.created_at).toLocaleDateString('es-ES')}
                  {c.revisado_at && ` · Revisada: ${new Date(c.revisado_at).toLocaleDateString('es-ES')}`}
                </div>
              </div>
              <span style={{fontSize:'.75rem',fontWeight:700,padding:'4px 12px',
                            borderRadius:20,background:badge.bg,color:badge.color,
                            textTransform:'capitalize'}}>
                {c.estado}
              </span>
            </div>

            {/* Banner */}
            {c.banner_url && (
              <div style={{marginBottom:14}}>
                <img src={c.banner_url} alt="Banner"
                  style={{width:'100%',maxWidth:728,height:90,objectFit:'cover',
                          borderRadius:8,border:'1px solid var(--border)'}} />
                <a href={c.url_destino} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:'.72rem',color:'var(--orange)',marginTop:4,display:'inline-block'}}>
                  {c.url_destino}
                </a>
              </div>
            )}

            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',
                         gap:8,marginBottom:14,fontSize:'.8rem'}}>
              {[
                ['Imp. total',  (c.impresiones_total||0).toLocaleString('es-ES')],
                ['Imp. usadas', (c.impresiones_usadas||0).toLocaleString('es-ES')],
                ['Restantes',   Math.max((c.impresiones_total||0)-(c.impresiones_usadas||0),0).toLocaleString('es-ES')],
                ['Clics',       (c.clics_total||0).toLocaleString('es-ES')],
                ['CTR',         c.impresiones_usadas ? (((c.clics_total||0)/c.impresiones_usadas)*100).toFixed(2)+'%' : '—'],
              ].map(([l,v]) => (
                <div key={l} style={{padding:'8px 12px',background:'var(--cream)',
                                     borderRadius:6,textAlign:'center'}}>
                  <div style={{fontWeight:700,color:'var(--navy)'}}>{v}</div>
                  <div style={{color:'var(--text-muted)',fontSize:'.7rem'}}>{l}</div>
                </div>
              ))}
            </div>

            {/* Barra progreso impresiones */}
            {c.impresiones_total > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:impPct+'%',
                               background: impPct > 80 ? '#dc2626' : impPct > 50 ? '#d97706' : '#16a34a',
                               borderRadius:3,transition:'width .4s'}} />
                </div>
                <div style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:4}}>
                  {impPct}% de impresiones usadas
                </div>
              </div>
            )}

            {/* Acciones según estado */}
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start'}}>

              {/* Pendiente — aprobar o rechazar */}
              {c.estado === 'pendiente' && (
                <>
                  <button
                    onClick={() => aprobar(c)}
                    disabled={procesando === c.id}
                    style={{padding:'8px 20px',borderRadius:8,border:'none',
                            background:'#16a34a',color:'white',fontWeight:700,
                            fontSize:'.85rem',cursor:'pointer'}}>
                    {procesando === c.id ? 'Procesando...' : '✓ Aprobar'}
                  </button>
                  <div style={{flex:1,minWidth:200}}>
                    <input
                      placeholder="Motivo del rechazo (obligatorio)"
                      value={motivoRechazo[c.id] || ''}
                      onChange={e => setMotivoRechazo(m => ({...m, [c.id]: e.target.value}))}
                      className="form-control"
                      style={{marginBottom:6,fontSize:'.82rem'}}
                    />
                    <button
                      onClick={() => rechazar(c)}
                      disabled={procesando === c.id || !motivoRechazo[c.id]?.trim()}
                      style={{padding:'8px 20px',borderRadius:8,border:'none',
                              background: !motivoRechazo[c.id]?.trim() ? 'var(--border)' : '#dc2626',
                              color:'white',fontWeight:700,fontSize:'.85rem',
                              cursor: !motivoRechazo[c.id]?.trim() ? 'not-allowed' : 'pointer'}}>
                      ✗ Rechazar
                    </button>
                  </div>
                </>
              )}

              {/* Aprobada — pausar */}
              {c.estado === 'aprobada' && (
                <button onClick={() => toggleActivo(c)}
                  style={{padding:'8px 20px',borderRadius:8,border:'1px solid var(--border)',
                          background:'white',cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
                  ⏸ Pausar campaña
                </button>
              )}

              {/* Pausada — reactivar */}
              {c.estado === 'pausada' && (
                <button onClick={() => toggleActivo(c)}
                  style={{padding:'8px 20px',borderRadius:8,border:'none',
                          background:'var(--navy)',color:'white',cursor:'pointer',
                          fontSize:'.85rem',fontWeight:600}}>
                  ▶ Reactivar campaña
                </button>
              )}

              {/* Rechazada — volver a pendiente si sube nuevo banner */}
              {c.estado === 'rechazada' && (
                <div style={{fontSize:'.8rem',color:'var(--text-muted)',fontStyle:'italic'}}>
                  El usuario debe subir un nuevo banner para revisión.
                  {c.estado_motivo && (
                    <div style={{marginTop:4,color:'#dc2626'}}>
                      Motivo: {c.estado_motivo}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}