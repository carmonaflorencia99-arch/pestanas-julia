import React, { useState, useEffect } from 'react';

// Pantalla de bienvenida de la primera vez que se abre la tablet cada día:
// saludo + una frase que cambia a diario. Se cierra sola a los pocos segundos o al tocar.
const FRASES = [
  'Cada pestaña bien puesta es una pequeña obra de arte.',
  'Hoy vas a hacer sentir bonita a alguien. Eso no es poca cosa.',
  'La paciencia y la precisión: tu mejor combinación.',
  'Una sonrisa al recibirla ya es parte del servicio.',
  'Lo que haces con las manos, ellas lo llevan puesto todo el mes.',
  'Un día a la vez, una clienta a la vez.',
  'Tu trabajo se nota en la mirada de quien sale por esa puerta.',
  'Tómate tu tiempo: lo bien hecho se ve.',
  'Hoy es un buen día para superar el de ayer.',
  'Confía en tu pulso, llevas años afinándolo.',
  'Las pequeñas atenciones hacen que vuelvan.',
  'Respira hondo, concéntrate y disfruta lo que haces.',
  'El detalle marca la diferencia. Y tú los notas todos.',
  'Cuidar a otras personas también es un arte. Gracias por hacerlo.',
  'Hoy suma: cada clienta contenta es una victoria.',
  'Tu energía se contagia. Que sea una buena.',
  'No hace falta que sea perfecto, hace falta que sea con cariño.',
  'Qué suerte tienen quienes se ponen en tus manos.',
  'Empieza tranquila: el día se ordena solo.',
  'Una pausa a tiempo también es profesionalidad.',
  'Lo que hoy aprendas, mañana lo harás sin pensar.',
  'Trabajar en equipo hace el día más ligero.',
  'Cada servicio es una oportunidad de dejar huella.',
  'Brilla: tu trabajo ya lo hace.',
  'Despacio y con buena letra: así salen las cosas bonitas.',
  'Hoy también eres parte de lo que hace especial este lugar.',
  'Si hoy es un día largo, recuerda que lo estás haciendo muy bien.',
  'La confianza de una clienta se gana con detalles como los tuyos.',
  'Vamos a por un día bonito.',
  'Mira lo que has aprendido desde el primer día. Sigue.',
];

const claveHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function saludo() {
  const h = new Date().getHours();
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function SaludoDia({ staff }) {
  const clave = `saludo-${staff.id}`;
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(clave) !== claveHoy();
    } catch (e) {
      return false;
    }
  });
  const [saliendo, setSaliendo] = useState(false);

  const cerrar = () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      localStorage.setItem(clave, claveHoy());
    } catch (e) {
      /* ignorar */
    }
    setTimeout(() => setVisible(false), 450);
  };

  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(cerrar, 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), 0, 0);
  const diaDelAnio = Math.floor((hoy - inicio) / 86400000);
  const frase = FRASES[diaDelAnio % FRASES.length];
  const nombre = (staff.nombre || '').split(' ')[0];

  return (
    <div
      onClick={cerrar}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-8 text-center bg-paper cursor-pointer"
      style={{ opacity: saliendo ? 0 : 1, transition: 'opacity 450ms ease' }}
    >
      <p className="font-display italic text-brand-700 text-lg mb-6">Las Pestañas de Julia</p>
      <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink mb-5">
        {saludo()}, {nombre} <span className="inline-block">✨</span>
      </h1>
      <p className="text-xl sm:text-2xl text-gray-600 max-w-md leading-snug">{frase}</p>
      <div className="mt-10 w-40 h-1 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-pink-400 rounded-full" style={{ animation: 'saludoBarra 4.5s linear forwards' }} />
      </div>
      <p className="text-xs text-gray-400 mt-4">Toca para empezar</p>
      <style>{`@keyframes saludoBarra { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
