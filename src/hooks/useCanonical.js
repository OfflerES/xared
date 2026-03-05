// src/hooks/useCanonical.js
import { useEffect } from 'react'

const ROOT = 'https://xared.com'

/**
 * Inyecta o actualiza <link rel="canonical"> en el <head>.
 * La URL canónica siempre apunta al dominio raíz xared.com,
 * independientemente de si el usuario está en un subdominio.
 *
 * @param {string|null} path — ruta canónica, ej: '/e/acme-sarl'
 *                             Pasar null para no hacer nada (datos aún cargando)
 */
export function useCanonical(path) {
  useEffect(() => {
    if (!path) return

    const canonical = ROOT + path

    let el = document.querySelector('link[rel="canonical"]')
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      document.head.appendChild(el)
    }
    el.setAttribute('href', canonical)

    // Limpiar al desmontar: evita que la canónica del componente anterior
    // persista al navegar a otra página en la SPA
    return () => {
      const current = document.querySelector('link[rel="canonical"]')
      if (current) current.setAttribute('href', ROOT + '/')
    }
  }, [path])
}
