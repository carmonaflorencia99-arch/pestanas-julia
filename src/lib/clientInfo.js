import { supabase } from '../supabaseClient';

// Quita caracteres que rompen el filtro .or() de Supabase.
const limpiar = (q) => q.replace(/[,()*]/g, ' ').trim();

// Busca clientas por nombre O por teléfono.
export async function buscarClientas(texto, limite = 50) {
  const q = limpiar(texto || '');
  let query = supabase.from('clients').select('*').order('nombre').limit(limite);
  if (q) {
    const soloDigitos = q.replace(/[\s+\-.]/g, '');
    const filtros = [`nombre.ilike.%${q}%`, `telefono.ilike.%${q}%`];
    if (/^\d+$/.test(q)) filtros.push(`flowww_id.eq.${q}`);
    if (soloDigitos && soloDigitos !== q && /^\d+$/.test(soloDigitos)) {
      filtros.push(`telefono.ilike.%${soloDigitos}%`);
    }
    query = query.or(filtros.join(','));
  }
  const { data } = await query;
  return data || [];
}

// Agrega a cada clienta: ultima_visita y profesional_habitual_nombre.
export async function enriquecerClientas(clientas) {
  if (!clientas || clientas.length === 0) return [];
  const ids = clientas.map((c) => c.id);

  const [{ data: visitas }, { data: staff }] = await Promise.all([
    supabase
      .from('service_records')
      .select('client_id, fecha')
      .in('client_id', ids)
      .order('fecha', { ascending: false })
      .limit(1000),
    supabase.from('staff').select('id, nombre'),
  ]);

  const ultima = {};
  (visitas || []).forEach((v) => {
    if (!ultima[v.client_id]) ultima[v.client_id] = v.fecha;
  });
  const nombresStaff = {};
  (staff || []).forEach((s) => {
    nombresStaff[s.id] = s.nombre;
  });

  return clientas.map((c) => ({
    ...c,
    // la más reciente entre las visitas de la app y la de Flowww
    ultima_visita:
      [ultima[c.id], c.flowww_ultima_visita].filter(Boolean).sort().pop() || null,
    profesional_habitual_nombre: c.profesional_habitual_id
      ? nombresStaff[c.profesional_habitual_id] || null
      : null,
  }));
}

export function formatoFecha(f) {
  if (!f) return null;
  const d = new Date(f);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES');
}

// Texto corto para distinguir: "📞 600 111 222 · Última visita: 12/03/2026 · ⭐ Ana"
export function resumenClienta(c) {
  const partes = [c.telefono ? '📞 ' + c.telefono : 'Sin teléfono'];
  const f = formatoFecha(c.ultima_visita);
  partes.push(f ? 'Última visita: ' + f : 'Sin visitas');
  if (c.flowww_visitas) partes.push(c.flowww_visitas + (c.flowww_visitas === 1 ? ' visita' : ' visitas') + ' en Flowww');
  if (c.profesional_habitual_nombre) partes.push('⭐ ' + c.profesional_habitual_nombre);
  if (c.flowww_id) partes.push('Nº ' + c.flowww_id);
  return partes.join(' · ');
}

// Nombres repetidos dentro de una lista (para marcarlos).
export function nombresRepetidos(lista) {
  const cuenta = {};
  lista.forEach((c) => {
    const k = (c.nombre || '').trim().toLowerCase();
    cuenta[k] = (cuenta[k] || 0) + 1;
  });
  return (c) => cuenta[(c.nombre || '').trim().toLowerCase()] > 1;
}
