import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { codigoCorto, extraerCodigo, formatearFechaHora, nombreReferencia } from '../../utils/inventario';

const ORIGEN = {
  recuento: 'Recuento',
  pedido: 'Pedido',
  manual: 'Sin QR',
  sin_registrar: 'No estaba dada de alta',
};

// Historial de salidas y entradas, con las correcciones de la admin:
// devolver una caja al almacén, cambiar su tipo/largo o borrarla.
export default function Movimientos({ referencias, onCambios }) {
  const [vista, setVista] = useState('salidas'); // salidas | entradas
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    let consulta = supabase
      .from('inv_cajas')
      .select(
        'id, codigo, estado, origen, entrada_en, salida_en, salida_manual, referencia_id, ' +
          'inv_referencias(tipo, largo), entrada:entrada_por(nombre), salida:salida_por(nombre)'
      )
      .limit(150);

    const codigo = extraerCodigo(busqueda);
    if (codigo) {
      consulta = consulta.ilike('codigo', `%${codigo}%`).order('entrada_en', { ascending: false });
    } else if (vista === 'salidas') {
      consulta = consulta.eq('estado', 'sacada').order('salida_en', { ascending: false });
    } else {
      consulta = consulta.order('entrada_en', { ascending: false });
    }

    const { data } = await consulta;
    setFilas(data || []);
    setCargando(false);
  }, [vista, busqueda]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const despuesDeCambiar = () => {
    cargar();
    onCambios();
  };

  const devolver = async (caja) => {
    if (!window.confirm(`¿Devolver ${nombreReferencia(caja.inv_referencias)} al almacén?`)) return;
    const { error } = await supabase.rpc('inv_deshacer_salida', { p_caja_id: caja.id });
    if (error) alert('No se ha podido devolver.');
    despuesDeCambiar();
  };

  const cambiarReferencia = async (caja, referenciaId) => {
    const { error } = await supabase.from('inv_cajas').update({ referencia_id: referenciaId }).eq('id', caja.id);
    if (error) alert('No se ha podido cambiar.');
    setEditandoId(null);
    despuesDeCambiar();
  };

  const borrar = async (caja) => {
    if (
      !window.confirm(
        `¿Borrar del inventario la caja ${nombreReferencia(caja.inv_referencias)} (${codigoCorto(caja.codigo)})? ` +
          'Úsalo solo si se registró por error.'
      )
    )
      return;
    const { error } = await supabase.from('inv_cajas').delete().eq('id', caja.id);
    if (error) alert('No se ha podido borrar.');
    despuesDeCambiar();
  };

  const opcionesRef = referencias
    .slice()
    .sort((a, b) => a.orden_tipo - b.orden_tipo || a.largo - b.largo);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {[
          ['salidas', 'Salidas'],
          ['entradas', 'Entradas'],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            onClick={() => {
              setVista(valor);
              setBusqueda('');
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              vista === valor && !busqueda ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {texto}
          </button>
        ))}
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar caja por código…"
          className="flex-1 min-w-[180px] p-2 border rounded-lg text-sm"
        />
      </div>

      {cargando && filas.length === 0 && <p className="text-sm text-gray-400">Cargando…</p>}
      {!cargando && filas.length === 0 && <p className="text-sm text-gray-400">No hay movimientos.</p>}

      <div className="space-y-2">
        {filas.map((c) => {
          const esSalida = c.estado === 'sacada' && (vista === 'salidas' || busqueda);
          return (
            <div key={c.id} className="bg-gray-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p>
                    <span className="font-semibold text-gray-800">{nombreReferencia(c.inv_referencias)}</span>
                    <span className="text-xs text-gray-400 ml-2">{codigoCorto(c.codigo)}</span>
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-md ${
                        c.estado === 'sacada' ? 'bg-gray-200 text-gray-600' : 'bg-brand-100 text-brand-700'
                      }`}
                    >
                      {c.estado === 'sacada' ? 'Sacada' : 'En almacén'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {esSalida ? (
                      <>
                        Sacada {formatearFechaHora(c.salida_en)} por {c.salida?.nombre || '—'}
                        {c.salida_manual && ' · registrada sin escanear'}
                      </>
                    ) : (
                      <>
                        Entrada {formatearFechaHora(c.entrada_en)} · {ORIGEN[c.origen]}
                        {c.entrada?.nombre && ` · ${c.entrada.nombre}`}
                        {c.estado === 'sacada' && ` · sacada ${formatearFechaHora(c.salida_en)} por ${c.salida?.nombre || '—'}`}
                      </>
                    )}
                    {c.origen === 'sin_registrar' && (
                      <span className="text-amber-600"> · no estaba dada de alta</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {c.estado === 'sacada' && (
                    <button onClick={() => devolver(c)} className="text-xs text-brand-700 font-semibold">
                      Devolver
                    </button>
                  )}
                  <button onClick={() => setEditandoId(editandoId === c.id ? null : c.id)} className="text-xs text-gray-500">
                    Cambiar
                  </button>
                  <button onClick={() => borrar(c)} className="text-xs text-red-400">
                    Borrar
                  </button>
                </div>
              </div>
              {editandoId === c.id && (
                <div className="mt-2 flex gap-2 items-center">
                  <span className="text-xs text-gray-500">Cambiar a:</span>
                  <select
                    defaultValue={c.referencia_id}
                    onChange={(e) => cambiarReferencia(c, e.target.value)}
                    className="p-2 border rounded-lg text-sm"
                  >
                    {opcionesRef.map((r) => (
                      <option key={r.id} value={r.id}>
                        {nombreReferencia(r)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
