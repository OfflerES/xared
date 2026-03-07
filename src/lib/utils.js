// ── Sufijos legales a eliminar del slug ───────────────────────────────────────
const SUFIJOS_LEGALES = [
  // España
  'sl','sa','slu','sau','sll','scoop','sc','cb','scp','snc','scom',
  // Internacional
  'gmbh','ag','kg','ohg','gbr',         // Alemania/Austria
  'ltd','llc','inc','corp','co',         // Anglosajón
  'sas','sarl','snc','eurl',             // Francia
  'srl','spa','snc','sas',              // Italia/LATAM
  'bv','nv',                             // Países Bajos/Bélgica
  'ab',                                  // Suecia
  'oy',                                  // Finlandia
  'as',                                  // Noruega/Dinamarca
  'lda','lda',                           // Portugal
  'cia','ltda',                          // LATAM
]

export function generarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    .slice(0, 80)
}

export function generarSlugEmpresa(razonSocial) {
  // 1. Normalizar y partir en tokens
  let tokens = razonSocial
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')                       // quitar puntuación
    .trim()
    .split(/\s+/)

  // 2. Eliminar sufijos legales del final (pueden ser 1 o 2 tokens finales)
  while (tokens.length > 1 && SUFIJOS_LEGALES.includes(tokens[tokens.length - 1])) {
    tokens.pop()
  }

  // 3. Construir slug limpio
  return tokens.join('-').replace(/-+/g, '-').slice(0, 60) || 'empresa'
}

export function slugPersonalizado(slug) {
  // Limpia y valida un slug propuesto por el usuario
  return slug
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/**
 * Genera un slug único para un producto del tipo "mesa-de-madera-a3f8b2c1.html"
 * Los primeros 8 chars del UUID garantizan unicidad incluso con nombres idénticos.
 */
export function generarSlugProducto(nombre, id) {
  const base  = generarSlug(nombre).slice(0, 60)
  const sufId = id ? id.replace(/-/g, '').slice(0, 8) : ''
  return base + (sufId ? '-' + sufId : '') + '.html'
}

export function detectarZona() {
  const lang = (navigator.language || '').toLowerCase()
  if (lang.startsWith('es-es') || lang.startsWith('ca') || lang.startsWith('gl') || lang.startsWith('eu')) return 'spain'
  if (lang.startsWith('es')) return 'latam'
  return 'global'
}

// Códigos ISO de países de la Unión Europea (sin España)
export const PAISES_UE = [
  'AT','BE','BG','CY','CZ','DE','DK','EE','FI','FR',
  'GR','HR','HU','IE','IT','LT','LU','LV','MT','NL',
  'PL','PT','RO','SE','SI','SK',
]

export function getOrigen(pais) {
  if (pais === 'ES')              return 'spain'
  if (PAISES_UE.includes(pais))  return 'ue'
  const latam = ['MX','CO','AR','CL','PE','VE','EC','BO','PY','UY','CU','DO','GT','HN','SV','NI','CR','PA','PR']
  if (latam.includes(pais))      return 'latam'
  return 'global'
}

export const PLAN_LIMITS = {
  gratuito:    3,
  basico:      10,
  profesional: 20,
  maximo:      50,
}

export const PROVINCIAS_ES = [
  'Álava','Albacete','Alicante','Almería','Asturias','Ávila','Badajoz','Barcelona',
  'Burgos','Cáceres','Cádiz','Cantabria','Castellón','Ciudad Real','Córdoba',
  'Cuenca','Girona','Granada','Guadalajara','Guipúzcoa','Huelva','Huesca',
  'Islas Baleares','Jaén','La Coruña','La Rioja','Las Palmas','León','Lleida',
  'Lugo','Madrid','Málaga','Murcia','Navarra','Ourense','Palencia','Pontevedra',
  'Salamanca','Santa Cruz de Tenerife','Segovia','Sevilla','Soria','Tarragona',
  'Teruel','Toledo','Valencia','Valladolid','Vizcaya','Zamora','Zaragoza',
  'Ceuta','Melilla',
]

// Países agrupados para el select de registro
export const PAISES_GRUPOS = [
  {
    label: '🇪🇸 España',
    paises: [{ code:'ES', name:'España' }]
  },
  {
    label: '🇪🇺 Unión Europea',
    paises: [
      { code:'AT', name:'Austria' },
      { code:'BE', name:'Bélgica' },
      { code:'BG', name:'Bulgaria' },
      { code:'CY', name:'Chipre' },
      { code:'CZ', name:'República Checa' },
      { code:'DE', name:'Alemania' },
      { code:'DK', name:'Dinamarca' },
      { code:'EE', name:'Estonia' },
      { code:'FI', name:'Finlandia' },
      { code:'FR', name:'Francia' },
      { code:'GR', name:'Grecia' },
      { code:'HR', name:'Croacia' },
      { code:'HU', name:'Hungría' },
      { code:'IE', name:'Irlanda' },
      { code:'IT', name:'Italia' },
      { code:'LT', name:'Lituania' },
      { code:'LU', name:'Luxemburgo' },
      { code:'LV', name:'Letonia' },
      { code:'MT', name:'Malta' },
      { code:'NL', name:'Países Bajos' },
      { code:'PL', name:'Polonia' },
      { code:'PT', name:'Portugal' },
      { code:'RO', name:'Rumanía' },
      { code:'SE', name:'Suecia' },
      { code:'SI', name:'Eslovenia' },
      { code:'SK', name:'Eslovaquia' },
    ]
  },
  {
    label: '🌎 Latinoamérica',
    paises: [
      { code:'MX', name:'México' },
      { code:'CO', name:'Colombia' },
      { code:'AR', name:'Argentina' },
      { code:'CL', name:'Chile' },
      { code:'PE', name:'Perú' },
      { code:'VE', name:'Venezuela' },
      { code:'EC', name:'Ecuador' },
      { code:'BO', name:'Bolivia' },
      { code:'PY', name:'Paraguay' },
      { code:'UY', name:'Uruguay' },
      { code:'CU', name:'Cuba' },
      { code:'DO', name:'República Dominicana' },
      { code:'GT', name:'Guatemala' },
      { code:'HN', name:'Honduras' },
      { code:'SV', name:'El Salvador' },
      { code:'NI', name:'Nicaragua' },
      { code:'CR', name:'Costa Rica' },
      { code:'PA', name:'Panamá' },
      { code:'PR', name:'Puerto Rico' },
    ]
  },
  {
    label: '🌍 Global',
    paises: [
      { code:'GB', name:'Reino Unido' },
      { code:'US', name:'Estados Unidos' },
      { code:'CA', name:'Canadá' },
      { code:'AU', name:'Australia' },
      { code:'JP', name:'Japón' },
      { code:'CN', name:'China' },
      { code:'IN', name:'India' },
      { code:'BR', name:'Brasil' },
      { code:'ZA', name:'Sudáfrica' },
      { code:'MA', name:'Marruecos' },
      { code:'OTHER', name:'Otro país / Global' },
    ]
  },
]

export const SECTORES = [
  'Alimentación y bebidas','Agricultura y ganadería','Automoción','Construcción y materiales',
  'Cosmética y cuidado personal','Energía y medioambiente','Farmacia y salud',
  'Industria y manufactura','Logística y transporte','Maquinaria e industria',
  'Moda y textil','Química','Servicios profesionales','Tecnología e informática',
  'Turismo y hostelería','Otros',
]

/**
 * Elimina etiquetas HTML, scripts y caracteres peligrosos de un string.
 * Úsala antes de guardar cualquier input de usuario en la BD.
 */
export function sanitize(str) {
  if (!str || typeof str !== 'string') return str
  return str
    // Eliminar etiquetas HTML completas
    .replace(/<[^>]*>/g, '')
    // Eliminar atributos de eventos (onclick, onload, etc.)
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Eliminar javascript: en href/src
    .replace(/javascript\s*:/gi, '')
    // Eliminar data: URIs peligrosas
    .replace(/data\s*:\s*text\/html/gi, '')
    // Eliminar vbscript:
    .replace(/vbscript\s*:/gi, '')
    // Limpiar espacios extra resultantes
    .trim()
}
