import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { t } from '../lib/i18n'
import RFQModal from '../components/RFQModal'
import { useCanonical } from '../hooks/useCanonical'

export default function ProductoPublico({ bySlug }) {
  const { id, empSlug, prodSlug } = useParams()
  const navigate = useNavigate()
  const { lang } = useApp()
  const [prod,    setProd]    = useState(null)
  const [fotoMain,setFotoMain]= useState('')
  const [loading, setLoading] = useState(true)
  const [rfqOpen, setRfqOpen] = useState(false)

  const emp = prod?.empresas

  // ── Canónica: siempre xared.com/site/:empSlug/:prodSlug ─────────────────────
  // null mientras carga = no inyecta nada todavía
  useCanonical(
    emp?.slug && prod?.slug
      ? '/site/' + emp.slug + '/' + prod.slug
      : null
  )

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let prodId = id
      if (bySlug) {
        const { data: empData } = await supabase.from('empresas').select('id').eq('slug', empSlug).single()
        if (!empData) { setLoading(false); return }
        const { data: p } = await supabase.from('productos').select('id').eq('empresa_id', empData.id).eq('slug', prodSlug).single()
        if (!p) { setLoading(false); return }
        prodId = p.id
      }
      const { data } = await supabase.from('productos')
        .select('*, categorias(nombre, icono), empresas(*), producto_fotos(url, orden)')
        .eq('id', prodId).eq('estado','activo').single()
      if (data) {
        setProd(data)
        const fotos = (data.producto_fotos||[]).sort((a,b)=>a.orden-b.orden)
        setFotoMain(fotos[0]?.url || '')
        document.title = data.nombre + ' — ' + (data.empresas?.razon_social||'Proveedor') + ' · Xared'
      }
      setLoading(false)
    }
    load()
  }, [id, empSlug, prodSlug, bySlug])

  if (loading) return <div style={{textAlign:'center',padding:80,color:'var(--text-muted)'}}>{t('prod_loading', lang)}</div>
  if (!prod)   return <div style={{textAlign:'center',padding:80,color:'var(--text-muted)'}}>{t('prod_not_found', lang)}</div>

  const cat   = prod.categorias
  const fotos = (prod.producto_fotos||[]).sort((a,b)=>a.orden-b.orden)

  const distMap = { local: t('prod_dist_local', lang), nacional: t('prod_dist_nacional', lang), global: t('prod_dist_global', lang) }
  const specs = [
    prod.cantidad_minima && [t('prod_min_order', lang), prod.cantidad_minima + ' ' + (prod.unidad_minima||'uds')],
    prod.plazo_entrega   && [t('prod_delivery', lang),  prod.plazo_entrega],
    prod.zona            && [t('prod_distribution', lang), distMap[prod.zona] || prod.zona],
    emp?.provincia       && [t('prod_origin', lang), emp.provincia + (emp.pais && emp.pais!=='ES' ? ', '+emp.pais : ', España')],
    emp?.verificada      && [t('prod_company', lang), '✔ ' + t('prod_verified_company', lang)],
  ].filter(Boolean)

  return (
    <>
      <div style={{background:'var(--navy)',padding:'14px 24px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{maxWidth:1100,margin:'0 auto',fontSize:'.78rem',color:'rgba(255,255,255,0.4)',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span onClick={() => navigate('/')} style={{cursor:'pointer'}}>{t('dir_breadcrumb_home', lang)}</span><span>›</span>
          <span>{cat?.nombre || t('prod_category', lang)}</span><span>›</span>
          <span onClick={() => navigate(emp?.slug ? '/site/'+emp.slug : '/empresa/'+emp?.id)} style={{cursor:'pointer'}}>{emp?.razon_social||'Empresa'}</span><span>›</span>
          <span style={{color:'rgba(255,255,255,0.7)'}}>{prod.nombre}</span>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'36px 24px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:32}}>
          <div>
            {/* Galeria */}
            <div style={{background:'var(--cream-dark)',borderRadius:14,overflow:'hidden',marginBottom:16,height:380,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {fotoMain
                ? <img src={fotoMain} alt={prod.nombre} style={{width:'100%',height:'100%',objectFit:'contain'}} />
                : <span style={{fontSize:'4rem'}}>{cat?.icono||'📦'}</span>
              }
            </div>
            {fotos.length > 1 && (
              <div style={{display:'flex',gap:8,marginBottom:24}}>
                {fotos.map((f,i) => (
                  <button key={i} className={'foto-thumb-btn' + (f.url===fotoMain?' active':'')} onClick={() => setFotoMain(f.url)}>
                    <img src={f.url} alt={'foto '+(i+1)} />
                  </button>
                ))}
              </div>
            )}

            <div style={{marginBottom:8}}>
              <span style={{fontSize:'.75rem',fontWeight:700,color:'var(--orange)',textTransform:'uppercase',letterSpacing:'.06em'}}>{cat?.icono||''} {cat?.nombre||''}</span>
            </div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',fontSize:'1.5rem',marginBottom:12}}>{prod.nombre}</h1>
            {prod.descripcion && <p style={{fontSize:'.93rem',color:'var(--text)',lineHeight:1.7,marginBottom:24}}>{prod.descripcion}</p>}

            {specs.length > 0 && (
              <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',marginBottom:24}}>
                {specs.map(([label, val]) => (
                  <div key={label} className="spec-row">
                    <div className="spec-label">{label}</div>
                    <div className="spec-value">{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:14,padding:24,marginBottom:16}}>
              <button onClick={() => setRfqOpen(true)} style={{width:'100%',background:'var(--orange)',color:'white',border:'none',padding:13,borderRadius:8,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'1rem',cursor:'pointer',marginBottom:16}}>
                {t('prod_request_quote', lang)}
              </button>
              <div style={{display:'flex',gap:12,alignItems:'center',cursor:'pointer',padding:'12px 0',borderTop:'1px solid var(--cream-dark)'}} onClick={() => navigate(emp?.slug ? '/site/'+emp.slug : '/empresa/'+emp?.id)}>
                <div className="company-logo-box" style={{width:44,height:44,flexShrink:0,fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)'}}>
                  {emp?.logo_url ? <img src={emp.logo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="logo" /> : emp?.razon_social?.charAt(0)||'🏢'}
                </div>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.88rem'}}>{emp?.razon_social}</div>
                  <div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{emp?.sector}</div>
                  <div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{emp?.provincia}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rfqOpen && <RFQModal tipo="producto" empresaId={emp?.id} productoId={prod.id} productoNombre={prod.nombre} lang={lang} onClose={() => setRfqOpen(false)} />}
    </>
  )
}
