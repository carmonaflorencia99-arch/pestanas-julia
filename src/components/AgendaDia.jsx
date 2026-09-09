import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import NewClientModal from './NewClientModal';

const hoyStr = () => new Date().toISOString().slice(0, 10);
const mananaStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const etiquetaFecha = (fecha) => {
  if (fecha === hoyStr()) return 'hoy';
  if (fecha === mananaStr()) return 'mañana';
  return fecha;
};

export default function AgendaDia({ currentStaff }) {
  const [profesionales, setProfesionales] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  // Fecha que se está viendo/editando en la agenda (por defecto, hoy).
  // Permite dejar armada la agenda de mañana con anticipación.
  const [fechaAgenda, setFechaAgenda] = useState(hoyStr());

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
  const [editingId, setEditingId] = useState(null); // id de la asignación que se está editando

  // ----- Descanso -----
  const [mostrarDescanso, setMostrarDescanso] = useState(false);
  const [descansoForm, setDescansoForm] = useState({ staff_id: '', hora: '', hora_fin: '', nota: '' });
  const [savingDescanso, setSavingDescanso] = useState(false);

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
        setServicioActual((f) =>
          f.categoria_servicio ? f : { ...f, categoria_servicio: firstCat, subtipo_servicio: grouped[firstCat][0] }
        );
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
  const [profesionalAutoSeleccionada, setProfesionalAutoSeleccionada] = useState(false);

  const seleccionarClienta = async (c) => {
    setClientResults([]);
    setCargandoMapeo(true);
    setMapeoPrellenado(false);

    // Traemos la profesional de preferencia y las notas generales de la
    // clienta (cargadas en su alta) para poder autocompletar.
    const { data: clienteCompleto } = await supabase
      .from('clients')
      .select('id, nombre, profesional_habitual_id, notas_generales')
      .eq('id', c.id)
      .single();

    setForm((f) => ({
      ...f,
      client: c,
      staff_id: clienteCompleto?.profesional_habitual_id || f.staff_id,
    }));
    setProfesionalAutoSeleccionada(!!clienteCompleto?.profesional_habitual_id);

    const { data } = await supabase
      .from('service_records')
      .select('categoria_servicio, subtipo_servicio, historial_observaciones')
      .eq('client_id', c.id)
      .eq('es_extra', false)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      // Ya vino antes: se prellena con lo de su última visita real.
      setServicioActual({
        categoria_servicio: data.categoria_servicio,
        subtipo_servicio: data.subtipo_servicio,
        historial_observaciones: data.historial_observaciones || '',
      });
      setMapeoPrellenado(true);
    } else {
      // Primera vez: si tiene notas generales cargadas en el alta, se usan
      // como punto de partida para las observaciones.
      const firstCat = Object.keys(catalogo)[0];
      setServicioActual({
        categoria_servicio: firstCat || '',
        subtipo_servicio: firstCat ? catalogo[firstCat][0] : '',
        historial_observaciones: clienteCompleto?.notas_generales || '',
      });
    }
    setCargandoMapeo(false);
  };

  const handleClientaCreada = (nuevaClienta) => {
    setForm((f) => ({
      ...f,
      client: nuevaClienta,
      staff_id: nuevaClienta.profesional_habitual_id || f.staff_id,
    }));
    setProfesionalAutoSeleccionada(!!nuevaClienta.profesional_habitual_id);
    setClientSearch('');
    setClientResults([]);
    setMapeoPrellenado(false);
    const firstCat = Object.keys(catalogo)[0];
    setServicioActual({
      categoria_servicio: firstCat || '',
      subtipo_servicio: firstCat ? catalogo[firstCat][0] : '',
      historial_observaciones: nuevaClienta.notas_generales || '',
    });
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

  // Los "extras" son siempre del día real de hoy (algo que se hizo recién),
  // independientemente de qué fecha esté mirando la secretaria en la agenda.
  const [extras, setExtras] = useState([]);
  const fetchExtras = useCallback(async () => {
    const inicioHoy = `${hoyStr()}T00:00:00`;
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
      .eq('fecha', fechaAgenda)
      .order('hora');
    if (data) setAsignaciones(data);
  }, [fechaAgenda]);

  useEffect(() => {
    fetchProfesionales();
    fetchCatalogo();
    fetchExtras();
  }, [fetchProfesionales, fetchCatalogo, fetchExtras]);

  useEffect(() => {
    fetchAsignaciones();
  }, [fetchAsignaciones]);

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

  const resetFormularioCita = () => {
    const firstCat = Object.keys(catalogo)[0];
    setForm({ client: null, staff_id: '', hora: '' });
    setServicios([]);
    setServicioActual({
      categoria_servicio: firstCat || '',
      subtipo_servicio: firstCat ? catalogo[firstCat][0] : '',
      historial_observaciones: '',
    });
    setClientSearch('');
    setEditingId(null);
    setMapeoPrellenado(false);
    setProfesionalAutoSeleccionada(false);
  };

  const handleAsignar = async (e) => {
    e.preventDefault();
    if (!form.client || !form.staff_id || servicios.length === 0) return;

    if (editingId) {
      // Editando una asignación existente: no se cambia la clienta, solo
      // profesional, hora y servicios.
      const { error } = await supabase
        .from('asignaciones_dia')
        .update({
          staff_id: form.staff_id,
          hora: form.hora,
          servicios,
        })
        .eq('id', editingId);

      if (!error) {
        resetFormularioCita();
        fetchAsignaciones();
      } else {
        alert('No se pudo guardar el cambio. Intenta de nuevo.');
      }
      return;
    }

    const { error } = await supabase.from('asignaciones_dia').insert([
      {
        client_id: form.client.id,
        staff_id: form.staff_id,
        hora: form.hora,
        servicios,
        tipo: 'cita',
        fecha: fechaAgenda,
        creado_por: currentStaff.id,
      },
    ]);

    if (!error) {
      resetFormularioCita();
      fetchAsignaciones();
    } else {
      alert('No se pudo asignar. Intenta de nuevo.');
    }
  };

  const iniciarEdicion = (a) => {
    setEditingId(a.id);
    setForm({ client: a.clients ? { id: a.client_id, nombre: a.clients.nombre } : null, staff_id: a.staff_id, hora: a.hora || '' });
    setServicios(a.servicios || []);
    setMapeoPrellenado(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAgregarDescanso = async (e) => {
    e.preventDefault();
    if (!descansoForm.staff_id || !descansoForm.hora) return;
    setSavingDescanso(true);

    const { error } = await supabase.from('asignaciones_dia').insert([
      {
        staff_id: descansoForm.staff_id,
        hora: descansoForm.hora,
        hora_fin: descansoForm.hora_fin,
        historial_observaciones: descansoForm.nota,
        tipo: 'descanso',
        client_id: null,
        servicios: [],
        fecha: fechaAgenda,
        creado_por: currentStaff.id,
      },
    ]);

    setSavingDescanso(false);
    if (!error) {
      setDescansoForm({ staff_id: '', hora: '', hora_fin: '', nota: '' });
      setMostrarDescanso(false);
      fetchAsignaciones();
    } else {
      alert('No se pudo agregar el descanso.');
    }
  };

  const handleEliminar = async (id) => {
    await supabase.from('asignaciones_dia').delete().eq('id', id);
    if (editingId === id) resetFormularioCita();
    fetchAsignaciones();
  };

  const toggleCampo = async (id, campo, valorActual) => {
    await supabase.from('asignaciones_dia').update({ [campo]: !valorActual }).eq('id', id);
    fetchAsignaciones();
  };

  const estadoColor = {
    pendiente: 'bg-gray-100 text-gray-500',
    en_proceso: 'bg-amber-100 text-amber-700',
    completado: 'bg-green-100 text-green-700',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h2 className="font-bold text-ink mb-1">Agenda</h2>
      <p className="text-xs text-gray-400 mb-4">
        Asigna qué profesional atiende a cada clienta. Cada profesional ve esto en su tablet a partir del día que corresponda.
      </p>

      {/* Selector de fecha: permite armar la agenda de mañana con anticipación */}
      <div className="flex items-center gap-2 mb-6 bg-gray-50 p-3 rounded-xl">
        <label className="text-xs font-semibold text-gray-500">VIENDO AGENDA DE:</label>
        <button
          type="button"
          onClick={() => setFechaAgenda(hoyStr())}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${fechaAgenda === hoyStr() ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600'}`}
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => setFechaAgenda(mananaStr())}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${fechaAgenda === mananaStr() ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600'}`}
        >
          Mañana
        </button>
        <input
          type="date"
          value={fechaAgenda}
          onChange={(e) => setFechaAgenda(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border bg-white"
        />
      </div>

      {extras.length > 0 && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-amber-700 mb-3">
            ⚠️ Servicios extra pendientes de cargar en Booksy ({extras.length})
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

      <form onSubmit={handleAsignar} className="bg-brand-50/60 p-4 rounded-xl border border-brand-100 mb-3 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-brand-700">
            {editingId ? 'Editando asignación' : `Nueva asignación (${etiquetaFecha(fechaAgenda)})`}
          </h3>
          {editingId && (
            <button type="button" onClick={resetFormularioCita} className="text-xs text-gray-400 hover:text-gray-600">
              Cancelar edición
            </button>
          )}
        </div>

        <div className="relative">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold">CLIENTA</label>
            {!editingId && (
              <button
                type="button"
                onClick={() => setShowNewClientModal(true)}
                className="text-xs text-brand-600 font-semibold hover:underline"
              >
                + Nueva clienta
              </button>
            )}
          </div>
          <input
            disabled={!!editingId}
            placeholder="Buscar clienta..."
            value={form.client ? form.client.nombre : clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setForm({ ...form, client: null });
            }}
            className="w-full p-2 border rounded-lg text-sm bg-white disabled:opacity-60"
          />
          {editingId && <p className="text-xs text-gray-400 mt-1">Para cambiar de clienta, quitá esta asignación y creá una nueva.</p>}
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
          {clientSearch && clientResults.length === 0 && !form.client && !editingId && (
            <p className="text-xs text-gray-400 mt-1">
              No se encontró ninguna clienta. Tocá "+ Nueva clienta" para darla de alta.
            </p>
          )}
          {cargandoMapeo && <p className="text-xs text-gray-400 mt-1">Buscando su último mapeo...</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1">PROFESIONAL</label>
            <select
              value={form.staff_id}
              onChange={(e) => {
                setForm({ ...form, staff_id: e.target.value });
                setProfesionalAutoSeleccionada(false);
              }}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Seleccionar...</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {profesionalAutoSeleccionada && (
              <p className="text-xs text-blush-600 mt-1">⭐ Auto-seleccionada por preferencia</p>
            )}
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
          {editingId ? 'Guardar cambios' : 'Asignar'}
        </button>
      </form>

      {/* Descanso */}
      <div className="mb-6">
        {!mostrarDescanso ? (
          <button
            type="button"
            onClick={() => setMostrarDescanso(true)}
            className="w-full border-2 border-dashed border-amber-300 text-amber-700 text-sm font-semibold py-2 rounded-lg hover:bg-amber-50"
          >
            ☕ Agregar horario de descanso ({etiquetaFecha(fechaAgenda)})
          </button>
        ) : (
          <form onSubmit={handleAgregarDescanso} className="bg-amber-50 p-4 rounded-xl border-2 border-amber-200 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-amber-700">Horario de descanso</h3>
              <button type="button" onClick={() => setMostrarDescanso(false)} className="text-xs text-gray-400">
                Cancelar
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">PROFESIONAL</label>
              <select
                value={descansoForm.staff_id}
                onChange={(e) => setDescansoForm({ ...descansoForm, staff_id: e.target.value })}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">DESDE</label>
                <input
                  placeholder="Ej: 14:00"
                  value={descansoForm.hora}
                  onChange={(e) => setDescansoForm({ ...descansoForm, hora: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">HASTA (opcional)</label>
                <input
                  placeholder="Ej: 15:00"
                  value={descansoForm.hora_fin}
                  onChange={(e) => setDescansoForm({ ...descansoForm, hora_fin: e.target.value })}
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">NOTA (opcional)</label>
              <input
                placeholder="Almuerzo, trámite personal..."
                value={descansoForm.nota}
                onChange={(e) => setDescansoForm({ ...descansoForm, nota: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={savingDescanso || !descansoForm.staff_id || !descansoForm.hora}
              className="w-full bg-amber-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              {savingDescanso ? 'Guardando...' : 'Agregar descanso'}
            </button>
          </form>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cola de {etiquetaFecha(fechaAgenda)}</h3>
      <div className="space-y-2">
        {asignaciones.length === 0 && <p className="text-xs text-gray-400">Todavía no hay asignaciones para esta fecha.</p>}
        {asignaciones.map((a) =>
          a.tipo === 'descanso' ? (
            <div key={a.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg text-sm border border-amber-100">
              <div>
                <span className="font-semibold">☕ Descanso</span>{' '}
                <span className="text-gray-400">
                  {a.hora}
                  {a.hora_fin && ` – ${a.hora_fin}`}
                </span>{' '}
                <span className="text-gray-400">→ {a.staff?.nombre}</span>
                {a.historial_observaciones && <p className="text-xs text-gray-400 mt-0.5">{a.historial_observaciones}</p>}
              </div>
              <button onClick={() => handleEliminar(a.id)} className="text-xs text-red-400 hover:text-red-600">
                Quitar
              </button>
            </div>
          ) : (
            <div key={a.id} className="p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between items-start">
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${estadoColor[a.estado]}`}>{a.estado}</span>
                  <button onClick={() => iniciarEdicion(a)} className="text-xs text-brand-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => handleEliminar(a.id)} className="text-xs text-red-400 hover:text-red-600">
                    Quitar
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleCampo(a.id, 'llego', a.llego)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${a.llego ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                >
                  {a.llego ? '✅ Llegó' : '⏳ Aún no llega'}
                </button>
                <button
                  onClick={() => toggleCampo(a.id, 'pagado', a.pagado)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${a.pagado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                >
                  {a.pagado ? '💰 Pagó' : 'Pendiente de pago'}
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {showNewClientModal && (
        <NewClientModal
          currentStaff={currentStaff}
          onClose={() => setShowNewClientModal(false)}
          onCreated={handleClientaCreada}
        />
      )}
    </div>
  );
}

