import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function AgendaDia({ currentStaff }) {
  const [profesionales, setProfesionales] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [form, setForm] = useState({ client: null, staff_id: '', hora: '' });

  const fetchProfesionales = useCallback(async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, nombre')
      .eq('rol', 'profesional')
      .eq('activo', true)
      .order('nombre');
    if (data) setProfesionales(data);
  }, []);

  const fetchAsignaciones = useCallback(async () => {
    const { data } = await supabase
      .from('asignaciones_dia')
      .select('*, clients(nombre), staff:staff_id(nombre)')
      .eq('fecha', hoy())
      .order('hora');
    if (data) setAsignaciones(data);
  }, []);

  useEffect(() => {
    fetchProfesionales();
    fetchAsignaciones();
  }, [fetchProfesionales, fetchAsignaciones]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!clientSearch) {
        setClientResults([]);
        return;
      }
      const { data } = await supabase
        .from('clients')
        .select('id, nombre')
        .ilike('nombre', `%${clientSearch}%`)
        .limit(8);
      setClientResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const handleAsignar = async (e) => {
    e.preventDefault();
    if (!form.client || !form.staff_id) return;

    const { error } = await supabase.from('asignaciones_dia').insert([
      {
        client_id: form.client.id,
        staff_id: form.staff_id,
        hora: form.hora,
        creado_por: currentStaff.id,
      },
    ]);

    if (!error) {
      setForm({ client: null, staff_id: '', hora: '' });
      setClientSearch('');
      fetchAsignaciones();
    } else {
      alert('No se pudo asignar. Intenta de nuevo.');
    }
  };

  const handleEliminar = async (id) => {
    await supabase.from('asignaciones_dia').delete().eq('id', id);
    fetchAsignaciones();
  };

  const estadoColor = {
    pendiente: 'bg-gray-100 text-gray-500',
    en_proceso: 'bg-amber-100 text-amber-700',
    completado: 'bg-green-100 text-green-700',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h2 className="font-bold text-gray-800 mb-1">Agenda de hoy</h2>
      <p className="text-xs text-gray-400 mb-4">
        Asigna qué profesional atiende a cada clienta hoy. Cada profesional verá esto en su tablet.
      </p>

      <form onSubmit={handleAsignar} className="bg-pink-50/50 p-4 rounded-xl border border-pink-100 mb-6 space-y-3">
        <div className="relative">
          <label className="text-xs font-semibold block mb-1">CLIENTA</label>
          <input
            placeholder="Buscar clienta..."
            value={form.client ? form.client.nombre : clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setForm({ ...form, client: null });
            }}
            className="w-full p-2 border rounded-lg text-sm bg-white"
          />
          {clientResults.length > 0 && !form.client && (
            <div className="absolute z-10 bg-white border rounded-lg mt-1 w-full shadow-md max-h-40 overflow-y-auto">
              {clientResults.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setForm({ ...form, client: c });
                    setClientResults([]);
                  }}
                  className="p-2 text-sm hover:bg-pink-50 cursor-pointer"
                >
                  {c.nombre}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1">PROFESIONAL</label>
            <select
              value={form.staff_id}
              onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Seleccionar...</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">HORA (opcional)</label>
            <input
              placeholder="Ej: 16:30"
              value={form.hora}
              onChange={(e) => setForm({ ...form, hora: e.target.value })}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!form.client || !form.staff_id}
          className="w-full bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
        >
          Asignar
        </button>
      </form>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cola de hoy</h3>
      <div className="space-y-2">
        {asignaciones.length === 0 && <p className="text-xs text-gray-400">Todavía no hay asignaciones para hoy.</p>}
        {asignaciones.map((a) => (
          <div key={a.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
            <div>
              <span className="font-semibold">{a.hora || '—'}</span>{' '}
              <span>{a.clients?.nombre}</span>{' '}
              <span className="text-gray-400">→ {a.staff?.nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-lg font-medium ${estadoColor[a.estado]}`}>
                {a.estado}
              </span>
              <button
                onClick={() => handleEliminar(a.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
