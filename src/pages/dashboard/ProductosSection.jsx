import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { PLAN_LIMITS, sanitize, generarSlugProducto } from '../../lib/utils'
import { logAction } from '../../lib/audit'

export default function ProductosSection({ empresa, productos, loadProductos }) {
  const [categorias, setCategorias] = useState([])
  const [form, setForm] = useState(null)
  const [fotosExist, setFotosExist] = useState([])
  const [fotosFiles, setFotosFiles] = useState([])
  const [ok, setOk] = useState(''); const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('categorias').select('*').eq('visible',true).order('orden').then(({ data }) => setCategorias(data||[]))
  }, [])

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  const limite = empresa?.max_productos_override || PLAN_LIMITS[empresa?.plan] || 3
  const atLimit = productos.length >= limite && !form?.id

  const abrirNuevo = () => {
    // Preseleccionar la categoría que coincida con el sector de la empresa
    const catDefault = categorias.find(c =>
      c.nombre?.toLowerCase() === empresa?.sector?.toLowerCase() ||
      c.nombre_en?.toLowerCase() === empresa?.sector?.toLowerCase()
    )
    setForm({ nombre:'', categoria_id: catDefault?.id || '', zona:'nacional', cantidad_minima:'', unidad_minima:'uds', plazo_entrega:'', descripcion:'', made_in: false, palabras_clave:'' })
    setFotosExist([]); setFotosFiles([])
    setOk(''); setErr('')
  }
  const abrirEditar = (p) => {
    setForm({ ...p })
    setFotosExist((p.producto_fotos||[]).sort((a,b)=>a.orden-b.orden).map(f=>f.url))
    setFotosFiles([]); setOk(''); setErr('')
  }
  const cerrar = () => { setForm(null); setFotosExist([]); setFotosFiles([]) }

  const TIPOS_PERMITIDOS = ['image/jpeg','image/jpg','image/png','image/webp','image/gif']

  const handleFotos = (files) => {
    const disponibles = 3 - fotosExist.length - fotosFiles.length
    if (disponibles <= 0) { setErr('Máximo 3 fotos por producto.'); return }
    const nuevas = Array.from(files).slice(0, disponibles)
    const valid = nuevas.filter(f => {
      if (!TIPOS_PERMITIDOS.includes(f.type)) { setErr(`⚠️ Formato no admitido: ${f.name}. Usa JPG, PNG, WebP o GIF.`); return false }
      if (f.size > 5*1024*1024) { setErr(`⚠️ ${f.name} supera 5MB.`); return false }
      return true
    })
    setFotosFiles(p => [...p, ...valid])
  }

  const subirFotos = async (pid) => {
    const urls = [...fotosExist]
    for (const file of fotosFiles) {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = empresa.id + '/' + pid + '/' + Date.now() + '_' + Math.random().toString(36).slice(2,7) + '.' + ext
      const { data: upData, error } = await supabase.storage.from('producto-fotos').upload(path, file, { upsert: true, contentType: file.type })
      if (error) { setErr('Error al subir foto: ' + error.message); continue }
      const { data: urlData } = supabase.storage.from('producto-fotos').getPublicUrl(path)
      if (urlData?.publicUrl) urls.push(urlData.publicUrl)
    }
    return urls
  }

  const guardar = async () => {
    setOk(''); setErr('')
    if (!form.nombre)      { setErr('⚠️ El nombre es obligatorio.'); return }
    if (!form.categoria_id){ setErr('⚠️ Selecciona una categoría.'); return }
    if (!form.descripcion) { setErr('⚠️ La descripción es obligatoria.'); return }
    setSaving(true)
    try {
      const payload = { empresa_id: empresa.id, categoria_id: parseInt(form.categoria_id), nombre: sanitize(form.nombre), descripcion: sanitize(form.descripcion), zona: form.zona, cantidad_minima: form.cantidad_minima ? parseInt(form.cantidad_minima) : null, unidad_minima: form.unidad_minima, plazo_entrega: sanitize(form.plazo_entrega) || null, made_in: form.made_in || false, palabras_clave: sanitize(form.palabras_clave)?.slice(0,100) || null, estado: 'activo' }
      let pid = form.id
      if (form.id) {
        // Al editar NO cambiamos el slug para no romper URLs indexadas
        const { error } = await supabase.from('productos').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        // Al crear: primero insertamos para obtener el id, luego asignamos el slug con ese id
        const { data, error } = await supabase.from('productos').insert(payload).select().single()
        if (error) throw error
        pid = data.id
        const slug = generarSlugProducto(form.nombre, pid)
        await supabase.from('productos').update({ slug }).eq('id', pid)
      }
      const fotoUrls = await subirFotos(pid)
      await supabase.from('producto_fotos').delete().eq('producto_id', pid)
      if (fotoUrls.length) await supabase.from('producto_fotos').insert(fotoUrls.map((url,orden) => ({ producto_id: pid, url, orden })))
      setOk(form.id ? '✅ Producto actualizado.' : '✅ Producto publicado.')
      logAction('accion', form.id ? 'editar_producto' : 'nuevo_producto', {
        userId: empresa.user_id, empresaId: empresa.id,
        metadata: { producto_id: pid, nombre: form.nombre }
      })
      await loadProductos()
      setTimeout(cerrar, 1500)
    } catch(e) {
      setErr('❌ ' + (e.message || 'Error al guardar.'))
    } finally { setSaving(false) }
  }

  const eliminar = async (p) => {
    if (!confirm('¿Eliminar "' + p.nombre + '"? Esta acción no se puede deshacer.')) return
    if (p.producto_fotos?.length) {
      for (const f of p.producto_fotos) {
        const m = f.url.match(/producto-fotos\/(.+)$/)
        if (m) await supabase.storage.from('producto-fotos').remove([m[1]])
      }
    }
    await supabase.from('productos').delete().eq('id', p.id)
    logAction('accion', 'eliminar_producto', {
      userId: empresa.user_id, empresaId: empresa.id,
      metadata: { producto_id: p.id, nombre: p.nombre }
    })
    await loadProductos()
  }

  const statusCls = { pendiente:'prod-status-pendiente', activo:'prod-status-activo', rechazado:'prod-status-rechazado' }
  const statusLbl = { pendiente:'⏳ Pendiente', activo:'✅ Activo', rechazado:'❌ Rechazado' }

  return (
    <div className="dash-section">
      <div className="dash-section-title">
        Mis productos ({productos.length}/{limite})
        <button className="save-btn" onClick={abrirNuevo} disabled={atLimit}>+ Nuevo producto</button>
      </div>
      {atLimit && <div className="alert alert-info" style={{display:'block'}}>⚠️ Has alcanzado el límite de {limite} productos de tu plan. Actualiza tu plan para añadir más.</div>}

      {/* Form */}
      {form && (
        <div style={{background:'var(--cream)',borderRadius:12,padding:24,marginBottom:20,border:'1px solid var(--border)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <strong style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)'}}>{form.id ? 'Editar producto' : 'Nuevo producto'}</strong>
            <button onClick={cerrar} style={{background:'none',border:'none',fontSize:'1.2rem',color:'var(--text-muted)',cursor:'pointer'}}>✕</button>
          </div>
          {ok  && <div className="alert alert-success">{ok}</div>}
          {err && <div className="alert alert-error">{err}</div>}
          <div className="form-row">
            <div className="form-group"><label>Nombre *</label><input className="form-control" value={form.nombre} onChange={e=>set('nombre',e.target.value)} /></div>
            <div className="form-group"><label>Categoría *</label>
              <select className="form-control" value={form.categoria_id||''} onChange={e=>set('categoria_id',e.target.value)}>
                <option value="">Selecciona...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icono||''} {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Descripción *</label><textarea className="form-control" rows={3} value={form.descripcion||''} onChange={e=>set('descripcion',e.target.value)} /></div>
          <div className="form-group">
            <label style={{display:'flex',justifyContent:'space-between'}}>
              Palabras clave
              <span style={{fontWeight:400,color:(form.palabras_clave?.length||0)>100?'var(--danger)':'var(--text-muted)',fontSize:'.75rem'}}>{form.palabras_clave?.length||0}/100</span>
            </label>
            <input className="form-control" value={form.palabras_clave||''} onChange={e=>set('palabras_clave',e.target.value)}
              placeholder="mesa, table, wood, madera, furniture, muebles..." maxLength={100} />
            <div style={{fontSize:'.73rem',color:'var(--text-muted)',marginTop:4}}>
              Términos en cualquier idioma por los que quieres que te encuentren. Separados por comas.
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Cantidad mínima</label><input type="number" className="form-control" value={form.cantidad_minima||''} onChange={e=>set('cantidad_minima',e.target.value)} /></div>
            <div className="form-group"><label>Unidad</label>
              <select className="form-control" value={form.unidad_minima||'uds'} onChange={e=>set('unidad_minima',e.target.value)}>
                {['uds','kg','t','l','m','m²','caja','palet'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Plazo de entrega</label><input className="form-control" value={form.plazo_entrega||''} onChange={e=>set('plazo_entrega',e.target.value)} placeholder="Ej: 5-7 días hábiles" /></div>
            <div className="form-group"><label>Zona</label>
              <select className="form-control" value={form.zona||'nacional'} onChange={e=>set('zona',e.target.value)}>
                <option value="local">Local</option><option value="nacional">Nacional</option><option value="global">Global</option>
              </select>
            </div>
          </div>
          {/* Made in — solo para empresas España y UE */}
          {empresa?.pais && empresa.pais !== 'OTHER' && empresa.origen !== 'global' && (
            <div className="form-group">
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',textTransform:'none',letterSpacing:'normal',fontWeight:500,fontSize:'.88rem'}}>
                <input
                  type="checkbox"
                  checked={form.made_in || false}
                  onChange={e => set('made_in', e.target.checked)}
                  style={{width:16,height:16,accentColor:'var(--orange)',cursor:'pointer'}}
                />
                <span>
                  <strong>Made in {empresa.pais === 'ES' ? 'Spain 🇪🇸' : empresa.pais}</strong>
                  <span style={{color:'var(--text-muted)',marginLeft:6,fontSize:'.8rem'}}>— este producto es de fabricación local</span>
                </span>
              </label>
            </div>
          )}
          {/* Fotos */}
          <div className="form-group">
            <label>Fotos ({fotosExist.length + fotosFiles.length}/3)</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
              {fotosExist.map((url,i) => (
                <div key={i} className="foto-preview-item">
                  <img src={url} alt={"foto "+(i+1)} />
                  <button className="foto-preview-del" onClick={() => setFotosExist(p => p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
              {fotosFiles.map((f,i) => (
                <div key={i} className="foto-preview-item">
                  <img src={URL.createObjectURL(f)} alt={"nueva "+(i+1)} />
                  <button className="foto-preview-del" onClick={() => setFotosFiles(p => p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
            </div>
            {fotosExist.length + fotosFiles.length < 3 && (
              <label style={{display:'block',border:'2px dashed var(--border)',borderRadius:8,padding:'16px',textAlign:'center',cursor:'pointer',background:'var(--white)'}}>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple style={{display:'none'}} onChange={e=>handleFotos(e.target.files)} />
                <span style={{fontSize:'.83rem',color:'var(--text-muted)'}}>+ Añadir fotos (JPG, PNG, WebP · máx. 5MB cada una)</span>
              </label>
            )}
          </div>
          <button className="submit-btn" onClick={guardar} disabled={saving} style={{marginTop:8}}>
            {saving ? <><span className="spinner"/>Guardando...</> : (form.id ? 'Guardar cambios →' : 'Publicar producto →')}
          </button>
        </div>
      )}

      {/* Lista */}
      {productos.length === 0 && !form && (
        <div style={{textAlign:'center',padding:32,color:'var(--text-muted)',fontSize:'.85rem'}}>
          Aún no tienes productos publicados. Haz clic en <strong>+ Nuevo producto</strong> para empezar.
        </div>
      )}
      {productos.map(p => {
        const foto = (p.producto_fotos||[]).sort((a,b)=>a.orden-b.orden)[0]?.url
        return (
          <div key={p.id} className="prod-card">
            <div className="prod-thumb">{foto ? <img src={foto} alt={p.nombre} loading="lazy" /> : (p.categorias?.icono||'📦')}</div>
            <div>
              <div className="prod-info-name">{p.nombre}</div>
              <div className="prod-info-cat">{p.categorias?.icono||''} {p.categorias?.nombre||'Sin categoría'}</div>
              <div className="prod-info-meta">
                {p.cantidad_minima && <span className="prod-meta-tag">📦 Mín: {p.cantidad_minima} {p.unidad_minima||'uds'}</span>}
                <span className="prod-meta-tag">🌐 {p.zona||'nacional'}</span>
                {p.plazo_entrega && <span className="prod-meta-tag">⏱ {p.plazo_entrega}</span>}
                {p.made_in && <span className="prod-meta-tag" style={{background:'rgba(170,21,27,0.07)',color:'var(--spain)',border:'1px solid rgba(170,21,27,0.2)',fontWeight:600}}>🏭 Made in {empresa?.pais === 'ES' ? 'Spain' : empresa?.pais}</span>}
                <span className={"prod-status " + (statusCls[p.estado]||'prod-status-pendiente')}>{statusLbl[p.estado]||p.estado}</span>
              </div>
              {p.descripcion && <p style={{fontSize:'.8rem',color:'var(--text-muted)',marginTop:6,lineHeight:1.5}}>{p.descripcion.slice(0,120)}{p.descripcion.length>120?'...':''}</p>}
            </div>
            <div className="prod-actions">
              <button className="prod-btn prod-btn-edit" onClick={() => abrirEditar(p)}>✏️ Editar</button>
              <button className="prod-btn prod-btn-del"  onClick={() => eliminar(p)}>🗑 Eliminar</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
