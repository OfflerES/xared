import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'https://xared.com'

// Mapa subdominio → { region, pais, base }
const SUBDOMAIN_MAP: Record<string, { region?: string; pais?: string }> = {
  spain:      { region: 'spain', pais: 'ES' },
  eu:         { region: 'eu' },
  latam:      { region: 'latam' },
  france:     { pais: 'FR' },
  germany:    { pais: 'DE' },
  italy:      { pais: 'IT' },
  portugal:   { pais: 'PT' },
  mexico:     { pais: 'MX' },
  argentina:  { pais: 'AR' },
  colombia:   { pais: 'CO' },
  chile:      { pais: 'CL' },
  brazil:     { pais: 'BR' },
  peru:       { pais: 'PE' },
  netherlands:{ pais: 'NL' },
  belgium:    { pais: 'BE' },
  poland:     { pais: 'PL' },
  sweden:     { pais: 'SE' },
}

const PAISES_UE = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK']

const CATEGORIAS_SLUG = [
  'alimentacion','automocion','construccion','electronica','energia',
  'farmacia','hosteleria','industria','logistica','maquinaria',
  'moda','quimica','salud','tecnologia','textil'
]

function xmlHeader() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
}

function urlEntry(loc: string, lastmod?: string, changefreq = 'weekly', priority = '0.7') {
  return `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`
}

Deno.serve(async (req) => {
  const url       = new URL(req.url)
  const tipo      = url.searchParams.get('tipo')      || 'index'
  const subdominio = url.searchParams.get('subdominio') || ''
  const regionParam = url.searchParams.get('region')  || ''

  // Resolver región y país desde subdominio o parámetro region
  let region = regionParam
  let pais: string | null = null
  let base = SITE

  if (subdominio && SUBDOMAIN_MAP[subdominio]) {
    const mapped = SUBDOMAIN_MAP[subdominio]
    if (mapped.region) region = mapped.region
    if (mapped.pais)   pais   = mapped.pais
    base = `https://${subdominio}.xared.com`
  } else if (subdominio) {
    // Subdominio desconocido — intentar como país por nombre
    base = `https://${subdominio}.xared.com`
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  }

  // ── SITEMAP INDEX ──────────────────────────────────────────────────────────
  if (tipo === 'index') {
    let xml = xmlHeader()
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += `  <sitemap><loc>${base}/sitemap-directorios.xml</loc></sitemap>\n`
    xml += `  <sitemap><loc>${base}/sitemap-empresas.xml</loc></sitemap>\n`
    xml += `  <sitemap><loc>${base}/sitemap-productos.xml</loc></sitemap>\n`
    xml += '</sitemapindex>'
    return new Response(xml, { headers })
  }

  // ── SITEMAP DIRECTORIOS ────────────────────────────────────────────────────
  if (tipo === 'directorios') {
    let xml = xmlHeader()
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += urlEntry(base + '/', undefined, 'daily', '1.0')

    if (!subdominio) {
      // xared.com — páginas estáticas + categorías
      for (const p of ['/precios', '/registro', '/publicidad']) {
        xml += urlEntry(SITE + p, undefined, 'monthly', '0.5')
      }
    }
    for (const cat of CATEGORIAS_SLUG) {
      xml += urlEntry(`${base}/cat/${cat}`, undefined, 'weekly', '0.8')
    }
    xml += '</urlset>'
    return new Response(xml, { headers })
  }

  // ── SITEMAP EMPRESAS ───────────────────────────────────────────────────────
  if (tipo === 'empresas') {
    let q = supabase
      .from('empresas')
      .select('slug, updated_at, origen, pais')
      .eq('estado', 'activa')
      .eq('verificada', true)
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })

    if (pais)              q = q.eq('pais', pais)
    else if (region === 'spain')  q = q.eq('pais', 'ES')
    else if (region === 'latam')  q = q.eq('origen', 'latam')
    else if (region === 'eu')     q = q.in('pais', PAISES_UE)

    const { data: empresas } = await q

    let xml = xmlHeader()
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for (const e of (empresas || [])) {
      const lastmod = e.updated_at ? e.updated_at.slice(0, 10) : ''
      xml += urlEntry(`${SITE}/site/${e.slug}`, lastmod, 'weekly', '0.8')
    }
    xml += '</urlset>'
    return new Response(xml, { headers })
  }

  // ── SITEMAP PRODUCTOS ──────────────────────────────────────────────────────
  if (tipo === 'productos') {
    let q = supabase
      .from('productos')
      .select('slug, updated_at, empresas!inner(slug, origen, pais, estado, verificada)')
      .eq('estado', 'activo')
      .eq('empresas.estado', 'activa')
      .eq('empresas.verificada', true)
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })

    if (pais)              q = q.eq('empresas.pais', pais)
    else if (region === 'spain')  q = q.eq('empresas.pais', 'ES')
    else if (region === 'latam')  q = q.eq('empresas.origen', 'latam')
    else if (region === 'eu')     q = q.in('empresas.pais', PAISES_UE)

    const { data: productos } = await q

    let xml = xmlHeader()
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for (const p of (productos || [])) {
      const empSlug = (p.empresas as Record<string, string>)?.slug
      if (!empSlug || !p.slug) continue
      const lastmod = p.updated_at ? p.updated_at.slice(0, 10) : ''
      xml += urlEntry(`${SITE}/site/${empSlug}/${p.slug}`, lastmod, 'monthly', '0.6')
    }
    xml += '</urlset>'
    return new Response(xml, { headers })
  }

  return new Response('tipo no válido', { status: 400 })
})
