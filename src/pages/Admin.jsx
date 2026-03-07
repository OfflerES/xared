import { useState } from 'react'
import AdminEmpresas from './admin/AdminEmpresas'
import AdminProductos from './admin/AdminProductos'
import AdminCupones from './admin/AdminCupones'
import AdminPublicidad from './admin/AdminPublicidad'
import AdminConfig from './admin/AdminConfig'
import AdminAudit from './admin/AdminAudit'
import AdminModeradores from './admin/AdminModeradores'
import AdminEmail from './admin/AdminEmail'
import AdminContactos from './admin/AdminContactos'

const TABS = [
  { id:'empresas',    label:'Empresas' },
  { id:'productos',   label:'Productos' },
  { id:'cupones',     label:'Cupones' },
  { id:'publicidad',  label:'Publicidad' },
  { id:'email',       label:'📧 Emails' },
  { id:'moderadores', label:'Moderadores' },
  { id:'audit',       label:'Actividad' },
  { id:'config',      label:'Config' },
]

export default function Admin() {
  const [tab, setTab] = useState('empresas')
  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 24px'}}>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'var(--navy)',marginBottom:24}}>Panel de administración</h1>
      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'2px solid var(--border)',flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{padding:'10px 20px',border:'none',background:'none',fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:'.85rem',cursor:'pointer',
              color:        tab===t.id?'var(--orange)':'var(--text-muted)',
              borderBottom: tab===t.id?'2px solid var(--orange)':'2px solid transparent',
              marginBottom: -2,transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'empresas'    && <AdminEmpresas />}
      {tab === 'productos'   && <AdminProductos />}
      {tab === 'cupones'     && <AdminCupones />}
      {tab === 'publicidad'  && <AdminPublicidad />}
      {tab === 'email'       && <AdminEmail />}
      {tab === 'moderadores' && <AdminModeradores />}
      {tab === 'audit'       && <AdminAudit />}
      {tab === 'config'      && <AdminConfig />}
      {tab === 'contactos'   && <AdminContactos />}
    </div>
  )
}
