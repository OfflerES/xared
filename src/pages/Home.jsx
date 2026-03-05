import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { t } from '../lib/i18n'
import { PAISES_UE } from '../lib/utils'
import CompanyCard from '../components/CompanyCard'

export default function Home() {
  const { lang } = useApp()
  const navigate = useNavigate()
  const [categorias, setCategorias] = useState([])
  const [spain,      setSpain]      = useState([])
  const [ue,         setUe]         = useState([])
  const [latam,      setLatam]      = useState([])
  const [otros,      setOtros]      = useState([])
  const [total,      setTotal]      = useState(null)
  const [totalPaises, setTotalPaises] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchCat,  setSearchCat]  = useState('')

  useEffect(() => {
    const load = async () => {
      const base = 'id,razon_social,sector,provincia,descripcion,verificada,plan,pais,origen,logo_url,slug'
      const [{ data: cats }, { data: sp }, { data: ueData }, { data: lt }, { data: ot }, { count }, { data: paisRows }] = await Promise.all([
        supabase.from('categorias').select('id,nombre,nombre_en,icono,slug').eq('visible', true).order('orden'),
        supabase.from('empresas').select(base).eq('estado','activa').eq('verificada',true).eq('pais','ES').limit(12),
        supabase.from('empresas').select(base).eq('estado','activa').eq('verificada',true).in('pais', PAISES_UE).limit(12),
        supabase.from('empresas').select(base).eq('estado','activa').eq('verificada',true).eq('origen','latam').limit(12),
        supabase.from('empresas').select(base).eq('estado','activa').eq('verificada',true).eq('origen','global').limit(12),
        supabase.from('empresas').select('*',{count:'exact',head:true}).eq('verificada',true),
        supabase.from('empresas').select('pais').eq('verificada',true).eq('estado','activa'),
      ])
      const PORD = { maximo:0, profesional:1, basico:2, gratuito:3 }
      const byPlan = (arr) => (arr||[]).slice().sort((a,b)=>(PORD[a.plan]??3)-(PORD[b.plan]??3)).slice(0,6)
      setCategorias(cats || [])
      setSpain(byPlan(sp))
      setUe(byPlan(ueData))
      setLatam(byPlan(lt))
      setOtros(byPlan(ot))
      setTotal(count)
      const uniquePaises = new Set((paisRows||[]).map(r=>r.pais).filter(Boolean))
      setTotalPaises(uniquePaises.size)
    }
    load()
  }, [])

  const handleSearch = () => {
    const base = searchCat ? '/es/cat/' + searchCat : '/es'
    navigate(base + (searchTerm.trim() ? '?q=' + encodeURIComponent(searchTerm.trim()) : ''))
  }

  const DirectorySection = ({ title, badge, badgeClass, empresas, variant, dark, link }) => (
    <div className={dark ? 'featured-dark' : ''}>
      <div style={{maxWidth:1280,margin:'0 auto',padding: dark ? '0 24px' : undefined}}>
        <div className={dark ? '' : 'section-wrap'} style={dark ? {padding:'56px 0'} : {}}>
          <div className="section-header">
            <h2 className="section-title">
              {title} <span className={'section-badge ' + badgeClass}>{badge}</span>
            </h2>
            <button className="section-link" onClick={() => navigate(link || '/')}>Ver todas</button>
          </div>
          {empresas.length === 0
            ? <div style={{textAlign:'center',padding:32,color: dark ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)',fontSize:'.85rem'}}>
                Aun no hay empresas registradas en este directorio.
              </div>
            : <div className="companies-grid">
                {empresas.map(e => <CompanyCard key={e.id} empresa={e} dark={dark} variant={variant} />)}
              </div>
          }
        </div>
      </div>
    </div>
  )

  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-inner">
          <span className="hero-tag">{t('hero_tag', lang)}</span>
          <h1 dangerouslySetInnerHTML={{ __html: t('hero_h1', lang)
            .replace('proveedores verificados', '<em>proveedores verificados</em>')
            .replace('verified suppliers', '<em>verified suppliers</em>') }} />
          <p className="hero-sub" dangerouslySetInnerHTML={{ __html: t('hero_sub', lang) }} />
          <div className="hero-flags">
            <span className="hero-flag" style={{cursor:'pointer'}} onClick={() => navigate('/es')}>{t('hero_flag_es', lang)}</span>
            <span className="hero-flag" style={{cursor:'pointer'}} onClick={() => navigate('/eu')}>{t('hero_flag_eu', lang)}</span>
            <span className="hero-flag" style={{cursor:'pointer'}} onClick={() => navigate('/latam')}>{t('hero_flag_latam', lang)}</span>
            <span className="hero-flag" style={{cursor:'pointer'}} onClick={() => navigate('/global')}>{t('hero_flag_global', lang)}</span>
          </div>
          <div className="search-bar">
            <input type="text" placeholder={lang==='en'?'Search for a product or supplier...':'Busca un producto o proveedor...'}
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <select value={searchCat} onChange={e => setSearchCat(e.target.value)}>
              <option value="">{lang === 'en' ? 'All categories' : 'Todas las categorías'}</option>
              {categorias.map(c => <option key={c.id} value={c.slug || c.id}>{(lang === 'en' && c.nombre_en) ? c.nombre_en : c.nombre}</option>)}
            </select>
            <button onClick={handleSearch}>{t('search_btn', lang)}</button>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-num">{total !== null ? total.toLocaleString('es-ES') : '—'}</div><div className="stat-label">{t('stat_companies', lang)}</div></div>
            <div className="stat"><div className="stat-num">{totalPaises !== null ? totalPaises : '—'}</div><div className="stat-label">{t('stat_countries', lang)}</div></div>
          </div>
        </div>
      </section>

      <div className="section-wrap">
        <div className="section-header">
          <h2 className="section-title">{t('home_categories', lang)}</h2>
        </div>
        <div className="category-grid">
          {categorias.map(c => (
            <div key={c.id} className="cat-card" style={{cursor:'pointer'}}
              onClick={() => navigate('/es/cat/' + (c.slug || c.id))}>
              <span className="cat-icon">{c.icono || '?'}</span>
              <div className="cat-name">{(lang === 'en' && c.nombre_en) ? c.nombre_en : c.nombre}</div>
              <div className="cat-count">{lang === 'en' ? 'View products' : 'Ver productos'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="divider-line" />
      <DirectorySection title="Empresas espanolas"      badge="Espana" badgeClass="badge-spain"  empresas={spain} variant="spain" dark link="/es" />
      <div className="divider-line" />
      <DirectorySection title="Empresas europeas"       badge="UE"     badgeClass="badge-global" empresas={ue}    variant="ue"    link="/eu" />
      <div className="divider-line" />
      <DirectorySection title="Empresas latinoamericanas" badge="LATAM" badgeClass="badge-latam"  empresas={latam} variant="latam" dark link="/latam" />
      <div className="divider-line" />
      <DirectorySection title="Empresas globales"       badge="Global" badgeClass="badge-global" empresas={otros} variant="global" link="/global" />
    </>
  )
}
