import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { t } from '../lib/i18n'

export default function Login() {
  const { lang, user, loading } = useApp()
  const navigate = useNavigate()
  const [email,      setEmail]      = useState('')
  const [pass,       setPass]       = useState('')
  const [ok,         setOk]         = useState('')
  const [err,        setErr]        = useState('')
  const [info,       setInfo]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user || loading) return
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    const plan = params.get('plan')
    if (checkout === 'success') {
      navigate('/dashboard?checkout=success&plan=' + (plan || ''))
    } else {
      navigate(user.email === ADMIN_EMAIL ? '/admin' : '/dashboard')
    }
  }, [user, loading])

  const submit = async () => {
    setOk(''); setErr(''); setInfo('')
    if (!email || !pass) {
      setErr('⚠️ ' + (lang==='en' ? 'Enter email and password.' : 'Introduce email y contrasena.'))
      return
    }
    setSubmitting(true)   // ← corregido
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) {
        if (error.message.includes('Email not confirmed'))
          setInfo('📧 ' + (lang==='en' ? 'Please verify your email before logging in.' : 'Verifica tu email antes de iniciar sesion.'))
        else if (error.message.includes('Invalid login'))
          setErr('❌ ' + (lang==='en' ? 'Wrong email or password.' : 'Email o contrasena incorrectos.'))
        else throw error
        return
      }
      // La redirección la maneja el useEffect cuando loading=false y user está listo
    } catch(e) {
      setErr('❌ ' + (e.message || (lang==='en' ? 'Login error.' : 'Error al iniciar sesion.')))
    } finally {
      setSubmitting(false)  // ← corregido
    }
  }

  const isLoading = submitting || loading

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <h2>{lang==='en' ? <>Welcome back to <em>Xared</em></> : <>Bienvenido de nuevo a <em>Xared</em></>}</h2>
        <p>{lang==='en'
          ? 'Access your dashboard to manage your company, publish products and respond to quote requests.'
          : 'Accede a tu panel para gestionar tu empresa, publicar productos y responder a solicitudes de presupuesto.'}</p>
        <ul className="auth-perks">
          {(lang==='en'
            ? ['📊 Visit statistics for your profile','📩 Manage your quote requests','🖼️ Update photos and description in real time']
            : ['📊 Estadisticas de visitas a tu perfil','📩 Gestiona tus solicitudes de presupuesto','🖼️ Actualiza fotos y descripcion en tiempo real']
          ).map((p,i) => { const sp=p.indexOf(' '); return <li key={i}><span>{p.slice(0,sp)}</span>{p.slice(sp+1)}</li> })}
        </ul>
      </div>
      <div className="auth-right">
        <h3>{t('login_title', lang)}</h3>
        {ok   && <div className="alert alert-success">{ok}</div>}
        {err  && <div className="alert alert-error">{err}</div>}
        {info && <div className="alert alert-info">{info}</div>}
        <div className="form-group">
          <label>{t('login_email', lang)}</label>
          <input type="email" className="form-control" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
        </div>
        <div className="form-group">
          <label>{t('login_pass', lang)}</label>
          <input type="password" className="form-control" value={pass}
            onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
        </div>
        <button className="submit-btn" onClick={submit} disabled={isLoading}>
          {isLoading ? <><span className="spinner"/>{t('login_loading', lang)}</> : t('login_btn', lang)+' →'}
        </button>
        <div className="auth-switch" style={{marginTop:12}}>
          <Link to="/recuperar" style={{color:'var(--orange)',fontWeight:600}}>{t('login_forgot', lang)}</Link>
        </div>
        <div className="auth-switch">
          {t('login_no_account', lang)} <Link to="/registro">{t('login_register_link', lang)}</Link>
        </div>
      </div>
    </div>
  )
}