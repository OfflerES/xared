import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { detectSubdomain } from '../lib/subdomain'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import BannerPublicitario from '../components/BannerPublicitario'
import Home from '../pages/Home'
import Register from '../pages/Register'
import Login from '../pages/Login'
import Recover from '../pages/Recover'
import Dashboard from '../pages/Dashboard'
import Pricing from '../pages/Pricing'
import Publicidad from '../pages/Publicidad'
import EmpresaPublica from '../pages/EmpresaPublica'
import ProductoPublico from '../pages/ProductoPublico'
import Directorio from '../pages/Directorio'
import Admin from '../pages/Admin'
import Moderador from '../pages/Moderador'
import Mantenimiento from '../pages/Mantenimiento'
import { ADMIN_EMAIL } from '../lib/supabase'

const SUBDOMAIN = detectSubdomain()

export default function App() {
  const { user, moderador, loading } = useApp()
  const [siteEstado, setSiteEstado] = useState(null)
  const [maintMsg,   setMaintMsg]   = useState({ es: '', en: '' })

  useEffect(() => {
    const timeout = setTimeout(() => setSiteEstado('activo'), 3000)
    supabase.from('config').select('clave,valor')
      .in('clave', ['site_estado','site_maint_msg_es','site_maint_msg_en'])
      .then(({ data }) => {
        clearTimeout(timeout)
        const c = {}
        ;(data || []).forEach(r => c[r.clave] = r.valor)
        setSiteEstado(c.site_estado || 'activo')
        setMaintMsg({
          es: c.site_maint_msg_es || 'Estamos realizando tareas de mantenimiento. Volveremos en breve.',
          en: c.site_maint_msg_en || 'Scheduled maintenance in progress. We will be back shortly.'
        })
      })
  }, [])

  const publicPaths = ['/login', '/registro', '/recuperar']
  const isPublicPath = publicPaths.some(p => window.location.pathname.startsWith(p))

  if ((loading || siteEstado === null) && !isPublicPath) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="spinner" style={{width:32,height:32,border:'3px solid #D8D2C9',
        borderTopColor:'#F4600C',borderRadius:'50%',animation:'spin .7s linear infinite'}} />
    </div>
  )

  const isAdmin = user?.email === ADMIN_EMAIL
  if (siteEstado === 'mantenimiento' && !isAdmin) {
    return <Mantenimiento msgEs={maintMsg.es} msgEn={maintMsg.en} />
  }

  // ── Subdominio activo ──────────────────────────────────────────────
  if (SUBDOMAIN) {
    const { region, paisSlug } = SUBDOMAIN
    return (
      <>
        <Nav />
        <BannerPublicitario />
        <Routes>
          <Route path="/"
            element={<Directorio region={region} subPais={paisSlug} />} />
          <Route path="/registro"   element={<Register />} />
          <Route path="/login"      element={<Login />} />
          <Route path="/recuperar"  element={<Recover />} />
          <Route path="/precios"    element={<Pricing />} />
          <Route path="/publicidad" element={<Publicidad />} />
          <Route path="/dashboard"
            element={user && user.email !== ADMIN_EMAIL
              ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/cat/:categoria"
            element={<Directorio region={region} subPais={paisSlug} />} />
          <Route path="/:empSlug"
            element={<EmpresaPublica bySlug subdomainRegion={region} />} />
          <Route path="/:empSlug/:prodSlug"
            element={<ProductoPublico bySlug />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Footer />
      </>
    )
  }

  // ── Dominio raíz xared.com ─────────────────────────────────────────
  return (
    <>
      <Nav />
      <BannerPublicitario />
      <Routes>
        <Route path="/"           element={<Home />} />
        <Route path="/registro"   element={<Register />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/recuperar"  element={<Recover />} />
        <Route path="/precios"    element={<Pricing />} />
        <Route path="/publicidad" element={<Publicidad />} />

        <Route path="/es"                            element={<Directorio region="spain" />} />
        <Route path="/es/cat/:categoria"             element={<Directorio region="spain" />} />
        <Route path="/eu"                            element={<Directorio region="ue" />} />
        <Route path="/eu/todo"                       element={<Directorio region="ue" showAll />} />
        <Route path="/eu/:paisCode"                  element={<Directorio region="ue" />} />
        <Route path="/eu/:paisCode/cat/:categoria"   element={<Directorio region="ue" />} />
        <Route path="/latam"                         element={<Directorio region="latam" />} />
        <Route path="/latam/todo"                    element={<Directorio region="latam" showAll />} />
        <Route path="/latam/:paisCode"               element={<Directorio region="latam" />} />
        <Route path="/latam/:paisCode/cat/:categoria" element={<Directorio region="latam" />} />
        <Route path="/global"                        element={<Directorio region="global" />} />
        <Route path="/global/cat/:categoria"         element={<Directorio region="global" />} />

        <Route path="/e/:slug"              element={<EmpresaPublica bySlug />} />
        <Route path="/empresa/:id"          element={<EmpresaPublica />} />
        <Route path="/e/:empSlug/:prodSlug" element={<ProductoPublico bySlug />} />
        <Route path="/producto/:id"         element={<ProductoPublico />} />

        <Route path="/dashboard"
          element={user && user.email !== ADMIN_EMAIL
            ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/admin"
          element={isAdmin ? <Admin /> : <Navigate to="/login" />} />
        <Route path="/moderador"
          element={moderador ? <Moderador /> : <Navigate to="/login" />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Footer />
    </>
  )
}
