import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import SacarCajaModal from './SacarCajaModal';
import { codigoCorto, inicioDeHoyISO } from '../../utils/inventario';

// Bloque de la vista de la profesional: botón para registrar las cajas
// que saca del almacén y la lista de las que ha sacado hoy.
// No muestra el stock del almacén (la base de datos tampoco se lo permite).
export default function CajasProfesional({ currentStaff }) {
  const [abierto, setAbierto] = useState(false);
  const [salidas, setSalidas] = useState([]);

  const cargarSalidas = useCallback(async () => {
    const { data } = await supabase
      .from('inv_cajas')
      .select('id, codigo, salida_en, inv_referencias(tipo, largo)')
      .eq('salida_por', currentStaff.id)
      .gte('salida_en', inicioDeHoyISO())
      .order('salida_en', { ascending: false });
    setSalidas(data || []);
  }, [currentStaff.id]);

  useEffect(() => {
    cargarSalidas();
  }, [cargarSalidas]);

  const deshacer = async (caja) => {
    const nombre = `${caja.inv_referencias?.tipo} · ${caja.inv_referencias?.largo} mm`;
    if (!window.confirm(`¿Deshacer la salida de ${nombre}? Vuelve a contar como caja en el almacén.`)) return;
    const { error } = await supabase.rpc('inv_deshacer_salida', { p_caja_id: caja.id });
    if (error) {
      alert('No se ha podido deshacer. Pídeselo a la admin.');
      return;
    }
    cargarSalidas();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 p-5 mb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-gray-800">📦 Cajas de pestañas</p>
          <p className="text-sm text-gray-400">¿Has sacado una caja del almacén? Regístrala aquí.</p>
        </div>
        <button
          onClick={() => setAbierto(true)}
          className="bg-pink-600 text-white font-semibold px-5 py-3 rounded-xl active:bg-pink-700 whitespace-nowrap"
        >
          Sacar caja
        </button>
      </div>

      {salidas.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Has sacado hoy</p>
          <div className="space-y-1">
            {salidas.map((c) => (
              <div key={c.id} className="flex justify-between items-center text-sm py-1">
                <span className="text-gray-700">
                  <span className="font-semibold">{c.inv_referencias?.tipo}</span> · {c.inv_referencias?.largo} mm
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(c.salida_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {codigoCorto(c.codigo)}
                  </span>
                </span>
                <button onClick={() => deshacer(c)} className="text-xs text-gray-400 underline px-2 py-1">
                  Deshacer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {abierto && (
        <SacarCajaModal
          onClose={() => {
            setAbierto(false);
            cargarSalidas();
          }}
          onRegistrada={cargarSalidas}
        />
      )}
    </div>
  );
}
