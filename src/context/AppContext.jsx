import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'
import { logAction } from '../lib/audit'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [empresa,   setEmpresa]   = useState(null)
  const [moderador, setModerador] = useState(false)
  const [lang,      setLangState] = useState(() => localStorage.getItem('xared_lang') || 'es')
  const [loading,   setLoading]   = useState(true)

  const setLang = (l) => { setLangState(l); localStorage.setItem('xared_lang', l) }

  const loadSession = async (u) => {
    setUser(u)
    if (!u || u.email === ADMIN_EMAIL) { setEmpresa(null); return }
    const [{ data: emp }, { data: mod }] = await Promise.all([
      supabase.from('empresas').select('*').eq('user_id', u.id).maybeSingle(),
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
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-')) localStorage.removeItem(key)
      }
    } catch(_) {}
  }

  const refreshEmpresa = async () => {
    if (!user || user.email === ADMIN_EMAIL) return
    const { data } = await supabase.from('empresas').select('*').eq('user_id', user.id).maybeSingle()
    setEmpresa(data || null)
  }

  useEffect(() => {
    const safetyTimeout = setTimeout(() => setLoading(false), 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        const handleAuth = async () => {
          try {
            if (session?.user) {
              await loadSession(session.user)
            } else {
              setUser(null)
              setEmpresa(null)
            }
          } catch(e) {
            setEmpresa(null)
          } finally {
            clearTimeout(safetyTimeout)
            setLoading(false)
          }
          if (event === 'SIGNED_IN' && session?.user) {
            logAction('login', 'login', { userId: session.user.id, metadata: { email: session.user.email } }).catch(() => {})
          }
        }
        handleAuth()
      }

      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
        supabase.from('empresas').select('*').eq('user_id', session.user.id).maybeSingle()
          .then(({ data: emp }) => { if (emp) setEmpresa(emp) })
          .catch(() => {})
      }

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setEmpresa(null)
        setModerador(false)
        clearTimeout(safetyTimeout)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ user, empresa, setEmpresa, moderador, lang, setLang, loading, loadSession, logout, refreshEmpresa }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
