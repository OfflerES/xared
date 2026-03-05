import { useNavigate } from 'react-router-dom'

const PLAN_BORDER = {
  maximo:      { color: '#dc2626', shadow: 'rgba(220,38,38,0.18)',   label: null },
  profesional: { color: '#f46010', shadow: 'rgba(244,96,16,0.18)',   label: null },
  basico:      { color: '#60a5fa', shadow: 'rgba(96,165,250,0.18)',  label: null },
  gratuito:    { color: '#d1d5db', shadow: 'none',                   label: null },
}

const PLAN_ORDER = { maximo: 0, profesional: 1, basico: 2, gratuito: 3 }

export { PLAN_ORDER }

export default function CompanyCard({ empresa, dark, variant }) {
  const navigate = useNavigate()
  const inicial  = empresa.razon_social?.charAt(0).toUpperCase() || '🏢'
  const plan     = empresa.plan || 'gratuito'
  const pb       = PLAN_BORDER[plan] || PLAN_BORDER.gratuito
  const isPaid   = plan !== 'gratuito'

  const borderStyle = dark
    ? { border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)' }
    : {
        border:     `2px solid ${pb.color}`,
        cursor:     'pointer',
        boxShadow:  pb.shadow !== 'none' ? `0 2px 12px ${pb.shadow}` : 'none',
      }

  return (
    <div
      className={"company-card" + (variant === 'spain' ? ' spain-card' : variant === 'latam' ? ' latam-card' : '') + (isPaid ? ' premium' : '')}
      style={borderStyle}
      onClick={() => navigate(empresa.slug ? '/e/' + empresa.slug : '/empresa/' + empresa.id)}
    >
      <div className="company-logo-box" style={dark ? {background:'rgba(255,255,255,0.08)'} : {}}>
        {empresa.logo_url
          ? <img src={empresa.logo_url} alt={empresa.razon_social} style={{width:'100%',height:'100%',objectFit:'cover'}} />
          : <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'1.8rem',color:dark?'white':'var(--navy)'}}>{inicial}</span>
        }
      </div>
      <div className="company-name" style={dark?{color:'white'}:{}}>
        {empresa.razon_social}
        {empresa.verificada && <span className="verified-badge">✔</span>}
      </div>
      <div className="company-sector">
        {empresa.sector}{empresa.provincia ? ' · ' + empresa.provincia : ''}
        {empresa.pais && empresa.pais !== 'ES' ? ' · ' + empresa.pais : ''}
      </div>
      {empresa.descripcion && <div className="company-desc">{empresa.descripcion.slice(0,80)}...</div>}
      <div className="company-meta">
        <span className="company-tag" style={isPaid && !dark ? {color: pb.color, borderColor: pb.color} : {}}>
          {lang_tag(plan)}
        </span>
      </div>
    </div>
  )
}

// etiqueta discreta de plan — solo para planes de pago
function lang_tag(plan) {
  if (plan === 'maximo')      return 'Ver perfil →'
  if (plan === 'profesional') return 'Ver perfil →'
  if (plan === 'basico')      return 'Ver perfil →'
  return 'Ver perfil →'
}
