import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const DIRECTORIOS = [
  { value:'todos',  label:'🌍 Todos los registros' },
  { value:'spain',  label:'🇪🇸 Solo España' },
  { value:'eu',     label:'🇪🇺 Unión Europea' },
  { value:'latam',  label:'🌎 Latinoamérica' },
  { value:'global', label:'🌐 Global' },
]

// Opciones de formato WYSIWYG
const TOOLBAR = [
  { cmd:'bold',          icon:'B',        title:'Negrita',       style:{fontWeight:'bold'} },
  { cmd:'italic',        icon:'I',        title:'Cursiva',       style:{fontStyle:'italic'} },
  { cmd:'underline',     icon:'U',        title:'Subrayado',     style:{textDecoration:'underline'} },
  { cmd:'separator' },
  { cmd:'insertUnorderedList', icon:'≡',  title:'Lista' },
  { cmd:'separator' },
  { cmd:'justifyLeft',   icon:'⟵',       title:'Izquierda' },
  { cmd:'justifyCenter', icon:'↔',        title:'Centrado' },
  { cmd:'separator' },
  { cmd:'createLink',    icon:'🔗',       title:'Insertar enlace' },
  { cmd:'removeFormat',  icon:'✕',        title:'Quitar formato' },
]

export default function AdminEmail() {
  const [asunto,       setAsunto]       = useState('')
  const [destinatario, setDestinatario] = useState('todos')
  const [enviando,     setEnviando]     = useState(false)
  const [preview,      setPreview]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [historial,    setHistorial]    = useState([])
  const [conteo,       setConteo]       = useState(null)
  const editorRef = useRef(null)

  useEffect(() => {
    cargarHistorial()
  }, [])

  // Actualizar conteo de destinatarios al cambiar filtro
  useEffect(() => {
    const calcConteo = async () => {
      let q = supabase.from('empresas').select('id', { count: 'exact', head: true })
        .eq('estado', 'activa').eq('verificada', true)
      if (destinatario === 'spain')  q = q.eq('pais', 'ES')
      if (destinatario === 'eu')     q = q.eq('origen', 'ue')
      if (destinatario === 'latam')  q = q.eq('origen', 'latam')
      if (destinatario === 'global') q = q.eq('origen', 'global')
      const { count } = await q
      // Restar unsubscribes
      const { count: unsubs } = await supabase.from('email_unsubscribes').select('id', { count:'exact', head:true })
      setConteo(Math.max(0, (count||0) - (unsubs||0)))
    }
    calcConteo()
  }, [destinatario])

  const cargarHistorial = async () => {
    const { data } = await supabase.from('email_campanas')
      .select('*').order('created_at', { ascending: false }).limit(20)
    setHistorial(data || [])
  }

  const execCmd = (cmd) => {
    if (cmd === 'createLink') {
      const url = prompt('URL del enlace:')
      if (url) document.execCommand('createLink', false, url)
    } else {
      document.execCommand(cmd, false, null)
    }
    editorRef.current?.focus()
  }

  const getHtml = () => editorRef.current?.innerHTML || ''

  const enviar = async () => {
    if (!asunto.trim()) { alert('Escribe un asunto.'); return }
    const html = getHtml()
    if (!html.trim() || html === '<br>') { alert('El contenido del email está vacío.'); return }
    if (!confirm(`¿Enviar este email a ${conteo} destinatarios?`)) return

    setEnviando(true)
    setResult(null)
    try {
      const campana_id = crypto.randomUUID()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.functions.invoke('enviar-campana', {
        body: {
          asunto,
          cuerpo_html: html,
          destinatarios: destinatario,
          campana_id,
          enviado_por: user?.id
        }
      })
      if (error) throw error
      setResult({ ok: true, sent: data.sent, total: data.total })
      // Limpiar editor
      if (editorRef.current) editorRef.current.innerHTML = ''
      setAsunto('')
      cargarHistorial()
    } catch (e) {
      setResult({ ok: false, error: e.message })
    } finally {
      setEnviando(false)
    }
  }

  const fmtFecha = (ts) => new Date(ts).toLocaleString('es-ES', { dateStyle:'short', timeStyle:'short' })

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20,maxWidth:860}}>
      <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,padding:24}}>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:4,fontSize:'.95rem'}}>
          📧 Enviar email masivo
        </h3>
        <p style={{fontSize:'.78rem',color:'var(--text-muted)',marginBottom:20}}>
          Envía un email a todas las empresas verificadas del directorio seleccionado.
          Cada email incluye automáticamente un enlace de baja.
        </p>

        {result && (
          <div className={`alert ${result.ok ? 'alert-success' : 'alert-error'}`} style={{marginBottom:16}}>
            {result.ok
              ? `✅ Email enviado a ${result.sent} de ${result.total} destinatarios.`
              : `❌ Error: ${result.error}`}
          </div>
        )}

        {/* Destinatario */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div className="form-group" style={{margin:0}}>
            <label>Destinatarios</label>
            <select className="form-control" value={destinatario} onChange={e=>setDestinatario(e.target.value)}>
              {DIRECTORIOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',paddingBottom:1}}>
            {conteo !== null && (
              <div style={{padding:'10px 14px',background:'var(--cream)',borderRadius:8,fontSize:'.82rem',color:'var(--text-muted)',width:'100%'}}>
                📬 <strong style={{color:'var(--navy)',fontSize:'1rem'}}>{conteo.toLocaleString()}</strong> destinatarios (excl. bajas)
              </div>
            )}
          </div>
        </div>

        {/* Asunto */}
        <div className="form-group" style={{marginBottom:16}}>
          <label>Asunto del email</label>
          <input className="form-control" value={asunto} onChange={e=>setAsunto(e.target.value)}
            placeholder="Ej: Novedades en Xared — Nuevas funciones disponibles" />
        </div>

        {/* Editor WYSIWYG */}
        <div className="form-group" style={{marginBottom:0}}>
          <label>Contenido del email</label>
          {/* Toolbar */}
          <div style={{display:'flex',gap:3,padding:'6px 8px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderBottom:'none',borderRadius:'8px 8px 0 0',flexWrap:'wrap'}}>
            {TOOLBAR.map((btn, i) => btn.cmd === 'separator'
              ? <div key={i} style={{width:1,background:'var(--border)',margin:'2px 4px',alignSelf:'stretch'}} />
              : <button key={btn.cmd} title={btn.title}
                  onMouseDown={e => { e.preventDefault(); execCmd(btn.cmd) }}
                  style={{...btn.style, padding:'4px 10px',border:'1px solid var(--border)',borderRadius:5,
                          background:'white',cursor:'pointer',fontSize:'.82rem',color:'var(--navy)',minWidth:32}}>
                  {btn.icon}
                </button>
            )}
          </div>
          {/* Editor area */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            style={{minHeight:200,padding:16,border:'1px solid var(--border)',borderRadius:'0 0 8px 8px',
                    fontSize:'.9rem',lineHeight:1.7,outline:'none',background:'white',
                    cursor:'text'}}
            onFocus={e => { if (!e.target.innerHTML) e.target.innerHTML = '' }}
          />
          <p style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:6}}>
            💡 El link de unsubscribe se añade automáticamente al final del email.
          </p>
        </div>

        {/* Preview toggle */}
        <div style={{display:'flex',gap:10,marginTop:16,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={() => setPreview(p => !p)}
            style={{padding:'8px 16px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:'pointer',fontSize:'.82rem',color:'var(--navy)'}}>
            {preview ? '✕ Cerrar preview' : '👁 Vista previa'}
          </button>
          <button onClick={enviar} disabled={enviando || conteo === 0}
            style={{padding:'10px 24px',border:'none',borderRadius:6,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.88rem',cursor:'pointer',
                    background: conteo === 0 ? 'var(--cream-dark)' : 'var(--orange)',
                    color: conteo === 0 ? 'var(--text-muted)' : 'white',
                    opacity: enviando ? 0.7 : 1}}>
            {enviando ? '⏳ Enviando...' : `📧 Enviar a ${conteo ?? '…'} empresas`}
          </button>
        </div>

        {/* Preview panel */}
        {preview && (
          <div style={{marginTop:20,padding:20,border:'2px dashed var(--border)',borderRadius:8,background:'#fafafa'}}>
            <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.05em'}}>Preview — {asunto || '(sin asunto)'}</div>
            <div style={{fontSize:'.9rem',lineHeight:1.7}} dangerouslySetInnerHTML={{ __html: getHtml() || '<em style="color:#9ca3af">El editor está vacío</em>' }} />
            <hr style={{margin:'16px 0',border:'none',borderTop:'1px solid #e5e7eb'}} />
            <p style={{fontSize:'12px',color:'#9ca3af',textAlign:'center'}}>
              <a href="#" style={{color:'#9ca3af'}}>Unsubscribe from Xared notifications</a>
              {' · '}
              <a href="#" style={{color:'#9ca3af'}}>Darse de baja de las notificaciones de Xared</a>
            </p>
          </div>
        )}
      </div>

      {/* Historial */}
      {historial.length > 0 && (
        <div style={{background:'white',border:'1px solid var(--border)',borderRadius:12,padding:24}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:16,fontSize:'.95rem'}}>
            📋 Historial de campañas
          </h3>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {historial.map(c => (
              <div key={c.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:12,alignItems:'center',padding:'10px 14px',background:'var(--cream)',borderRadius:8}}>
                <div>
                  <div style={{fontWeight:600,color:'var(--navy)',fontSize:'.85rem'}}>{c.asunto}</div>
                  <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:2}}>
                    {DIRECTORIOS.find(d=>d.value===c.destinatarios)?.label || c.destinatarios}
                  </div>
                </div>
                <div style={{textAlign:'right',fontSize:'.78rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                  {c.total_enviado?.toLocaleString()} enviados
                </div>
                <div style={{fontSize:'.72rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                  {fmtFecha(c.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
