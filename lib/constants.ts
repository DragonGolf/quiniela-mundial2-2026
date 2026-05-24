// ============================================================
// Constantes globales de la Quiniela Mundial 2026
// ============================================================

// Las predicciones se bloquean 1 hora antes del primer partido del Mundial.
// Primer partido estimado: 11 de junio de 2026, ~7 PM CDT (México).
// Actualiza esta fecha cuando se confirme el horario oficial.
export const PREDICTIONS_LOCK_DATE = new Date('2026-06-12T00:00:00Z'); // medianoche UTC = 7 PM CDT 11-jun

// Fecha límite para confirmar participación con el administrador
export const PARTICIPATION_DEADLINE_STR = '10 de junio de 2026';

// Porcentaje de descuento por administración
export const ADMIN_FEE_PERCENT = 10;

// Fecha formateada del cierre de predicciones
export const LOCK_DATE_STR = '11 de junio de 2026, 1 hora antes del primer partido';

/** Devuelve true si ya no se pueden modificar predicciones */
export function isPredictionsLocked(): boolean {
  return new Date() >= PREDICTIONS_LOCK_DATE;
}
