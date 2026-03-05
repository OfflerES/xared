import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'
import { logAction } from '../lib/audit'

const SUPABASE_URL = 'https://ypvfpwdenpdllegycwod.supabase.co'
const SUPABASE_KEY = 'sb_publishable_qjsAnFGUAX8W5x12eKwRqA_AmFJTRiE'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  console.log('🏗️ AppProvider RENDER')

  const [user,      setUser]      = useState(null)
  const [empresa,   setEmpresa]   = useState(null)
  const [moderador, setModerador] = useState(false)
  const [lang,      setLangState] = useState(() => localStorage.getItem('xared_lang') || 'es')
  const [loading,   setLoading]   = useState(true)
  const initializedUserId = useRef(null)

  const setLang = (l) => { setLangState(l); localStorage.setItem('xared_lang', l) }

  const loadSession = async (u, accessToken = null) => {
    setUser(u)
    if (!u || u.email === ADMIN_EMAIL) { setEmpresa(null); return }
    try {
      const token = accessToken ||
        (await supabase.auth.getSession()).data.session?.access_token

      const headers = {
        'apikey':        SUPABASE_KEY,
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      }

      const [resEmp, resMod] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/empresas?user_id=eq.${u.id}&select=*&limit=1`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/moderadores?user_id=eq.${u.id}&activo=eq.true&select=id,activo&limit=1`, { headers }),
      ])

      const [rowsEmp, rowsMod] = await Promise.all([resEmp.json(), resMod.json()])

      setEmpresa(rowsEmp?.[0] || null)
      setModerador(rowsMod?.length > 0)
    } catch(e) {
      console.error('loadSession error:', e.message)
      setEmpresa(null)
    }
  }

  const logout = async () => {
    setUser(null)
    setEmpresa(null)
    setModerador(false)
    initializedUserId.current = null
    await supabase.auth.signOut().catch(() => {})
  }

  const refreshEmpresa = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token || !initializedUserId.current) return
    const headers = {
      'apikey':        SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/empresas?user_id=eq.${initializedUserId.current}&select=*&limit=1`, { headers })
    const rows = await res.json()
    setEmpresa(rows?.[0] || null)
  }

  useEffect(() => {
    console.log('🏗️ AppProvider useEffect MOUNT')

    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      console.log('🔔 AUTH EVENT:', event, '| user:', session?.user?.email, '| initializedUserId:', initializedUserId.current)

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          if (initializedUserId.current === session.user.id) {
            console.log('⏭️ Skipping — ya inicializado para:', session.user.id)
            return
          }
          initializedUserId.current = session.user.id
          setLoading(true)
          await loadSession(session.user, session.access_token)
          if (event === 'SIGNED_IN') {
            logAction('login', 'login', { userId: session.user.id, metadata: { email: session.user.email } })
          }
          if (mounted) setLoading(false)
        } else {
          if (mounted) setLoading(false)
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setEmpresa(null)
        setModerador(false)
        initializedUserId.current = null
        if (mounted) setLoading(false)
      }
    })

    return () => {
      console.log('💥 AppProvider useEffect UNMOUNT')
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AppContext.Provider value={{ user, empresa, setEmpresa, moderador, lang, setLang, loading, loadSession, logout, refreshEmpresa }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)