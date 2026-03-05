import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { ADMIN_EMAIL } from '../lib/supabase'
import { t } from '../lib/i18n'
import XaredLogo from './XaredLogo'

export default function Nav() {
  const { user, empresa, moderador, lang, setLang, logout } = useApp()
  const navigate  = useNavigate()
  const isAdmin   = user?.email === ADMIN_EMAIL
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => { setOpen(false); logout(); navigate('/') }

  return (
    <nav>
      <div className="nav-inner">
        <Link to="/" className="logo"><XaredLogo /></Link>
        <ul className="nav-links">
          <li><Link to="/" className="nav-btn">{t('nav_home', lang)}</Link></li>
          <li><Link to="/precios" className="nav-btn">{t('nav_pricing', lang)}</Link></li>
          <li><Link to="/publicidad" className="nav-btn">Publicidad</Link></li>

          {!user ? (
            <>
              <li><Link to="/login"    className="nav-btn">{t('nav_login', lang)}</Link></li>
              <li><Link to="/registro" className="nav-btn nav-cta">{t('nav_register', lang)}</Link></li>
            </>
          ) : isAdmin ? (
            <li>
              <div className="nav-user">
                <Link to="/admin" className="nav-btn" style={{color:'rgba(255,140,0,0.9)'}}>⚙ Admin</Link>
                <button className="nav-logout" onClick={handleLogout}>{t('nav_logout', lang)}</button>
              </div>
            </li>
          ) : (
            <li ref={dropRef} style={{position:'relative'}}>
              {/* Botón principal — nombre empresa con flecha */}
              <button
                onClick={() => setOpen(o => !o)}
                style={{display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:8,padding:'6px 13px',cursor:'pointer',color:'white',fontFamily:"'DM Sans',sans-serif",fontSize:'.85rem',fontWeight:500,transition:'background .2s'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}
              >
                <span style={{maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {empresa?.razon_social || user.email}
                </span>
                <span style={{fontSize:'.65rem',opacity:.7,transition:'transform .2s',transform:open?'rotate(180deg)':'none'}}>▼</span>
              </button>

              {/* Dropdown */}
              {open && (
                <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'white',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 8px 32px rgba(0,0,0,0.15)',minWidth:190,zIndex:200,overflow:'hidden'}}>
                  <div style={{padding:'8px 14px',borderBottom:'1px solid var(--cream-dark)',fontSize:'.72rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em'}}>
                    {empresa?.razon_social || user.email}
                  </div>
                  <button onClick={() => { setOpen(false); navigate(empresa?.slug ? '/e/' + empresa.slug : '/dashboard') }}
                    style={{width:'100%',textAlign:'left',padding:'11px 16px',border:'none',background:'none',cursor:'pointer',fontSize:'.88rem',color:'var(--navy)',display:'flex',alignItems:'center',gap:10,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}
                    onMouseOver={e=>e.currentTarget.style.background='var(--cream)'}
                    onMouseOut={e=>e.currentTarget.style.background='none'}>
                    🏢 {t('nav_my_company', lang)} <span style={{fontSize:'.72rem',color:'var(--text-muted)',marginLeft:'auto'}}>{lang==='en'?'Public profile':'Perfil publico'}</span>
                  </button>
                  <button onClick={() => { setOpen(false); navigate('/dashboard') }}
                    style={{width:'100%',textAlign:'left',padding:'11px 16px',border:'none',background:'none',cursor:'pointer',fontSize:'.88rem',color:'var(--navy)',display:'flex',alignItems:'center',gap:10,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}
                    onMouseOver={e=>e.currentTarget.style.background='var(--cream)'}
                    onMouseOut={e=>e.currentTarget.style.background='none'}>
                    📊 {t('nav_my_panel', lang)} <span style={{fontSize:'.72rem',color:'var(--text-muted)',marginLeft:'auto'}}>{lang==='en'?'Management':'Gestion'}</span>
                  </button>
                  {moderador && (
                    <button onClick={() => { setOpen(false); navigate('/moderador') }}
                      style={{width:'100%',textAlign:'left',padding:'11px 16px',border:'none',background:'none',cursor:'pointer',fontSize:'.88rem',color:'var(--navy)',display:'flex',alignItems:'center',gap:10,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}
                      onMouseOver={e=>e.currentTarget.style.background='var(--cream)'}
                      onMouseOut={e=>e.currentTarget.style.background='none'}>
                      🛡 {t('nav_mod_panel', lang)} <span style={{fontSize:'.72rem',color:'var(--orange)',marginLeft:'auto',fontWeight:700}}>Mod</span>
                    </button>
                  )}
                  <div style={{borderTop:'1px solid var(--cream-dark)',padding:'4px 0'}}>
                    <button onClick={handleLogout}
                      style={{width:'100%',textAlign:'left',padding:'10px 16px',border:'none',background:'none',cursor:'pointer',fontSize:'.85rem',color:'var(--danger)',display:'flex',alignItems:'center',gap:10,fontFamily:"'DM Sans',sans-serif"}}
                      onMouseOver={e=>e.currentTarget.style.background='rgba(220,38,38,0.05)'}
                      onMouseOut={e=>e.currentTarget.style.background='none'}>
                      ↩ {t('nav_logout', lang)}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )}

          {/* Selector de idioma */}
          <li>
            <div style={{display:'flex',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,overflow:'hidden',fontSize:'.78rem'}}>
              <button onClick={() => setLang('es')} style={{padding:'5px 10px',border:'none',fontFamily:"'DM Sans',sans-serif",fontWeight:600,background:lang==='es'?'rgba(244,96,12,0.8)':'transparent',color:lang==='es'?'white':'rgba(255,255,255,0.5)',transition:'all .2s'}}>🇪🇸 ES</button>
              <button onClick={() => setLang('en')} style={{padding:'5px 10px',border:'none',fontFamily:"'DM Sans',sans-serif",fontWeight:600,background:lang==='en'?'rgba(244,96,12,0.8)':'transparent',color:lang==='en'?'white':'rgba(255,255,255,0.5)',transition:'all .2s'}}>🇬🇧 EN</button>
            </div>
          </li>
        </ul>
      </div>
    </nav>
  )
}
