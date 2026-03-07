import { useState } from 'react'
import { supabase } from '../lib/supabase'

const MOTIVOS_ES = [
  { value: 'slug_inapropiado',   label: 'URL/nombre inapropiado o que pertenece a otra empresa' },
  { value: 'contenido_ilegal',   label: 'Contenido ilegal o fraudulento' },
  { value: 'empresa_falsa',      label: 'Empresa falsa o suplantación de identidad' },
  { value: 'producto_fraudulento', label: 'Producto fraudulento o engañoso' },
  { value: 'otro',               label: 'Otro motivo' },
]

const MOTIVOS_EN = [
  { value: 'slug_inapropiado',   label: 'Inappropriate URL/name or belonging to another company' },
  { value: 'contenido_ilegal',   label: 'Illegal or fraudulent content' },
  { value: 'empresa_falsa',      label: 'Fake company or identity theft' },
  { value: 'producto_fraudulento', label: 'Fraudulent or misleading product' },
  { value: 'otro',               label: 'Other reason' },
]

export default function DenunciaModal({ tipo, refId, lang, onClose }) {
  const [motivo,      setMotivo]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [email,       setEmail]       = useState('')
  const [sending,     setSending]     = useState(false)
  const [ok,          setOk]          = useState(false)
  const [err,         setErr]         = useState('')

  const motivos = lang === 'en' ? MOTIVOS_EN : MOTIVOS_ES
  const es = lang !== 'en'

  const submit = async () => {
    if (!motivo)      { setErr(es ? 'Selecciona un motivo.' : 'Please select a reason.'); return }
    if (!descripcion.trim()) { setErr(es ? 'Describe brevemente el problema.' : 'Please describe the issue.'); return }
    setSending(true); setErr('')
    try {
      const { error } = await supabase.from('denuncias').insert({
        tipo, ref_id: refId, motivo, descripcion: descripcion.trim(), email: email.trim() || null
      })
      if (error) throw error
      setOk(true)
    } catch(e) {
      setErr('❌ ' + (e.message || (es ? 'Error al enviar.' : 'Error sending.')))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{background:'white',borderRadius:14,padding:28,maxWidth:480,width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <strong style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)',fontSize:'1rem'}}>
            {es ? '⚑ Denunciar contenido' : '⚑ Report content'}
          </strong>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.2rem',color:'var(--text-muted)',cursor:'pointer'}}>✕</button>
        </div>

        {ok ? (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:'2rem',marginBottom:12}}>✅</div>
            <div style={{fontWeight:700,color:'var(--navy)',marginBottom:8}}>
              {es ? 'Denuncia enviada' : 'Report submitted'}
            </div>
            <p style={{fontSize:'.85rem',color:'var(--text-muted)',marginBottom:20}}>
              {es
                ? 'Nuestro equipo la revisará en un plazo de 24–48h. Gracias por ayudarnos a mantener la calidad del directorio.'
                : 'Our team will review it within 24–48h. Thank you for helping us maintain directory quality.'}
            </p>
            <button onClick={onClose} style={{padding:'9px 24px',background:'var(--navy)',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600}}>
              {es ? 'Cerrar' : 'Close'}
            </button>
          </div>
        ) : (
          <>
            <p style={{fontSize:'.82rem',color:'var(--text-muted)',marginBottom:16}}>
              {es
                ? 'Si encuentras contenido inapropiado, falso o que infringe derechos de otra empresa, infórmanos.'
                : 'If you find inappropriate, false, or rights-infringing content, let us know.'}
            </p>

            {err && <div style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:8,padding:'8px 12px',fontSize:'.82rem',color:'#dc2626',marginBottom:12}}>{err}</div>}

            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:'.8rem',fontWeight:600,color:'var(--navy)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>
                {es ? 'Motivo *' : 'Reason *'}
              </label>
              {motivos.map(m => (
                <label key={m.value} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8,cursor:'pointer',fontSize:'.85rem',color:'var(--text)'}}>
                  <input type="radio" name="motivo" value={m.value} checked={motivo===m.value} onChange={() => setMotivo(m.value)}
                    style={{marginTop:2,accentColor:'var(--orange)',flexShrink:0}} />
                  {m.label}
                </label>
              ))}
            </div>

            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:'.8rem',fontWeight:600,color:'var(--navy)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>
                {es ? 'Descripción *' : 'Description *'}
              </label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={es ? 'Explica brevemente el problema...' : 'Briefly describe the issue...'}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:'.85rem',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}}
              />
              <div style={{fontSize:'.72rem',color:'var(--text-muted)',textAlign:'right'}}>{descripcion.length}/500</div>
            </div>

            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:'.8rem',fontWeight:600,color:'var(--navy)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>
                {es ? 'Tu email (opcional)' : 'Your email (optional)'}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={es ? 'Para que podamos contactarte si necesitamos más info' : 'So we can contact you if we need more info'}
                style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:'.85rem',fontFamily:'inherit',boxSizing:'border-box'}}
              />
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={onClose} style={{padding:'9px 18px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',fontSize:'.85rem',fontWeight:600}}>
                {es ? 'Cancelar' : 'Cancel'}
              </button>
              <button onClick={submit} disabled={sending}
                style={{padding:'9px 18px',background:'var(--navy)',color:'white',border:'none',borderRadius:8,cursor:sending?'not-allowed':'pointer',fontSize:'.85rem',fontWeight:600,opacity:sending?.7:1}}>
                {sending ? (es ? 'Enviando...' : 'Sending...') : (es ? 'Enviar denuncia' : 'Submit report')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
