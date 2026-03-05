import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const EMPTY = { codigo:'', descripcion:'', asociacion_nombre:'', asociacion_url:'', tipo:'plan', max_productos:5, max_fotos:1, con_publicidad:true, descuento_pct:10, fecha_inicio:'', fecha_fin:'', max_usos:'', solo_nuevos:true, activo:true }

export default function AdminCupones() {
  const [cupones, setCupones] = useState([])
  const [form,    setForm]    = useState(null)
  const [editId,  setEditId]  = useState(null)
  const [ok, setOk] = useState(''); const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  const load = async () => {
    const { data } = await supabase.from('cupones').select('*').order('created_at', { ascending: false })
    setCupones(data || [])
  }
  const set = (k, v) => setForm(p => ({...p, [k]: v}))
  const abrir = (c) => { setForm(c ? {...c} : {...EMPTY}); setEditId(c?.id || null); setOk(''); setErr('') }
  const cerrar = () => { setForm(null); setEditId(null) }

  const guardar = async () => {
    setOk(''); setErr('')
    if (!form.codigo) { setErr('El código es obligatorio.'); return }
    setSaving(true)
    const payload = { ...form, codigo: form.codigo.toUpperCase(), max_usos: form.max_usos ? parseInt(form.max_usos) : null, fecha_inicio: form.fecha_inicio || new Date().toISOString(), fecha_fin: form.fecha_fin || null }
    let error
    if (editId) { ({ error } = await supabase.from('cupones').update(payload).eq('id', editId)) }
    else        { ({ error } = await supabase.from('cupones').insert(payload)) }
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(editId ? 'Cupón actualizado.' : 'Cupón creado.')
    await load(); setTimeout(cerrar, 1200)
  }

  const toggle = async (id, activo) => {
    await supabase.from('cupones').update({ activo }).eq('id', id)
    setCupones(p => p.map(c => c.id===id ? {...c, activo} : c))
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)'}}>Cupones de descuento</h3>
        <button className="save-btn" onClick={() => abrir(null)}>+ Nuevo cupón</button>
      </div>

      {form && (
        <div style={{background:'var(--cream)',border:'1px solid var(--border)',borderRadius:12,padding:24,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <strong style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)'}}>{editId ? 'Editar cupón' : 'Nuevo cupón'}</strong>
            <button onClick={cerrar} style={{background:'none',border:'none',fontSize:'1.2rem',color:'var(--text-muted)',cursor:'pointer'}}>✕</button>
          </div>
          {ok  && <div className="alert alert-success">{ok}</div>}
          {err && <div className="alert alert-error">{err}</div>}
          <div className="form-row">
            <div className="form-group"><label>Código *</label><input className="form-control" value={form.codigo} onChange={e=>set('codigo',e.target.value.toUpperCase())} /></div>
            <div className="form-group"><label>Descripción interna</label><input className="form-control" value={form.descripcion||''} onChange={e=>set('descripcion',e.target.value)} placeholder="Uso interno, no visible" /></div>
          </div>
          {/* Asociación — visible públicamente en el perfil de empresa */}
          <div style={{background:'rgba(244,96,12,0.05)',border:'1px solid rgba(244,96,12,0.15)',borderRadius:8,padding:14,marginBottom:13}}>
            <div style={{fontSize:'.75rem',fontWeight:700,color:'var(--orange)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>
              🤝 Asociación promotora (opcional — visible en el perfil público)
            </div>
            <div className="form-row" style={{marginBottom:0}}>
              <div className="form-group" style={{marginBottom:0}}><label>Nombre de la asociación</label><input className="form-control" value={form.asociacion_nombre||''} onChange={e=>set('asociacion_nombre',e.target.value)} placeholder="Ej: ADEG, PIMEC, CECOT…" /></div>
              <div className="form-group" style={{marginBottom:0}}><label>URL de la asociación</label><input className="form-control" value={form.asociacion_url||''} onChange={e=>set('asociacion_url',e.target.value)} placeholder="https://www.adeg.cat" /></div>
            </div>
          </div>
          <div className="form-group"><label>Tipo</label>
            <select className="form-control" value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
              <option value="plan">Plan personalizado</option>
              <option value="descuento">Descuento %</option>
            </select>
          </div>
          {form.tipo === 'plan' && (
            <div className="form-row">
              <div className="form-group"><label>Max productos</label><input type="number" className="form-control" value={form.max_productos} onChange={e=>set('max_productos',parseInt(e.target.value))} /></div>
              <div className="form-group"><label>Max fotos/prod</label><input type="number" className="form-control" value={form.max_fotos} onChange={e=>set('max_fotos',parseInt(e.target.value))} /></div>
            </div>
          )}
          {form.tipo === 'descuento' && (
            <div className="form-group"><label>Descuento (%)</label><input type="number" className="form-control" value={form.descuento_pct} onChange={e=>set('descuento_pct',parseInt(e.target.value))} /></div>
          )}
          <div className="form-row">
            <div className="form-group"><label>Fecha inicio</label><input type="datetime-local" className="form-control" value={form.fecha_inicio?.slice(0,16)||''} onChange={e=>set('fecha_inicio',e.target.value)} /></div>
            <div className="form-group"><label>Fecha fin</label><input type="datetime-local" className="form-control" value={form.fecha_fin?.slice(0,16)||''} onChange={e=>set('fecha_fin',e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Máx usos (vacío = ilimitado)</label><input type="number" className="form-control" value={form.max_usos||''} onChange={e=>set('max_usos',e.target.value)} /></div>
            <div className="form-group" style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:0}}>
                <input type="checkbox" checked={form.solo_nuevos} onChange={e=>set('solo_nuevos',e.target.checked)} />
                Solo cuentas nuevas
              </label>
            </div>
          </div>
          <button className="submit-btn" onClick={guardar} disabled={saving}>
            {saving ? <><span className="spinner"/>Guardando...</> : 'Guardar cupón'}
          </button>
        </div>
      )}

      <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
        <div className="cupon-row" style={{background:'var(--cream-dark)',fontWeight:700,fontSize:'.72rem',textTransform:'uppercase',color:'var(--text-muted)'}}>
          <span>Código</span><span>Descripción</span><span>Usos</span><span>Caduca</span><span>Estado</span><span>Acciones</span>
        </div>
        {cupones.map(c => {
          const caducado = c.fecha_fin && new Date(c.fecha_fin) < new Date()
          const agotado  = c.max_usos !== null && c.usos_actuales >= c.max_usos
          const activo   = c.activo && !caducado && !agotado
          const caducaStr = c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '∞'
          const usosStr   = c.max_usos  ? (c.usos_actuales+'/'+c.max_usos) : (c.usos_actuales+'/∞')
          const conds = c.tipo==='plan' ? (c.max_productos+' prods · '+c.max_fotos+' foto'+(c.max_fotos>1?'s':'')) : (c.descuento_pct+'% descuento')
          return (
            <div key={c.id} className="cupon-row">
              <div><span className="cupon-code">{c.codigo}</span> <span className={"cupon-active " + (activo?'on':'off')} /></div>
              <div><div style={{color:'var(--navy)',fontSize:'.8rem'}}>{c.descripcion||'—'}</div><div style={{color:'var(--orange)',fontSize:'.72rem'}}>{conds}</div></div>
              <div>{usosStr}</div>
              <div>{caducaStr}</div>
              <div style={{fontSize:'.72rem',fontWeight:600,color:caducado?'var(--danger)':agotado?'var(--warning)':c.activo?'var(--success)':'var(--border)'}}>
                {caducado?'Caducado':agotado?'Agotado':c.activo?'Activo':'Inactivo'}
              </div>
              <div style={{display:'flex',gap:4}}>
                <button className="admin-btn admin-btn-edit" onClick={() => abrir(c)}>✏️</button>
                <button className={"admin-btn "+(c.activo?'admin-btn-reject':'admin-btn-approve')} onClick={() => toggle(c.id, !c.activo)}>
                  {c.activo?'Desactivar':'Activar'}
                </button>
              </div>
            </div>
          )
        })}
        {!cupones.length && <div style={{padding:24,textAlign:'center',color:'var(--text-muted)',fontSize:'.85rem'}}>No hay cupones creados.</div>}
      </div>
    </div>
  )
}
