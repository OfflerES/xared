export default function Mantenimiento({ msgEs, msgEn }) {
  // Detectar idioma del navegador
  const esEs = (navigator.language || 'en').toLowerCase().startsWith('es')
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                 background:'var(--navy)',padding:24,textAlign:'center'}}>
      <div style={{marginBottom:32,opacity:.9}}>
        {/* Logo inline para no depender de componentes */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="24" fill="rgba(244,96,12,0.15)"/>
          <text x="24" y="31" textAnchor="middle" fontSize="24" fill="#f46010" fontWeight="bold">X</text>
        </svg>
      </div>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'white',
                  fontSize:'clamp(1.4rem,4vw,2rem)',marginBottom:12}}>
        🔧 {esEs ? 'Mantenimiento' : 'Maintenance'}
      </h1>
      <p style={{color:'rgba(255,255,255,0.7)',maxWidth:480,lineHeight:1.7,fontSize:'1rem',marginBottom:8}}>
        {esEs ? msgEs : msgEn}
      </p>
      {!esEs && (
        <p style={{color:'rgba(255,255,255,0.4)',maxWidth:480,lineHeight:1.7,fontSize:'.88rem',fontStyle:'italic'}}>
          {msgEs}
        </p>
      )}
      <p style={{color:'rgba(255,255,255,0.3)',marginTop:32,fontSize:'.78rem'}}>
        Xared B2B Network
      </p>
    </div>
  )
}
