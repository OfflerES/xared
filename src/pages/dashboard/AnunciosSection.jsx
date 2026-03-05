import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const ZONAS = [
  { id: 'espana',  label: '🇪🇸 España' },
  { id: 'latam',   label: '🌎 Latinoamérica' },
  { id: 'europa',  label: '🌍 Europa' },
  { id: 'global',  label: '🌐 Global' },
]

const ESTADO_BADGE = {
  pendiente: { bg:'#fef3c7', color:'#d97706', text:'Pendiente' },
  aprobada:  { bg:'#dcfce7', color:'#16a34a', text:'Activa' },
  rechazada: { bg:'#fee2e2', color:'#dc2626', text:'Rechazada' },
  pausada:   { bg:'#f3f4f6', color:'#6b7280', text:'Pausada' },
  agotada:   { bg:'#f3f4f6', color:'#6b7280', text:'Agotada' },
}

export default function AnunciosSection({ empresa }) {
  const { lang } = useApp()
  const navigate = useNavigate()
  const es = lang !== 'en'

  const [campana,  setCampana]  = useState(null)
  const [stats,    setStats]    = useState(null)
  const [zona,     setZona]     = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [ok,       setOk]       = useState('')
  const [err,      setErr]      = useState('')

  useEffect(() => {
    if (!empresa) return
    const load = async () => {
      const { data: c } = await supabase.from('campanas')
        .select('*').eq('empresa_id', empresa.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (!c) return
      setCampana(c)
      setZona(c.target_zona || 'espana')

      const [{ count: imps }, { count: clicks }] = await Promise.all([
        supabase.from('banner_eventos').select('id',{count:'exact'}).eq('campana_id', c.id).eq('tipo','impresion'),
        supabase.from('banner_eventos').select('id',{count:'exact'}).eq('campana_id', c.id).eq('tipo','click'),
      ])
      setStats({ imps: imps||0, clicks: clicks||0 })
    }
    load()
  }, [empresa?.id])

  const guardarZona = async () => {
    if (!campana || zona === campana.target_zona) return
    setSaving(true); setOk(''); setErr('')
    const { error } = await supabase.from('campanas')
      .update({ target_zona: zona, updated_at: new Date().toISOString() })
      .eq('id', campana.id)
    setSaving(false)
    if (error) { setErr('Error: ' + error.message); return }
    setCampana(c => ({...c, target_zona: zona}))
    setOk(es ? 'Zona actualizada correctamente.' : 'Zone updated successfully.')
  }

  if (!campana) return (
    <div className="dash-section">
      <div className="dash-section-title">📊 {es?'Mis anuncios':'My ads'}</div>
      <p style={{color:'var(--text-muted)',fontSize:'.85rem',marginBottom:16}}>
        {es
          ? 'Aún no tienes impresiones contratadas. Sube tu banner y contrátalo desde la página de Publicidad.'
          : 'You have no impressions yet. Upload your banner and purchase from the Advertising page.'}
      </p>
      <button onClick={() => navigate('/publicidad')}
        style={{background:'var(--orange)',color:'white',border:'none',padding:'10px 24px',borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.85rem',cursor:'pointer'}}>
        {es ? 'Ir a Publicidad →' : 'Go to Advertising →'}
      </button>
    </div>
  )

  const badge = ESTADO_BADGE[campana.estado] || ESTADO_BADGE.pendiente
  const impRestantes = (campana.impresiones_total || 0) - (campana.impresiones_usadas || 0)
  const pct = campana.impresiones_total
    ? Math.round(((campana.impresiones_usadas||0) / campana.impresiones_total) * 100)
    : 0
  const ctr = stats?.imps ? ((stats.clicks / stats.imps) * 100).toFixed(2) : '0.00'

  return (
    <div className="dash-section">
      <div className="dash-section-title">
        📊 {es?'Mis anuncios':'My ads'}
        <span style={{fontSize:'.72rem',padding:'3px 10px',borderRadius:20,fontWeight:600,background:badge.bg,color:badge.color}}>
          {badge.text}
        </span>
      </div>

      {/* Saldo de impresiones */}
      <div style={{background:'var(--cream)',borderRadius:12,padding:20,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.9rem'}}>
            {es ? 'Saldo de impresiones' : 'Impressions balance'}
          </span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'1.1rem',color: impRestantes > 0 ? 'var(--orange)' : 'var(--text-muted)'}}>
            {impRestantes.toLocaleString('es-ES')} {es?'restantes':'remaining'}
          </span>
        </div>
        <div style={{height:8,background:'var(--border)',borderRadius:4,overflow:'hidden',marginBottom:8}}>
          <div style={{height:'100%',width:pct+'%',background:'var(--orange)',borderRadius:4,transition:'width .4s'}} />
        </div>
        <div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>
          {(campana.impresiones_usadas||0).toLocaleString('es-ES')} / {(campana.impresiones_total||0).toLocaleString('es-ES')} {es?'usadas':'used'}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            [es?'Impresiones':'Impressions', stats.imps.toLocaleString('es-ES')],
            ['Clicks', stats.clicks.toLocaleString('es-ES')],
            ['CTR', ctr + '%'],
          ].map(([label, val]) => (
            <div key={label} style={{textAlign:'center',padding:14,background:'white',borderRadius:10,border:'1px solid var(--border)'}}>
              <div style={{fontWeight:700,fontSize:'1.1rem',color:'var(--navy)'}}>{val}</div>
              <div style={{color:'var(--text-muted)',fontSize:'.72rem'}}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Targeting — solo si tiene impresiones y banner aprobado */}
      {campana.estado === 'aprobada' && impRestantes > 0 && (
        <div style={{border:'1px solid var(--border)',borderRadius:10,padding:18,marginBottom:16}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.88rem',marginBottom:12}}>
            🎯 {es ? 'Zona de emisión' : 'Target zone'}
          </div>
          <p style={{fontSize:'.8rem',color:'var(--text-muted)',marginBottom:12}}>
            {es
              ? 'Puedes cambiar la zona donde se muestra tu banner en cualquier momento.'
              : 'You can change the zone where your banner appears at any time.'}
          </p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <select value={zona} onChange={e => setZona(e.target.value)}
              className="form-control" style={{width:'auto',flex:1}}>
              {ZONAS.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
            <button onClick={guardarZona} disabled={saving || zona === campana.target_zona}
              style={{padding:'10px 20px',borderRadius:8,border:'none',background: saving || zona === campana.target_zona ? 'var(--border)' : 'var(--navy)',color:'white',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.85rem',cursor: saving || zona === campana.target_zona ? 'default' : 'pointer'}}>
              {saving ? (es?'Guardando...':'Saving...') : (es?'Guardar':'Save')}
            </button>
          </div>
          {ok  && <div className="alert alert-success" style={{marginTop:10}}>{ok}</div>}
          {err && <div className="alert alert-error"   style={{marginTop:10}}>{err}</div>}
        </div>
      )}

      {/* Comprar más impresiones */}
      <button onClick={() => navigate('/publicidad')}
        style={{width:'100%',padding:'11px',borderRadius:8,border:'2px solid var(--orange)',background:'transparent',color:'var(--orange)',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.88rem',cursor:'pointer'}}>
        + {es ? 'Comprar más impresiones' : 'Purchase more impressions'}
      </button>
    </div>
  )
}