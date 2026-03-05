import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { t } from '../lib/i18n'
import XaredLogo from './XaredLogo'

export default function Footer() {
  const { lang } = useApp()
  const es = lang !== 'en'
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <XaredLogo />
            <p>{t('footer_desc', lang)}</p>
          </div>
          <div className="footer-col">
            <h4>{es ? 'Directorio' : 'Directory'}</h4>
            <ul>
              <li><Link to="/es">{es ? 'Empresas España' : 'Spain companies'}</Link></li>
              <li><Link to="/eu">{es ? 'Empresas Europa' : 'European companies'}</Link></li>
              <li><Link to="/latam">{es ? 'Empresas LATAM' : 'LATAM companies'}</Link></li>
              <li><Link to="/global">Global</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>{es ? 'Empresa' : 'Company'}</h4>
            <ul>
              <li><Link to="/precios">{es ? 'Planes y precios' : 'Plans & pricing'}</Link></li>
              <li><Link to="/publicidad">{es ? 'Publicidad' : 'Advertising'}</Link></li>
              <li><a href="mailto:hola@xared.com">{es ? 'Contacto' : 'Contact'}</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">{es ? 'Aviso legal' : 'Legal notice'}</a></li>
              <li><a href="#">{es ? 'Privacidad' : 'Privacy'}</a></li>
              <li><a href="#">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Xared. {es ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
          <p>Made in Spain 🇪🇸</p>
        </div>
      </div>
    </footer>
  )
}
