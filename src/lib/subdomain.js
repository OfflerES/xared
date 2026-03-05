// ── Mapa completo de subdominios → región/país ────────────────────────────────
// Cada entrada: subdominio → { region, paisSlug? }
// paisSlug es el slug usado en las rutas de Directorio (/eu/france, /latam/mexico, etc.)

export const SUBDOMAIN_MAP = {
  // Regiones hub
  'spain':   { region: 'spain',  paisSlug: null },
  'eu':      { region: 'ue',     paisSlug: null },
  'latam':   { region: 'latam',  paisSlug: null },
  'global':  { region: 'global', paisSlug: null },

  // Países UE
  'germany':        { region: 'ue', paisSlug: 'germany' },
  'austria':        { region: 'ue', paisSlug: 'austria' },
  'belgium':        { region: 'ue', paisSlug: 'belgium' },
  'bulgaria':       { region: 'ue', paisSlug: 'bulgaria' },
  'cyprus':         { region: 'ue', paisSlug: 'cyprus' },
  'czech-republic': { region: 'ue', paisSlug: 'czech-republic' },
  'denmark':        { region: 'ue', paisSlug: 'denmark' },
  'estonia':        { region: 'ue', paisSlug: 'estonia' },
  'finland':        { region: 'ue', paisSlug: 'finland' },
  'france':         { region: 'ue', paisSlug: 'france' },
  'greece':         { region: 'ue', paisSlug: 'greece' },
  'croatia':        { region: 'ue', paisSlug: 'croatia' },
  'hungary':        { region: 'ue', paisSlug: 'hungary' },
  'ireland':        { region: 'ue', paisSlug: 'ireland' },
  'italy':          { region: 'ue', paisSlug: 'italy' },
  'lithuania':      { region: 'ue', paisSlug: 'lithuania' },
  'luxembourg':     { region: 'ue', paisSlug: 'luxembourg' },
  'latvia':         { region: 'ue', paisSlug: 'latvia' },
  'malta':          { region: 'ue', paisSlug: 'malta' },
  'netherlands':    { region: 'ue', paisSlug: 'netherlands' },
  'poland':         { region: 'ue', paisSlug: 'poland' },
  'portugal':       { region: 'ue', paisSlug: 'portugal' },
  'romania':        { region: 'ue', paisSlug: 'romania' },
  'sweden':         { region: 'ue', paisSlug: 'sweden' },
  'slovenia':       { region: 'ue', paisSlug: 'slovenia' },
  'slovakia':       { region: 'ue', paisSlug: 'slovakia' },

  // España como país UE (subdominio spain → directorio España)
  'spain-country':  { region: 'ue', paisSlug: 'spain' },

  // Países LATAM
  'mexico':             { region: 'latam', paisSlug: 'mexico' },
  'colombia':           { region: 'latam', paisSlug: 'colombia' },
  'argentina':          { region: 'latam', paisSlug: 'argentina' },
  'chile':              { region: 'latam', paisSlug: 'chile' },
  'peru':               { region: 'latam', paisSlug: 'peru' },
  'venezuela':          { region: 'latam', paisSlug: 'venezuela' },
  'ecuador':            { region: 'latam', paisSlug: 'ecuador' },
  'bolivia':            { region: 'latam', paisSlug: 'bolivia' },
  'paraguay':           { region: 'latam', paisSlug: 'paraguay' },
  'uruguay':            { region: 'latam', paisSlug: 'uruguay' },
  'cuba':               { region: 'latam', paisSlug: 'cuba' },
  'dominican-republic': { region: 'latam', paisSlug: 'dominican-republic' },
  'guatemala':          { region: 'latam', paisSlug: 'guatemala' },
  'honduras':           { region: 'latam', paisSlug: 'honduras' },
  'el-salvador':        { region: 'latam', paisSlug: 'el-salvador' },
  'nicaragua':          { region: 'latam', paisSlug: 'nicaragua' },
  'costa-rica':         { region: 'latam', paisSlug: 'costa-rica' },
  'panama':             { region: 'latam', paisSlug: 'panama' },
  'puerto-rico':        { region: 'latam', paisSlug: 'puerto-rico' },
}

/**
 * Detecta el subdominio activo desde window.location.hostname
 * Devuelve { region, paisSlug } o null si es el dominio raíz
 *
 * Ejemplos:
 *   france.xared.com  → { region: 'ue',    paisSlug: 'france' }
 *   spain.xared.com   → { region: 'spain', paisSlug: null }
 *   xared.com         → null
 *   localhost         → null
 */
export function detectSubdomain() {
  const hostname = window.location.hostname  // e.g. "france.xared.com"
  const parts    = hostname.split('.')

  // localhost o dominio raíz (xared.com, www.xared.com) → sin subdominio
  if (parts.length <= 2) return null
  if (parts[0] === 'www') return null

  const sub = parts[0].toLowerCase()  // "france"
  return SUBDOMAIN_MAP[sub] || null
}
