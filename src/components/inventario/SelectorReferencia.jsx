import React, { useMemo, useState, useEffect } from 'react';
import { agruparPorTipo } from '../../utils/inventario';

// Elegir tipo de caja y largo con botones grandes (pensado para tocar en tablet).
// - referencias: filas de inv_referencias
// - valor: id de la referencia seleccionada (o null)
// - onChange(referencia)
// - color: 'pink' (vista profesional) | 'brand' (admin)
export default function SelectorReferencia({ referencias, valor, onChange, color = 'brand', compacto = false }) {
  const grupos = useMemo(
    () => agruparPorTipo(referencias.filter((r) => r.activo)).filter((g) => g.refs.length > 0),
    [referencias]
  );
  const seleccionada = referencias.find((r) => r.id === valor) || null;
  const [tipo, setTipo] = useState(seleccionada ? seleccionada.tipo : null);

  useEffect(() => {
    if (seleccionada) setTipo(seleccionada.tipo);
  }, [seleccionada]);

  const grupo = grupos.find((g) => g.tipo === tipo);
  const activo = color === 'pink' ? 'bg-pink-600 text-white border-pink-600' : 'bg-brand-600 text-white border-brand-600';
  const tamTipo = compacto ? 'px-2 py-2 text-xs' : 'px-2 py-3 text-sm';

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Tipo</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
        {grupos.map((g) => (
          <button
            key={g.tipo}
            type="button"
            onClick={() => {
              setTipo(g.tipo);
              if (seleccionada && seleccionada.tipo !== g.tipo) onChange(null);
            }}
            className={`${tamTipo} rounded-xl border-2 font-semibold ${
              tipo === g.tipo ? activo : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
            }`}
          >
            {g.tipo}
          </button>
        ))}
      </div>

      {grupo && (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Largo ({grupo.tipo})</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {grupo.refs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onChange(r)}
                className={`${compacto ? 'py-2 text-sm' : 'py-3 text-lg'} rounded-xl border-2 font-bold ${
                  valor === r.id ? activo : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
                }`}
              >
                {r.largo}
                <span className="text-xs font-normal"> mm</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
