import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PAISES_UE, PROVINCIAS_ES } from '../lib/utils'
import CompanyCard from '../components/CompanyCard'

// ── Constantes ────────────────────────────────────────────────────────────────
const OPCIONES_PAGINA = [20, 30, 40, 50]
const LS_KEY = 'xared_por_pagina'

const getPorPagina = () => {
  const v = parseInt(localStorage.getItem(LS_KEY))
  return OPCIONES_PAGINA.includes(v) ? v : 20
}

// Cada pais tiene: code ISO, local (nombre oficial), en (nombre en inglés), slug (para URL, en inglés)
// dir = "business directory" en el idioma oficial del país
const PAISES_UE_NAMED = [
  { code:'DE', local:'Deutschland',  en:'Germany',        slug:'germany',        dir:'Unternehmensverzeichnis' },
  { code:'AT', local:'Österreich',   en:'Austria',        slug:'austria',        dir:'Unternehmensverzeichnis' },
  { code:'BE', local:'België',       en:'Belgium',        slug:'belgium',        dir:'Bedrijvengids' },
  { code:'BG', local:'България',     en:'Bulgaria',       slug:'bulgaria',       dir:'Бизнес директория' },
  { code:'CY', local:'Κύπρος',       en:'Cyprus',         slug:'cyprus',         dir:'Επιχειρηματικός κατάλογος' },
  { code:'CZ', local:'Česko',        en:'Czech Republic', slug:'czech-republic', dir:'Firemní adresář' },
  { code:'DK', local:'Danmark',      en:'Denmark',        slug:'denmark',        dir:'Virksomhedsregister' },
  { code:'EE', local:'Eesti',        en:'Estonia',        slug:'estonia',        dir:'Ettevõtete kataloog' },
  { code:'FI', local:'Suomi',        en:'Finland',        slug:'finland',        dir:'Yritysluettelo' },
  { code:'FR', local:'France',       en:'France',         slug:'france',         dir:'Annuaire des entreprises' },
  { code:'GR', local:'Ελλάδα',       en:'Greece',         slug:'greece',         dir:'Επιχειρηματικός κατάλογος' },
  { code:'HR', local:'Hrvatska',     en:'Croatia',        slug:'croatia',        dir:'Poslovni imenik' },
  { code:'HU', local:'Magyarország', en:'Hungary',        slug:'hungary',        dir:'Cégjegyzék' },
  { code:'IE', local:'Éire',         en:'Ireland',        slug:'ireland',        dir:'Business directory' },
  { code:'IT', local:'Italia',       en:'Italy',          slug:'italy',          dir:'Elenco delle imprese' },
  { code:'LT', local:'Lietuva',      en:'Lithuania',      slug:'lithuania',      dir:'Įmonių katalogas' },
  { code:'LU', local:'Lëtzebuerg',   en:'Luxembourg',     slug:'luxembourg',     dir:'Annuaire des entreprises' },
  { code:'LV', local:'Latvija',      en:'Latvia',         slug:'latvia',         dir:'Uzņēmumu katalogs' },
  { code:'MT', local:'Malta',        en:'Malta',          slug:'malta',          dir:'Business directory' },
  { code:'NL', local:'Nederland',    en:'Netherlands',    slug:'netherlands',    dir:'Bedrijvengids' },
  { code:'PL', local:'Polska',       en:'Poland',         slug:'poland',         dir:'Katalog firm' },
  { code:'PT', local:'Portugal',     en:'Portugal',       slug:'portugal',       dir:'Diretório de empresas' },
  { code:'RO', local:'România',      en:'Romania',        slug:'romania',        dir:'Director de afaceri' },
  { code:'SE', local:'Sverige',      en:'Sweden',         slug:'sweden',         dir:'Företagskatalog' },
  { code:'SI', local:'Slovenija',    en:'Slovenia',       slug:'slovenia',       dir:'Imenik podjetij' },
  { code:'SK', local:'Slovensko',    en:'Slovakia',       slug:'slovakia',       dir:'Firemný adresár' },
]

// España aparece en la lista UE — bilingüe ES/EN
const ESPANA_UE = { code:'ES', local:'España', en:'Spain', slug:'spain', dir:'Directorio de empresas' }

// LATAM — español en todos, inglés para SEO
const PAISES_LATAM_NAMED = [
  { code:'MX', local:'México',          en:'Mexico',           slug:'mexico' },
  { code:'CO', local:'Colombia',        en:'Colombia',         slug:'colombia' },
  { code:'AR', local:'Argentina',       en:'Argentina',        slug:'argentina' },
  { code:'CL', local:'Chile',           en:'Chile',            slug:'chile' },
  { code:'PE', local:'Perú',            en:'Peru',             slug:'peru' },
  { code:'VE', local:'Venezuela',       en:'Venezuela',        slug:'venezuela' },
  { code:'EC', local:'Ecuador',         en:'Ecuador',          slug:'ecuador' },
  { code:'BO', local:'Bolivia',         en:'Bolivia',          slug:'bolivia' },
  { code:'PY', local:'Paraguay',        en:'Paraguay',         slug:'paraguay' },
  { code:'UY', local:'Uruguay',         en:'Uruguay',          slug:'uruguay' },
  { code:'CU', local:'Cuba',            en:'Cuba',             slug:'cuba' },
  { code:'DO', local:'Rep. Dominicana', en:'Dominican Republic',slug:'dominican-republic' },
  { code:'GT', local:'Guatemala',       en:'Guatemala',        slug:'guatemala' },
  { code:'HN', local:'Honduras',        en:'Honduras',         slug:'honduras' },
  { code:'SV', local:'El Salvador',     en:'El Salvador',      slug:'el-salvador' },
  { code:'NI', local:'Nicaragua',       en:'Nicaragua',        slug:'nicaragua' },
  { code:'CR', local:'Costa Rica',      en:'Costa Rica',       slug:'costa-rica' },
  { code:'PA', local:'Panamá',          en:'Panama',           slug:'panama' },
  { code:'PR', local:'Puerto Rico',     en:'Puerto Rico',      slug:'puerto-rico' },
]

// Helpers
const findPaisBySlug = (list, slug) => list.find(p => p.slug === slug || p.code.toLowerCase() === slug)
const findPaisByCode = (list, code) => list.find(p => p.code === code?.toUpperCase())

// Label visible del pais según contexto
// UE: "Deutschland / Germany"  |  LATAM: "México"  |  España: "España / Spain"
const paisLabel = (p, isUE) => {
  if (p.code === 'ES') return 'España / Spain'
  if (isUE) return p.local + ' / ' + p.en
  return p.local
}

// Lang detectado del navegador — 'es' para español, 'en' para el resto
const browserLang = () => (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'

const getConfig = (lang) => {
  const es = lang !== 'en'
  return {
    spain:  { label: es ? 'España'         : 'Spain',           color:'var(--spain)', basePath:'/es' },
    ue:     { label: es ? 'Unión Europea'  : 'European Union',  color:'#2563EB',      basePath:'/eu' },
    latam:  { label: es ? 'Latinoamérica' : 'Latin America',   color:'#059669',      basePath:'/latam' },
    global: { label:'Global',                                    color:'var(--navy)',  basePath:'/global' },
  }
}

const getNAV_TABS = (lang) => {
  const es = lang !== 'en'
  return [
    { id:'spain',  label: es ? 'España'         : 'Spain' },
    { id:'ue',     label: es ? 'Unión Europea'  : 'European Union' },
    { id:'latam',  label: es ? 'Latinoamérica'  : 'Latin America' },
    { id:'global', label: 'Global' },
  ]
}

// ── Componente paginacion ─────────────────────────────────────────────────────
function Paginacion({ pagina, total, porPagina, setPagina, setPorPagina }) {
  const totalPags = Math.ceil(total / porPagina)
  if (totalPags <= 1 && total <= OPCIONES_PAGINA[0]) return null

  const cambiarPorPagina = (v) => {
    const n = parseInt(v)
    localStorage.setItem(LS_KEY, n)
    setPorPagina(n)
    setPagina(0)
  }

  // Rango de paginas visibles
  const rango = []
  const delta = 2
  for (let i = Math.max(0, pagina - delta); i <= Math.min(totalPags - 1, pagina + delta); i++) {
    rango.push(i)
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginTop:32,padding:'16px 0',borderTop:'1px solid var(--border)'}}>
      {/* Selector por pagina */}
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:'.8rem',color:'var(--text-muted)'}}>
        Mostrar
        {OPCIONES_PAGINA.map(n => (
          <button key={n} onClick={() => cambiarPorPagina(n)}
            style={{padding:'4px 10px',borderRadius:6,border:'1px solid',fontSize:'.78rem',cursor:'pointer',fontWeight:600,
              borderColor: porPagina===n ? 'var(--orange)' : 'var(--border)',
              background:  porPagina===n ? 'var(--orange)' : 'white',
              color:       porPagina===n ? 'white' : 'var(--text-muted)'}}>
            {n}
          </button>
        ))}
        por pagina — {total.toLocaleString('es-ES')} resultados
      </div>

      {/* Navegacion de paginas */}
      {totalPags > 1 && (
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <button onClick={() => setPagina(p => Math.max(0, p-1))} disabled={pagina===0}
            style={{padding:'5px 10px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:pagina===0?'not-allowed':'pointer',color:pagina===0?'var(--text-muted)':'var(--navy)',fontSize:'.8rem'}}>
            Ant
          </button>
          {rango[0] > 0 && <><button onClick={() => setPagina(0)} style={{padding:'5px 10px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:'pointer',fontSize:'.8rem'}}>1</button><span style={{fontSize:'.8rem',color:'var(--text-muted)'}}>...</span></>}
          {rango.map(p => (
            <button key={p} onClick={() => setPagina(p)}
              style={{padding:'5px 10px',border:'1px solid',borderRadius:6,cursor:'pointer',fontSize:'.8rem',fontWeight: p===pagina?700:400,
                borderColor: p===pagina ? 'var(--orange)' : 'var(--border)',
                background:  p===pagina ? 'var(--orange)' : 'white',
                color:       p===pagina ? 'white' : 'var(--navy)'}}>
              {p+1}
            </button>
          ))}
          {rango[rango.length-1] < totalPags-1 && <><span style={{fontSize:'.8rem',color:'var(--text-muted)'}}>...</span><button onClick={() => setPagina(totalPags-1)} style={{padding:'5px 10px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:'pointer',fontSize:'.8rem'}}>{totalPags}</button></>}
          <button onClick={() => setPagina(p => Math.min(totalPags-1, p+1))} disabled={pagina===totalPags-1}
            style={{padding:'5px 10px',border:'1px solid var(--border)',borderRadius:6,background:'white',cursor:pagina===totalPags-1?'not-allowed':'pointer',color:pagina===totalPags-1?'var(--text-muted)':'var(--navy)',fontSize:'.8rem'}}>
            Sig
          </button>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Directorio({ region, subPais, showAll }) {
  const navigate = useNavigate()
  const { paisCode: paisCodeUrl, categoria } = useParams()
  // Si venimos de subdominio (france.xared.com), subPais sobreescribe la URL
  const paisCode = subPais || paisCodeUrl
  const [searchParams] = useSearchParams()
  const { lang } = useApp()
  const cfg     = getConfig(lang)[region] || getConfig(lang).spain
  const NAV_TABS = getNAV_TABS(lang)
  const esCat  = !!categoria
  const esPais = !!paisCode && paisCode !== 'todo'

  const paisList = region === 'ue' ? [ESPANA_UE, ...PAISES_UE_NAMED]
                 : region === 'latam' ? PAISES_LATAM_NAMED : []
  // paisCode en la URL puede ser el slug inglés (germany) o el código ISO (de) — soportamos ambos
  const paisInfo = paisCode ? (findPaisBySlug(paisList, paisCode) || findPaisByCode(paisList, paisCode)) : null

  const [empresas,       setEmpresas]       = useState([])
  const [productos,      setProductos]      = useState([])
  const [categorias,     setCategorias]     = useState([])
  const [total,          setTotal]          = useState(0)
  const [totalEmpresas,  setTotalEmpresas]  = useState(0)
  const [totalProductos, setTotalProductos] = useState(0)
  const [busqueda,       setBusqueda]       = useState(searchParams.get('q') || '')
  const [pagina,         setPagina]         = useState(0)
  const [porPagina,      setPorPagina]      = useState(getPorPagina)
  const [loading,        setLoading]        = useState(true)
  const [provincia,      setProvincia]      = useState('')
  const [paisFiltro,     setPaisFiltro]     = useState('')

  useEffect(() => {
    supabase.from('categorias').select('id,nombre,nombre_en,icono,slug').eq('visible', true).order('orden')
      .then(({ data }) => setCategorias(data || []))
  }, [])

  // Nombre de categoría según idioma del selector
  const catNombre = (c) => (lang === 'en' && c?.nombre_en) ? c.nombre_en : (c?.nombre || '')

  // ── Clave de búsqueda: cuando cambian los filtros principales, volvemos a página 0
  // Un único useEffect maneja todo: resetea pagina si los filtros cambian, luego carga
  const filtersKey = [region, paisCode, categoria, busqueda, provincia, paisFiltro, porPagina].join('|')

  useEffect(() => {
    setPagina(0)
    setEmpresas([])
    setProductos([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, pagina])

  useEffect(() => {
    const cat = categorias.find(c => c.slug === categoria)
    const isUE = region === 'ue'
    document.title = cat ? catNombre(cat) + ' — Xared'
      : paisInfo ? paisLabel(paisInfo, isUE) + ' — Xared'
      : 'Directorio ' + cfg.label + ' — Xared'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, paisCode, categoria, categorias, lang])

  const applyRegionFilter = (q) => {
    // Si hay pais, resolvemos el code ISO desde paisInfo (soporta slug o code en URL)
    const code = paisInfo ? paisInfo.code : (paisFiltro || null)
    if (code) return q.eq('pais', code)
    if (region === 'spain')  return q.eq('pais', 'ES')
    if (region === 'ue')     return q.in('pais', ['ES', ...PAISES_UE])
    if (region === 'latam')  return q.eq('origen', 'latam')
    return q
  }

  const load = async () => {
    setLoading(true)
    const term = busqueda.trim() ? '%' + busqueda.trim() + '%' : null
    const from = pagina * porPagina
    const to   = from + porPagina - 1

    const PORD = { maximo:0, profesional:1, basico:2, gratuito:3 }
    const sortByPlan     = (arr) => (arr||[]).slice().sort((a,b) => (PORD[a.plan]??3)                  - (PORD[b.plan]??3))
    const sortByPlanProd = (arr) => (arr||[]).slice().sort((a,b) => (PORD[a.empresas?.plan]??3) - (PORD[b.empresas?.plan]??3))

    // Siempre buscamos empresas — en categoría filtramos por las que tienen productos en ella
    let q = supabase.from('empresas')
      .select('id,razon_social,sector,provincia,descripcion,verificada,plan,pais,origen,logo_url,slug', { count: 'exact' })
      .eq('estado', 'activa')
      .eq('verificada', true)
      .range(from, to)

    if (esCat) {
      // Solo empresas que tienen al menos 1 producto activo en esta categoría
      const { data: catRows } = await supabase
        .from('productos')
        .select('empresa_id, categorias!inner(slug)')
        .eq('estado', 'activo')
        .eq('categorias.slug', categoria)
      const ids = [...new Set((catRows||[]).map(r => r.empresa_id).filter(Boolean))]
      if (ids.length === 0) { setEmpresas([]); setTotal(0); setLoading(false); return }
      q = q.in('id', ids)
    } else {
      q = applyRegionFilter(q)
      if (provincia) q = q.eq('provincia', provincia)
    }

    if (term) q = q.or('razon_social.ilike.' + term + ',descripcion.ilike.' + term)

    if (term) {
      // Con búsqueda: empresas + productos en paralelo
      const qProd = supabase.from('productos')
        .select('id,nombre,descripcion,slug,palabras_clave,empresa_id,empresas!inner(razon_social,slug,plan,verificada,estado),categorias(nombre,icono,nombre_en),producto_fotos(url,orden)', { count: 'exact' })
        .eq('estado', 'activo')
        .eq('empresas.estado', 'activa')
        .eq('empresas.verificada', true)
        .or('nombre.ilike.' + term + ',palabras_clave.ilike.' + term + ',descripcion.ilike.' + term)
        .range(from, to)

      const [resEmp, resProd] = await Promise.all([q, qProd])
      setEmpresas(sortByPlan(resEmp.data))
      setProductos(sortByPlanProd(resProd.data))
      setTotal(Math.max(resEmp.count || 0, resProd.count || 0))
      setTotalEmpresas(resEmp.count || 0)
      setTotalProductos(resProd.count || 0)
    } else {
      // Sin búsqueda: solo empresas
      const { data, count } = await q
      setEmpresas(sortByPlan(data))
      setTotal(count || 0)
      setProductos([])
      setTotalProductos(0)
    }
    setLoading(false)
  }

  // ── Navegación consciente de subdominios ──────────────────────────────────
  const isSubdomain = window.location.hostname.split('.').length > 2 &&
                      window.location.hostname.split('.')[0] !== 'www'

  const goRegion = (r) => {
    const MAP = { spain:'spain', ue:'eu', latam:'latam', global:'global' }
    const sub = MAP[r]
    if (!sub) return
    if (isSubdomain) {
      window.location.href = 'https://' + sub + '.xared.com'
    } else {
      navigate({ spain:'/es', ue:'/eu', latam:'/latam', global:'/global' }[r])
    }
  }

  const goCat = (slug) => {
    // Normalizar slug — quitar acentos por si la BD los tiene
    const cleanSlug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').toLowerCase()
    if (isSubdomain) {
      navigate('/cat/' + cleanSlug)
    } else {
      const base = esPais ? cfg.basePath + '/' + paisCode : cfg.basePath
      navigate(base + '/cat/' + cleanSlug)
    }
  }

  const goPais = (p) => {
    if (isSubdomain) {
      window.location.href = 'https://' + p.slug + '.xared.com'
    } else {
      navigate(cfg.basePath + '/' + p.slug)
    }
  }

  const PLAN_BORDER = { maximo:'#dc2626', profesional:'#f46010', basico:'#60a5fa', gratuito:'#d1d5db' }
  const PLAN_SHADOW = { maximo:'rgba(220,38,38,0.18)', profesional:'rgba(244,96,16,0.18)', basico:'rgba(96,165,250,0.18)', gratuito:'none' }

  const renderProductCard = (p) => {
    const foto  = (p.producto_fotos || []).sort((a, b) => a.orden - b.orden)[0]?.url
    const url   = p.empresas?.slug && p.slug ? '/e/' + p.empresas.slug + '/' + p.slug : '/producto/' + p.id
    const plan  = p.empresas?.plan || 'gratuito'
    const color = PLAN_BORDER[plan] || PLAN_BORDER.gratuito
    const shdw  = PLAN_SHADOW[plan] || 'none'
    const catName = (lang === 'en' && p.categorias?.nombre_en) ? p.categorias.nombre_en : p.categorias?.nombre
    return (
      <div key={p.id} className="company-card"
        style={{cursor:'pointer', border: '2px solid ' + color, boxShadow: shdw !== 'none' ? '0 2px 12px ' + shdw : 'none'}}
        onClick={() => navigate(url)}>
        <div className="company-logo-box">
          {foto ? <img src={foto} alt={p.nombre} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:8}} />
                : <span style={{fontSize:'1.8rem'}}>{p.categorias?.icono || '?'}</span>}
        </div>
        <div className="company-name" style={{fontSize:'.9rem'}}>{p.nombre}</div>
        <div className="company-sector">{p.categorias?.icono} {catName}</div>
        {p.empresas && <div className="company-desc" style={{fontSize:'.78rem',color:'var(--text-muted)'}}>{p.empresas.razon_social}</div>}
        <div className="company-meta">
          <span className="company-tag" style={{color, borderColor: color}}>{lang==='en'?'View product →':'Ver producto →'}</span>
        </div>
      </div>
    )
  }

  const catActiva = categorias.find(c => c.slug === categoria)
  const isUE = region === 'ue'
  const headerTitle = esCat ? catNombre(catActiva) || categoria
    : esPais && paisInfo ? paisLabel(paisInfo, isUE)
    : cfg.label

  // Selector de países compacto con links SEO ocultos para rastreadores
  const PaisSelect = () => {
    if (region !== 'ue' && region !== 'latam') return null
    if (esPais) return null
    const ph = lang === 'en' ? 'Browse by country...' : 'Ver por país...'
    return (
      <div style={{position:'relative',marginBottom:16}}>
        <select
          defaultValue=""
          onChange={e => { const p = paisList.find(x => x.slug === e.target.value); if (p) goPais(p) }}
          style={{padding:'8px 36px 8px 14px',borderRadius:8,border:'1px solid var(--border)',
                  fontSize:'.85rem',fontWeight:600,color:'var(--navy)',background:'white',
                  cursor:'pointer',width:'100%',maxWidth:340}}>
          <option value="">{ph}</option>
          {paisList.map(p => (
            <option key={p.code} value={p.slug}>{paisLabel(p, isUE)}</option>
          ))}
        </select>
        {/* Links invisibles para rastreadores — indexan todas las URLs de países */}
        <div style={{position:'absolute',overflow:'hidden',width:0,height:0}} aria-hidden="true">
          {paisList.map(p => <a key={p.code} href={cfg.basePath+'/'+p.slug}>{paisLabel(p, isUE)}</a>)}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div style={{background:'var(--navy)',padding:'40px 24px 56px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 70% 50%,rgba(244,96,12,0.08),transparent 60%)',pointerEvents:'none'}} />
        <div style={{maxWidth:1280,margin:'0 auto',position:'relative'}}>
          {/* Breadcrumb */}
          <div style={{fontSize:'.78rem',color:'rgba(255,255,255,0.45)',marginBottom:16,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <span onClick={() => navigate('/')} style={{cursor:'pointer',padding:'3px 8px',borderRadius:4,background:'rgba(255,255,255,0.07)'}}
              onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
              onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
              {lang === 'en' ? 'Home' : 'Inicio'}
            </span>
            <span style={{opacity:.4}}>›</span>
            <span onClick={() => goRegion(region)}
              style={{cursor:'pointer',padding:'3px 8px',borderRadius:4,background: esPais||esCat ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.15)',color: esPais||esCat ? 'rgba(255,255,255,0.5)' : 'white',fontWeight: esPais||esCat ? 400 : 600}}
              onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
              onMouseOut={e=>e.currentTarget.style.background= esPais||esCat ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.15)'}>
              {cfg.label}
            </span>
            {esPais && paisInfo && (
              <>
                <span style={{opacity:.4}}>›</span>
                <span onClick={() => navigate(cfg.basePath + '/' + paisInfo.slug)}
                  style={{cursor:'pointer',padding:'3px 8px',borderRadius:4,background: esCat ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.15)',color: esCat ? 'rgba(255,255,255,0.5)' : 'white',fontWeight: esCat ? 400 : 600}}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
                  onMouseOut={e=>e.currentTarget.style.background= esCat ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.15)'}>
                  {paisLabel(paisInfo, isUE)}
                </span>
              </>
            )}
            {esCat && (
              <>
                <span style={{opacity:.4}}>›</span>
                <span style={{padding:'3px 8px',borderRadius:4,background:'rgba(255,255,255,0.15)',color:'white',fontWeight:600}}>
                  {catNombre(catActiva) || categoria}
                </span>
              </>
            )}
          </div>

          {/* Título principal */}
          {esPais && paisInfo && !esCat ? (
            <>
              {/*
                Formato por caso:
                España/LATAM: "España › Directorio de empresas" + "Spain business directory"
                UE:           "France › Annuaire des entreprises" + "France business directory · Directorio de empresas"
                (siempre: idioma local en h1, inglés en subtítulo)
              */}
              {(() => {
                const isSpain = paisInfo.code === 'ES'
                const isLatam = region === 'latam'
                // Frase local: directorio en el idioma del país
                const dirLocal = isSpain || isLatam
                  ? 'Directorio de empresas'
                  : (paisInfo.dir || 'Business directory')
                // Nombre del país en local
                const nameLocal = paisInfo.local || paisInfo.en
                // Nombre del país en inglés
                const nameEn    = paisInfo.en || nameLocal
                // Subtítulo en inglés para SEO
                const subEn     = nameEn + ' business directory'
                // Subtítulo secundario en español (solo UE no-España)
                const subEs     = (!isSpain && !isLatam) ? ('Directorio de empresas · ' + nameLocal) : null

                return (
                  <>
                    <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'white',
                                fontSize:'clamp(1.4rem,4vw,2.1rem)',marginBottom:4,lineHeight:1.15,
                                display:'flex',alignItems:'baseline',flexWrap:'wrap',gap:'0 10px'}}>
                      <span>{nameLocal}</span>
                      <span style={{fontWeight:400,fontSize:'clamp(.9rem,2.2vw,1.15rem)',color:'rgba(255,255,255,0.5)'}}>
                        › {dirLocal}
                      </span>
                    </h1>
                    {/* Subtítulo EN siempre visible — clave SEO */}
                    <p style={{fontFamily:"'Syne',sans-serif",fontWeight:500,fontStyle:'italic',
                                color:'rgba(255,255,255,0.38)',fontSize:'clamp(.82rem,1.7vw,.92rem)',
                                marginBottom: subEs ? 2 : 6}}>
                      {subEn}
                    </p>
                    {/* Subtítulo ES adicional para UE */}
                    {subEs && (
                      <p style={{fontFamily:"'Syne',sans-serif",fontWeight:400,fontStyle:'italic',
                                  color:'rgba(255,255,255,0.28)',fontSize:'clamp(.78rem,1.5vw,.87rem)',
                                  marginBottom:6}}>
                        {subEs}
                      </p>
                    )}
                  </>
                )
              })()}
              <p style={{color:'rgba(255,255,255,0.4)',fontSize:'.8rem',marginBottom:24}}>
                {total.toLocaleString()} {lang==='en'?'companies':'empresas'}
              </p>
            </>
          ) : (
            <>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'white',
                          fontSize:'clamp(1.5rem,4vw,2.2rem)',marginBottom:4,lineHeight:1.15,
                          display:'flex',alignItems:'baseline',flexWrap:'wrap',gap:'0 10px'}}>
                {esCat ? (
                  <span>{(catActiva?.icono || '') + ' ' + headerTitle}</span>
                ) : (
                  <>
                    <span>{headerTitle}</span>
                    {/* Para regiones no-Global: subtítulo "Directorio de empresas" */}
                    {region !== 'global' && (
                      <span style={{fontWeight:400,fontSize:'clamp(.9rem,2.2vw,1.15rem)',color:'rgba(255,255,255,0.5)'}}>
                        › {lang==='en' ? 'Business directory' : 'Directorio de empresas'}
                      </span>
                    )}
                  </>
                )}
              </h1>
              {/* Subtítulo en el otro idioma — solo para regiones con identidad lingüística propia */}
              {!esCat && region === 'spain' && (
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:500,fontStyle:'italic',
                            color:'rgba(255,255,255,0.38)',fontSize:'clamp(.82rem,1.7vw,.92rem)',marginBottom:6}}>
                  {lang==='en' ? 'Directorio de empresas de España' : 'Spain business directory'}
                </p>
              )}
              {!esCat && region === 'latam' && (
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:500,fontStyle:'italic',
                            color:'rgba(255,255,255,0.38)',fontSize:'clamp(.82rem,1.7vw,.92rem)',marginBottom:6}}>
                  {lang==='en' ? 'Directorio de empresas de Latinoamérica' : 'Latin America business directory'}
                </p>
              )}
              {!esCat && region === 'ue' && (
                <p style={{fontFamily:"'Syne',sans-serif",fontWeight:500,fontStyle:'italic',
                            color:'rgba(255,255,255,0.38)',fontSize:'clamp(.82rem,1.7vw,.92rem)',marginBottom:6}}>
                  {lang==='en' ? 'Directorio de empresas · Unión Europea' : 'European Union business directory'}
                </p>
              )}
              <p style={{color:'rgba(255,255,255,0.45)',fontSize:'.85rem',marginBottom:24}}>
                {total.toLocaleString()} {lang==='en'?'companies':'empresas'}
              </p>
            </>
          )}

          {/* Buscador */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',maxWidth:700}}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder={lang==='en'?'Search product or supplier...':'Buscar producto o proveedor...'}
              style={{flex:1,minWidth:180,padding:'9px 16px',borderRadius:8,border:'none',fontSize:'.88rem',background:'rgba(255,255,255,0.1)',color:'white',outline:'none'}} />
            {!esCat && region === 'spain' && (
              <select value={provincia} onChange={e => { setProvincia(e.target.value); setPagina(0) }}
                style={{padding:'9px 12px',borderRadius:8,border:'none',fontSize:'.82rem',background:'rgba(255,255,255,0.1)',color:'white',outline:'none',cursor:'pointer'}}>
                <option value="" style={{color:'var(--navy)'}}>Todas las provincias</option>
                {PROVINCIAS_ES.map(p => <option key={p} value={p} style={{color:'var(--navy)'}}>{p}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:'0 auto',padding:'24px 24px 40px'}}>

        {/* Fila 1: tabs de region — solo cuando NO estamos dentro de un pais concreto */}
        {!esPais && (
          <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
            {NAV_TABS.map(tab => (
              <button key={tab.id} onClick={() => goRegion(tab.id)}
                style={{padding:'6px 14px',borderRadius:16,border:'2px solid',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.78rem',cursor:'pointer',transition:'all .15s',
                  borderColor: region===tab.id ? cfg.color : 'var(--border)',
                  background:  region===tab.id ? cfg.color : 'white',
                  color:       region===tab.id ? 'white'  : 'var(--text-muted)'}}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Fila 2: categorias */}
        {categorias.length > 0 && (
          <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap',alignItems:'center',paddingTop:8,borderTop:'1px solid var(--border)'}}>
            <span style={{fontSize:'.7rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginRight:4}}>
              {lang === 'en' ? 'Categories' : 'Categorías'}
            </span>
            {categorias.map(c => (
              <button key={c.id} onClick={() => goCat(c.slug || c.id)}
                style={{padding:'5px 12px',borderRadius:14,border:'1px solid',fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:'.75rem',cursor:'pointer',transition:'all .15s',
                  borderColor: esCat && categoria===(c.slug||c.id) ? 'var(--orange)' : 'var(--border)',
                  background:  esCat && categoria===(c.slug||c.id) ? 'var(--orange)' : 'white',
                  color:       esCat && categoria===(c.slug||c.id) ? 'white' : 'var(--text-muted)'}}>
                {c.icono} {catNombre(c)}
              </button>
            ))}
          </div>
        )}

        {/* Selector de país compacto para EU y LATAM */}
        <PaisSelect />

        {/* Contenido */}
        {loading
          ? <div style={{textAlign:'center',padding:48,color:'var(--text-muted)'}}>{lang==='en'?'Loading...':'Cargando...'}</div>
          : <>
              {/* Empresas */}
              {empresas.length > 0 && (
                <div style={{marginBottom: productos.length > 0 ? 32 : 0}}>
                  {busqueda.trim() && (
                    <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:12}}>
                      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.95rem',margin:0}}>
                        {lang==='en'?'Companies':'Empresas'}
                      </h2>
                      <span style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{totalEmpresas.toLocaleString()} {lang==='en'?'results':'resultados'}</span>
                    </div>
                  )}
                  <div className="companies-grid">
                    {empresas.map(e => (
                      <div key={e.id} style={{position:'relative'}}>
                        <CompanyCard empresa={e} variant={cfg.variant} />
                        {region === 'global' && e.pais && (
                          <div style={{textAlign:'center',fontSize:'.7rem',color:'var(--text-muted)',marginTop:-8,marginBottom:8}}>{e.pais}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Productos — solo cuando hay búsqueda activa */}
              {busqueda.trim() && productos.length > 0 && (
                <div style={{borderTop: empresas.length > 0 ? '2px solid var(--border)' : 'none', paddingTop: empresas.length > 0 ? 28 : 0}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:12}}>
                    <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:'var(--navy)',fontSize:'.95rem',margin:0}}>
                      {lang==='en'?'Products':'Productos'}
                    </h2>
                    <span style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{totalProductos.toLocaleString()} {lang==='en'?'results':'resultados'}</span>
                  </div>
                  <div className="companies-grid">{productos.map(renderProductCard)}</div>
                </div>
              )}

              {/* Vacío total */}
              {empresas.length === 0 && (!busqueda.trim() || productos.length === 0) && (
                <div style={{textAlign:'center',padding:48,color:'var(--text-muted)',fontSize:'.9rem'}}>
                  {esCat
                    ? (lang==='en'?'No companies in this category yet.':'No hay empresas en esta categoría aún.')
                    : (lang==='en'?'No results found.':'No hay resultados con estos filtros.')}
                </div>
              )}

              <Paginacion pagina={pagina} total={total} porPagina={porPagina} setPagina={setPagina} setPorPagina={setPorPagina} />
            </>
        }
      </div>
    </>
  )
}
