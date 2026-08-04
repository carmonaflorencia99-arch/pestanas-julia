import { supabase } from '../supabaseClient';

// Exporta todo el historial de fichas a un CSV, coherente con el
// flujo de trabajo habitual (Google Sheets / calendario de contenido).
export async function exportRecordsToCsv() {
  const { data, error } = await supabase
    .from('service_records')
    .select('fecha, categoria_servicio, subtipo_servicio, historial_observaciones, clients(nombre, telefono), staff(nombre)')
    .order('fecha', { ascending: false });

  if (error || !data) {
    alert('No se pudo exportar el historial.');
    return;
  }

  const headers = ['Fecha', 'Clienta', 'Teléfono', 'Profesional', 'Categoría', 'Servicio', 'Observaciones'];
  const rows = data.map((r) => [
    new Date(r.fecha).toLocaleDateString('es-ES'),
    r.clients?.nombre || '',
    r.clients?.telefono || '',
    r.staff?.nombre || '',
    r.categoria_servicio,
    r.subtipo_servicio,
    (r.historial_observaciones || '').replace(/\n/g, ' '),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fichas_pestanas_julia_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
