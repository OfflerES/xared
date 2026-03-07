import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { t } from '../lib/i18n'
import RFQModal from '../components/RFQModal'
import ContactoModal from '../components/ContactoModal'
import { useCanonical } from '../hooks/useCanonical'

// Email ofuscado — visible solo al hacer clic, no indexable por bots
function EmailOfuscado({ email, lang }) {
  const [revelado, setRevelado] = useState(false)
  const [user, domain] = email.split('@')
  return (
    <div style={{marginTop:12}}>
      {revelado
        ? <a href={'mailto:' + email}
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',border:'1px solid var(--border)',borderRadius:8,fontSize:'.82rem',fontWeight:600,color:'var(--navy)',textDecoration:'none',wordBreak:'break-all'}}>
            <span>✉</span> {email}
          </a>
        : <button onClick={() => setRevelado(true)}
            style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'10px 14px',border:'1px solid var(--border)',borderRadius:8,fontSize:'.82rem',fontWeight:600,color:'var(--navy)',background:'white',cursor:'pointer',textAlign:'left'}}>
            <span>✉</span>
            <span style={{letterSpacing:2,color:'var(--text-muted)'}}>
              {user.slice(0,2) + '•••' + '@' + domain.slice(0,2) + '•••'}
            </span>
            <span style={{marginLeft:'auto',fontSize:'.7rem',color:'var(--orange)',fontWeight:700}}>{t('emp_show_email', lang)}</span>
          </button>
      }
      {revelado && (
        <div style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:4,lineHeight:1.4}}>
          {t('emp_direct_contact', lang)}
        </div>
      )}
    </div>
  )
}


export default function EmpresaPublica({ bySlug }) {
  const { id, slug } = useParams()
  const navigate     = useNavigate()
  const { lang }     = useApp()
  const [empresa,  setEmpresa]  = useState(null)
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [rfqOpen,      setRfqOpen]      = useState(false)
  const [contactoOpen, setContactoOpen] = useState(false)

  // ── Canónica: siempre xared.com/site/:slug ──────────────────────────────────
  // null mientras empresa carga = no inyecta nada todavía
  useCanonical(empresa?.slug ? '/site/' + empresa.slug : null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let empId = id
      if (bySlug) {
        const { data } = await supabase.from('empresas').select('id').eq('slug', slug).single()
        if (!data) { setLoading(false); return }
        empId = data.id
      }
      const { data: emp } = await supabase.from('empresas').select('*').eq('id', empId).eq('estado','activa').eq('verificada', true).single()
      if (!emp) { setLoading(false); return }
      setEmpresa(emp)
      document.title = emp.razon_social + ' — Proveedor B2B · Xared'

      const { data: prods } = await supabase
        .from('productos').select('*, categorias(nombre, icono), producto_fotos(url, orden)')
        .eq('empresa_id', empId).eq('estado','activo').order('created_at', { ascending: false })
      setProducts(prods || [])
      setLoading(false)
    }
    load()
  }, [id, slug, bySlug])

  const compartir = (red) => {
    const url = encodeURIComponent(window.location.href)
    const txt = encodeURIComponent(document.title)
    const urls = {
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + url,
      whatsapp: 'https://wa.me/?text=' + txt + '%20' + url,
      twitter:  'https://twitter.com/intent/tweet?url=' + url + '&text=' + txt,
    }
    if (red === 'copy') { navigator.clipboard.writeText(window.location.href); return }
    if (urls[red]) window.open(urls[red], '_blank', 'noopener')
  }

  if (loading) return <div style={{textAlign:'center',padding:80,color:'var(--text-muted)'}}>Cargando...</div>
  if (!empresa) return <div style={{textAlign:'center',padding:80,color:'var(--text-muted)'}}>Empresa no encontrada.</div>

  const inicial = empresa.razon_social?.charAt(0).toUpperCase() || '🏢'
  const metas = [
    empresa.provincia && '📍 ' + empresa.provincia,
    empresa.zona      && '🌐 ' + ({local:'Local',nacional:'Nacional',global:'Global'}[empresa.zona] || empresa.zona),
    empresa.telefono  && '📞 ' + empresa.telefono,
  ].filter(Boolean)

  return (
    <>
      {/* Breadcrumb */}
      <div style={{background:'var(--navy)',padding:'14px 24px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{maxWidth:1100,margin:'0 auto',fontSize:'.78rem',color:'rgba(255,255,255,0.4)',display:'flex',alignItems:'center',gap:8}}>
          <span onClick={() => navigate('/')} style={{cursor:'pointer'}} className="bread-link">{t('dir_breadcrumb_home', lang)}</span>
          <span>›</span>
          <span onClick={() => navigate('/')} style={{cursor:'pointer'}} className="bread-link">{empresa.sector || 'Directorio'}</span>
          <span>›</span>
          <span style={{color:'rgba(255,255,255,0.7)'}}>{empresa.razon_social}</span>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'36px 24px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:32}}>
          {/* Main */}
          <div>
            {/* Header */}
            <div style={{display:'flex',gap:20,alignItems:'flex-start',marginBottom:24}}>
              <div className="company-logo-box" style={{width:80,height:80,borderRadius:14,flexShrink:0,fontSize:'2.4rem',fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)'}}>
                {empresa.logo_url ? <img src={empresa.logo_url} alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : inicial}
              </div>
              <div style={{flex:1}}>
                <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',fontSize:'1.6rem',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                  {empresa.razon_social}
                  {empresa.verificada && <span style={{color:'var(--verified)',fontSize:'.85rem'}}>✔ {t('emp_verified', lang)}</span>}
                </h1>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                  <span style={{fontSize:'.78rem',fontWeight:600,padding:'3px 10px',borderRadius:20,
                    background: empresa.pais==='ES'?'rgba(170,21,27,0.08)':'rgba(37,99,235,0.08)',
                    color:      empresa.pais==='ES'?'var(--spain)':'var(--latam)',
                    border:     empresa.pais==='ES'?'1px solid rgba(170,21,27,0.15)':'1px solid rgba(37,99,235,0.15)'}}>
                    {empresa.pais==='ES'?'🇪🇸 España':empresa.origen==='latam'?'🌎 '+(empresa.pais||'LATAM'):'🌍 '+(empresa.pais||'Global')}
                  </span>
                  {empresa.sector && <span style={{fontSize:'.78rem',color:'var(--text-muted)',padding:'3px 10px',borderRadius:20,background:'var(--cream-dark)'}}>{empresa.sector}</span>}
                </div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:'.82rem',color:'var(--text-muted)'}}>
                  {metas.map((m,i) => <span key={i}>{m}</span>)}
                </div>
                {empresa.asociacion_nombre && (
                  <div style={{marginTop:10,display:'inline-flex',alignItems:'center',gap:7,padding:'5px 12px',background:'rgba(244,96,12,0.06)',border:'1px solid rgba(244,96,12,0.18)',borderRadius:20}}>
                    <span style={{fontSize:'.82rem'}}>🤝</span>
                    <span style={{fontSize:'.78rem',color:'var(--text-muted)'}}>{t('emp_member_of', lang)}</span>
                    {empresa.asociacion_url
                      ? <a href={empresa.asociacion_url} target="_blank" rel="noopener" style={{fontSize:'.8rem',fontWeight:700,color:'var(--orange)'}}>{empresa.asociacion_nombre} ↗</a>
                      : <span style={{fontSize:'.8rem',fontWeight:700,color:'var(--orange)'}}>{empresa.asociacion_nombre}</span>
                    }
                  </div>
                )}
              </div>
            </div>

            {empresa.descripcion && <p style={{fontSize:'.93rem',color:'var(--text)',lineHeight:1.7,marginBottom:24}}>{empresa.descripcion}</p>}

            {empresa.web && <div style={{marginBottom:24}}>
              <a href={empresa.web} target="_blank" rel="noopener" style={{fontSize:'.83rem',color:'var(--orange)',fontWeight:600}}>🔗 {empresa.web.replace(/^https?:\/\//, '')}</a>
            </div>}

            {/* Productos */}
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:16,fontSize:'1.1rem'}}>
              {t('emp_products', lang)} <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'.85rem'}}>({products.length})</span>
            </h2>
            {products.length === 0
              ? <p style={{color:'var(--text-muted)',fontSize:'.85rem'}}>{t('emp_no_products', lang)}</p>
              : <div className="companies-grid">
                  {products.map(p => {
                    const foto = (p.producto_fotos||[]).sort((a,b)=>a.orden-b.orden)[0]?.url
                    return (
                      <div key={p.id} className="company-card" onClick={() => navigate(empresa.slug && p.slug ? '/site/' + empresa.slug + '/' + p.slug : '/producto/' + p.id)} style={{cursor:'pointer'}}>
                        <div className="company-logo-box">{foto ? <img src={foto} alt={p.nombre} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:8}} /> : (p.categorias?.icono||'📦')}</div>
                        <div className="company-name" style={{fontSize:'.9rem'}}>{p.nombre}</div>
                        <div className="company-sector">{p.categorias?.icono||''} {p.categorias?.nombre||''}</div>
                        {p.cantidad_minima && <div className="company-desc" style={{fontSize:'.78rem'}}>{t('emp_min', lang)} {p.cantidad_minima} {p.unidad_minima||'uds'}</div>}
                        <div className="company-meta"><span className="company-tag">{t('emp_view_product', lang)}</span></div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Sidebar */}
          <div>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:24,marginBottom:16}}>

              {/* Opcion 1 — Presupuesto formal */}
              <div style={{marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <span style={{fontSize:'1.1rem'}}>📋</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.88rem'}}>{t('emp_request_quote', lang)}</span>
                </div>
                <button onClick={() => setRfqOpen(true)}
                  style={{width:'100%',background:'var(--orange)',color:'white',border:'none',padding:12,borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.9rem',cursor:'pointer',marginBottom:6}}>
                  {t('emp_request_quote_btn', lang)}
                </button>
                <div style={{fontSize:'.71rem',color:'var(--text-muted)',lineHeight:1.5,padding:'0 2px'}}>
                  {t('emp_request_quote_desc', lang)}
                </div>
              </div>

              <div style={{borderTop:'1px dashed var(--border)',margin:'16px 0'}} />

              {/* Opcion 2 — Mensaje interno */}
              <div style={{marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <span style={{fontSize:'1.1rem'}}>💬</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.88rem'}}>{t('emp_message', lang)}</span>
                </div>
                <button onClick={() => setContactoOpen(true)}
                  style={{width:'100%',background:'var(--cream)',color:'var(--navy)',border:'1px solid var(--border)',padding:11,borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:'.88rem',cursor:'pointer',marginBottom:6}}>
                  {t('emp_message_btn', lang)}
                </button>
                <div style={{fontSize:'.71rem',color:'var(--text-muted)',lineHeight:1.5,padding:'0 2px'}}>
                  {t('emp_message_desc', lang)}
                </div>
              </div>

              {empresa.telefono && (
                <>
                  <div style={{borderTop:'1px solid var(--border)',margin:'16px 0'}} />
                  <a href={'tel:' + empresa.telefono}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',border:'1px solid var(--border)',borderRadius:8,fontSize:'.85rem',fontWeight:600,color:'var(--navy)',textDecoration:'none'}}>
                    <span>📞</span> {empresa.telefono}
                  </a>
                </>
              )}

              {empresa.email && (
                <>
                  {!empresa.telefono && <div style={{borderTop:'1px solid var(--border)',margin:'16px 0'}} />}
                  <EmailOfuscado email={empresa.email} lang={lang} />
                </>
              )}
            </div>
            {/* Redes sociales */}
            {(empresa.linkedin || empresa.instagram || empresa.twitter || empresa.whatsapp) && (
              <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:20,marginBottom:16}}>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',marginBottom:12,fontSize:'.88rem'}}>
                  {lang === 'en' ? 'Connect' : 'Redes'}
                </div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {empresa.linkedin && (
                    <a href={empresa.linkedin} target="_blank" rel="noopener noreferrer"
                      title="LinkedIn"
                      style={{display:'flex',alignItems:'center',justifyContent:'center',width:40,height:40,borderRadius:8,background:'#0A66C2',color:'white',textDecoration:'none',flexShrink:0}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                  )}
                  {empresa.instagram && (
                    <a href={empresa.instagram} target="_blank" rel="noopener noreferrer"
                      title="Instagram"
                      style={{display:'flex',alignItems:'center',justifyContent:'center',width:40,height:40,borderRadius:8,background:'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',color:'white',textDecoration:'none',flexShrink:0}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </a>
                  )}
                  {empresa.twitter && (
                    <a href={empresa.twitter} target="_blank" rel="noopener noreferrer"
                      title="X / Twitter"
                      style={{display:'flex',alignItems:'center',justifyContent:'center',width:40,height:40,borderRadius:8,background:'#000',color:'white',textDecoration:'none',flexShrink:0}}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {empresa.whatsapp && (
                    <a href={'https://wa.me/' + empresa.whatsapp.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer"
                      title="WhatsApp"
                      style={{display:'flex',alignItems:'center',justifyContent:'center',width:40,height:40,borderRadius:8,background:'#25D366',color:'white',textDecoration:'none',flexShrink:0}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {rfqOpen      && <RFQModal tipo="empresa" empresaId={empresa.id} lang={lang} onClose={() => setRfqOpen(false)} />}
      {contactoOpen && <ContactoModal empresa={empresa} lang={lang} onClose={() => setContactoOpen(false)} />}
    </>
  )
}
