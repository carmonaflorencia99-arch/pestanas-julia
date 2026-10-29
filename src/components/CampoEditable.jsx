import React, { useState } from 'react';

// Dato que se edita ahí mismo, sin abrir ventanas: se toca el lápiz, se escribe y se guarda.
// Enter guarda (en campos de una línea) · Esc cancela.
export default function CampoEditable({
  etiqueta,
  valor,
  vacio = 'Añadir…',
  multilinea = false,
  opciones = null, // [{ value, label }] para un desplegable
  puedeEditar = true,
  onGuardar,
  colorValor = 'text-gray-700',
  mostrar, // opcional: cómo mostrar el valor en lectura
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);

  const empezar = () => {
    setBorrador(valor || '');
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(borrador);
    setGuardando(false);
    if (ok !== false) setEditando(false);
  };

  const teclas = (e) => {
    if (e.key === 'Escape') setEditando(false);
    if (e.key === 'Enter' && !multilinea) {
      e.preventDefault();
      guardar();
    }
  };

  const textoLectura = mostrar ? mostrar(valor) : valor;

  if (!editando) {
    return (
      <div className="group flex items-start gap-2 text-sm">
        <span className="text-xs font-semibold text-gray-400 w-24 flex-shrink-0 pt-0.5">{etiqueta}</span>
        <span className={`flex-1 whitespace-pre-wrap ${textoLectura ? colorValor : 'text-gray-300 italic'}`}>
          {textoLectura || vacio}
        </span>
        {puedeEditar && (
          <button
            type="button"
            onClick={empezar}
            title={`Editar ${etiqueta.toLowerCase()}`}
            className="text-xs text-brand-600 font-semibold px-2 py-0.5 rounded-lg hover:bg-brand-50"
          >
            ✏️ {textoLectura ? 'Editar' : 'Añadir'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs font-semibold text-gray-400 w-24 flex-shrink-0 pt-2">{etiqueta}</span>
      <div className="flex-1 space-y-2">
        {opciones ? (
          <select
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm bg-white"
          >
            {opciones.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : multilinea ? (
          <textarea
            autoFocus
            rows="3"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={teclas}
            className="w-full p-2 border rounded-lg text-sm bg-white"
          />
        ) : (
          <input
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={teclas}
            className="w-full p-2 border rounded-lg text-sm bg-white"
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="text-xs bg-brand-600 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="text-xs bg-gray-100 text-gray-600 font-semibold px-3 py-1.5 rounded-lg"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
