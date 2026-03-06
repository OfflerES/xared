import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'
import { logAction } from '../lib/audit'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user,       setUser]       = useState(null)
  const [empresa,    setEmpresa]    = useState(null)
  const [moderador,  setModerador]  = useState(false)
  const [lang,       setLangState]  = useState(() => localStorage.getItem('xared_lang') || 'es')
  const [loading,    setLoading]    = useState(false) // false por defecto — no bloquear rutas públicas

  const setLang = (l) => { setLangState(l); localStorage.setItem('xared_lang', l) }

  const loadSession = async (u) => {
    setUser(u)
    if (!u || u.email === ADMIN_EMAIL) { setEmpresa(null); return }
    const [{ data: emp }, { data: mod }] = await Promise.all([
      supabase.from('empresas').select('*').eq('user_id', u.id).single(),
      supabase.from('moderadores').select('id,activo').eq('user_id', u.id).eq('activo', true).maybeSingle(),
    ])
    setEmpresa(emp || null)
    setModerador(!!mod)
  }

  const logout = async () => {
    setUser(null)
    setEmpresa(null)
    setModerador(false)
    await supabase.auth.signOut().catch(() => {})
    // Limpiar todas las claves sb- de localStorage
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-')) localStorage.removeItem(key)
      }
    } catch(_) {}
  }

  const refreshEmpresa = async () => {
    if (!user || user.email === ADMIN_EMAIL) return
    const { data } = await supabase.from('empresas').select('*').eq('user_id', user.id).single()
    setEmpresa(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Hay sesión activa — mostrar spinner mientras carga la empresa
        setLoading(true)
        loadSession(session.user).finally(() => setLoading(false))
      }
      // Sin sesión: loading ya es false, la web carga inmediatamente
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadSession(session.user)
        logAction('login', 'login', { userId: session.user.id, metadata: { email: session.user.email } })
      }
      if (event === 'SIGNED_OUT') { setUser(null); setEmpresa(null); setModerador(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AppContext.Provider value={{ user, empresa, setEmpresa, moderador, lang, setLang, loading, loadSession, logout, refreshEmpresa }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
