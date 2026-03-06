import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { detectSubdomain } from '../lib/subdomain'

const SUBDOMAIN = detectSubdomain()

function detectarZona() {
  if (!SUBDOMAIN) {
    const path = window.location.pathname
    if (path.startsWith('/es'))    return 'espana'
    if (path.startsWith('/eu'))    return 'europa'
    if (path.startsWith('/latam')) return 'latam'
    if (path.startsWith('/e/') || path === '/') return 'espana'
    return 'global'
  }
  const { region } = SUBDOMAIN
  if (region === 'spain') return 'espana'
  if (region === 'ue')    return 'europa'
  if (region === 'latam') return 'latam'
  return 'global'
}

const PLANES_PAGO = ['basico', 'profesional', 'maximo']

export default function BannerPublicitario() {
  const [campana, setCampana] = useState(null)
  const [visible, setVisible] = useState(false)
  const reportado = useRef(false)
  const zona      = detectarZona()

  useEffect(() => {
    const cargar = async () => {
      // Si estamos en el perfil de una empresa, verificar su plan
      const path = window.location.pathname
      if (path.startsWith('/e/')) {
        const slug = path.split('/')[2]
        if (slug) {
          const { data: emp } = await supabase
            .from('empresas').select('plan').eq('slug', slug).single()
          if (emp && PLANES_PAGO.includes(emp.plan)) return // no mostrar
        }
      }

      const { data } = await supabase
        .rpc('get_banner_activo', { zona_param: zona })
      if (data?.length > 0) {
        setCampana(data[0])
        setVisible(true)
      }
    }
    cargar()
  }, [zona])

  // Registrar impresión una sola vez cuando el banner aparece
  useEffect(() => {
    if (!campana || reportado.current) return
    reportado.current = true
    supabase.functions.invoke('banner-impresion', {
      body: {
        campanaId: campana.id,
        tipo:      'impresion',
        referer:   window.location.href,
        userAgent: navigator.userAgent,
      }
    })
  }, [campana])

  const handleClick = () => {
    supabase.functions.invoke('banner-impresion', {
      body: { campanaId: campana.id, tipo: 'click' }
    })
    window.open(campana.url_destino, '_blank', 'noopener,noreferrer')
  }

  if (!visible || !campana) return null

  return (
    <div style={{
      width:        '100%',
      background:   'var(--cream)',
      borderBottom: '1px solid var(--border)',
      display:      'flex',
      justifyContent: 'center',
      alignItems:   'center',
      padding:      '6px 16px',
      position:     'relative',
    }}>
      {/* Etiqueta publicitaria */}
      <span style={{
        position:      'absolute',
        top:           4,
        left:          8,
        fontSize:      '.6rem',
        color:         'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '.06em',
      }}>
        Publicidad
      </span>

      {/* Banner clickable */}
      <div onClick={handleClick} style={{cursor:'pointer', lineHeight:0}}>
        <img
          src={campana.banner_url}
          alt={campana.nombre || 'Publicidad'}
          style={{
            width:      '100%',
            maxWidth:   728,
            height:     90,
            objectFit:  'cover',
            borderRadius: 6,
            display:    'block',
          }}
          onError={() => setVisible(false)}
        />
      </div>

      {/* Cerrar */}
      <button
        onClick={() => setVisible(false)}
        style={{
          position:   'absolute',
          top:        4,
          right:      8,
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          fontSize:   '.75rem',
          color:      'var(--text-muted)',
          lineHeight: 1,
        }}
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  )
}