import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import FichaTabletModal from './FichaTabletModal';
import CajasProfesional from './inventario/CajasProfesional';
import { paralelosDe, resumenServicios } from '../lib/paralelos';
import { sinRegistro, registrosDe, registrosNecesarios, necesitaRegistroManual } from '../lib/registros';
import GuiaProfesional, { claveGuia } from './GuiaProfesional';

const hoy = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Citas de días anteriores ya guardadas automáticamente (para no repetirlo en esta sesión).
const autoGuardadas = new Set();

export default function ColaProfesional({ currentStaff }) {
  const [asignaciones, setAsignaciones] = useState([]);
  const [registrosHoy, setRegistrosHoy] = useState([]);
  const [activa, setActiva] = useState(null); // asignación abierta en la ficha
  const [faltaId, setFaltaId] = useState(null); // asignación que se abrió desde el aviso de "falta registrar"
  const [pendientesRegistro, setPendientesRegistro] = useState([]); // atendidas sin registro (hoy y días anteriores)
  const [mostrarGuia, setMostrarGuia] = useState(false);
  // Se puede ocultar el aviso de pendientes para hacerlos más tarde (reaparece solo a las 2 horas).
  const claveOculto = `pendientes_ocultos_${currentStaff.id}`;
  const leerOculto = () => {
    try {
      return Number(localStorage.getItem(claveOculto) || 0) > Date.now();
    } catch (e) {
      return false;
    }
  };
  const [ocultos, setOcultos] = useState(leerOculto);
  const ocultarPendientes = () => {
    try {
      localStorage.setItem(claveOculto, String(Date.now() + 2 * 60 * 60 * 1000));
    } catch (e) {
      /* sin almacenamiento: se oculta solo en esta sesión */
    }
    setOcultos(true);
  };
  const mostrarPendientes = () => {
    try {
      localStorage.removeItem(claveOculto);
    } catch (e) {
      /* nada */
    }
    setOcultos(false);
  };
  useEffect(() => {
    // al pasar las 2 horas vuelve a aparecer solo
    const t = setInterval(() => {
      if (ocultos && !leerOculto()) setOcultos(false);
    }, 60000);
    return () => clearInterval(t);
  }, [ocultos]); // eslint-disable-line react-hooks/exhaustive-deps
  const [otras, setOtras] = useState([]); // asignaciones de hoy de las mismas clientas con otras profesionales

  const fetchAsignaciones = useCallback(async () => {
    const { data } = await supabase
      .from('asignaciones_dia')
      .select('*, clients(*)')
      .eq('fecha', hoy())
      .eq('staff_id', currentStaff.id)
      .order('hora');
    if (!data) return;
    setAsignaciones(data);

    // Lo ya registrado hoy (para saber qué clientas ya están listas).
    const { data: regs } = await supabase
      .from('service_records')
      .select('client_id, staff_id, fecha, es_extra')
      .eq('staff_id', currentStaff.id)
      .gte('fecha', `${hoy()}T00:00:00`);
    setRegistrosHoy(regs || []);

    // Servicios en paralelo: la misma clienta, a la misma hora, con otra profesional.
    const ids = [...new Set(data.filter((a) => a.tipo !== 'descanso' && a.client_id).map((a) => a.client_id))];
    if (ids.length > 0) {
      const { data: resto } = await supabase
        .from('asignaciones_dia')
        .select('id, client_id, staff_id, hora, tipo, servicios, staff:staff_id(nombre)')
        .eq('fecha', hoy())
        .in('client_id', ids)
        .neq('staff_id', currentStaff.id);
      setOtras(resto || []);
    } else {
      setOtras([]);
    }
  }, [currentStaff.id]);

  // Guía de uso: aparece la primera vez que se abre en esta tablet.
  useEffect(() => {
    try {
      if (!localStorage.getItem(claveGuia(currentStaff.id))) setMostrarGuia(true);
    } catch (e) {
      setMostrarGuia(true);
    }
  }, [currentStaff.id]);

  const cerrarGuia = () => {
    try {
      localStorage.setItem(claveGuia(currentStaff.id), '1');
    } catch (e) {
      /* sin almacenamiento: simplemente se cierra */
    }
    setMostrarGuia(false);
  };

  // Citas atendidas (últimos 7 días) a las que aún les falta registrar lo realizado.
  const fetchPendientesRegistro = useCallback(async () => {
    const { data: citas } = await supabase
      .from('asignaciones_dia')
      .select('*, clients(*)')
      .eq('staff_id', currentStaff.id)
      .gte('fecha', haceDias(7))
      .lte('fecha', hoy());
    if (!citas || citas.length === 0) {
      setPendientesRegistro([]);
      return;
    }
    const { data: records } = await supabase
      .from('service_records')
      .select('client_id, staff_id, fecha, es_extra')
      .eq('staff_id', currentStaff.id)
      .gte('fecha', `${haceDias(7)}T00:00:00`);
    const faltan = sinRegistro(citas, records || []);

    // Citas de días anteriores que YA traen información (historial escrito): se guardan solas
    // en su historial, sin pedirle nada a la profesional. Así nada queda vacío.
    const auto = faltan.filter((a) => a.fecha < hoy() && !necesitaRegistroManual(a) && !autoGuardadas.has(a.id));
    for (const a of auto) {
      autoGuardadas.add(a.id);
      const yaHay = registrosDe(a, records || []);
      const filas = (a.servicios || []).slice(yaHay).map((sv) => ({
        client_id: a.client_id,
        staff_id: currentStaff.id,
        categoria_servicio: sv.categoria_servicio,
        subtipo_servicio: sv.subtipo_servicio,
        historial_observaciones: sv.historial_observaciones || '',
        fecha: `${a.fecha}T12:00:00`,
      }));
      if (filas.length > 0) {
        const { error } = await supabase.from('service_records').insert(filas);
        if (error) autoGuardadas.delete(a.id);
        else await supabase.from('asignaciones_dia').update({ estado: 'completado' }).eq('id', a.id);
      }
    }

    // Se le avisa solo de las que no tienen información (vacías o todavía "Puesta nueva").
    setPendientesRegistro(faltan.filter((a) => necesitaRegistroManual(a)));
  }, [currentStaff.id]);

  useEffect(() => {
    fetchPendientesRegistro();
    const t = setInterval(fetchPendientesRegistro, 60000);
    return () => clearInterval(t);
  }, [fetchPendientesRegistro]);

  useEffect(() => {
    fetchAsignaciones();
    // refresco automático cada 60s por si la secretaria agrega algo nuevo
    const interval = setInterval(fetchAsignaciones, 60000);
    return () => clearInterval(interval);
  }, [fetchAsignaciones]);

  // Quitar una clienta de la lista de pendientes (no vino / no se le hizo nada): vuelve a "aún no llega".
  const quitarPendiente = async (a) => {
    const seguro = window.confirm(
      `¿${a.clients?.nombre} no vino o no se le hizo nada? Se quitará de la lista de pendientes y no quedará nada registrado.`
    );
    if (!seguro) return;
    await supabase.from('asignaciones_dia').update({ llego: false, estado: 'pendiente' }).eq('id', a.id);
    fetchPendientesRegistro();
    fetchAsignaciones();
  };

  const citas = asignaciones.filter((a) => a.tipo !== 'descanso');
  const descansos = asignaciones.filter((a) => a.tipo === 'descanso');
  // Una clienta pasa sola a "Atendidas" cuando ya se confirmó todo lo que se le hizo.
  const estaRegistrada = (a) => a.estado === 'completado' || registrosDe(a, registrosHoy) >= registrosNecesarios(a);
  const pendientes = citas.filter((a) => !estaRegistrada(a));
  const atendidas = citas.filter(estaRegistrada);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-sm font-semibold text-brand-600 mb-1">Tu agenda de hoy</p>
          <h2 className="font-display text-3xl font-semibold text-ink">Hola, {currentStaff.nombre}</h2>
        </div>
        <button
          onClick={() => setMostrarGuia(true)}
          className="text-sm text-brand-700 font-semibold bg-brand-50 px-4 py-2 rounded-full active:bg-brand-100"
        >
          ? Cómo funciona
        </button>
      </div>

      {pendientesRegistro.length > 0 && ocultos && (
        <button
          onClick={mostrarPendientes}
          className="mb-6 w-full text-left text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 active:bg-red-100"
        >
          ⚠️ {pendientesRegistro.length} registro{pendientesRegistro.length > 1 ? 's' : ''} pendiente
          {pendientesRegistro.length > 1 ? 's' : ''} (ocultos) · Toca para verlos
        </button>
      )}

      {pendientesRegistro.length > 0 && !ocultos && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-3xl p-5">
          <div className="flex justify-between items-start gap-3 mb-3">
            <p className="font-bold text-red-700">
              Falta registrar lo que se le hizo a{' '}
              {pendientesRegistro.length === 1 ? 'una clienta' : `${pendientesRegistro.length} clientas`}
            </p>
            <button
              onClick={ocultarPendientes}
              className="text-xs font-semibold text-red-500 bg-white border border-red-200 px-3 py-1.5 rounded-full whitespace-nowrap active:bg-red-50"
            >
              Ocultar y hacerlo más tarde
            </button>
          </div>
          <div className="space-y-2">
            {pendientesRegistro.map((a) => (
              <div key={a.id} className="flex justify-between items-center bg-white rounded-2xl px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{a.clients?.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {a.fecha === hoy() ? 'Hoy' : new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-ES')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => quitarPendiente(a)}
                    className="text-xs font-semibold text-gray-400 px-3 py-2 rounded-full active:bg-gray-100"
                  >
                    Quitar
                  </button>
                  <button
                    onClick={() => {
                      setFaltaId(a.id);
                      setActiva(a);
                    }}
                    className="bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-full active:bg-red-600"
                  >
                    Registrar ahora
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CajasProfesional currentStaff={currentStaff} />

      {descansos.length > 0 && (
        <div className="space-y-2 mb-6">
          {descansos.map((d) => (
            <div key={d.id} className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-center gap-3">
              <span className="text-2xl">☕</span>
              <div>
                <p className="font-bold text-amber-700">
                  Descanso {d.hora}
                  {d.hora_fin && ` – ${d.hora_fin}`}
                </p>
                {d.historial_observaciones && <p className="text-sm text-amber-600">{d.historial_observaciones}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendientes.length === 0 && atendidas.length === 0 && descansos.length === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
          Todavía no tienes clientas asignadas hoy.
        </div>
      )}

      <div className="space-y-4">
        {pendientes.map((a) => (
          <div key={a.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-start gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {a.hora && (
                    <span className="text-sm font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full">{a.hora}</span>
                  )}
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      a.llego ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {a.llego ? '✓ Ya llegó' : 'Aún no llega'}
                  </span>
                </div>
                <p className="text-3xl font-bold text-ink leading-tight">{a.clients?.nombre}</p>
                {a.servicios?.length > 0 && (
                  <p className="text-base text-gray-500 mt-1">{a.servicios.map((s) => s.subtipo_servicio).join(' + ')}</p>
                )}
              </div>
              {a.clients?.alertas_salud && (
                <span className="text-xs bg-red-50 text-red-600 font-semibold px-3 py-2 rounded-full whitespace-nowrap">
                  ⚠️ Alerta de salud
                </span>
              )}
            </div>

            {paralelosDe(a, otras).map((b) => (
              <div key={b.id} className="mb-4 bg-blush-50 border border-blush-200 text-blush-600 rounded-2xl px-4 py-3">
                <p className="font-bold text-sm">🔗 Servicio en paralelo a la misma hora</p>
                <p className="text-sm">
                  {b.staff?.nombre} la atiende a la vez: {resumenServicios(b)}. Coordinen para no hacerla esperar.
                </p>
              </div>
            ))}

            <button
              onClick={() => setActiva(a)}
              className="w-full bg-brand-600 text-white text-lg font-semibold py-4 rounded-2xl active:bg-brand-700"
            >
              Abrir ficha
            </button>
          </div>
        ))}

        {atendidas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-8 mb-3">Atendidas hoy</p>
            {atendidas.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 mb-2 flex justify-between items-center opacity-70"
              >
                <div>
                  <p className="font-semibold text-gray-600">✓ {a.clients?.nombre}</p>
                  {a.hora && <p className="text-xs text-gray-400">{a.hora}</p>}
                </div>
                <button onClick={() => setActiva(a)} className="text-sm text-brand-600 font-semibold">
                  Ver ficha
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {mostrarGuia && <GuiaProfesional onClose={cerrarGuia} />}

      {activa && (
        <FichaTabletModal
          client={activa.clients}
          asignacion={activa}
          currentStaff={currentStaff}
          avisoFalta={faltaId === activa.id}
          onClose={() => {
            setActiva(null);
            setFaltaId(null);
            fetchAsignaciones();
            fetchPendientesRegistro();
          }}
        />
      )}
    </div>
  );
}
