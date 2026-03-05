import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { sanitize } from '../lib/utils'
import { t } from '../lib/i18n'

const MAX_MENSAJES_POR_REMITENTE = 5
const MAX_CHARS = 250

export default function ContactoModal({ empresa, lang: langProp, onClose }) {
  const { user, empresa: miEmpresa, lang: ctxLang } = useApp()
  const lang = langProp || ctxLang || 'es'
  const estaRegistrado = !!user

  // Si esta logueado usamos su email directamente
  const [email,   setEmail]   = useState(miEmpresa?.email || user?.email || '')
  const [mensaje, setMensaje] = useState('')
  const [step,    setStep]    = useState('form')
  const [sending, setSending] = useState(false)
  const [errMsg,  setErrMsg]  = useState('')

  const enviar = async () => {
    setErrMsg('')
    if (!email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { setErrMsg('Introduce un email valido.'); return }
    if (!mensaje.trim()) { setErrMsg('Escribe un mensaje.'); return }
    if (mensaje.length > MAX_CHARS) { setErrMsg('Maximo ' + MAX_CHARS + ' caracteres.'); return }

    setSending(true)
    try {
      const { count } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresa.id)
        .eq('remitente_email', email.toLowerCase().trim())

      if (count >= MAX_MENSAJES_POR_REMITENTE) { setStep('lleno'); return }

      const { error } = await supabase.from('mensajes').insert({
        empresa_id:         empresa.id,
        remitente_email:    sanitize(email.toLowerCase().trim()),
        contenido:          sanitize(mensaje.trim()),
        // Usuario registrado: verificado directamente, sin email de confirmacion
        verificado:         estaRegistrado,
        token_verificacion: estaRegistrado ? null : crypto.randomUUID(),
      })
      if (error) throw error

      // Solo enviamos email de verificacion si NO esta registrado
      if (!estaRegistrado) {
        const { data: inserted } = await supabase
          .from('mensajes')
          .select('token_verificacion')
          .eq('empresa_id', empresa.id)
          .eq('remitente_email', email.toLowerCase().trim())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (inserted?.token_verificacion) {
          await supabase.functions.invoke('enviar-verificacion-mensaje', {
            body: {
              token:           inserted.token_verificacion,
              remitente_email: email.toLowerCase().trim(),
              empresa_nombre:  empresa.razon_social,
              preview:         mensaje.trim().slice(0, 60),
            }
          })
        }
      }

      setStep('enviado')
    } catch(e) {
      setErrMsg('Error al enviar: ' + (e.message || 'intentalo de nuevo.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:460}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'1.05rem'}}>
            {t('contacto_title', lang)} {empresa.razon_social}
          </h3>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.3rem',color:'var(--text-muted)',cursor:'pointer'}}>✕</button>
        </div>

        {step === 'form' && (
          <>
            <div style={{background: estaRegistrado ? 'rgba(5,150,105,0.06)' : 'var(--cream)', border: '1px solid ' + (estaRegistrado ? 'rgba(5,150,105,0.2)' : 'var(--border)'), borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:'.8rem',color:'var(--text-muted)',lineHeight:1.5}}>
              {estaRegistrado ? t('contacto_info_registered', lang) : t('contacto_info_guest', lang)}
            </div>

            {errMsg && <div className="alert alert-error" style={{marginBottom:12}}>{errMsg}</div>}

            <div className="form-group">
              <label>{t('contacto_email', lang)}</label>
              <input className="form-control" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="tu@email.com"
                readOnly={estaRegistrado}
                style={estaRegistrado ? {background:'var(--cream)',cursor:'not-allowed'} : {}}
              />
              {estaRegistrado && (
                <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:3}}>
                  {t('contacto_email_note', lang)}
                </div>
              )}
            </div>

            <div className="form-group">
              <label style={{display:'flex',justifyContent:'space-between'}}>
                {t('contacto_message', lang)}
                <span style={{fontWeight:400,color: mensaje.length > MAX_CHARS ? 'var(--danger)' : 'var(--text-muted)',fontSize:'.75rem'}}>
                  {mensaje.length}/{MAX_CHARS}
                </span>
              </label>
              <textarea className="form-control" rows={4} value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                placeholder={t('contacto_message_placeholder', lang)} style={{resize:'vertical'}} />
            </div>

            <button className="submit-btn" onClick={enviar} disabled={sending || mensaje.length > MAX_CHARS}>
              {sending ? t('contacto_sending', lang) : t('contacto_btn', lang)}
            </button>

            {!estaRegistrado && (
              <div style={{marginTop:10,fontSize:'.73rem',color:'var(--text-muted)',textAlign:'center'}}>
                {t('contacto_verify_note', lang)}
              </div>
            )}
          </>
        )}

        {step === 'enviado' && (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>✅</div>
            <h4 style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)',marginBottom:8}}>{t('contacto_sent_title', lang)}</h4>
            <p style={{fontSize:'.88rem',color:'var(--text-muted)',lineHeight:1.6}}>
              {estaRegistrado
                ? t('contacto_sent_registered', lang) + ' ' + empresa.razon_social + '.'
                : t('contacto_sent_guest', lang) + ' ' + empresa.razon_social + '.'
              }
            </p>
            <button onClick={onClose} className="submit-btn" style={{marginTop:20}}>{t('contacto_close', lang)}</button>
          </div>
        )}

        {step === 'lleno' && (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>📭</div>
            <h4 style={{fontFamily:"'Syne',sans-serif",color:'var(--navy)',marginBottom:8}}>{t('contacto_full_title', lang)}</h4>
            <p style={{fontSize:'.88rem',color:'var(--text-muted)',lineHeight:1.6}}>{t('contacto_full_text', lang)}</p>
            <button onClick={onClose} className="submit-btn" style={{marginTop:20}}>{t('contacto_close', lang)}</button>
          </div>
        )}
      </div>
    </div>
  )
}
