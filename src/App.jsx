import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { supabase } from './lib/supabase'
import { detectSubdomain } from './lib/subdomain'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import Register from './pages/Register'
import Login from './pages/Login'
import Recover from './pages/Recover'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'
import Publicidad from './pages/Publicidad'
import EmpresaPublica from './pages/EmpresaPublica'
import ProductoPublico from './pages/ProductoPublico'
import Directorio from './pages/Directorio'
import Admin from './pages/Admin'
import Moderador from './pages/Moderador'
import Mantenimiento from './pages/Mantenimiento'
import { ADMIN_EMAIL } from './lib/supabase'
import BannerPublicitario from './components/BannerPublicitario'

const SUBDOMAIN = detectSubdomain()

// Rutas protegidas — espera a que loading sea false antes de redirigir
function PrivateRoute({ children, condition }) {
  const { loading } = useApp()
  if (loading) return (
    <div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="spinner" style={{width:32,height:32,border:'3px solid #D8D2C9',
        borderTopColor:'#F4600C',borderRadius:'50%',animation:'spin .7s linear infinite'}} />
    </div>
  )
  return condition ? children : <Navigate to="/login" />
}

// Rutas comunes a todos los subdominios y al dominio raíz
function CommonRoutes({ user, isAdmin, moderador }) {
  return (
    <>
      <Route path="/registro"   element={<Register />} />
      <Route path="/login"      element={<Login />} />
      <Route path="/recuperar"  element={<Recover />} />
      <Route path="/precios"    element={<Pricing />} />
      <Route path="/publicidad" element={<Publicidad />} />
      <Route path="/dashboard"
        element={
          <PrivateRoute condition={!!user && user.email !== ADMIN_EMAIL}>
            <Dashboard />
          </PrivateRoute>
        } />
      <Route path="/admin"
        element={
          <PrivateRoute condition={isAdmin}>
            <Admin />
          </PrivateRoute>
        } />
      <Route path="/moderador"
        element={
          <PrivateRoute condition={!!moderador}>
            <Moderador />
          </PrivateRoute>
        } />
    </>
  )
}

export default function App() {
  const { user, moderador } = useApp()
  const [siteEstado, setSiteEstado] = useState(null)
  const [maintMsg,   setMaintMsg]   = useState({ es: '', en: '' })

  useEffect(() => {
    const timeout = setTimeout(() => setSiteEstado('activo'), 1500)
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
      .catch(() => setSiteEstado('activo'))
  }, [])

  const isAdmin = user?.email === ADMIN_EMAIL

  if (siteEstado === 'mantenimiento' && !isAdmin) {
    return <Mantenimiento msgEs={maintMsg.es} msgEn={maintMsg.en} />
  }

  if (siteEstado === null) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="spinner" style={{width:32,height:32,border:'3px solid #D8D2C9',
        borderTopColor:'#F4600C',borderRadius:'50%',animation:'spin .7s linear infinite'}} />
    </div>
  )

  // ── Subdominio activo (spain.xared.com, france.xared.com, latam.xared.com, etc.) ──
  if (SUBDOMAIN) {
    const { region, paisSlug } = SUBDOMAIN
    return (
      <>
        <Nav />
        <BannerPublicitario />
        <Routes>
          <Route path="/" element={<Directorio region={region} subPais={paisSlug} />} />
          <Route path="/cat/:categoria" element={<Directorio region={region} subPais={paisSlug} />} />
          <Route path="/:empSlug" element={<EmpresaPublica bySlug subdomainRegion={region} />} />
          <Route path="/:empSlug/:prodSlug" element={<ProductoPublico bySlug />} />
          {CommonRoutes({ user, isAdmin, moderador })}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Footer />
      </>
    )
  }

  // ── Dominio raíz xared.com ─────────────────────────────────────────────────
  // Solo directorio global + perfiles de empresa + categorías globales
  return (
    <>
      <Nav />
      <BannerPublicitario />
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Directorio global */}
        <Route path="/cat/:categoria" element={<Directorio region="global" />} />

        {/* Perfiles canónicos de empresa y producto */}
        <Route path="/site/:slug"              element={<EmpresaPublica bySlug />} />
        <Route path="/empresa/:id"          element={<EmpresaPublica />} />
        <Route path="/site/:empSlug/:prodSlug" element={<ProductoPublico bySlug />} />
        <Route path="/producto/:id"         element={<ProductoPublico />} />

        {/* Redirecciones de rutas antiguas → subdominios correctos */}
        <Route path="/es"     element={<RedirectToSubdomain sub="spain" />} />
        <Route path="/es/*"   element={<RedirectToSubdomain sub="spain" />} />
        <Route path="/eu"     element={<RedirectToSubdomain sub="eu" />} />
        <Route path="/eu/*"   element={<RedirectToSubdomain sub="eu" />} />
        <Route path="/latam"  element={<RedirectToSubdomain sub="latam" />} />
        <Route path="/latam/*" element={<RedirectToSubdomain sub="latam" />} />
        <Route path="/global" element={<Navigate to="/" />} />
        <Route path="/global/*" element={<Navigate to="/" />} />

        {CommonRoutes({ user, isAdmin, moderador })}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Footer />
    </>
  )
}

// Redirige al subdominio correspondiente manteniendo el path
function RedirectToSubdomain({ sub }) {
  useEffect(() => {
    const { hostname, pathname, search } = window.location
    const baseDomain = hostname.split('.').slice(-2).join('.')  // xared.com
    window.location.href = `https://${sub}.${baseDomain}${pathname}${search}`
  }, [sub])
  return null
}
