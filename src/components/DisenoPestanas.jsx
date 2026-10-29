import React from 'react';

// Diseño / historial de pestañas en un solo campo:
//   [tipo de pestaña a elegir con un toque]  +  [números del diseño, escritos a mano]
// Se guarda como texto: "2D LU · 8-9-10-12 centro 10". Así sigue siendo parte del historial.
const SEP = ' · ';

export function separarDiseno(valor, tipos) {
  const v = valor || '';
  const t = tipos.find((x) => v === x || v.startsWith(x + SEP) || v.startsWith(x + ' '));
  if (!t) return { tipo: '', numeros: v };
  return { tipo: t, numeros: v.slice(t.length).replace(/^\s*·?\s*/, '') };
}

export default function DisenoPestanas({ value, onChange, tipos, disabled }) {
  const { tipo, numeros } = separarDiseno(value, tipos);
  const componer = (t, n) => (t ? (n ? `${t}${SEP}${n}` : `${t}${SEP}`) : n);

  return (
    <div className="space-y-3">
      {tipos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Tipo de pestañas</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {tipos.map((t) => (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => onChange(componer(tipo === t ? '' : t, numeros))}
                className={`px-2 py-3 rounded-xl border-2 text-sm font-semibold disabled:opacity-60 ${
                  tipo === t ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Diseño (números)</p>
        <input
          placeholder="Ej: 8-9-10-12 centro 10"
          value={numeros}
          disabled={disabled}
          onChange={(e) => onChange(componer(tipo, e.target.value))}
          className="w-full p-4 border rounded-xl text-lg bg-white disabled:opacity-60"
        />
      </div>
    </div>
  );
}
