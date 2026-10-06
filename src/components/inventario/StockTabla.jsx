import React, { useMemo, useState } from 'react';
import { agruparPorTipo, estaBaja } from '../../utils/inventario';
import AjustarCantidad from './AjustarCantidad';

// Cuadrícula de stock: una fila por tipo, una columna por largo.
// Rojo = sin cajas · ámbar = en el mínimo o por debajo · verde = bien.
export default function StockTabla({ stock, onCambios }) {
  const [soloBajos, setSoloBajos] = useState(false);
  const [ajustando, setAjustando] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const activos = stock.filter((s) => s.activo);
  const grupos = useMemo(() => agruparPorTipo(activos), [stock]); // eslint-disable-line react-hooks/exhaustive-deps
  const largos = useMemo(
    () => Array.from(new Set(activos.map((s) => s.largo))).sort((a, b) => a - b),
    [stock] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bajos = activos.filter(estaBaja);
  const total = activos.reduce((n, s) => n + s.en_almacen, 0);
  const gruposVisibles = soloBajos ? grupos.filter((g) => g.refs.some(estaBaja)) : grupos;

  const textoPedido = agruparPorTipo(bajos)
    .map((g) => `${g.tipo}: ${g.refs.map((r) => `${r.largo} mm (quedan ${r.en_almacen})`).join(', ')}`)
    .join('\n');

  const copiarPedido = async () => {
    try {
      await navigator.clipboard.writeText(textoPedido);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      window.prompt('Copia la lista:', textoPedido);
    }
  };

  const estiloCelda = (s) => {
    if (!s) return 'text-gray-200';
    if (s.en_almacen === 0) return 'bg-red-50 text-red-600 font-bold';
    if (estaBaja(s)) return 'bg-amber-50 text-amber-700 font-bold';
    return 'text-brand-700 font-semibold';
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-brand-50 rounded-xl p-4">
          <p className="text-xs text-brand-700">Cajas en el almacén</p>
          <p className="text-2xl font-bold text-brand-800">{total}</p>
        </div>
        <div className={`rounded-xl p-4 ${bajos.length ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <p className={`text-xs ${bajos.length ? 'text-amber-700' : 'text-gray-500'}`}>Referencias por pedir</p>
          <p className={`text-2xl font-bold ${bajos.length ? 'text-amber-700' : 'text-gray-500'}`}>{bajos.length}</p>
        </div>
      </div>

      {bajos.length > 0 && total > 0 && (
        <div className="mb-5 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h3 className="text-sm font-bold text-amber-800">⚠️ Quedan pocas cajas ({bajos.length})</h3>
            <button
              onClick={copiarPedido}
              className="text-xs bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              {copiado ? 'Copiado ✓' : 'Copiar lista para el pedido'}
            </button>
          </div>
          <div className="text-sm text-amber-900 space-y-0.5">
            {agruparPorTipo(bajos).map((g) => (
              <p key={g.tipo}>
                <span className="font-semibold">{g.tipo}:</span>{' '}
                {g.refs.map((r) => `${r.largo} mm (${r.en_almacen})`).join(' · ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="mb-5 bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
          Todavía no hay cajas registradas. Empieza por la pestaña <strong>Recuento y entradas</strong> para escanear
          el stock actual.
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
        <input type="checkbox" checked={soloBajos} onChange={(e) => setSoloBajos(e.target.checked)} />
        Ver solo tipos con cajas por pedir
      </label>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="text-left font-semibold py-2 pr-2">Tipo</th>
              {largos.map((l) => (
                <th key={l} className="font-semibold py-2 px-1 text-center w-12">
                  {l}
                </th>
              ))}
              <th className="font-semibold py-2 pl-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {gruposVisibles.map((g) => (
              <tr key={g.tipo} className="border-t border-gray-100">
                <td className="py-1.5 pr-2 font-semibold text-gray-700 whitespace-nowrap">{g.tipo}</td>
                {largos.map((l) => {
                  const s = g.refs.find((r) => r.largo === l);
                  return (
                    <td key={l} className="px-1 py-1">
                      {s ? (
                        <button
                          type="button"
                          onClick={() => setAjustando(s)}
                          className={`w-full rounded-lg text-center py-1.5 hover:ring-2 hover:ring-brand-200 ${estiloCelda(s)}`}
                          title={`Mínimo: ${s.stock_minimo} · toca para corregir la cantidad`}
                        >
                          {s.en_almacen}
                        </button>
                      ) : (
                        <div className={`rounded-lg text-center py-1.5 ${estiloCelda(s)}`}>—</div>
                      )}
                    </td>
                  );
                })}
                <td className="pl-2 text-center text-gray-500 font-semibold">
                  {g.refs.reduce((n, r) => n + r.en_almacen, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Toca un número para corregir la cantidad. Avisa cuando quedan tantas cajas como el mínimo o menos; los
        mínimos se cambian en <em>Referencias</em>.
      </p>

      {ajustando && (
        <AjustarCantidad fila={ajustando} onClose={() => setAjustando(null)} onGuardado={onCambios} />
      )}
    </div>
  );
}
