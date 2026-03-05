import { supabase } from './supabase'

/**
 * Registra una acción en el audit log.
 * @param {'login'|'accion'} tipo
 * @param {string} accion  p.ej: 'guardar_perfil', 'nuevo_producto', 'eliminar_producto'
 * @param {object} opts    { userId, empresaId, metadata }
 */
export async function logAction(tipo, accion, { userId, empresaId, metadata } = {}) {
  try {
    // Obtener IP pública de forma ligera (solo en cliente)
    let ip = null
    try {
      const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) })
      const d = await r.json()
      ip = d.ip
    } catch { /* sin IP si falla o tarda */ }

    await supabase.from('audit_log').insert({
      tipo,
      accion,
      user_id:    userId    || null,
      empresa_id: empresaId || null,
      ip,
      user_agent: navigator?.userAgent?.slice(0, 200) || null,
      metadata:   metadata  || null,
    })
  } catch (e) {
    // El audit log nunca debe romper la operación principal
    console.warn('audit log error:', e.message)
  }
}
