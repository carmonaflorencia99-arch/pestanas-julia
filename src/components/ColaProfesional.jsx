import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import FichaTabletModal from './FichaTabletModal';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function ColaProfesional({ currentStaff }) {
  const [asignaciones, setAsignaciones] = useState([]);
  const [activa, setActiva] = useState(null); // asignación abierta en la ficha

  const fetchAsignaciones = useCallback(async () => {
    const { data } = await supabase
      .from('asignaciones_dia')
      .select('*, clients(*)')
      .eq('fecha', hoy())
      .eq('staff_id', currentStaff.id)
      .order('hora');
    if (data) setAsignaciones(data);
  }, [currentStaff.id]);

  useEffect(() => {
    fetchAsignaciones();
    // refresco automático cada 60s por si la secretaria agrega algo nuevo
    const interval = setInterval(fetchAsignaciones, 60000);
    return () => clearInterval(interval);
  }, [fetchAsignaciones]);

  const marcarEstado = async (id, estado) => {
    await supabase.from('asignaciones_dia').update({ estado }).eq('id', id);
    fetchAsignaciones();
  };

  const estadoStyle = {
    pendiente: 'border-gray-200',
    en_proceso: 'border-amber-300 ring-2 ring-amber-100',
    completado: 'border-green-300 opacity-60',
  };

  const pendientes = asignaciones.filter((a) => a.estado !== 'completado');
  const completadas = asignaciones.filter((a) => a.estado === 'completado');

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Hola, {currentStaff.nombre} 👋</h2>
      <p className="text-gray-400 mb-8">Tu agenda de hoy</p>

      {pendientes.length === 0 && completadas.length === 0 && (
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
              </div>
              {a.clients?.alertas_salud && (
                <span className="text-xs bg-red-50 text-red-500 font-semibold px-3 py-2 rounded-lg">
                  ⚠️ Alerta de salud
                </span>
              )}
            </div>

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

      {activa && (
        <FichaTabletModal
          client={activa.clients}
          asignacion={activa}
          currentStaff={currentStaff}
          onClose={() => {
            setActiva(null);
            fetchAsignaciones();
          }}
        />
      )}
    </div>
  );
}
