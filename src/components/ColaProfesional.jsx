import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import FichaTabletModal from './FichaTabletModal';
import CajasProfesional from './inventario/CajasProfesional';
import { paralelosDe, resumenServicios } from '../lib/paralelos';
import { sinRegistro, registrosNecesarios } from '../lib/registros';
import GuiaProfesional, { claveGuia } from './GuiaProfesional';

const hoy = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function ColaProfesional({ currentStaff }) {
  const [asignaciones, setAsignaciones] = useState([]);
  const [activa, setActiva] = useState(null); // asignación abierta en la ficha
  const [faltaId, setFaltaId] = useState(null); // asignación que se intentó completar sin registrar
  const [pendientesRegistro, setPendientesRegistro] = useState([]); // atendidas sin registro (hoy y días anteriores)
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [otras, setOtras] = useState([]); // asignaciones de hoy de las mismas clientas con otras profesionales

  const fetchAsignaciones = useCallback(async () => {
    const { data } = await supabase
      .from('asignaciones_dia')
      .select('*, clients(*)')
      .eq('fecha', hoy())
      .eq('staff_id', currentStaff.id)
      .order('hora');
    if (data) {
      setAsignaciones(data);
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
      .lte('fecha', hoy())
      .in('estado', ['en_proceso', 'completado']);
    if (!citas || citas.length === 0) {
      setPendientesRegistro([]);
      return;
    }
    const { data: records } = await supabase
      .from('service_records')
      .select('client_id, staff_id, fecha, es_extra')
      .eq('staff_id', currentStaff.id)
      .gte('fecha', `${haceDias(7)}T00:00:00`);
    setPendientesRegistro(sinRegistro(citas, records || []));
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

  const marcarEstado = async (id, estado) => {
    if (estado === 'completado') {
      // No se completa si falta registrar lo que se le hizo a la clienta.
      const a = asignaciones.find((x) => x.id === id);
      if (a && a.tipo !== 'descanso' && a.client_id) {
        const { data: regs } = await supabase
          .from('service_records')
          .select('id')
          .eq('client_id', a.client_id)
          .eq('staff_id', currentStaff.id)
          .eq('es_extra', false)
          .gte('fecha', `${a.fecha}T00:00:00`)
          .lt('fecha', `${a.fecha}T23:59:59.999`);
        if ((regs || []).length < registrosNecesarios(a)) {
          setFaltaId(a.id);
          setActiva(a);
          return;
        }
      }
    }
    await supabase.from('asignaciones_dia').update({ estado }).eq('id', id);
    fetchAsignaciones();
  };

  const estadoStyle = {
    pendiente: 'border-gray-200',
    en_proceso: 'border-amber-300 ring-2 ring-amber-100',
    completado: 'border-green-300 opacity-60',
  };

  const citas = asignaciones.filter((a) => a.tipo !== 'descanso');
  const descansos = asignaciones.filter((a) => a.tipo === 'descanso');
  const pendientes = citas.filter((a) => a.estado !== 'completado');
  const completadas = citas.filter((a) => a.estado === 'completado');

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Hola, {currentStaff.nombre} 👋</h2>
      <p className="text-gray-400 mb-8">Tu agenda de hoy</p>

      <button
        onClick={() => setMostrarGuia(true)}
        className="mb-4 text-sm text-brand-700 font-semibold bg-brand-50 px-4 py-2 rounded-xl active:bg-brand-100"
      >
        ❓ Cómo funciona
      </button>

      {pendientesRegistro.length > 0 && (
        <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-2xl p-4">
          <p className="font-bold text-red-700 mb-2">
            ⚠️ Falta registrar lo que se le hizo a {pendientesRegistro.length === 1 ? 'una clienta' : `${pendientesRegistro.length} clientas`}
          </p>
          <div className="space-y-2">
            {pendientesRegistro.map((a) => (
              <div key={a.id} className="flex justify-between items-center bg-white rounded-xl px-3 py-2">
                <div>
                  <p className="font-semibold text-gray-800">{a.clients?.nombre}</p>
                  <p className="text-xs text-gray-400">{a.fecha === hoy() ? 'Hoy' : new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-ES')}</p>
                </div>
                <button
                  onClick={() => {
                    setFaltaId(a.id);
                    setActiva(a);
                  }}
                  className="bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg active:bg-red-600"
                >
                  Registrar ahora
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <CajasProfesional currentStaff={currentStaff} />

      {descansos.length > 0 && (
        <div className="space-y-2 mb-6">
          {descansos.map((d) => (
            <div key={d.id} className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-3">
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

      {pendientes.length === 0 && completadas.length === 0 && descansos.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
          Todavía no tienes clientas asignadas hoy.
        </div>
      )}

      <div className="space-y-4">
        {pendientes.map((a) => (
          <div
            key={a.id}
            className={`bg-white rounded-2xl shadow-sm border-2 p-6 ${estadoStyle[a.estado]}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-3xl font-bold text-gray-800">{a.clients?.nombre}</p>
                {a.hora && <p className="text-lg text-pink-600 font-semibold mt-1">{a.hora}</p>}
                {a.servicios?.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {a.servicios.map((s) => s.subtipo_servicio).join(' + ')}
                  </p>
                )}
                <span
                  className={`inline-block mt-2 text-xs font-semibold px-2 py-1 rounded-lg ${
                    a.llego ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {a.llego ? '✅ Ya llegó' : '⏳ Todavía no llega'}
                </span>
              </div>
              {a.clients?.alertas_salud && (
                <span className="text-xs bg-red-50 text-red-500 font-semibold px-3 py-2 rounded-lg">
                  ⚠️ Alerta de salud
                </span>
              )}
            </div>

            {paralelosDe(a, otras).map((b) => (
              <div key={b.id} className="mb-4 bg-pink-50 border-2 border-pink-200 text-pink-700 rounded-xl px-4 py-3">
                <p className="font-bold text-sm">🔗 Servicio en paralelo a la misma hora</p>
                <p className="text-sm">
                  {b.staff?.nombre} la atiende a la vez: {resumenServicios(b)}. Coordinen para no hacerla esperar.
                </p>
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={() => setActiva(a)}
                className="flex-1 bg-pink-600 text-white text-lg font-semibold py-4 rounded-xl active:bg-pink-700"
              >
                Abrir ficha
              </button>
              {a.estado === 'pendiente' && (
                <button
                  onClick={() => marcarEstado(a.id, 'en_proceso')}
                  className="px-5 bg-amber-100 text-amber-700 text-sm font-semibold rounded-xl active:bg-amber-200"
                >
                  En curso
                </button>
              )}
              {a.estado === 'en_proceso' && (
                <button
                  onClick={() => marcarEstado(a.id, 'completado')}
                  className="px-5 bg-green-100 text-green-700 text-sm font-semibold rounded-xl active:bg-green-200"
                >
                  Completar
                </button>
              )}
            </div>
          </div>
        ))}

        {completadas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mt-8 mb-3">Completadas hoy</p>
            {completadas.map((a) => (
              <div
                key={a.id}
                className={`bg-white rounded-2xl shadow-sm border-2 p-4 mb-2 flex justify-between items-center ${estadoStyle[a.estado]}`}
              >
                <div>
                  <p className="font-semibold text-gray-600">{a.clients?.nombre}</p>
                  {a.hora && <p className="text-xs text-gray-400">{a.hora}</p>}
                </div>
                <button onClick={() => setActiva(a)} className="text-xs text-pink-500 font-medium">
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
