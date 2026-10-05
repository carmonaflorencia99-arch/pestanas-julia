import React, { useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { agruparPorTipo } from '../../utils/inventario';

// Gestión de tipos de caja, largos y stock mínimo de cada referencia.
export default function ReferenciasAdmin({ referencias, onCambios }) {
  const grupos = useMemo(() => agruparPorTipo(referencias), [referencias]);
  const [nuevo, setNuevo] = useState({ tipo: '', desde: 8, hasta: 14, minimo: 2 });
  const [renombrando, setRenombrando] = useState(null); // { tipo, valor }
  const [largoExtra, setLargoExtra] = useState({}); // tipo -> número
  const [minimoTipo, setMinimoTipo] = useState({}); // tipo -> número

  const guardarMinimo = async (ref, valor) => {
    const n = parseInt(valor, 10);
    if (Number.isNaN(n) || n < 0 || n === ref.stock_minimo) return;
    await supabase.from('inv_referencias').update({ stock_minimo: n }).eq('id', ref.id);
    onCambios();
  };

  const aplicarMinimoATipo = async (tipo) => {
    const n = parseInt(minimoTipo[tipo], 10);
    if (Number.isNaN(n) || n < 0) return;
    await supabase.from('inv_referencias').update({ stock_minimo: n }).eq('tipo', tipo);
    setMinimoTipo({ ...minimoTipo, [tipo]: '' });
    onCambios();
  };

  const toggleTipo = async (g) => {
    await supabase.from('inv_referencias').update({ activo: !g.activo }).eq('tipo', g.tipo);
    onCambios();
  };

  const guardarNombre = async () => {
    const valor = renombrando.valor.trim();
    if (!valor || valor === renombrando.tipo) {
      setRenombrando(null);
      return;
    }
    const { error } = await supabase.from('inv_referencias').update({ tipo: valor }).eq('tipo', renombrando.tipo);
    if (error) alert('No se ha podido cambiar el nombre (¿ya existe un tipo con ese nombre?).');
    setRenombrando(null);
    onCambios();
  };

  const anadirLargo = async (g) => {
    const largo = parseInt(largoExtra[g.tipo], 10);
    if (!largo) return;
    const { error } = await supabase.from('inv_referencias').insert([
      { tipo: g.tipo, largo, orden_tipo: g.orden_tipo, stock_minimo: g.refs[0]?.stock_minimo ?? 2 },
    ]);
    if (error) alert('Ese largo ya existe o no es válido.');
    setLargoExtra({ ...largoExtra, [g.tipo]: '' });
    onCambios();
  };

  const crearTipo = async (e) => {
    e.preventDefault();
    const tipo = nuevo.tipo.trim();
    const desde = parseInt(nuevo.desde, 10);
    const hasta = parseInt(nuevo.hasta, 10);
    const minimo = parseInt(nuevo.minimo, 10) || 0;
    if (!tipo || !desde || !hasta || hasta < desde) return;
    const orden = Math.max(0, ...referencias.map((r) => r.orden_tipo)) + 1;
    const filas = [];
    for (let l = desde; l <= hasta; l++) filas.push({ tipo, largo: l, orden_tipo: orden, stock_minimo: minimo });
    const { error } = await supabase.from('inv_referencias').insert(filas);
    if (error) {
      alert('No se ha podido crear (¿ya existe ese tipo?).');
      return;
    }
    setNuevo({ tipo: '', desde: 8, hasta: 14, minimo: 2 });
    onCambios();
  };

  return (
    <div>
      <form onSubmit={crearTipo} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6 p-4 bg-gray-50 rounded-lg items-end">
        <label className="col-span-2 text-xs text-gray-500">
          Nuevo tipo de caja
          <input
            required
            value={nuevo.tipo}
            onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}
            placeholder="Ej. 3D L"
            className="mt-1 w-full p-2 border rounded-lg text-sm text-gray-800"
          />
        </label>
        <label className="text-xs text-gray-500">
          Largos de
          <input
            type="number"
            value={nuevo.desde}
            onChange={(e) => setNuevo({ ...nuevo, desde: e.target.value })}
            className="mt-1 w-full p-2 border rounded-lg text-sm text-gray-800"
          />
        </label>
        <label className="text-xs text-gray-500">
          a (mm)
          <input
            type="number"
            value={nuevo.hasta}
            onChange={(e) => setNuevo({ ...nuevo, hasta: e.target.value })}
            className="mt-1 w-full p-2 border rounded-lg text-sm text-gray-800"
          />
        </label>
        <label className="text-xs text-gray-500">
          Mínimo
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              min="0"
              value={nuevo.minimo}
              onChange={(e) => setNuevo({ ...nuevo, minimo: e.target.value })}
              className="w-full p-2 border rounded-lg text-sm text-gray-800"
            />
            <button type="submit" className="bg-brand-600 text-white px-3 rounded-lg text-sm font-semibold">
              Crear
            </button>
          </div>
        </label>
      </form>

      <p className="text-xs text-gray-400 mb-3">
        El número de cada largo es el <strong>stock mínimo</strong>: la app avisa cuando quedan esas cajas o menos.
        Pon 0 en los que no queráis que avise.
      </p>

      <div className="space-y-3">
        {grupos.map((g) => (
          <div key={g.tipo} className={`border rounded-xl p-3 ${g.activo ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              {renombrando && renombrando.tipo === g.tipo ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={renombrando.valor}
                    onChange={(e) => setRenombrando({ ...renombrando, valor: e.target.value })}
                    className="p-1.5 border rounded-lg text-sm"
                  />
                  <button onClick={guardarNombre} className="text-xs bg-brand-600 text-white px-3 rounded-lg">
                    Guardar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRenombrando({ tipo: g.tipo, valor: g.tipo })}
                  className="font-semibold text-gray-800 text-left"
                  title="Cambiar nombre"
                >
                  {g.tipo} <span className="text-xs text-gray-300">✎</span>
                </button>
              )}
              <div className="flex gap-3 items-center">
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    min="0"
                    value={minimoTipo[g.tipo] ?? ''}
                    onChange={(e) => setMinimoTipo({ ...minimoTipo, [g.tipo]: e.target.value })}
                    placeholder="mín."
                    className="w-14 p-1 border rounded-lg text-xs"
                  />
                  <button onClick={() => aplicarMinimoATipo(g.tipo)} className="text-xs text-brand-700 font-semibold">
                    Aplicar a todos
                  </button>
                </div>
                <button onClick={() => toggleTipo(g)} className="text-xs text-gray-500 underline">
                  {g.activo ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              {g.refs.map((r) => (
                <label key={r.id} className="text-center text-xs text-gray-400">
                  {r.largo} mm
                  <input
                    type="number"
                    min="0"
                    defaultValue={r.stock_minimo}
                    key={`${r.id}-${r.stock_minimo}`}
                    onBlur={(e) => guardarMinimo(r, e.target.value)}
                    className="block w-14 mt-0.5 p-1.5 border rounded-lg text-sm text-center text-gray-800"
                  />
                </label>
              ))}
              <div className="flex gap-1 items-end ml-2">
                <input
                  type="number"
                  value={largoExtra[g.tipo] ?? ''}
                  onChange={(e) => setLargoExtra({ ...largoExtra, [g.tipo]: e.target.value })}
                  placeholder="+ mm"
                  className="w-16 p-1.5 border rounded-lg text-sm"
                />
                <button onClick={() => anadirLargo(g)} className="text-xs text-brand-700 font-semibold pb-2">
                  Añadir largo
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
