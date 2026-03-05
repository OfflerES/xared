#!/usr/bin/env node
// scripts/generate-sitemap.js
//
// Genera /var/www/xared/dist/sitemap.xml con SOLO URLs canónicas (xared.com).
// Nunca incluye subdominios.
//
// Uso:
//   node generate-sitemap.js
//
// Variables de entorno necesarias (añadir a /etc/environment o usar .env):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY=eyJ...   ← service_role, NUNCA la anon key en servidor
//
// Cron recomendado (regenera cada noche a las 3am):
//   0 3 * * * root cd /var/www/xared && node scripts/generate-sitemap.js >> /var/log/sitemap.log 2>&1

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────
const ROOT         = 'https://xared.com'
const OUTPUT_PATH  = resolve(__dirname, '../dist/sitemap.xml')

const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Faltan variables de entorno: SUPABASE_URL y/o SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── URLs estáticas ────────────────────────────────────────────────────────────
const STATIC_URLS = [
  { loc: ROOT + '/',           priority: '1.0', changefreq: 'weekly'  },
  { loc: ROOT + '/precios',    priority: '0.8', changefreq: 'monthly' },
  { loc: ROOT + '/publicidad', priority: '0.6', changefreq: 'monthly' },
  { loc: ROOT + '/es',         priority: '0.9', changefreq: 'daily'   },
  { loc: ROOT + '/eu',         priority: '0.8', changefreq: 'daily'   },
  { loc: ROOT + '/latam',      priority: '0.8', changefreq: 'daily'   },
  { loc: ROOT + '/global',     priority: '0.7', changefreq: 'daily'   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

function buildUrl({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${esc(loc)}</loc>`,
    lastmod    ? `    <lastmod>${lastmod}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority   ? `    <priority>${priority}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Generando sitemap...`)

  // Empresas activas y verificadas con slug
  const { data: empresas, error: errEmp } = await supabase
    .from('empresas')
    .select('slug, updated_at')
    .eq('estado', 'activa')
    .eq('verificada', true)
    .not('slug', 'is', null)

  if (errEmp) { console.error('❌ Error empresas:', errEmp.message); process.exit(1) }

  // Productos activos con slug + slug de empresa
  const { data: productos, error: errProd } = await supabase
    .from('productos')
    .select('slug, updated_at, empresas(slug)')
    .eq('estado', 'activo')
    .not('slug', 'is', null)

  if (errProd) { console.error('❌ Error productos:', errProd.message); process.exit(1) }

  const empresaUrls = (empresas || []).map(e => ({
    loc:        ROOT + '/e/' + e.slug,
    lastmod:    e.updated_at?.slice(0, 10),
    priority:   '0.8',
    changefreq: 'weekly',
  }))

  const productoUrls = (productos || [])
    .filter(p => p.empresas?.slug)           // descartar productos sin empresa con slug
    .map(p => ({
      loc:        ROOT + '/e/' + p.empresas.slug + '/' + p.slug,
      lastmod:    p.updated_at?.slice(0, 10),
      priority:   '0.7',
      changefreq: 'weekly',
    }))

  const allUrls = [...STATIC_URLS, ...empresaUrls, ...productoUrls]

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allUrls.map(buildUrl),
    '</urlset>',
    '',   // newline final
  ].join('\n')

  writeFileSync(OUTPUT_PATH, xml, 'utf8')

  console.log(`✅ Sitemap generado: ${allUrls.length} URLs → ${OUTPUT_PATH}`)
  console.log(`   Empresas: ${empresaUrls.length} | Productos: ${productoUrls.length} | Estáticas: ${STATIC_URLS.length}`)
}

main().catch(err => {
  console.error('❌ Error inesperado:', err)
  process.exit(1)
})
