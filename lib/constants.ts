// ============================================================
// Constantes globales de la Quiniela Mundial 2026
// ============================================================

// Las predicciones se bloquean 1 hora antes del primer partido del Mundial.
// Primer partido (según la API): 11 de junio de 2026, 19:00 UTC = 1:00 PM México (UTC-6).
// Cierre = 1 hora antes = 18:00 UTC = 12:00 PM (mediodía) México.
// Actualiza esta fecha si la FIFA confirma otro horario.
export const PREDICTIONS_LOCK_DATE = new Date('2026-06-11T18:00:00Z'); // 12:00 PM México, 11-jun

// Fecha límite para confirmar participación con el administrador
export const PARTICIPATION_DEADLINE_STR = '10 de junio de 2026';

// Porcentaje de descuento por administración
export const ADMIN_FEE_PERCENT = 10;

// Fecha formateada del cierre de predicciones
export const LOCK_DATE_STR = '11 de junio de 2026, 12:00 PM (México) — 1h antes del primer partido';

/** Devuelve true si ya no se pueden modificar predicciones */
export function isPredictionsLocked(): boolean {
  return new Date() >= PREDICTIONS_LOCK_DATE;
}

/**
 * Candado global considerando una reapertura temporal por liga.
 * Si la liga tiene predictions_open_until en el futuro, se permite editar
 * (los partidos ya iniciados siguen bloqueados por el candado por-partido).
 */
export function isPredictionsLockedFor(openUntil?: string | null): boolean {
  if (openUntil && new Date() < new Date(openUntil)) return false;
  return isPredictionsLocked();
}
