import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { sanitize } from '../lib/utils'
import { t } from '../lib/i18n'

// Reemplaza con tu sitekey de Cloudflare Turnstile
// Registro gratuito: dash.cloudflare.com -> Turnstile -> Add site
const TURNSTILE_SITEKEY = 'TU_SITEKEY_AQUI'

function TurnstileWidget({ onVerify, onExpire }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!window.turnstile || !ref.current) return
    const id = window.turnstile.render(ref.current, {
      sitekey: TURNSTILE_SITEKEY,
      callback: (token) => onVerify(token),
      'expired-callback': () => onExpire(),
      theme: 'light',
      language: 'es',
    })
    return () => { try { window.turnstile.remove(id) } catch {} }
  }, [])

  return <div ref={ref} style={{margin:'12px 0'}} />
}

export default function RFQModal({ tipo, empresaId, productoId, productoNombre, lang: langProp, onClose }) {
  const { empresa: miEmpresa, lang: ctxLang } = useApp()
  const lang = langProp || ctxLang || 'es'
  const [form, setForm] = useState({
    nombre:   miEmpresa?.razon_social || '',
    email:    miEmpresa?.email || '',
    empresa:  miEmpresa?.razon_social || '',
    cantidad: '',
    mensaje:  '',
  })
  const [ok,             setOk]             = useState('')
  const [err,            setErr]            = useState('')
  const [loading,        setLoading]        = useState(false)
  const [captchaToken,   setCaptchaToken]   = useState('')
  const [scriptLoaded,   setScriptLoaded]   = useState(false)

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  // Cargar script de Turnstile al montar
  useEffect(() => {
    if (window.turnstile) { setScriptLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  const enviar = async () => {
    setOk(''); setErr('')
    if (!form.nombre || !form.email || !form.mensaje) { setErr(t('rfq_err_fields', lang)); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setErr(t('rfq_err_email', lang)); return }
    if (!captchaToken) { setErr(t('rfq_err_captcha', lang)); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('rfq').insert({
        empresa_id:          empresaId,
        producto_id:         tipo === 'producto' ? productoId : null,
        nombre_solicitante:  sanitize(form.nombre),
        email_solicitante:   sanitize(form.email),
        empresa_solicitante: sanitize(form.empresa) || null,
        mensaje:             sanitize((form.cantidad ? 'Cantidad: ' + form.cantidad + '\n\n' : '') + form.mensaje),
        estado: 'nueva'
      })
      if (error) throw error
      setOk(t('rfq_ok', lang))
      setTimeout(onClose, 3000)
    } catch(e) {
      setErr('Error: ' + (e.message || 'Intentalo de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{maxWidth:500}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'1.05rem'}}>
            {t('rfq_title', lang)}
          </h3>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.3rem',color:'var(--text-muted)',cursor:'pointer'}}>✕</button>
        </div>

        <div style={{background:'rgba(244,96,12,0.06)',border:'1px solid rgba(244,96,12,0.2)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:'.78rem',color:'var(--text-muted)',lineHeight:1.6}}>
          {t('rfq_info', lang)}
        </div>

        {productoNombre && (
          <p style={{fontSize:'.83rem',color:'var(--text-muted)',marginBottom:14}}>
            {t('rfq_product_label', lang)} <strong style={{color:'var(--navy)'}}>{productoNombre}</strong>
          </p>
        )}

        {ok  && <div className="alert alert-success" style={{marginBottom:12}}>{ok}</div>}
        {err && <div className="alert alert-error"   style={{marginBottom:12}}>{err}</div>}

        <div className="form-group">
          <label>{t('rfq_name', lang)}</label>
          <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('rfq_email', lang)}</label>
          <input type="email" className="form-control" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="form-group">
          <label>{t('rfq_company', lang)}</label>
          <input className="form-control" value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder={t('rfq_company_placeholder', lang)} />
        </div>
        {tipo === 'producto' && (
          <div className="form-group">
            <label>{t('rfq_qty', lang)}</label>
            <input className="form-control" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label>{t('rfq_message', lang)}</label>
          <textarea className="form-control" rows={4} value={form.mensaje} onChange={e => set('mensaje', e.target.value)}
            placeholder={t('rfq_message_placeholder', lang)} style={{resize:'vertical'}} />
        </div>

        {scriptLoaded
          ? <TurnstileWidget onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
          : <div style={{height:65,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.8rem',color:'var(--text-muted)'}}>...</div>
        }

        <button className="submit-btn" onClick={enviar} disabled={loading || !captchaToken}
          style={{opacity: (!captchaToken || loading) ? 0.6 : 1}}>
          {loading ? t('rfq_sending', lang) : t('rfq_btn', lang)}
        </button>

        <div style={{marginTop:10,fontSize:'.72rem',color:'var(--text-muted)',textAlign:'center'}}>
          {t('rfq_captcha_info', lang)}
        </div>
      </div>
    </div>
  )
}
