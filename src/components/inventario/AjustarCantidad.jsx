import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { nombreReferencia } from '../../utils/inventario';

// Corregir de golpe cuántas cajas hay de una referencia (solo admin).
// - Si se baja la cantidad, se quitan primero las cajas SIN QR (las más
//   recientes primero) y solo después, si hiciera falta, las escaneadas.
// - Si se sube, se añaden cajas sin QR.
export default function AjustarCantidad({ fila, onClose, onGuardado }) {
  const [cajas, setCajas] = useState(null); // cajas en almacén de esta referencia
  const [nueva, setNueva] = useState(String(fila.en_almacen));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Se cargan por páginas: Supabase devuelve como mucho 1000 filas por consulta.
    let cancelado = false;
    const cargar = async () => {
      const todas = [];
      for (let desde = 0; desde < 20000; desde += 1000) {
        const { data, error: e } = await supabase
          .from('inv_cajas')
          .select('id, codigo, entrada_en')
          .eq('referencia_id', fila.referencia_id)
          .eq('estado', 'en_almacen')
          .order('entrada_en', { ascending: false })
          .order('id')
          .range(desde, desde + 999);
        if (e) {
          if (!cancelado) setError('No se han podido cargar las cajas.');
          break;
        }
        todas.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      if (!cancelado) setCajas(todas);
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [fila.referencia_id]);

  const actual = cajas ? cajas.length : fila.en_almacen;
  const sinQR = cajas ? cajas.filter((c) => !c.codigo) : [];
  const conQR = cajas ? cajas.filter((c) => c.codigo) : [];
  const objetivo = parseInt(nueva, 10);
  const valido = !Number.isNaN(objetivo) && objetivo >= 0 && objetivo <= 2000;
  const diferencia = valido ? objetivo - actual : 0;
  const quitaEscaneadas = diferencia < 0 ? Math.max(0, -diferencia - sinQR.length) : 0;

  const guardar = async () => {
    if (!valido || diferencia === 0 || !cajas) return;
    if (
      quitaEscaneadas > 0 &&
      !window.confirm(
        `Para dejar ${objetivo} cajas hay que quitar también ${quitaEscaneadas} ${
          quitaEscaneadas === 1 ? 'caja escaneada' : 'cajas escaneadas'
        } (con QR). ¿Seguro?`
      )
    )
      return;

    setGuardando(true);
    setError('');

    if (diferencia > 0) {
      for (let resto = diferencia; resto > 0; resto -= 500) {
        const { error: e } = await supabase.rpc('inv_alta_sin_codigo', {
          p_referencia_id: fila.referencia_id,
          p_cantidad: Math.min(resto, 500),
          p_origen: 'manual',
        });
        if (e) {
          setError('No se han podido añadir todas las cajas.');
          setGuardando(false);
          onGuardado();
          return;
        }
      }
    } else {
      // sinQR y conQR ya vienen ordenadas de la más reciente a la más antigua
      const aQuitar = [...sinQR, ...conQR].slice(0, -diferencia).map((c) => c.id);
      for (let i = 0; i < aQuitar.length; i += 200) {
        const { error: e } = await supabase.from('inv_cajas').delete().in('id', aQuitar.slice(i, i + 200));
        if (e) {
          setError('No se han podido quitar todas las cajas. Vuelve a abrir esta ventana para revisar.');
          setGuardando(false);
          onGuardado();
          return;
        }
      }
    }

    setGuardando(false);
    onGuardado();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-1">Corregir cantidad</h3>
        <p className="text-sm text-gray-500 mb-4">{nombreReferencia(fila)}</p>

        {!cajas ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : (
          <>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 mb-4">
              Ahora hay <strong>{actual}</strong> en el almacén
              <span className="block text-xs text-gray-400 mt-0.5">
                {conQR.length} escaneadas con QR · {sinQR.length} añadidas sin QR
              </span>
            </div>

            <label className="text-xs font-semibold text-gray-400 uppercase">Cantidad real</label>
            <input
              type="number"
              min="0"
              autoFocus
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              className="mt-1 w-full p-3 border-2 rounded-xl text-2xl font-bold text-center"
            />

            {valido && diferencia !== 0 && (
              <p className={`text-sm mt-3 ${diferencia < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                {diferencia < 0
                  ? `Se quitarán ${-diferencia} ${-diferencia === 1 ? 'caja' : 'cajas'}` +
                    (quitaEscaneadas > 0
                      ? ` (incluidas ${quitaEscaneadas} escaneadas con QR).`
                      : ' sin QR. Las escaneadas no se tocan.')
                  : `Se añadirán ${diferencia} ${diferencia === 1 ? 'caja' : 'cajas'} sin QR.`}
              </p>
            )}
            {!valido && nueva !== '' && <p className="text-sm text-red-600 mt-3">Escribe un número entre 0 y 2000.</p>}
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!valido || diferencia === 0 || guardando}
                className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-40"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
