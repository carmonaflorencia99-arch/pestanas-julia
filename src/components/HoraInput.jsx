import React from 'react';

// Selector de hora en formato 24 h (sin a. m. / p. m.): dos desplegables, hora y minutos.
// value: "16:30" o "" · onChange recibe "16:30" o "".
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const aMin = (hhmm) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10);

// min / max: rango permitido ("10:30" a "19:30"). Una hora ya guardada fuera de rango se sigue mostrando.
export default function HoraInput({ value, onChange, className = '', min: desde = '00:00', max: hasta = '23:59' }) {
  const [h, m] = (value || '').split(':');
  const hora = h || '';
  const min = m || '';

  const cambiarHora = (nuevaH) => {
    if (!nuevaH) return onChange('');
    const primero = MINUTOS.find((mm) => dentro(nuevaH, mm)) || '00';
    onChange(`${nuevaH}:${min && dentro(nuevaH, min) ? min : primero}`);
  };
  const cambiarMin = (nuevoM) => {
    if (!hora) return; // primero hay que elegir la hora
    onChange(`${hora}:${nuevoM}`);
  };

  // Si ya había una hora con minutos que no son múltiplo de 5 (p. ej. 16:32), se muestra igual.
  const dentro = (hh, mm) => aMin(`${hh}:${mm}`) >= aMin(desde) && aMin(`${hh}:${mm}`) <= aMin(hasta);
  const horasOpciones = HORAS.filter((x) => MINUTOS.some((mm) => dentro(x, mm)) || x === hora);
  const base = MINUTOS.filter((mm) => !hora || dentro(hora, mm));
  const minutosOpciones = min && !base.includes(min) ? [...base, min].sort() : base;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={hora}
        onChange={(e) => cambiarHora(e.target.value)}
        className="flex-1 p-2 border rounded-lg text-sm bg-white"
        aria-label="Hora"
      >
        <option value="">--</option>
        {horasOpciones.map((x) => (
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
