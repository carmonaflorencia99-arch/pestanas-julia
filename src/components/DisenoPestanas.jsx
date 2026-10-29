import React from 'react';

// Diseño y observaciones de pestañas en un solo campo:
//   [desplegable con el tipo de pestaña (como el inventario)]  +  [un único cuadro de texto]
// Se guarda como texto: "2D LU · 8-9-10-12 centro 10, sin reacciones".
const SEP = ' · ';

export function separarDiseno(valor, tipos) {
  const v = valor || '';
  const t = tipos.find((x) => v === x || v.startsWith(x + SEP) || v.startsWith(x + ' '));
  if (!t) return { tipo: '', texto: v };
  return { tipo: t, texto: v.slice(t.length).replace(/^\s*·?\s*/, '') };
}

export default function DisenoPestanas({ value, onChange, tipos, disabled }) {
  const { tipo, texto } = separarDiseno(value, tipos);
  const componer = (t, n) => (t ? (n ? `${t}${SEP}${n}` : `${t}${SEP}`) : n);

  return (
    <div className="space-y-3">
      {tipos.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase block mb-2">Tipo de pestañas</label>
          <select
            value={tipo}
            disabled={disabled}
            onChange={(e) => onChange(componer(e.target.value, texto))}
            className="w-full p-4 border rounded-xl text-lg bg-white disabled:opacity-60"
          >
            <option value="">Elegir tipo…</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-gray-400 uppercase block mb-2">Diseño y observaciones</label>
        <textarea
          rows="3"
          placeholder="Números del diseño, mapeo, reacciones… Ej: 8-9-10-12 centro 10"
          value={texto}
          disabled={disabled}
          onChange={(e) => onChange(componer(tipo, e.target.value))}
          className="w-full p-4 border rounded-xl text-lg bg-white disabled:opacity-60"
        />
      </div>
    </div>
  );
}
