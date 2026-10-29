import React, { useState } from 'react';

// Versión de la guía: si se cambia el número, vuelve a aparecer a todas.
export const GUIA_VERSION = 'v1';
export const claveGuia = (staffId) => `guia_profesional_${GUIA_VERSION}_${staffId}`;

const PASOS = [
  {
    titulo: 'Bienvenida a tu tablet',
    texto:
      'Aquí ves tu agenda de hoy. Recepción asigna las clientas y la lista se actualiza sola cada minuto. Arriba de cada clienta verás si ya llegó o todavía no.',
  },
  {
    titulo: 'Abre la ficha',
    texto:
      'Pulsa "Abrir ficha". Verás sus alergias, el servicio que recepción ya cargó y el diseño y las observaciones de la última vez. Todo viene escrito para que no tengas que teclear desde cero.',
  },
  {
    titulo: 'Confirma lo que le hiciste',
    texto:
      'Revisa el servicio y el diseño. En las extensiones de pestañas es obligatorio dejar el diseño o las observaciones; en el resto de servicios es opcional. Si es igual que la última vez, solo pulsa "Confirmar este servicio". Si cambió algo, corrígelo antes de confirmar. Recepción verá los cambios de diseño para actualizarlos en Booksy.',
  },
  {
    titulo: 'Si se hizo algo extra',
    texto: 'Usa el botón "La clienta se hizo algo extra". Queda avisado a recepción para cargarlo en Booksy.',
  },
  {
    titulo: 'Y listo',
    texto:
      'Cuando confirmas lo que le hiciste, la clienta pasa sola a "Atendidas hoy". No hace falta marcar nada más. Lo que la clienta se hizo tiene que quedar siempre guardado: si se te olvida, verás un aviso rojo en tu agenda. Puedes ocultarlo para hacerlo más tarde (vuelve a aparecer solo a las 2 horas), dejar "No lo recuerdo" (queda en su historial como pendiente de cargar, sin agobios) o quitarla si no vino.',
  },
  {
    titulo: 'Servicios en paralelo',
    texto:
      'Si tu clienta está a la misma hora con otra profesional (por ejemplo manicura o pedicura), te sale un aviso rosa en su tarjeta. Coordínense para no hacerla esperar.',
  },
];

export default function GuiaProfesional({ onClose }) {
  const [paso, setPaso] = useState(0);
  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-xl">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-brand-600 mb-3">Paso {paso + 1} de {PASOS.length}</p>
          <h3 className="text-2xl font-bold text-ink mb-3">{p.titulo}</h3>
          <p className="text-lg text-gray-600 leading-relaxed">{p.texto}</p>
        </div>

        <div className="flex justify-center gap-2 my-6">
          {PASOS.map((_, i) => (
            <span key={i} className={`h-2 rounded-full ${i === paso ? 'w-6 bg-brand-600' : 'w-2 bg-gray-200'}`} />
          ))}
        </div>

        <div className="flex gap-3">
          {paso > 0 ? (
            <button
              onClick={() => setPaso(paso - 1)}
              className="px-6 py-4 bg-gray-100 text-gray-600 text-lg font-semibold rounded-xl active:bg-gray-200"
            >
              Atrás
            </button>
          ) : (
            <button onClick={onClose} className="px-6 py-4 text-gray-400 text-base font-medium">
              Saltar
            </button>
          )}
          <button
            onClick={() => (ultimo ? onClose() : setPaso(paso + 1))}
            className="flex-1 bg-brand-600 text-white text-lg font-semibold py-4 rounded-xl active:bg-brand-700"
          >
            {ultimo ? 'Entendido ✓' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
