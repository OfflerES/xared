import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

export default function Contacto() {
  const { lang } = useApp()
  const es = lang !== 'en'
  const [form, setForm] = useState({ nombre:'', email:'', asunto:'', mensaje:'' })
  const [sending, setSending] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  const submit = async () => {
    setErr('')
    if (!form.nombre || !form.email || !form.asunto || !form.mensaje) {
      setErr(es ? 'Rellena todos los campos.' : 'Please fill in all fields.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErr(es ? 'Email no válido.' : 'Invalid email.')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.from('contactos_admin').insert({
        nombre:  form.nombre.trim(),
        email:   form.email.trim(),
        asunto:  form.asunto.trim(),
        mensaje: form.mensaje.trim(),
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
    <div style={{maxWidth:620,margin:'0 auto',padding:'56px 24px'}}>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',marginBottom:8,fontSize:'clamp(1.6rem,4vw,2.2rem)'}}>
        {es ? 'Contacto' : 'Contact us'}
      </h1>
      <p style={{color:'var(--text-muted)',marginBottom:32,lineHeight:1.6}}>
        {es
          ? 'Escríbenos para cualquier consulta. Te responderemos en 24–48h.'
          : 'Write to us for any enquiry. We will reply within 24–48h.'}
      </p>

      {ok ? (
        <div style={{textAlign:'center',padding:'48px 24px',background:'var(--cream)',borderRadius:16,border:'1px solid var(--border)'}}>
          <div style={{fontSize:'2.5rem',marginBottom:16}}>✅</div>
          <h2 style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)',marginBottom:8}}>
            {es ? 'Mensaje enviado' : 'Message sent'}
          </h2>
          <p style={{color:'var(--text-muted)',fontSize:'.9rem'}}>
            {es ? 'Te responderemos en breve en el email indicado.' : 'We will reply shortly to the email provided.'}
          </p>
        </div>
      ) : (
        <div style={{background:'white',border:'1px solid var(--border)',borderRadius:14,padding:32}}>
          {err && <div className="alert alert-error" style={{marginBottom:16}}>{err}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>{es ? 'Nombre *' : 'Name *'}</label>
              <input className="form-control" value={form.nombre} onChange={e=>set('nombre',e.target.value)}
                placeholder={es ? 'Tu nombre o empresa' : 'Your name or company'} />
            </div>
            <div className="form-group">
              <label>{es ? 'Email *' : 'Email *'}</label>
              <input type="email" className="form-control" value={form.email} onChange={e=>set('email',e.target.value)}
                placeholder="hola@empresa.com" />
            </div>
          </div>

          <div className="form-group">
            <label>{es ? 'Asunto *' : 'Subject *'}</label>
            <input className="form-control" value={form.asunto} onChange={e=>set('asunto',e.target.value)}
              placeholder={es ? 'En qué podemos ayudarte?' : 'How can we help you?'} />
          </div>

          <div className="form-group">
            <label style={{display:'flex',justifyContent:'space-between'}}>
              <span>{es ? 'Mensaje *' : 'Message *'}</span>
              <span style={{fontWeight:400,fontSize:'.75rem',color:'var(--text-muted)'}}>{form.mensaje.length}/1000</span>
            </label>
            <textarea className="form-control" rows={5} value={form.mensaje} onChange={e=>set('mensaje',e.target.value.slice(0,1000))}
              placeholder={es ? 'Describe tu consulta...' : 'Describe your enquiry...'} />
          </div>

          <button className="submit-btn" onClick={submit} disabled={sending} style={{marginTop:8}}>
            {sending
              ? <><span className="spinner"/>{es ? 'Enviando...' : 'Sending...'}</>
              : (es ? 'Enviar mensaje →' : 'Send message →')}
          </button>
        </div>
      )}
    </div>
  )
}
