import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

export default function BannerSection({ empresa, refreshEmpresa }) {
  const { lang } = useApp()
  const es = lang !== 'en'
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [campana, setCampana] = useState(null)
  const [ok,      setOk]      = useState('')
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    if (!empresa) return
    supabase.from('campanas')
      .select('*')
      .eq('empresa_id', empresa.id)
      .maybeSingle()
      .then(({ data }) => setCampana(data || null))
  }, [empresa?.id])

  const estado = campana?.estado || 'sin_banner'
  const badge = {
    sin_banner: { bg:'var(--border)',  color:'var(--text-muted)', text: es?'Sin banner':'No banner' },
    pendiente:  { bg:'#fef3c7',        color:'#d97706',           text: es?'Pendiente de aprobación':'Pending approval' },
    aprobada:   { bg:'#dcfce7',        color:'#16a34a',           text: es?'Aprobado':'Approved' },
    rechazada:  { bg:'#fee2e2',        color:'#dc2626',           text: es?'Rechazado':'Rejected' },
    pausada:    { bg:'#f3f4f6',        color:'#6b7280',           text: es?'Pausado':'Paused' },
    agotada:    { bg:'#f3f4f6',        color:'#6b7280',           text: es?'Agotado':'Exhausted' },
  }[estado] || { bg:'var(--border)', color:'var(--text-muted)', text: estado }

  const handleFile = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setErr(es ? 'Solo se admiten imágenes (JPG, PNG, GIF).' : 'Only images allowed (JPG, PNG, GIF).')
      return
    }
    if (f.size > 2*1024*1024) {
      setErr(es ? 'El banner no puede superar 2MB.' : 'Banner cannot exceed 2MB.')
      return
    }
    setFile(f); setErr('')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  const subir = async () => {
    if (!file || !empresa) return
    setOk(''); setErr(''); setLoading(true)
    try {
      // 1. Subir imagen a Storage
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${empresa.id}/banner_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('banners').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path)
      const bannerUrl = urlData.publicUrl

      // 2. Crear o actualizar campaña
      if (campana) {
        // Ya existe — actualizar banner y volver a pendiente
        const { data: updated, error: updErr } = await supabase
          .from('campanas')
          .update({
            banner_url:   bannerUrl,
            estado:       'pendiente',
            estado_motivo: null,
            revisado_at:  null,
            revisado_por: null,
            updated_at:   new Date().toISOString(),
          })
          .eq('id', campana.id)
          .select()
          .single()
        if (updErr) throw updErr
        setCampana(updated)
      } else {
        // Primera vez — crear campaña
        const { data: nueva, error: insErr } = await supabase
          .from('campanas')
          .insert({
            empresa_id:       empresa.id,
            banner_url:       bannerUrl,
            url_destino:      empresa.web || 'https://xared.com',
            nombre:           empresa.razon_social + ' — banner',
            estado:           'pendiente',
            impresiones_total: 0,
            impresiones_usadas: 0,
            target_zona:      'espana',
            activo:           false,
          })
          .select()
          .single()
        if (insErr) throw insErr
        setCampana(nueva)
      }

      // 3. Actualizar también empresas.banner_url y banner_estado para el admin
      await supabase.from('empresas').update({
        banner_url:        bannerUrl,
        banner_estado:     'pendiente',
        banner_rechazo:    null,
        banner_updated_at: new Date().toISOString(),
      }).eq('id', empresa.id)

      await refreshEmpresa()
      setFile(null); setPreview(null)
      setOk(es
        ? 'Banner enviado. Lo revisaremos en menos de 24h.'
        : 'Banner submitted. We will review it within 24h.')
    } catch(e) {
      setErr((es ? 'Error al subir: ' : 'Upload error: ') + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dash-section">
      <div className="dash-section-title">
        📢 {es ? 'Banner publicitario' : 'Advertising banner'}
        <span style={{fontSize:'.72rem',padding:'3px 10px',borderRadius:20,fontWeight:600,
                      background:badge.bg,color:badge.color}}>
          {badge.text}
        </span>
      </div>

      <p style={{fontSize:'.83rem',color:'var(--text-muted)',marginBottom:16,lineHeight:1.6}}>
        {es
          ? <>Sube un banner de <strong>728 × 90 px</strong> (JPG, PNG o GIF, máx. 2MB).
              Una vez aprobado podrás contratar impresiones en la página de{' '}
              <a href="/publicidad" style={{color:'var(--orange)'}}>Publicidad</a>.</>
          : <>Upload a <strong>728 × 90 px</strong> banner (JPG, PNG or GIF, max 2MB).
              Once approved you can purchase impressions on the{' '}
              <a href="/publicidad" style={{color:'var(--orange)'}}>Advertising</a> page.</>
        }
      </p>

      {/* Banner actual */}
      {campana?.banner_url && (
        <div style={{marginBottom:16}}>
          <p style={{fontSize:'.75rem',color:'var(--text-muted)',textTransform:'uppercase',
                     letterSpacing:'.06em',marginBottom:6}}>
            {es ? 'Tu banner actual' : 'Your current banner'}
          </p>
          <img src={campana.banner_url} alt="Banner"
            style={{width:'100%',maxWidth:728,height:90,objectFit:'cover',
                    borderRadius:8,border:'1px solid var(--border)'}} />
          {estado === 'rechazada' && campana.estado_motivo && (
            <div style={{marginTop:8,padding:'10px 14px',
                         background:'rgba(220,38,38,0.06)',
                         border:'1px solid rgba(220,38,38,0.2)',
                         borderRadius:8,fontSize:'.8rem',color:'#dc2626'}}>
              {es ? 'Motivo del rechazo: ' : 'Rejection reason: '}{campana.estado_motivo}
            </div>
          )}
        </div>
      )}

      {/* Zona de emisión — solo si aprobada */}
      {estado === 'aprobada' && (
        <div style={{marginBottom:16,padding:14,background:'var(--cream)',
                     borderRadius:10,border:'1px solid var(--border)'}}>
          <p style={{fontSize:'.8rem',fontWeight:600,color:'var(--navy)',marginBottom:8}}>
            🎯 {es ? 'Zona de emisión actual:' : 'Current target zone:'}
            <strong style={{marginLeft:6}}>{campana.target_zona}</strong>
          </p>
          <p style={{fontSize:'.75rem',color:'var(--text-muted)'}}>
            {es
              ? 'Puedes cambiar la zona desde la pestaña "Anuncios".'
              : 'You can change the zone from the "Ads" tab.'}
          </p>
        </div>
      )}

      {/* Zona pendiente de aprobación */}
      {estado === 'pendiente' && (
        <div style={{marginBottom:16,padding:14,background:'#fef3c7',
                     borderRadius:10,border:'1px solid #fcd34d'}}>
          <p style={{fontSize:'.83rem',color:'#92400e'}}>
            🔍 {es
              ? 'Tu banner está siendo revisado por nuestro equipo. Te avisaremos por email cuando esté aprobado (normalmente en menos de 24h).'
              : 'Your banner is being reviewed by our team. We will notify you by email once approved (usually within 24h).'}
          </p>
        </div>
      )}

      {/* Upload */}
      {!preview && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
          style={{border:'2px dashed var(--border)',borderRadius:10,padding:24,
                  textAlign:'center',cursor:'pointer',background:'var(--cream)'}}>
          <div style={{fontSize:'2rem',marginBottom:8}}>🖼️</div>
          <p style={{fontSize:'.85rem',fontWeight:600,color:'var(--navy)',marginBottom:4}}>
            {es
              ? (campana ? 'Arrastra un nuevo banner o haz clic para reemplazar' : 'Arrastra tu banner o haz clic para seleccionar')
              : (campana ? 'Drag a new banner or click to replace' : 'Drag your banner or click to select')}
          </p>
          <p style={{fontSize:'.75rem',color:'var(--text-muted)'}}>
            728 × 90 px · JPG, PNG, GIF · {es ? 'Máx. 2MB' : 'Max 2MB'}
          </p>
          <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}}
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {preview && (
        <div style={{marginTop:16}}>
          <p style={{fontSize:'.75rem',color:'var(--text-muted)',
                     textTransform:'uppercase',marginBottom:6}}>
            {es ? 'Vista previa' : 'Preview'}
          </p>
          <img src={preview} alt="Preview"
            style={{width:'100%',maxWidth:728,height:90,objectFit:'cover',
                    borderRadius:8,border:'1px solid var(--border)'}} />
          <div style={{display:'flex',gap:10,marginTop:12}}>
            <button className="submit-btn" onClick={subir} disabled={loading} style={{flex:1}}>
              {loading
                ? <><span className="spinner"/>{es?'Enviando...':'Sending...'}</>
                : (es ? 'Enviar para aprobación →' : 'Submit for approval →')}
            </button>
            <button onClick={() => { setFile(null); setPreview(null) }}
              style={{padding:'10px 20px',border:'1px solid var(--border)',
                      borderRadius:8,background:'white',cursor:'pointer',fontSize:'.85rem'}}>
              {es ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {ok  && <div className="alert alert-success" style={{marginTop:12}}>{ok}</div>}
      {err && <div className="alert alert-error"   style={{marginTop:12}}>{err}</div>}
    </div>
  )
}