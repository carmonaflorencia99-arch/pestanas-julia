import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function FichaTabletModal({ client, currentStaff, onClose }) {
  const [catalogo, setCatalogo] = useState({});
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ categoria_servicio: '', subtipo_servicio: '', historial_observaciones: '' });
  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState(false);

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
      if (firstCat) setForm((f) => ({ ...f, categoria_servicio: firstCat, subtipo_servicio: grouped[firstCat][0] }));
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    const { data } = await supabase
      .from('service_records')
      .select('*')
      .eq('client_id', client.id)
      .order('fecha', { ascending: false })
      .limit(5);
    if (data) setRecords(data);
  }, [client.id]);

  useEffect(() => {
    fetchCatalogo();
    fetchRecords();
  }, [fetchCatalogo, fetchRecords]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('service_records').insert([
      {
        client_id: client.id,
        staff_id: currentStaff.id,
        categoria_servicio: form.categoria_servicio,
        subtipo_servicio: form.subtipo_servicio,
        historial_observaciones: form.historial_observaciones,
      },
    ]);
    setSaving(false);
    if (!error) {
      setGuardado(true);
      setForm((f) => ({ ...f, historial_observaciones: '' }));
      fetchRecords();
      setTimeout(() => setGuardado(false), 2000);
    } else {
      alert('No se pudo guardar.');
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 pb-16">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pt-2 pb-4">
          <button
            onClick={onClose}
            className="text-gray-400 text-lg font-medium flex items-center gap-1 active:text-gray-600"
          >
            ← Volver
          </button>
          {guardado && <span className="text-green-600 text-sm font-semibold">✓ Guardado</span>}
        </div>

        <h2 className="text-3xl font-bold text-gray-800">{client.nombre}</h2>
        <p className="text-lg text-red-500 font-medium mt-1 mb-8">
          ⚠️ {client.alertas_salud || 'Sin alertas de salud registradas'}
        </p>

        {Object.keys(catalogo).length > 0 && (
          <form onSubmit={handleSave} className="space-y-5 bg-pink-50/50 p-5 rounded-2xl border border-pink-100 mb-8">
            <div>
              <label className="text-sm font-semibold block mb-2">CATEGORÍA</label>
              <select
                value={form.categoria_servicio}
                onChange={(e) => {
                  const cat = e.target.value;
                  setForm({ ...form, categoria_servicio: cat, subtipo_servicio: catalogo[cat][0] });
                }}
                className="w-full p-4 border rounded-xl text-lg bg-white"
              >
                {Object.keys(catalogo).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2">SERVICIO</label>
              <select
                value={form.subtipo_servicio}
                onChange={(e) => setForm({ ...form, subtipo_servicio: e.target.value })}
                className="w-full p-4 border rounded-xl text-lg bg-white"
              >
                {(catalogo[form.categoria_servicio] || []).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2">OBSERVACIONES</label>
              <textarea
                rows="3"
                placeholder="Mapeo, reacciones, comentarios..."
                value={form.historial_observaciones}
                onChange={(e) => setForm({ ...form, historial_observaciones: e.target.value })}
                className="w-full p-4 border rounded-xl text-lg bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-pink-600 text-white text-lg font-semibold py-4 rounded-xl active:bg-pink-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar ficha'}
            </button>
          </form>
        )}

        <h3 className="text-lg font-semibold text-gray-700 mb-3">Últimos servicios</h3>
        <div className="space-y-3">
          {records.length === 0 && <p className="text-gray-400">Sin historial previo.</p>}
          {records.map((r) => (
            <div key={r.id} className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">{new Date(r.fecha).toLocaleDateString('es-ES')}</p>
              <p className="font-semibold text-gray-800">
                {r.categoria_servicio}: <span className="font-normal">{r.subtipo_servicio}</span>
              </p>
              {r.historial_observaciones && (
                <p className="text-sm text-gray-600 mt-1">{r.historial_observaciones}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
