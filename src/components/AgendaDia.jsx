import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function AgendaDia({ currentStaff }) {
  const [profesionales, setProfesionales] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [form, setForm] = useState({
    client: null,
    staff_id: '',
    hora: '',
  });
  const [servicioActual, setServicioActual] = useState({
    categoria_servicio: '',
    subtipo_servicio: '',
    historial_observaciones: '',
  });
  const [servicios, setServicios] = useState([]); // lista de servicios agregados para esta asignación

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
        setServicioActual((f) => ({ ...f, categoria_servicio: firstCat, subtipo_servicio: grouped[firstCat][0] }));
      }
    }
  }, []);

  const agregarServicio = () => {
    if (!servicioActual.categoria_servicio || !servicioActual.subtipo_servicio) return;
    setServicios((s) => [...s, servicioActual]);
    setServicioActual((f) => ({ ...f, historial_observaciones: '' }));
  };

  const quitarServicio = (index) => {
    setServicios((s) => s.filter((_, i) => i !== index));
  };

  const [cargandoMapeo, setCargandoMapeo] = useState(false);
  const [mapeoPrellenado, setMapeoPrellenado] = useState(false);

  const seleccionarClienta = async (c) => {
    setForm({ ...form, client: c });
    setClientResults([]);
    setCargandoMapeo(true);
    setMapeoPrellenado(false);

    const { data } = await supabase
      .from('service_records')
      .select('categoria_servicio, subtipo_servicio, historial_observaciones')
      .eq('client_id', c.id)
      .eq('es_extra', false)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setServicioActual({
        categoria_servicio: data.categoria_servicio,
        subtipo_servicio: data.subtipo_servicio,
        historial_observaciones: data.historial_observaciones || '',
      });
      setMapeoPrellenado(true);
    }
    setCargandoMapeo(false);
  };

  const fetchProfesionales = useCallback(async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, nombre')
      .eq('rol', 'profesional')
      .eq('activo', true)
      .order('nombre');
    if (data) setProfesionales(data);
  }, []);

  const [extras, setExtras] = useState([]);
  const fetchExtras = useCallback(async () => {
    const inicioHoy = `${hoy()}T00:00:00`;
    const { data } = await supabase
      .from('service_records')
      .select('*, clients(nombre), staff:staff_id(nombre)')
      .eq('es_extra', true)
      .eq('revisado', false)
      .gte('fecha', inicioHoy)
      .order('fecha', { ascending: false });
    if (data) setExtras(data);
  }, []);

  const marcarExtraRevisado = async (id) => {
    await supabase.from('service_records').update({ revisado: true }).eq('id', id);
    fetchExtras();
  };

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
    fetchCatalogo();
    fetchExtras();
  }, [fetchProfesionales, fetchAsignaciones, fetchCatalogo, fetchExtras]);

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
    if (!form.client || !form.staff_id || servicios.length === 0) return;

    const { error } = await supabase.from('asignaciones_dia').insert([
      {
        client_id: form.client.id,
        staff_id: form.staff_id,
        hora: form.hora,
        servicios,
        creado_por: currentStaff.id,
      },
    ]);

    if (!error) {
      const firstCat = Object.keys(catalogo)[0];
      setForm({ client: null, staff_id: '', hora: '' });
      setServicios([]);
      setServicioActual({
        categoria_servicio: firstCat || '',
        subtipo_servicio: firstCat ? catalogo[firstCat][0] : '',
        historial_observaciones: '',
      });
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
      <h2 className="font-bold text-ink mb-1">Agenda de hoy</h2>
      <p className="text-xs text-gray-400 mb-4">
        Asigna qué profesional atiende a cada clienta hoy. Cada profesional verá esto en su tablet.
      </p>

      {extras.length > 0 && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-amber-700 mb-3">
            ⚠️ Servicios extra pendientes de cargar en Flowww ({extras.length})
          </h3>
          <div className="space-y-2">
            {extras.map((ex) => (
              <div key={ex.id} className="flex justify-between items-center bg-white p-3 rounded-lg text-sm">
                <div>
                  <span className="font-semibold">{ex.clients?.nombre}</span>{' '}
                  <span className="text-gray-500">
                    — {ex.categoria_servicio}: {ex.subtipo_servicio}
                  </span>
                  <p className="text-xs text-gray-400">
                    Atendió: {ex.staff?.nombre}
                    {ex.historial_observaciones && ` · ${ex.historial_observaciones}`}
                  </p>
                </div>
                <button
                  onClick={() => marcarExtraRevisado(ex.id)}
                  className="text-xs bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg active:bg-amber-600 whitespace-nowrap ml-2"
                >
                  Ya lo cargué ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAsignar} className="bg-brand-50/60 p-4 rounded-xl border border-brand-100 mb-6 space-y-3">
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
                  onClick={() => seleccionarClienta(c)}
                  className="p-2 text-sm hover:bg-brand-50 cursor-pointer"
                >
                  {c.nombre}
                </div>
              ))}
            </div>
          )}
          {cargandoMapeo && <p className="text-xs text-gray-400 mt-1">Buscando su último mapeo...</p>}
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

        {Object.keys(catalogo).length > 0 && (
          <div className="border-t pt-3 space-y-3">
            <label className="text-xs font-semibold block">SERVICIOS DE ESTA VISITA</label>

            {mapeoPrellenado && (
              <p className="text-xs bg-blush-50 text-blush-600 font-medium px-2 py-1.5 rounded-lg inline-block">
                💡 Prellenado con su último mapeo registrado — podés ajustarlo antes de agregar
              </p>
            )}

            {servicios.length > 0 && (
              <div className="space-y-1.5">
                {servicios.map((s, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border text-sm">
                    <div>
                      <span className="font-semibold">{s.categoria_servicio}</span>
                      <span className="text-gray-400"> — {s.subtipo_servicio}</span>
                      {s.historial_observaciones && (
                        <p className="text-xs text-gray-400">{s.historial_observaciones}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarServicio(i)}
                      className="text-xs text-red-400 hover:text-red-600 ml-2"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">CATEGORÍA SERVICIO</label>
                <select
                  value={servicioActual.categoria_servicio}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setServicioActual({ ...servicioActual, categoria_servicio: cat, subtipo_servicio: catalogo[cat][0] });
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
                  value={servicioActual.subtipo_servicio}
                  onChange={(e) => setServicioActual({ ...servicioActual, subtipo_servicio: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                >
                  {(catalogo[servicioActual.categoria_servicio] || []).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">MAPEO / OBSERVACIONES (opcional)</label>
              <textarea
                rows="2"
                placeholder="Lo que dicte la profesional o quede acordado con la clienta..."
                value={servicioActual.historial_observaciones}
                onChange={(e) => setServicioActual({ ...servicioActual, historial_observaciones: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              />
            </div>
            <button
              type="button"
              onClick={agregarServicio}
              className="w-full border-2 border-dashed border-brand-300 text-brand-600 text-sm font-semibold py-2 rounded-lg hover:bg-brand-50"
            >
              + Agregar servicio a la lista
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!form.client || !form.staff_id || servicios.length === 0}
          className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
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
              {a.servicios?.length > 0 ? (
                <p className="text-xs text-gray-400 mt-0.5">
                  {a.servicios.map((s) => s.subtipo_servicio).join(' + ')}
                </p>
              ) : (
                a.categoria_servicio && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.categoria_servicio}: {a.subtipo_servicio}
                  </p>
                )
              )}
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
