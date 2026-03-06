import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// Limpiar claves de sesión corruptas o de versiones anteriores
// Solo conservar la clave correcta con el anon key actual
try {
  const correctKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('sb-') && key !== correctKey) {
      localStorage.removeItem(key)
    }
  }
} catch (_) {}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
    storageKey: `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`,
  }
})

export const ADMIN_EMAIL = 'emilio.lonas@gmail.com'
