import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import NewClientModal from './NewClientModal';
import { buscarClientas, enriquecerClientas, resumenClienta, nombresRepetidos } from '../lib/clientInfo';
import { inferirTipoExtension, buscarServicioExtension, proximoServicioDesde, servicioDesdeFlowww, esExtensionPestanas, servicioPuestaNueva, TEXTO_PUESTA_NUEVA, TEXTO_PENDIENTE } from '../lib/servicios';
import { sinRegistro, necesitaRegistroManual } from '../lib/registros';
import { paralelosDe, resumenServicios } from '../lib/paralelos';

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
  // Servicios de esta asignación: cada uno es una tarjeta editable (categoría, servicio, historial).
  const [servicios, setServicios] = useState([]);
  const [primeraVez, setPrimeraVez] = useState(false); // primera vez de la clienta en extensiones
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
    }
  }, []);

  const servicioVacio = () => {
    const firstCat = Object.keys(catalogo)[0];
    return {
      categoria_servicio: firstCat || '',
      subtipo_servicio: firstCat ? catalogo[firstCat][0] : '',
      historial_observaciones: '',
    };
  };

  // Un servicio adicional suele ser de otra categoría (lifting, manicura...): se ofrece la primera que no sea extensiones.
  const agregarServicio = () => {
    const cat = Object.keys(catalogo).find((c) => !esExtensionPestanas(c, catalogo[c][0])) || Object.keys(catalogo)[0];
    setServicios((s) => [
      ...s,
      { categoria_servicio: cat || '', subtipo_servicio: cat ? catalogo[cat][0] : '', historial_observaciones: '' },
    ]);
  };

  const quitarServicio = (index) => {
    setServicios((s) => (s.length > 1 ? s.filter((_, i) => i !== index) : s));
  };

  const actualizarServicio = (index, cambios) => {
    setServicios((prev) =>
      prev.map((sv, i) => {
        if (i !== index) return sv;
        const nuevo = { ...sv, ...cambios };
        // Primera vez haciéndose extensiones: el historial se completa solo.
        if (
          primeraVez &&
          esExtensionPestanas(nuevo.categoria_servicio, nuevo.subtipo_servicio) &&
          !(nuevo.historial_observaciones || '').trim()
        ) {
          nuevo.historial_observaciones = TEXTO_PUESTA_NUEVA;
        }
        return nuevo;
      })
    );
  };

  const [cargandoMapeo, setCargandoMapeo] = useState(false);
  const [servicioDetectado, setServicioDetectado] = useState(''); // texto: de dónde salió el servicio auto-cargado
  const [avisoParalelo, setAvisoParalelo] = useState('');
  const [profesionalAutoSeleccionada, setProfesionalAutoSeleccionada] = useState(false);

  const seleccionarClienta = async (c) => {
    setClientResults([]);
    setCargandoMapeo(true);

    // Traemos la profesional de preferencia y las notas generales de la
    // clienta (cargadas en su alta) para poder autocompletar.
    const { data: clienteCompleto } = await supabase
      .from('clients')
      .select('*')
      .eq('id', c.id)
      .single();

    setForm((f) => ({
      ...f,
      client: c,
      staff_id: clienteCompleto?.profesional_habitual_id || f.staff_id,
    }));
    setProfesionalAutoSeleccionada(!!clienteCompleto?.profesional_habitual_id);

    const { data: ultimos } = await supabase
      .from('service_records')
      .select('categoria_servicio, subtipo_servicio, historial_observaciones')
      .eq('client_id', c.id)
      .eq('es_extra', false)
      .order('fecha', { ascending: false })
      .limit(8);

    // Las visitas marcadas "Pendiente de cargar historial" no aportan información: se usa la
    // última visita con historial real (el servicio sí se toma de la visita más reciente).
    const lista = ultimos || [];
    const conInfo = lista.find((r) => (r.historial_observaciones || '').trim() && r.historial_observaciones.trim() !== TEXTO_PENDIENTE);
    const data = conInfo || lista[0] || null;
    const textoReal = conInfo ? conInfo.historial_observaciones : '';

    // Diseño / historial: lo de su última visita con información; si no hay, sus notas generales
    // (por ejemplo las que vinieron de Flowww).
    const historial = (textoReal || '').trim() || clienteCompleto?.notas_generales || '';

    // Servicio: 1) el de su última visita (en extensiones, su reposición),
    // 2) si no hay, se deduce del historial (mtc/bpc/0.25 → clásicas, 2D / V0.20 → 2D,
    // 3D-4D → volumen, 10D → mega).
    let servicioAuto = null;
    let origen = '';
    if (data && data.categoria_servicio && data.subtipo_servicio) {
      servicioAuto = proximoServicioDesde(catalogo, data.categoria_servicio, data.subtipo_servicio);
      origen = 'según su última visita';
    } else {
      // Sin visitas en la app: lo último que se hizo en Flowww; si no, se deduce del mapeo.
      const deFlowww = servicioDesdeFlowww(catalogo, clienteCompleto?.flowww_ultimo_servicio);
      if (deFlowww) {
        servicioAuto = deFlowww;
        origen = 'según su último servicio en Flowww';
      } else {
        const tipo = inferirTipoExtension(historial);
        if (tipo) {
          servicioAuto = buscarServicioExtension(catalogo, tipo, true);
          origen = 'deducido de su historial';
        }
      }
    }

    // ¿Es su primera vez con extensiones? (sin extensiones en la app, ni en Flowww, ni notas de mapeo)
    const { data: extPrevia } = await supabase
      .from('service_records')
      .select('id')
      .eq('client_id', c.id)
      .ilike('categoria_servicio', '%extens%')
      .limit(1)
      .maybeSingle();
    const esPrimera =
      !extPrevia &&
      !/extensiones/i.test(clienteCompleto?.flowww_ultimo_servicio || '') &&
      !(clienteCompleto?.notas_generales || '').trim();
    setPrimeraVez(esPrimera);

    if (servicioAuto) {
      setServicios([{ ...servicioAuto, historial_observaciones: historial }]);
      setServicioDetectado(`${servicioAuto.subtipo_servicio} (${origen})`);
    } else if (esPrimera && servicioPuestaNueva(catalogo)) {
      setServicios([{ ...servicioPuestaNueva(catalogo), historial_observaciones: TEXTO_PUESTA_NUEVA }]);
      setServicioDetectado('Puesta nueva (primera vez en extensiones)');
    } else {
      setServicios([{ ...servicioVacio(), historial_observaciones: historial }]);
      setServicioDetectado('');
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
    // Clienta nueva: primera vez en extensiones → "Puesta nueva", salvo que ya traiga notas.
    const notas = (nuevaClienta.notas_generales || '').trim();
    setPrimeraVez(!notas);
    const pn = servicioPuestaNueva(catalogo);
    if (!notas && pn) {
      setServicios([{ ...pn, historial_observaciones: TEXTO_PUESTA_NUEVA }]);
      setServicioDetectado('Puesta nueva (primera vez en extensiones)');
    } else {
      setServicios([{ ...servicioVacio(), historial_observaciones: notas }]);
      setServicioDetectado('');
    }
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

  // Visitas que la profesional no recordó: quedan "Pendiente de cargar historial" para completarlas.
  const [pendientesHistorial, setPendientesHistorial] = useState([]);
  const fetchPendientesHistorial = useCallback(async () => {
    const { data } = await supabase
      .from('service_records')
      .select('id, fecha, categoria_servicio, subtipo_servicio, clients(nombre), staff:staff_id(nombre)')
      .eq('historial_observaciones', TEXTO_PENDIENTE)
      .order('fecha', { ascending: false })
      .limit(30);
    setPendientesHistorial(data || []);
  }, []);
  useEffect(() => {
    fetchPendientesHistorial();
  }, [fetchPendientesHistorial, asignaciones]);

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

  // Registros técnicos del día que se mira: para avisar si falta registrar algo.
  const [registrosDia, setRegistrosDia] = useState([]);
  const fetchRegistrosDia = useCallback(async () => {
    const { data } = await supabase
      .from('service_records')
      .select('client_id, staff_id, fecha, es_extra')
      .gte('fecha', `${fechaAgenda}T00:00:00`)
      .lt('fecha', `${fechaAgenda}T23:59:59.999`);
    setRegistrosDia(data || []);
  }, [fechaAgenda]);
  useEffect(() => {
    fetchRegistrosDia();
    const t = setInterval(fetchRegistrosDia, 60000);
    return () => clearInterval(t);
  }, [fetchRegistrosDia, asignaciones]);
  const faltantesIds = new Set(
    sinRegistro(asignaciones, registrosDia)
      .filter((a) => necesitaRegistroManual(a))
      .map((a) => a.id)
  );

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!clientSearch) {
        setClientResults([]);
        return;
      }
      const base = await buscarClientas(clientSearch, 10);
      setClientResults(await enriquecerClientas(base));
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const resetFormularioCita = () => {
    setForm({ client: null, staff_id: '', hora: '' });
    setServicios([]);
    setClientSearch('');
    setEditingId(null);
    setServicioDetectado('');
    setPrimeraVez(false);
    setProfesionalAutoSeleccionada(false);
  };

  // Qué falta para poder asignar (el botón se activa solo cuando no falta nada).
  const faltaParaAsignar = [];
  if (!form.client) faltaParaAsignar.push('clienta');
  if (!form.staff_id) faltaParaAsignar.push('profesional');
  if (!(form.hora || '').trim()) faltaParaAsignar.push('hora');
  if (servicios.length === 0 || servicios.some((sv) => !sv.categoria_servicio || !sv.subtipo_servicio))
    faltaParaAsignar.push('servicio');
  if (
    servicios.some(
      (sv) =>
        esExtensionPestanas(sv.categoria_servicio, sv.subtipo_servicio) && !(sv.historial_observaciones || '').trim()
    )
  )
    faltaParaAsignar.push('historial');
  const listoParaAsignar = faltaParaAsignar.length === 0;

  const handleAsignar = async (e) => {
    e.preventDefault();
    if (!listoParaAsignar) return;

    // ¿Tiene servicios en paralelo (mani/pedi) a la misma hora con otra profesional?
    const nueva = { id: editingId || 'nueva', client_id: form.client.id, staff_id: form.staff_id, hora: form.hora, servicios, tipo: 'cita' };
    const enParalelo = paralelosDe(nueva, asignaciones);
    const avisar = () => {
      if (enParalelo.length === 0) return;
      const nombreProf = (id) => profesionales.find((p) => p.id === id)?.nombre || '';
      const nombres = [nombreProf(form.staff_id), ...enParalelo.map((b) => b.staff?.nombre || nombreProf(b.staff_id))]
        .filter(Boolean)
        .join(' y ');
      setAvisoParalelo(`🔗 ${form.client.nombre} tiene servicios en paralelo a las ${form.hora}. Se avisa en la tablet de ${nombres}.`);
    };

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
        avisar();
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
      avisar();
      resetFormularioCita();
      fetchAsignaciones();
    } else {
      alert('No se pudo asignar. Intenta de nuevo.');
    }
  };

  const iniciarEdicion = (a) => {
    setEditingId(a.id);
    setForm({ client: a.clients ? { id: a.client_id, nombre: a.clients.nombre } : null, staff_id: a.staff_id, hora: a.hora || '' });
    setServicios(a.servicios && a.servicios.length > 0 ? a.servicios : [servicioVacio()]);
    setServicioDetectado('');
    setPrimeraVez(false);
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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

      {pendientesHistorial.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-red-700 mb-1">
            📝 Pendiente de cargar historial ({pendientesHistorial.length})
          </h3>
          <p className="text-xs text-red-500 mb-3">
            La profesional no recordó qué se le hizo. Complétalo desde Fichas → la clienta → Editar en ese registro.
          </p>
          <div className="space-y-1.5">
            {pendientesHistorial.map((r) => (
              <div key={r.id} className="bg-white rounded-xl px-3 py-2 text-sm flex justify-between gap-2">
                <span>
                  <span className="font-semibold">{r.clients?.nombre}</span>{' '}
                  <span className="text-gray-400">— {r.subtipo_servicio}</span>
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(r.fecha).toLocaleDateString('es-ES')} · {r.staff?.nombre}
                </span>
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
            placeholder="Buscar por nombre o teléfono..."
            value={form.client ? form.client.nombre : clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setForm({ ...form, client: null });
            }}
            className="w-full p-2 border rounded-lg text-sm bg-white disabled:opacity-60"
          />
          {editingId && <p className="text-xs text-gray-400 mt-1">Para cambiar de clienta, quitá esta asignación y creá una nueva.</p>}
          {clientResults.length > 0 && !form.client && (
            <div className="absolute z-10 bg-white border rounded-lg mt-1 w-full shadow-md max-h-72 overflow-y-auto">
              {clientResults.map((c) => (
                <div
                  key={c.id}
                  onClick={() => seleccionarClienta(c)}
                  className="p-2 hover:bg-brand-50 cursor-pointer border-b last:border-b-0"
                >
                  <p className="text-sm font-semibold text-ink">
                    {c.nombre}
                    {nombresRepetidos(clientResults)(c) && (
                      <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Mismo nombre
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{resumenClienta(c)}</p>
                </div>
              ))}
            </div>
          )}
          {clientSearch && clientResults.length === 0 && !form.client && !editingId && (
            <p className="text-xs text-gray-400 mt-1">
              No se encontró ninguna clienta. Tocá "+ Nueva clienta" para darla de alta.
            </p>
          )}
          {form.client && (form.client.telefono || form.client.ultima_visita) && (
            <p className="text-xs text-gray-500 mt-1">{resumenClienta(form.client)}</p>
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
            <label className="text-xs font-semibold block mb-1">HORA</label>
            <input
              type="time"
              value={form.hora}
              onChange={(e) => setForm({ ...form, hora: e.target.value })}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            />
          </div>
        </div>

        {form.client && Object.keys(catalogo).length > 0 && (
          <div className="bg-white/70 border border-brand-100 rounded-2xl p-3 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold">SERVICIOS DE ESTA VISITA</label>
              {cargandoMapeo && <span className="text-xs text-gray-400">Cargando historial...</span>}
            </div>

            {servicioDetectado && (
              <p className="text-xs bg-brand-50 text-brand-700 font-medium px-3 py-2 rounded-xl">
                ✨ Cargado automáticamente: {servicioDetectado}. Puedes cambiarlo.
              </p>
            )}

            {servicios.map((sv, i) => {
              const esExt = esExtensionPestanas(sv.categoria_servicio, sv.subtipo_servicio);
              return (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 space-y-3 shadow-sm">
                  {servicios.length > 1 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-400">Servicio {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => quitarServicio(i)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold block mb-1">CATEGORÍA</label>
                      <select
                        value={sv.categoria_servicio}
                        onChange={(e) => {
                          const cat = e.target.value;
                          actualizarServicio(i, { categoria_servicio: cat, subtipo_servicio: catalogo[cat][0] });
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
                      <label className="text-xs font-semibold block mb-1">SERVICIO</label>
                      <select
                        value={sv.subtipo_servicio}
                        onChange={(e) => actualizarServicio(i, { subtipo_servicio: e.target.value })}
                        className="w-full p-2 border rounded-lg text-sm bg-white"
                      >
                        {(catalogo[sv.categoria_servicio] || []).map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      HISTORIAL / MAPEO {esExt ? <span className="text-blush-500">(obligatorio)</span> : '(opcional)'}
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Mapeo, diseño, lo acordado con la clienta..."
                      value={sv.historial_observaciones || ''}
                      onChange={(e) => actualizarServicio(i, { historial_observaciones: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={agregarServicio}
              className="w-full border-2 border-dashed border-brand-300 text-brand-600 text-sm font-semibold py-2 rounded-xl hover:bg-brand-50"
            >
              + Agregar otro servicio a esta clienta
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!listoParaAsignar}
          className="w-full bg-brand-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {editingId ? 'Guardar cambios' : 'Asignar'}
        </button>
        {form.client && !listoParaAsignar && (
          <p className="text-xs text-gray-400 text-center -mt-1">Falta: {faltaParaAsignar.join(', ')}</p>
        )}
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

      {avisoParalelo && (
        <div className="mb-4 bg-blush-50 border-2 border-blush-200 text-blush-700 text-sm font-medium rounded-xl p-3 flex justify-between items-start gap-2">
          <span>{avisoParalelo}</span>
          <button type="button" onClick={() => setAvisoParalelo('')} className="text-xs text-gray-400 hover:text-gray-600">
            Cerrar
          </button>
        </div>
      )}

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
              {faltantesIds.has(a.id) && (
                <p
                  className={`mt-2 text-xs font-semibold px-2 py-1.5 rounded-lg ${
                    a.fecha < hoyStr() ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {a.fecha < hoyStr()
                    ? `⚠️ ${a.staff?.nombre} no registró lo que se le hizo a esta clienta`
                    : `📝 ${a.staff?.nombre} aún no registró lo realizado`}
                </p>
              )}
              {paralelosDe(a, asignaciones).map((b) => (
                <p key={b.id} className="mt-2 text-xs bg-blush-50 text-blush-700 font-semibold px-2 py-1.5 rounded-lg">
                  🔗 En paralelo con {b.staff?.nombre}: {resumenServicios(b)}
                </p>
              ))}
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
