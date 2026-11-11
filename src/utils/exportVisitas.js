import { supabase } from '../supabaseClient';

// Copia de seguridad en CSV de las VISITAS: cuándo vino cada clienta, con quién, qué se le hizo y si
// ya está confirmado. Une la agenda con las fichas de servicio.
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

export async function exportVisitasCsv() {
  const [{ data: citas, error: e1 }, { data: fichas, error: e2 }] = await Promise.all([
    supabase
      .from('asignaciones_dia')
      .select('fecha, hora, tipo, llego, pagado, estado, servicios, clients(nombre, telefono), staff:staff_id(nombre)')
      .neq('tipo', 'descanso')
      .order('fecha', { ascending: false }),
    supabase
      .from('service_records')
      .select('fecha, categoria_servicio, subtipo_servicio, diseno_pestanas, historial_observaciones, es_extra, clients(nombre, telefono), staff:staff_id(nombre)')
      .order('fecha', { ascending: false }),
  ]);
  if (e1 || e2) {
    alert('No se pudo preparar la copia de visitas.');
    return;
  }

  const headers = ['Origen', 'Fecha', 'Hora', 'Clienta', 'Teléfono', 'Profesional', 'Servicio', 'Diseño / historial', 'Vino', 'Pagó', 'Confirmado'];
  const filasCitas = (citas || []).map((c) => [
    'Agenda',
    c.fecha,
    c.hora || '',
    c.clients?.nombre || '',
    c.clients?.telefono || '',
    c.staff?.nombre || '',
    (c.servicios || []).map((s) => `${s.categoria_servicio || ''}: ${s.subtipo_servicio || ''}`).join(' + '),
    (c.servicios || []).map((s) => s.historial_observaciones || '').filter(Boolean).join(' | '),
    c.llego ? 'Sí' : 'No',
    c.pagado ? 'Sí' : 'No',
    c.estado === 'completado' ? 'Sí' : 'No',
  ]);
  const filasFichas = (fichas || []).map((r) => [
    r.es_extra ? 'Ficha (extra)' : 'Ficha',
    String(r.fecha || '').slice(0, 10),
    '',
    r.clients?.nombre || '',
    r.clients?.telefono || '',
    r.staff?.nombre || '',
    `${r.categoria_servicio}: ${r.subtipo_servicio}`,
    r.historial_observaciones || r.diseno_pestanas || '',
    '',
    '',
    'Sí',
  ]);

  const csv = [headers, ...filasCitas, ...filasFichas].map((row) => row.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visitas_pestanas_julia_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
