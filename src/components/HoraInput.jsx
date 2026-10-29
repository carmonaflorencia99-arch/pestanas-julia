import React, { useState, useEffect } from 'react';

// Hora escrita a mano en 24 h: basta teclear 1030 (o 10:30, 10.30, 930) y se ordena sola.
// value: "16:30" o "" · onChange recibe "16:30" cuando la hora es válida y está en rango, o "".
const aMin = (hhmm) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10);

// Interpreta lo escrito → "HH:MM" o null
function interpretar(texto) {
  const t = (texto || '').trim();
  let h, m;
  const con = t.match(/^(\d{1,2})\s*[:.,hH]\s*(\d{1,2})$/);
  if (con) {
    h = con[1];
    m = con[2].length === 1 ? con[2] + '0' : con[2];
  } else if (/^\d{3,4}$/.test(t)) {
    h = t.slice(0, t.length - 2);
    m = t.slice(-2);
  } else if (/^\d{1,2}$/.test(t)) {
    h = t;
    m = '00';
  } else {
    return null;
  }
  const hh = parseInt(h, 10);
  const mm = parseInt(m, 10);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function HoraInput({ value, onChange, className = '', min: desde = '00:00', max: hasta = '23:59' }) {
  const [texto, setTexto] = useState(value || '');
  const [error, setError] = useState('');

  // Si el valor cambia desde fuera (limpiar formulario, editar otra cita), se refleja aquí.
  useEffect(() => {
    // solo si el cambio viene de fuera (no de lo que se está escribiendo ahora)
    if ((value || '') !== (interpretar(texto) === value ? value : '')) {
      setTexto(value || '');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const validar = (t, mostrarError) => {
    if (!t.trim()) {
      setError('');
      return '';
    }
    const h = interpretar(t);
    if (!h) {
      if (mostrarError) setError('Escribe la hora así: 10:30');
      return '';
    }
    if (aMin(h) < aMin(desde) || aMin(h) > aMin(hasta)) {
      if (mostrarError) setError(`Entre ${desde} y ${hasta}`);
      return '';
    }
    setError('');
    return h;
  };

  const alCambiar = (e) => {
    const t = e.target.value.replace(/[^\d:.,hH\s]/g, '').slice(0, 5);
    setTexto(t);
    if (!t.trim()) setError('');
    // si ya es una hora completa y válida, se acepta al momento (sin esperar a salir del campo)
    const h = /^\d{3,4}$|^\d{1,2}[:.,hH]\d{2}$/.test(t) ? validar(t, false) : '';
    onChange(h);
  };

  const alSalir = () => {
    if (texto === (value || '')) return; // sin cambios (p. ej. cita antigua fuera de rango)
    const h = validar(texto, true);
    if (h) setTexto(h);
    onChange(h);
  };

  return (
    <div className={className}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="10:30"
        value={texto}
        onChange={alCambiar}
        onBlur={alSalir}
        aria-label="Hora (24 h)"
        className={`w-full p-2 border rounded-lg text-sm bg-white ${error ? 'border-red-400' : ''}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
