// Servicios en paralelo: la misma clienta, a la misma hora, con dos
// profesionales distintas y al menos uno de los servicios es manicura/pedicura.

const quitarAcentos = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

const esManiPedi = (s) =>
  /manicur|pedicur/.test(quitarAcentos(`${s.categoria_servicio || ''} ${s.subtipo_servicio || ''}`).toLowerCase());

export const tieneManiPedi = (a) => {
  const lista = Array.isArray(a.servicios) ? a.servicios : [];
  if (lista.length > 0) return lista.some(esManiPedi);
  return esManiPedi({ categoria_servicio: a.categoria_servicio, subtipo_servicio: a.subtipo_servicio });
};

// "16.30" / "16:30" / "04:30" → "16:30" / "4:30"
const normHora = (h) => (h || '').trim().toLowerCase().replace('.', ':').replace(/^0(\d)/, '$1');

// Devuelve las otras asignaciones que son "en paralelo" con la asignación a.
export function paralelosDe(a, todas) {
  const h = normHora(a.hora);
  if (!h || !a.client_id || a.tipo === 'descanso') return [];
  return (todas || []).filter(
    (b) =>
      b.id !== a.id &&
      b.tipo !== 'descanso' &&
      b.client_id === a.client_id &&
      b.staff_id !== a.staff_id &&
      normHora(b.hora) === h &&
      (tieneManiPedi(a) || tieneManiPedi(b))
  );
}

export const resumenServicios = (a) =>
  (a.servicios || []).map((s) => s.subtipo_servicio).join(' + ') || a.subtipo_servicio || '';
