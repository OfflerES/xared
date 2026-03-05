import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { generarSlugEmpresa, PAISES_GRUPOS, PROVINCIAS_ES, SECTORES, getOrigen, sanitize } from '../lib/utils'
import { t } from '../lib/i18n'

const ORIGIN_MSG = {
  es: {
    spain: 'Introduce tu NIF/CIF espanol. Lo verificaremos automaticamente contra el Registro Mercantil.',
    ue:    'Tu empresa quedara pendiente de verificacion. Envianos tu numero de registro mercantil a <strong>verificacion@xared.com</strong>.',
    latam: 'Tu empresa quedara pendiente de verificacion. Envianos tu registro mercantil a <strong>verificacion@xared.com</strong>.',
    other: 'Las empresas globales requieren verificacion manual. Envianos tu documentacion a <strong>verificacion@xared.com</strong>.',
  },
  en: {
    spain: 'Enter your Spanish NIF/CIF. We will verify it automatically against the Mercantile Registry.',
    ue:    'Your company will be pending verification. Send your commercial registration number to <strong>verificacion@xared.com</strong>.',
    latam: 'Your company will be pending verification. Send your commercial registration to <strong>verificacion@xared.com</strong>.',
    other: 'Global companies require manual verification. Send your documentation to <strong>verificacion@xared.com</strong>.',
  }
}

const getNifLabel = (lang) => ({
  spain: lang==='en' ? 'Tax ID (NIF/CIF) *'               : 'NIF / CIF *',
  ue:    lang==='en' ? 'Tax number (VAT) *'                : 'Numero de registro fiscal (VAT) *',
  latam: lang==='en' ? 'Tax registration number *'         : 'Numero de registro fiscal *',
  other: lang==='en' ? 'Official tax number *'             : 'Numero de registro fiscal *',
})
const getNifPh = () => ({
  spain: 'B12345678',
  ue:    'DE123456789, FR12345678901...',
  latam: 'RFC, RUT, CNPJ...',
  other: '',
})

export default function Register() {
  const { loadSession, lang } = useApp()
  const [origin, setOrigin] = useState('spain')
  const [form,   setForm]   = useState({ nif:'', razon:'', pais:'ES', email:'', pass:'', pass2:'', sector:'', provincia:'', cupon:'' })
  const [cuponValido, setCuponValido] = useState(null)
  const [cuponFb,     setCuponFb]     = useState('')
  const [ok,  setOk]  = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  const setOrig = (o) => {
    setOrigin(o)
    if (o === 'spain')  set('pais', 'ES')
    if (o === 'ue')     set('pais', 'DE')
    if (o === 'latam')  set('pais', 'MX')
    if (o === 'global') set('pais', 'OTHER')
  }

  const gruposFiltrados = () => {
    if (origin === 'spain') return PAISES_GRUPOS.filter(g => g.label.includes('España') || g.label.includes('Spain'))
    if (origin === 'ue')    return PAISES_GRUPOS.filter(g => g.label.includes('Europea') || g.label.includes('European'))
    if (origin === 'latam') return PAISES_GRUPOS.filter(g => g.label.includes('Latino') || g.label.includes('Latin'))
    return PAISES_GRUPOS.filter(g => g.label.includes('Otros') || g.label.includes('Other'))
  }

  const validarCupon = async () => {
    const codigo = form.cupon.trim().toUpperCase()
    if (!codigo) return
    const { data, error } = await supabase.from('cupones').select('*').eq('codigo', codigo).eq('activo', true).single()
    if (error || !data) { setCuponFb('❌ ' + (lang==='en'?'Invalid or expired coupon':'Cupon no valido o caducado')); setCuponValido(null); return }
    if (data.fecha_fin && new Date(data.fecha_fin) < new Date()) { setCuponFb('❌ ' + (lang==='en'?'Coupon expired':'Este cupon ha caducado')); setCuponValido(null); return }
    if (data.max_usos !== null && data.usos_actuales >= data.max_usos) { setCuponFb('❌ ' + (lang==='en'?'Coupon exhausted':'Cupon agotado')); setCuponValido(null); return }
    setCuponValido(data)
    setCuponFb(data.tipo === 'plan'
      ? '✅ ' + (lang==='en'?'Valid coupon — ':'Cupon valido — ') + data.max_productos + ' productos · ' + data.max_fotos + ' foto' + (data.max_fotos > 1 ? 's' : '')
      : '✅ ' + data.descuento_pct + '% ' + (lang==='en'?'discount applied':'de descuento aplicado'))
  }

  const submit = async () => {
    setOk(''); setErr('')
    const reqFields = lang==='en' ? 'Fill in all required fields.' : 'Rellena todos los campos obligatorios.'
    if (!form.nif || !form.razon || !form.email || !form.pass) { setErr('⚠️ ' + reqFields); return }
    if (form.pass.length < 8)    { setErr('⚠️ ' + (lang==='en'?'Password must be at least 8 characters.':'La contrasena debe tener al menos 8 caracteres.')); return }
    if (form.pass !== form.pass2) { setErr('⚠️ ' + (lang==='en'?'Passwords do not match.':'Las contrasenas no coinciden.')); return }
    if (origin === 'spain' && !/^[A-Z0-9]{8,10}$/.test(form.nif)) { setErr('⚠️ ' + (lang==='en'?'Invalid NIF/CIF format. Example: B12345678':'Formato de NIF/CIF incorrecto. Ejemplo: B12345678')); return }
    setLoading(true)
    try {
      const { data: auth, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: form.pass,
        options: { emailRedirectTo: window.location.origin, data: { razon_social: form.razon, nif: form.nif } }
      })
      if (authErr) throw authErr
      if (form.email === ADMIN_EMAIL) {
        setOk('✅ ' + (lang==='en'?'Admin account created. Verify your email and log in.':'Cuenta admin creada. Verifica tu email e inicia sesion.'))
        return
      }

      // ── Verificación automática de dominio ───────────────────────────────
      // Cupón AS ya garantiza verificación → saltamos el check de dominio
      const cuponAS = cuponValido?.codigo?.startsWith('AS')
      let verificada        = cuponAS
      let verificacionMetodo = cuponAS ? 'auto_cupon_as' : null
      let estadoEmpresa     = 'activa'  // siempre activa (puede editar perfil)

      if (!cuponAS) {
        try {
          const { data: vData } = await supabase.functions.invoke('verificar-dominio', {
            body: { email: form.email, web: form.web || null }
          })
          if (vData?.verificada) {
            verificada         = true
            verificacionMetodo = vData.motivo || 'auto_dominio'
          }
        } catch { /* si falla la función, queda pendiente de verificación manual */ }
      }

      const { data: empData, error: empErr } = await supabase.from('empresas').insert({
        user_id:               auth.user.id,
        nif:                   sanitize(form.nif),
        razon_social:          sanitize(form.razon),
        email:                 sanitize(form.email),
        sector:                sanitize(form.sector)    || null,
        provincia:             sanitize(form.provincia) || null,
        pais:                  form.pais,
        origen:                getOrigen(form.pais),
        plan:                  'gratuito',
        estado:                estadoEmpresa,
        zona:                  'nacional',
        slug:                  generarSlugEmpresa(form.razon, form.nif),
        verificada,
        verificacion_metodo:   verificacionMetodo,
      }).select().single()

      if (empErr) {
        if (empErr.code === '23505') setErr('⚠️ ' + (lang==='en'?'This tax ID is already registered.':'Este NIF/CIF ya esta registrado.'))
        else throw empErr
        return
      }
      if (empData && cuponValido) {
        const updates = { cupon_id: cuponValido.id }
        if (cuponValido.tipo === 'plan') {
          updates.max_productos_override  = cuponValido.max_productos
          updates.max_fotos_override      = cuponValido.max_fotos
          updates.con_publicidad_override = cuponValido.con_publicidad
        }
        if (cuponValido.asociacion_nombre) updates.asociacion_nombre = cuponValido.asociacion_nombre
        if (cuponValido.asociacion_url)    updates.asociacion_url    = cuponValido.asociacion_url
        await supabase.from('empresas').update(updates).eq('id', empData.id)
        await supabase.from('cupones').update({ usos_actuales: cuponValido.usos_actuales + 1 }).eq('id', cuponValido.id)
        await supabase.from('cupones_usos').insert({ cupon_id: cuponValido.id, empresa_id: empData.id })
      }

      // Mensaje según resultado de verificación
      if (verificada) {
        setOk('✅ ' + (lang==='en'
          ? 'Account created and verified! Check your email to confirm it.'
          : '¡Cuenta creada y verificada! Revisa tu email para confirmarla.'))
      } else {
        setOk('✅ ' + (lang==='en'
          ? 'Account created. Check your email and complete your profile. Your listing will be visible once we verify your company (usually within 24–48h).'
          : 'Cuenta creada. Revisa tu email y completa tu perfil. Tu empresa será visible en el directorio una vez que la verifiquemos (normalmente en 24–48h).'))
      }
    } catch(e) {
      setErr('❌ ' + (e.message || (lang==='en'?'Error creating account.':'Error al crear la cuenta.')))
    } finally {
      setLoading(false)
    }
  }

  const TABS = [
    { id:'spain',  label: lang==='en' ? '🇪🇸 Spain'         : '🇪🇸 España' },
    { id:'ue',     label: lang==='en' ? '🇪🇺 European Union' : '🇪🇺 Union Europea' },
    { id:'latam',  label: lang==='en' ? '🌎 Latin America'   : '🌎 Latinoamerica' },
    { id:'global', label: lang==='en' ? '🌍 Global'          : '🌍 Global' },
  ]

  const nifLabel = getNifLabel(lang)
  const nifPh    = getNifPh()

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <h2>{lang==='en' ? <>Publish your company in the leading <em>B2B network</em></> : <>Publica tu empresa en la <em>red B2B</em> de referencia</>}</h2>
        <p>{lang==='en'
          ? 'Thousands of global buyers search for suppliers like you every day.'
          : 'Miles de compradores globales buscan proveedores como tu cada dia.'}</p>
        <ul className="auth-perks">
          {(lang==='en'
            ? ['✅ Free sign up — visible in the directory immediately','🌍 Global reach: Spain, EU, LATAM and worldwide buyers','📩 Receive quote requests directly','🔒 Tax ID verification for greater trust']
            : ['✅ Alta gratuita — visible en el directorio inmediatamente','🌍 Exposicion global: Espana, UE, LATAM y compradores de todo el mundo','📩 Recibe solicitudes de presupuesto directamente','🔒 Verificacion NIF/CIF para mayor confianza']
          ).map((p,i) => { const sp=p.indexOf(' '); return <li key={i}><span>{p.slice(0,sp)}</span>{p.slice(sp+1)}</li> })}
        </ul>
      </div>
      <div className="auth-right">
        <h3>{t('reg_title', lang)}</h3>
        {ok  && <div className="alert alert-success">{ok}</div>}
        {err && <div className="alert alert-error">{err}</div>}

        <div className="origin-tabs" style={{flexWrap:'wrap'}}>
          {TABS.map(tab => (
            <button key={tab.id} className={'origin-tab' + (origin===tab.id?' active':'')} onClick={() => setOrig(tab.id)}
              style={{minWidth:0,flex:'1 1 auto',fontSize:'.78rem',padding:'9px 8px'}}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={'origin-info' + (origin!=='spain'?' '+origin:'')}
          dangerouslySetInnerHTML={{ __html: ORIGIN_MSG[lang]?.[origin] || ORIGIN_MSG.es[origin] }} />

        <div className="form-row">
          <div className="form-group">
            <label>{nifLabel[origin]}</label>
            <input className="form-control" value={form.nif} onChange={e=>set('nif',e.target.value.toUpperCase())} placeholder={nifPh[origin]} />
          </div>
          <div className="form-group">
            <label>{t('reg_name', lang)}</label>
            <input className="form-control" value={form.razon} onChange={e=>set('razon',e.target.value)} placeholder="Empresa S.L." />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{lang==='en' ? 'Country *' : 'Pais *'}</label>
            <select className="form-control" value={form.pais} onChange={e=>set('pais',e.target.value)}>
              {gruposFiltrados().map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.paises.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          {origin === 'spain'
            ? <div className="form-group">
                <label>{lang==='en' ? 'Province' : 'Provincia'}</label>
                <select className="form-control" value={form.provincia} onChange={e=>set('provincia',e.target.value)}>
                  <option value="">{lang==='en' ? 'Select...' : 'Selecciona...'}</option>
                  {PROVINCIAS_ES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            : <div className="form-group">
                <label>{t('reg_province', lang)}</label>
                <input className="form-control" value={form.provincia} onChange={e=>set('provincia',e.target.value)}
                  placeholder={lang==='en' ? 'City or region' : 'Ciudad o region'} />
              </div>
          }
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('reg_sector', lang)}</label>
            <select className="form-control" value={form.sector} onChange={e=>set('sector',e.target.value)}>
              <option value="">{lang==='en' ? 'Select...' : 'Selecciona...'}</option>
              {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>{t('reg_email', lang)}</label>
          <input type="email" className="form-control" value={form.email} onChange={e=>set('email',e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>{t('reg_pass', lang)}</label>
            <input type="password" className="form-control" value={form.pass} onChange={e=>set('pass',e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('reg_pass2', lang)}</label>
            <input type="password" className="form-control" value={form.pass2} onChange={e=>set('pass2',e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>{t('reg_cupon', lang)}</label>
          <div style={{display:'flex',gap:8}}>
            <input className="form-control" value={form.cupon} onChange={e=>set('cupon',e.target.value.toUpperCase())}
              placeholder="CODIGO" style={{flex:1}} />
            <button onClick={validarCupon}
              style={{padding:'10px 16px',background:'var(--cream-dark)',border:'1px solid var(--border)',borderRadius:8,fontSize:'.82rem',fontWeight:600,whiteSpace:'nowrap'}}>
              {lang==='en' ? 'Validate' : 'Validar'}
            </button>
          </div>
          {cuponFb && <div className="form-hint" style={{color:cuponValido?'var(--success)':'var(--danger)'}}>{cuponFb}</div>}
          {cuponValido?.asociacion_nombre && (
            <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'rgba(244,96,12,0.06)',border:'1px solid rgba(244,96,12,0.2)',borderRadius:8}}>
              <span style={{fontSize:'1.4rem'}}>🤝</span>
              <div>
                <div style={{fontSize:'.8rem',fontWeight:700,color:'var(--navy)'}}>{lang==='en'?'Coupon promoted by':'Cupon promovido por'}</div>
                {cuponValido.asociacion_url
                  ? <a href={cuponValido.asociacion_url} target="_blank" rel="noopener" style={{fontSize:'.85rem',color:'var(--orange)',fontWeight:600}}>{cuponValido.asociacion_nombre} →</a>
                  : <span style={{fontSize:'.85rem',color:'var(--orange)',fontWeight:600}}>{cuponValido.asociacion_nombre}</span>
                }
              </div>
            </div>
          )}
        </div>

        <button className="submit-btn" onClick={submit} disabled={loading}>
          {loading ? <><span className="spinner"/>{t('reg_loading', lang)}</> : t('reg_btn', lang)+' →'}
        </button>
        <div className="auth-switch">
          {t('reg_have_account', lang)} <Link to="/login">{t('reg_login_link', lang)}</Link>
        </div>
      </div>
    </div>
  )
}
