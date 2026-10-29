import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { agruparCatalogo } from '../lib/catalogo';
import DisenoPestanas from './DisenoPestanas';

// Solo las extensiones de pestañas exigen diseño u observaciones.
const esExtensionPestanas = (categoria, subtipo) => {
  const t = `${categoria || ''} ${subtipo || ''}`.toLowerCase();
  return t.includes('extens') && t.includes('pesta');
};

const limpiarDiseno = (v) => (v || '').replace(/\s*·\s*$/, '').trim() || null;

const esServicioDePestanas = (categoria, subtipo) => {
  const texto = `${categoria || ''} ${subtipo || ''}`.toLowerCase();
  return texto.includes('pestañas') || texto.includes('lifting');
};

export default function FichaTabletModal({ client, asignacion, currentStaff, onClose, avisoFalta = false }) {
  const [catalogo, setCatalogo] = useState({});
  const [records, setRecords] = useState([]);
  const [tiposPestana, setTiposPestana] = useState([]); // tipos del inventario (2D LU, MTC, ...)
  useEffect(() => {
    supabase
      .from('inv_referencias')
      .select('tipo, orden_tipo, activo')
      .eq('activo', true)
      .order('orden_tipo')
      .then(({ data }) => setTiposPestana([...new Set((data || []).map((r) => r.tipo))]));
  }, []);

  // Lista de servicios de esta visita: viene de asignacion.servicios (nuevo
  // formato) o, si es una asignación vieja, de los campos sueltos (compatibilidad).
  const [items, setItems] = useState([]);
  const [savingIndex, setSavingIndex] = useState(null);
  const [guardadoIndex, setGuardadoIndex] = useState(null);

  const [mostrarExtra, setMostrarExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({
    categoria_servicio: '',
    subtipo_servicio: '',
    diseno_pestanas: '',
    historial_observaciones: '',
  });
  const [savingExtra, setSavingExtra] = useState(false);
  const [extraGuardado, setExtraGuardado] = useState(false);

  const fetchCatalogo = useCallback(async () => {
    const { data } = await supabase
      .from('servicios_catalogo')
      .select('categoria, subtipo, orden')
      .eq('activo', true)
      .order('orden');
    if (data) {
      const grouped = agruparCatalogo(data);
      setCatalogo(grouped);
      const firstCat = Object.keys(grouped)[0];

      if (firstCat) {
        setExtraForm((f) => (f.categoria_servicio ? f : { ...f, categoria_servicio: firstCat, subtipo_servicio: grouped[firstCat][0] }));
      }

      // Armar la lista de servicios a confirmar
      if (asignacion?.servicios?.length > 0) {
        setItems(asignacion.servicios.map((s) => ({ diseno_pestanas: '', ...s, guardado: false })));
      } else if (asignacion?.categoria_servicio) {
        // asignación vieja, un solo servicio suelto
        setItems([
          {
            categoria_servicio: asignacion.categoria_servicio,
            subtipo_servicio: asignacion.subtipo_servicio || '',
            diseno_pestanas: '',
            historial_observaciones: asignacion.historial_observaciones || '',
            guardado: false,
          },
        ]);
      } else if (firstCat) {
        // sin asignación previa: un servicio en blanco para completar
        setItems([
          {
            categoria_servicio: firstCat,
            subtipo_servicio: grouped[firstCat][0],
            diseno_pestanas: '',
            historial_observaciones: '',
            guardado: false,
          },
        ]);
      }
    }
  }, [asignacion]);

  const fetchRecords = useCallback(async () => {
    const { data } = await supabase
      .from('service_records')
      .select('*')
      .eq('client_id', client.id)
      .order('fecha', { ascending: false })
      .limit(6);
    if (data) setRecords(data);
  }, [client.id]);

  useEffect(() => {
    fetchCatalogo();
    fetchRecords();
  }, [fetchCatalogo, fetchRecords]);

  // El diseño de pestañas de la última vez viene ya escrito: si no cambió,
  // basta con confirmar. Si cambió, se edita y recepción lo verá como cambio.
  const [unificado, setUnificado] = useState(false);
  useEffect(() => {
    if (unificado || items.length === 0) return;
    setUnificado(true);
    setItems((prev) =>
      prev.map((it) => {
        const obs = (it.historial_observaciones || '').trim();
        if (!esServicioDePestanas(it.categoria_servicio, it.subtipo_servicio) || !obs) return it;
        const dis = (it.diseno_pestanas || '').trim();
        return { ...it, diseno_pestanas: dis ? `${dis} — ${obs}` : obs, historial_observaciones: '' };
      })
    );
  }, [items.length, unificado]);

  const [disenoPrellenado, setDisenoPrellenado] = useState(false);
  useEffect(() => {
    if (disenoPrellenado || items.length === 0 || records.length === 0) return;
    const ultimo = records.find((r) => r.diseno_pestanas && r.diseno_pestanas.trim());
    setDisenoPrellenado(true);
    if (!ultimo) return;
    setItems((prev) =>
      prev.map((it) =>
        esServicioDePestanas(it.categoria_servicio, it.subtipo_servicio) && !(it.diseno_pestanas || '').trim()
          ? { ...it, diseno_pestanas: ultimo.diseno_pestanas }
          : it
      )
    );
  }, [items.length, records, disenoPrellenado]);

  const actualizarItem = (index, campo, valor) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)));
  };

  const guardarItem = async (index) => {
    const item = items[index];

    // Lo que se le hizo a la clienta NO puede quedar vacío: en extensiones de pestañas
    // hace falta el diseño o las observaciones (puede ser lo mismo que la última vez).
    if (
      esExtensionPestanas(item.categoria_servicio, item.subtipo_servicio) &&
      !(item.diseno_pestanas || '').trim() &&
      !(item.historial_observaciones || '').trim()
    ) {
      alert('Falta registrar lo que se le hizo: escribe el diseño o las observaciones (puede ser igual que la última vez).');
      return false;
    }

    setSavingIndex(index);

    // Si es un servicio de pestañas con diseño cargado, comparamos contra
    // el último diseño registrado de esta clienta para avisar si cambió.
    let disenoCambioPendiente = false;
    if (esServicioDePestanas(item.categoria_servicio, item.subtipo_servicio) && item.diseno_pestanas) {
      const { data: previo } = await supabase
        .from('service_records')
        .select('diseno_pestanas')
        .eq('client_id', client.id)
        .not('diseno_pestanas', 'is', null)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previo?.diseno_pestanas && previo.diseno_pestanas.trim() !== item.diseno_pestanas.trim()) {
        disenoCambioPendiente = true;
      }
    }

    const { error } = await supabase.from('service_records').insert([
      {
        client_id: client.id,
        staff_id: currentStaff.id,
        categoria_servicio: item.categoria_servicio,
        subtipo_servicio: item.subtipo_servicio,
        diseno_pestanas: limpiarDiseno(item.diseno_pestanas),
        diseno_cambio_pendiente: disenoCambioPendiente,
        historial_observaciones: item.historial_observaciones,
        // Si se está registrando una cita de un día anterior, queda con la fecha de esa cita.
        ...(asignacion?.fecha && asignacion.fecha < new Date().toISOString().slice(0, 10)
          ? { fecha: `${asignacion.fecha}T12:00:00` }
          : {}),
      },
    ]);
    setSavingIndex(null);
    if (!error) {
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, guardado: true } : it)));
      setGuardadoIndex(index);
      fetchRecords();
      setTimeout(() => setGuardadoIndex(null), 1500);
      return true;
    }
    alert('No se pudo guardar este servicio.');
    return false;
  };

  const guardarTodosPendientes = async () => {
    for (let i = 0; i < items.length; i++) {
      if (!items[i].guardado) {
        const ok = await guardarItem(i);
        if (!ok) break;
      }
    }
  };

  const handleSaveExtra = async (e) => {
    e.preventDefault();
    setSavingExtra(true);

    let disenoCambioPendiente = false;
    if (esServicioDePestanas(extraForm.categoria_servicio, extraForm.subtipo_servicio) && extraForm.diseno_pestanas) {
      const { data: previo } = await supabase
        .from('service_records')
        .select('diseno_pestanas')
        .eq('client_id', client.id)
        .not('diseno_pestanas', 'is', null)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previo?.diseno_pestanas && previo.diseno_pestanas.trim() !== extraForm.diseno_pestanas.trim()) {
        disenoCambioPendiente = true;
      }
    }

    const { error } = await supabase.from('service_records').insert([
      {
        client_id: client.id,
        staff_id: currentStaff.id,
        categoria_servicio: extraForm.categoria_servicio,
        subtipo_servicio: extraForm.subtipo_servicio,
        diseno_pestanas: limpiarDiseno(extraForm.diseno_pestanas),
        diseno_cambio_pendiente: disenoCambioPendiente,
        historial_observaciones: extraForm.historial_observaciones,
        es_extra: true,
      },
    ]);
    setSavingExtra(false);
    if (!error) {
      setExtraGuardado(true);
      setExtraForm((f) => ({ ...f, diseno_pestanas: '', historial_observaciones: '' }));
      fetchRecords();
      setTimeout(() => {
        setExtraGuardado(false);
        setMostrarExtra(false);
      }, 1500);
    } else {
      alert('No se pudo guardar el extra.');
    }
  };

  // Cuando todos los servicios están confirmados, la cita pasa sola a "completado".
  useEffect(() => {
    if (
      asignacion?.id &&
      asignacion.estado !== 'completado' &&
      items.length > 0 &&
      items.every((it) => it.guardado)
    ) {
      supabase.from('asignaciones_dia').update({ estado: 'completado' }).eq('id', asignacion.id);
    }
  }, [items, asignacion]);

  const handleVolver = () => {
    const sinConfirmar = items.filter((it) => !it.guardado).length;
    const yaAtendida = asignacion && (asignacion.llego || (asignacion.estado && asignacion.estado !== 'pendiente'));
    if (yaAtendida && sinConfirmar > 0) {
      const seguro = window.confirm(
        `Todavía no confirmaste ${sinConfirmar} servicio${sinConfirmar > 1 ? 's' : ''} de ${client.nombre}. ` +
          'Lo que se le hizo tiene que quedar registrado. ¿Salir igualmente?'
      );
      if (!seguro) return;
    }
    onClose();
  };

  const cargadoPorRecepcion = asignacion?.servicios?.length > 0 || asignacion?.categoria_servicio;
  const pendientes = items.filter((it) => !it.guardado).length;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 pb-16">
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pt-2 pb-4">
          <button
            onClick={handleVolver}
            className="text-gray-400 text-lg font-medium flex items-center gap-1 active:text-gray-600"
          >
            ← Volver
          </button>
          {guardadoIndex !== null && <span className="text-green-600 text-sm font-semibold">✓ Guardado</span>}
        </div>

        <h2 className="text-3xl font-bold text-ink">{client.nombre}</h2>
        <p className={`text-lg font-medium mt-1 mb-2 ${client.alertas_salud ? 'text-red-500' : 'text-gray-400'}`}>
          {client.alertas_salud ? '' : '✓'} {client.alertas_salud || 'Sin alertas de salud registradas'}
        </p>
        {asignacion && (
          <span
            className={`inline-block text-xs font-semibold px-2 py-1 rounded-lg mb-4 ${
              asignacion.pagado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {asignacion.pagado ? 'Pagó' : 'Pendiente de pago'}
          </span>
        )}

        {(avisoFalta || (asignacion?.estado === 'completado' && pendientes > 0)) && pendientes > 0 && (
          <div className="mb-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl px-4 py-3">
            <p className="font-bold">Falta registrar lo que se le hizo a {client.nombre}</p>
            <p className="text-sm">
              Revisa el servicio y el diseño (ya vienen cargados con lo de la última vez) y pulsa "Confirmar".
              Quedará guardado en su historial.
            </p>
          </div>
        )}

        {items.length > 0 && pendientes === 0 && (
          <p className="mb-4 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            ✓ Todo registrado. Ya puedes volver a tu agenda.
          </p>
        )}

        {cargadoPorRecepcion && (
          <p className="text-xs bg-brand-100 text-brand-700 font-semibold px-3 py-2 rounded-lg inline-block mb-4">
            Cargado por recepción — revisa y confirma cada servicio
          </p>
        )}

        {items.length > 1 && pendientes > 0 && (
          <button
            onClick={guardarTodosPendientes}
            className="w-full bg-brand-600 text-white text-base font-semibold py-3 rounded-xl active:bg-brand-700 mb-4"
          >
            Confirmar todos los servicios ({pendientes} pendiente{pendientes > 1 ? 's' : ''})
          </button>
        )}

        {Object.keys(catalogo).length > 0 && (
          <div className="space-y-4 mb-8">
            {items.map((item, index) => (
              <div
                key={index}
                className={`space-y-4 p-5 rounded-2xl border-2 ${
                  item.guardado ? 'bg-green-50 border-green-200' : 'bg-brand-50/60 border-brand-100'
                }`}
              >
                {items.length > 1 && (
                  <p className="text-xs font-semibold text-gray-400">
                    Servicio {index + 1} de {items.length}
                  </p>
                )}

                <div>
                  <label className="text-sm font-semibold block mb-2">CATEGORÍA</label>
                  <select
                    value={item.categoria_servicio}
                    onChange={(e) => {
                      const cat = e.target.value;
                      actualizarItem(index, 'categoria_servicio', cat);
                      actualizarItem(index, 'subtipo_servicio', catalogo[cat][0]);
                    }}
                    disabled={item.guardado}
                    className="w-full p-4 border rounded-xl text-lg bg-white disabled:opacity-60"
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
                    value={item.subtipo_servicio}
                    onChange={(e) => actualizarItem(index, 'subtipo_servicio', e.target.value)}
                    disabled={item.guardado}
                    className="w-full p-4 border rounded-xl text-lg bg-white disabled:opacity-60"
                  >
                    {(catalogo[item.categoria_servicio] || []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {esServicioDePestanas(item.categoria_servicio, item.subtipo_servicio) && (
                  <div>
                    <label className="text-sm font-semibold block mb-2">DISEÑO Y OBSERVACIONES</label>
                    <DisenoPestanas
                      tipos={tiposPestana}
                      value={item.diseno_pestanas || ''}
                      onChange={(v) => actualizarItem(index, 'diseno_pestanas', v)}
                      disabled={item.guardado}
                    />
                  </div>
                )}

                {!esServicioDePestanas(item.categoria_servicio, item.subtipo_servicio) && (
                <div>
                  <label className="text-sm font-semibold block mb-2">OBSERVACIONES</label>
                  <textarea
                    rows="2"
                    placeholder="Mapeo, reacciones, comentarios..."
                    value={item.historial_observaciones}
                    onChange={(e) => actualizarItem(index, 'historial_observaciones', e.target.value)}
                    disabled={item.guardado}
                    className="w-full p-4 border rounded-xl text-lg bg-white disabled:opacity-60"
                  />
                </div>
                )}

                <button
                  onClick={() => guardarItem(index)}
                  disabled={item.guardado || savingIndex === index}
                  className="w-full bg-brand-600 text-white text-lg font-semibold py-4 rounded-xl active:bg-brand-700 disabled:opacity-50"
                >
                  {item.guardado ? '✓ Confirmado' : savingIndex === index ? 'Guardando...' : 'Confirmar este servicio'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Servicio extra: separado del resto para que no se confunda
            con lo asignado, y quede bien visible para la secretaria. */}
        <div className="mb-8">
          {!mostrarExtra ? (
            <button
              onClick={() => setMostrarExtra(true)}
              className="w-full border-2 border-dashed border-amber-300 text-amber-700 text-base font-semibold py-4 rounded-xl active:bg-amber-50"
            >
              La clienta se hizo algo extra
            </button>
          ) : (
            <form onSubmit={handleSaveExtra} className="space-y-4 bg-amber-50 p-5 rounded-2xl border-2 border-amber-200">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-amber-700">Servicio extra realizado</h3>
                <button type="button" onClick={() => setMostrarExtra(false)} className="text-xs text-gray-400">
                  Cancelar
                </button>
              </div>
              <p className="text-xs text-amber-600">
                Queda como pendiente para que recepción lo cargue en Booksy.
              </p>

              <div>
                <label className="text-sm font-semibold block mb-2">CATEGORÍA</label>
                <select
                  value={extraForm.categoria_servicio}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setExtraForm({ ...extraForm, categoria_servicio: cat, subtipo_servicio: catalogo[cat][0] });
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
                  value={extraForm.subtipo_servicio}
                  onChange={(e) => setExtraForm({ ...extraForm, subtipo_servicio: e.target.value })}
                  className="w-full p-4 border rounded-xl text-lg bg-white"
                >
                  {(catalogo[extraForm.categoria_servicio] || []).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {esServicioDePestanas(extraForm.categoria_servicio, extraForm.subtipo_servicio) && (
                <div>
                  <label className="text-sm font-semibold block mb-2">DISEÑO Y OBSERVACIONES</label>
                  <DisenoPestanas
                    tipos={tiposPestana}
                    value={extraForm.diseno_pestanas}
                    onChange={(v) => setExtraForm({ ...extraForm, diseno_pestanas: v })}
                  />
                </div>
              )}

              {!esServicioDePestanas(extraForm.categoria_servicio, extraForm.subtipo_servicio) && (
              <div>
                <label className="text-sm font-semibold block mb-2">DETALLE (opcional)</label>
                <textarea
                  rows="2"
                  placeholder="Algún detalle extra..."
                  value={extraForm.historial_observaciones}
                  onChange={(e) => setExtraForm({ ...extraForm, historial_observaciones: e.target.value })}
                  className="w-full p-4 border rounded-xl text-lg bg-white"
                />
              </div>
              )}

              <button
                type="submit"
                disabled={savingExtra}
                className="w-full bg-amber-500 text-white text-lg font-semibold py-4 rounded-xl active:bg-amber-600 disabled:opacity-50"
              >
                {extraGuardado ? '✓ Guardado' : savingExtra ? 'Guardando...' : 'Guardar extra'}
              </button>
            </form>
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-700 mb-3">Últimos servicios</h3>
        <div className="space-y-3">
          {records.length === 0 && <p className="text-gray-400">Sin historial previo.</p>}
          {records.map((r) => (
            <div key={r.id} className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">{new Date(r.fecha).toLocaleDateString('es-ES')}</p>
              <p className="font-semibold text-ink">
                {r.categoria_servicio}: <span className="font-normal">{r.subtipo_servicio}</span>
                {r.es_extra && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-semibold">
                    extra
                  </span>
                )}
              </p>
              {r.diseno_pestanas && (
                <p className="text-sm text-blush-600 mt-1">
                  <strong>Diseño:</strong> {r.diseno_pestanas}
                </p>
              )}
              {r.historial_observaciones && <p className="text-sm text-gray-600 mt-1">{r.historial_observaciones}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

