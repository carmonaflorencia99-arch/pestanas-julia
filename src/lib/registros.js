// Control de que lo que se le hizo a cada clienta quede SIEMPRE registrado.

// Cuántos registros técnicos (no extras) debería tener una asignación.
export const registrosNecesarios = (a) => Math.max(1, Array.isArray(a.servicios) ? a.servicios.length : 1);

// ¿Cuántos registros hay para esa asignación? (misma clienta, misma profesional, mismo día)
export function registrosDe(a, records) {
  return (records || []).filter(
    (r) =>
      !r.es_extra &&
      r.client_id === a.client_id &&
      r.staff_id === a.staff_id &&
      String(r.fecha || '').slice(0, 10) === a.fecha
  ).length;
}

// Citas ya atendidas (la clienta llegó o se marcó como atendida) a las que
// les falta registrar lo realizado.
export function sinRegistro(asignaciones, records) {
  return (asignaciones || []).filter(
    (a) =>
      a.tipo !== 'descanso' &&
      a.client_id &&
      (a.llego || a.estado === 'completado' || a.estado === 'en_proceso') &&
      registrosDe(a, records) < registrosNecesarios(a)
  );
}
