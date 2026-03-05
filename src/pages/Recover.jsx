import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { t } from '../lib/i18n'

export default function Recover() {
  const { lang } = useApp()
  const [email,   setEmail]   = useState('')
  const [ok,      setOk]      = useState('')
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setOk(''); setErr('')
    if (!email) { setErr('⚠️ ' + (lang==='en' ? 'Enter your email.' : 'Introduce tu email.')); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) throw error
      setOk('✅ ' + t('recover_sent', lang))
    } catch(e) {
      setErr('❌ ' + (e.message || (lang==='en' ? 'Error. Try again.' : 'Error. Intentalo de nuevo.')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <h2>{lang==='en' ? <>Recover access to your <em>account</em></> : <>Recupera el acceso a tu <em>cuenta</em></>}</h2>
        <p>{lang==='en' ? 'We will send you a link to reset your password.' : 'Te enviaremos un enlace para restablecer tu contrasena.'}</p>
      </div>
      <div className="auth-right">
        <h3>{t('recover_title', lang)}</h3>
        {ok  && <div className="alert alert-success">{ok}</div>}
        {err && <div className="alert alert-error">{err}</div>}
        <div className="form-group">
          <label>{t('login_email', lang)}</label>
          <input type="email" className="form-control" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <button className="submit-btn" onClick={submit} disabled={loading}>
          {loading ? <><span className="spinner"/>{lang==='en'?'Sending...':'Enviando...'}</> : t('recover_btn', lang)+' →'}
        </button>
        <div className="auth-switch"><Link to="/login">← {t('recover_back', lang)}</Link></div>
      </div>
    </div>
  )
}
