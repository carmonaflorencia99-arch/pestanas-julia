import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function ClientFicha({ client, currentStaff }) {
  const [records, setRecords] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const puedeCargar = currentStaff.rol === 'profesional' || currentStaff.rol === 'admin';

  const emptyForm = {
    categoria_servicio: '',
    subtipo_servicio: '',
    historial_observaciones: '',
  };
  const [form, setForm] = useState(emptyForm);

  const fetchCatalogo = useCallback(async () => {
    const { data } = await supabase
      .from('servicios_catalogo')
      .select('categoria, subtipo')
      .eq('activo', true)
      .order('orden');
    if (data) {
      const grouped = {};
      data.forEach((s) => {
        if (!grouped[s.categoria]) grouped[s.categoria] = [];
        grouped[s.categoria].push(s.subtipo);
      });
      setCatalogo(grouped);
      const firstCat = Object.keys(grouped)[0];
      if (firstCat) {
        setForm((f) => ({ ...f, categoria_servicio: firstCat, subtipo_servicio: grouped[firstCat][0] }));
      }
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('service_records')
      .select('*, staff:staff_id(nombre)')
      .eq('client_id', client.id)
      .order('fecha', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  }, [client.id]);

  const [profesionalHabitual, setProfesionalHabitual] = useState(null);
  useEffect(() => {
    if (client.profesional_habitual_id) {
      supabase
        .from('staff')
        .select('nombre')
        .eq('id', client.profesional_habitual_id)
        .single()
        .then(({ data }) => data && setProfesionalHabitual(data.nombre));
    } else {
      setProfesionalHabitual(null);
    }
  }, [client.profesional_habitual_id]);

  useEffect(() => {
    fetchCatalogo();
  }, [fetchCatalogo]);

  useEffect(() => {
    fetchRecords();
    setEditingId(null);
  }, [fetchRecords]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase
        .from('service_records')
        .update({
          categoria_servicio: form.categoria_servicio,
          subtipo_servicio: form.subtipo_servicio,
          historial_observaciones: form.historial_observaciones,
        })
        .eq('id', editingId);
      if (!error) {
        setEditingId(null);
        fetchRecords();
      } else {
        alert('No se pudo actualizar la ficha.');
      }
      return;
    }

    const { error } = await supabase.from('service_records').insert([
      {
        client_id: client.id,
        staff_id: currentStaff.id,
        categoria_servicio: form.categoria_servicio,
        subtipo_servicio: form.subtipo_servicio,
        historial_observaciones: form.historial_observaciones,
      },
    ]);

    if (!error) {
      setForm((f) => ({ ...f, historial_observaciones: '' }));
      fetchRecords();
    } else {
      alert('No se pudo guardar la ficha.');
    }
  };

  const handleEdit = (rec) => {
    setEditingId(rec.id);
    setForm({
      categoria_servicio: rec.categoria_servicio,
      subtipo_servicio: rec.subtipo_servicio,
      historial_observaciones: rec.historial_observaciones || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
    const { error } = await supabase.from('service_records').delete().eq('id', id);
    if (!error) fetchRecords();
  };

  const puedeEditarRegistro = (rec) =>
    currentStaff.rol === 'admin' || rec.staff_id === currentStaff.id;

  return (
    <div>
      <div className="border-b pb-4 mb-4">
        <h2 className="text-lg font-bold text-gray-800 uppercase">{client.nombre}</h2>
        <p className="text-xs text-gray-500">{client.telefono || 'Sin teléfono'}</p>
        <p className="text-xs text-red-500 font-medium mt-1">
          ⚠️ Alertas de salud: {client.alertas_salud || 'Ninguna registrada'}
        </p>
        {profesionalHabitual && (
          <p className="text-xs text-pink-500 font-medium mt-1">⭐ Profesional habitual: {profesionalHabitual}</p>
        )}
      </div>

      {puedeCargar && Object.keys(catalogo).length > 0 && (
        <form onSubmit={handleSave} className="space-y-4 bg-pink-50/50 p-4 rounded-xl border border-pink-100 mb-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-pink-700">
              {editingId ? 'Editando registro' : 'Nueva carga en talonario'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">CATEGORÍA SERVICIO</label>
              <select
                value={form.categoria_servicio}
                onChange={(e) => {
                  const cat = e.target.value;
                  setForm({ ...form, categoria_servicio: cat, subtipo_servicio: catalogo[cat][0] });
                }}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              >
                {Object.keys(catalogo).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">SERVICIO ESPECÍFICO</label>
              <select
                value={form.subtipo_servicio}
                onChange={(e) => setForm({ ...form, subtipo_servicio: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              >
                {(catalogo[form.categoria_servicio] || []).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">HISTORIAL Y OBSERVACIONES</label>
            <textarea
              rows="2"
              placeholder="Mapeo utilizado, reacciones, comentarios..."
              value={form.historial_observaciones}
              onChange={(e) => setForm({ ...form, historial_observaciones: e.target.value })}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-pink-700 transition"
          >
            {editingId ? 'Guardar cambios' : 'Guardar ficha'}
          </button>
        </form>
      )}

      <h3 className="font-semibold text-sm text-gray-700 mb-3">Historial de servicios anteriores</h3>
      <div className="space-y-3">
        {loading && <p className="text-xs text-gray-400">Cargando...</p>}
        {!loading && records.length === 0 && (
          <p className="text-xs text-gray-400">No hay registros previos para esta clienta.</p>
        )}
        {records.map((rec) => (
          <div key={rec.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
            <div className="flex justify-between font-semibold text-xs text-gray-500 mb-1">
              <span>{new Date(rec.fecha).toLocaleDateString('es-ES')}</span>
              <span className="text-pink-600">Atendió: {rec.staff?.nombre || '—'}</span>
            </div>
            <p className="font-bold text-gray-800">
              {rec.categoria_servicio}: <span className="font-normal">{rec.subtipo_servicio}</span>
            </p>
            {rec.historial_observaciones && (
              <p className="mt-2 text-xs bg-white p-2 rounded border border-gray-200 text-gray-700">
                <strong>Observaciones:</strong> {rec.historial_observaciones}
              </p>
            )}
            {puedeEditarRegistro(rec) && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => handleEdit(rec)}
                  className="text-xs text-pink-600 font-medium hover:underline"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(rec.id)}
                  className="text-xs text-red-500 font-medium hover:underline"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
