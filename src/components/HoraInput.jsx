import React from 'react';

// Selector de hora en formato 24 h (sin a. m. / p. m.): dos desplegables, hora y minutos.
// value: "16:30" o "" · onChange recibe "16:30" o "".
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export default function HoraInput({ value, onChange, className = '' }) {
  const [h, m] = (value || '').split(':');
  const hora = h || '';
  const min = m || '';

  const cambiarHora = (nuevaH) => {
    if (!nuevaH) return onChange('');
    onChange(`${nuevaH}:${min || '00'}`);
  };
  const cambiarMin = (nuevoM) => {
    if (!hora) return; // primero hay que elegir la hora
    onChange(`${hora}:${nuevoM}`);
  };

  // Si ya había una hora con minutos que no son múltiplo de 5 (p. ej. 16:32), se muestra igual.
  const minutosOpciones = min && !MINUTOS.includes(min) ? [...MINUTOS, min].sort() : MINUTOS;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={hora}
        onChange={(e) => cambiarHora(e.target.value)}
        className="flex-1 p-2 border rounded-lg text-sm bg-white"
        aria-label="Hora"
      >
        <option value="">--</option>
        {HORAS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="font-semibold text-gray-400">:</span>
      <select
        value={min}
        onChange={(e) => cambiarMin(e.target.value)}
        disabled={!hora}
        className="flex-1 p-2 border rounded-lg text-sm bg-white disabled:opacity-50"
        aria-label="Minutos"
      >
        {!hora && <option value="">--</option>}
        {minutosOpciones.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
