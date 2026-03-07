import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { detectSubdomain } from '../lib/subdomain'

const RUTAS_EXCLUIDAS = ['/login', '/registro', '/recuperar', '/precios', '/admin', '/moderador']
const SUBDOMAIN = detectSubdomain()
const PLANES_PAGO = ['basico', 'profesional', 'maximo']

function detectarZona(path) {
  // Si hay subdominio, la zona viene de la región del subdominio
  if (SUBDOMAIN) {
    const { region } = SUBDOMAIN
    if (region === 'spain') return 'espana'
    if (region === 'ue')    return 'europa'
    if (region === 'latam') return 'latam'
    return 'global'
  }
  // Dominio raíz xared.com → siempre global
  return 'global'
}

export default function BannerPublicitario() {
  const location  = useLocation()
  const [campana, setCampana] = useState(null)
  const [visible, setVisible] = useState(false)
  const reportado = useRef(false)

  const path = location.pathname
  const rutaExcluida = RUTAS_EXCLUIDAS.some(r => path === r || path.startsWith(r + '/'))

  useEffect(() => {
    if (rutaExcluida) {
      setCampana(null)
      setVisible(false)
      return
    }

    let cancelled = false
    reportado.current = false

    const cargar = async () => {
      // No mostrar en perfil de empresa con plan de pago
      if (path.startsWith('/site/')) {
        const slug = path.split('/')[2]
        if (slug) {
          const { data: emp } = await supabase
            .from('empresas').select('plan').eq('slug', slug).single()
          if (emp && PLANES_PAGO.includes(emp.plan)) return
        }
      }

      // Leer porcentaje AdSense desde config (default 90)
      const { data: cfgData } = await supabase
        .from('config').select('valor').eq('clave', 'adsense_pct').maybeSingle()
      const adsensePct = parseInt(cfgData?.valor ?? 90)

      // Decidir si mostrar AdSense o buscar campaña contratada
      const roll = Math.floor(Math.random() * 100)
      if (roll < adsensePct) {
        // Mostrar AdSense
        if (!cancelled) {
          setCampana({ _tipo: 'adsense' })
          setVisible(true)
        }
        return
      }

      // Buscar campaña contratada
      const zona = detectarZona(path)
      const { data } = await supabase.rpc('get_banner_activo', { zona_param: zona })
      if (!cancelled && data?.length > 0) {
        setCampana(data[0])
        setVisible(true)
      } else if (!cancelled && adsensePct < 100) {
        // Fallback a AdSense si no hay campaña contratada disponible
        setCampana({ _tipo: 'adsense' })
        setVisible(true)
      }
    }

    setCampana(null)
    setVisible(false)
    cargar()

    return () => { cancelled = true }
  }, [path, rutaExcluida])

  useEffect(() => {
    if (!campana || reportado.current || campana._tipo === 'adsense') return
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

  const isAdsense = campana._tipo === 'adsense'

  return (
    <div style={{
      width:          '100%',
      background:     'var(--cream)',
      borderBottom:   '1px solid var(--border)',
      display:        'flex',
      justifyContent: 'center',
      alignItems:     'center',
      padding:        '6px 16px',
      position:       'relative',
      minHeight:      isAdsense ? 100 : 'auto',
    }}>
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

      {isAdsense ? (
        <AdSenseSlot onClose={() => setVisible(false)} />
      ) : (
        <div onClick={handleClick} style={{cursor:'pointer', lineHeight:0}}>
          <img
            src={campana.banner_url}
            alt={campana.nombre || 'Publicidad'}
            style={{
              width:        '100%',
              maxWidth:     728,
              height:       90,
              objectFit:    'cover',
              borderRadius: 6,
              display:      'block',
            }}
            onError={() => setVisible(false)}
          />
        </div>
      )}

      {!isAdsense && (
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
          X
        </button>
      )}
    </div>
  )
}

// Componente AdSense — inyecta script + ins cuando hay slot configurado
function AdSenseSlot({ onClose }) {
  const slotRef = useRef(null)
  const [slotId, setSlotId] = useState(null)
  const [noSlot, setNoSlot] = useState(false)

  useEffect(() => {
    supabase.from('config').select('valor').eq('clave', 'adsense_slot').maybeSingle().then(({ data }) => {
      if (data?.valor?.trim()) {
        setSlotId(data.valor.trim())
      } else {
        setNoSlot(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!slotId || !slotRef.current) return
    try {
      // Cargar script AdSense si no está ya cargado
      if (!document.querySelector('script[src*="adsbygoogle"]')) {
        const script = document.createElement('script')
        script.async = true
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8285528910683262'
        script.crossOrigin = 'anonymous'
        document.head.appendChild(script)
      }
      // Activar el slot
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch(e) {
      console.warn('AdSense error:', e)
    }
  }, [slotId])

  // Sin slot configurado — no mostrar nada
  if (noSlot) return null

  if (!slotId) return null

  return (
    <div style={{position:'relative', maxWidth:728, width:'100%'}}>
      <ins
        ref={slotRef}
        className="adsbygoogle"
        style={{display:'block', width:'100%', height:90}}
        data-ad-client="ca-pub-8285528910683262"
        data-ad-slot={slotId}
        data-ad-format="horizontal"
        data-full-width-responsive="false"
      />
      <button onClick={onClose}
        style={{position:'absolute',top:2,right:2,background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--text-muted)'}}>
        X
      </button>
    </div>
  )
}
