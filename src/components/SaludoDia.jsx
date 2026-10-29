import React, { useState, useEffect } from 'react';

// Pantalla de bienvenida de la primera vez que se abre la tablet cada día:
// saludo + una frase que cambia a diario. Se cierra sola a los pocos segundos o al tocar.
const FRASES = [
  'Eres más fuerte de lo que crees y más capaz de lo que imaginas.',
  'Hoy te mereces un día bonito. Empieza regalándote una sonrisa.',
  'No tienes que hacerlo todo hoy. Hazlo a tu ritmo.',
  'Lo bueno llega a quienes no se rinden. Y tú no te rindes.',
  'Cuidarte también es una prioridad. Hoy, empieza por ti.',
  'Cada día es una página en blanco. Escribe una bonita.',
  'Eres suficiente, tal y como eres.',
  'Respira hondo. Todo lo que necesitas ya está en ti.',
  'Los días buenos se construyen con pequeñas alegrías. Busca la de hoy.',
  'Mereces cosas buenas. Hoy, deja que lleguen.',
  'Tu luz hace más fácil el día de quienes te rodean.',
  'Lo estás haciendo mejor de lo que piensas.',
  'Que hoy te sorprenda algo bonito.',
  'Sigue soñando en grande, un paso a la vez.',
  'Tu energía importa. Elige una que te haga bien.',
  'Hoy es un buen día para confiar en ti.',
  'Rodéate de lo que te hace feliz y hoy empieza por una buena música.',
  'Las cosas buenas toman tiempo. Tú vas bien.',
  'Un café, una sonrisa y a por el día.',
  'Eres el tipo de persona que hace mejor cualquier sitio al que llega.',
  'Date permiso para disfrutar el camino, no solo la meta.',
  'Hoy puede ser tu mejor día. Tú decides cómo empezarlo.',
  'Lo que sientes hoy pasa. Lo que construyes se queda.',
  'Agradecer lo pequeño hace grande el día.',
  'No te compares: tu camino es solo tuyo.',
  'Cada mañana es una nueva oportunidad. Aprovéchala a tu manera.',
  'Eres valiente, aunque a veces no lo parezca.',
  'Ríete hoy, aunque sea de ti misma. Es medicina.',
  'Que no te falte hoy tiempo para ti.',
  'Ser amable contigo misma es el mejor comienzo.',
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
  const esViernes = hoy.getDay() === 5;
  const frase = esViernes ? 'Que sea un día lleno de cosas buenas. ¡Ya casi es fin de semana!' : FRASES[diaDelAnio % FRASES.length];
  const nombre = (staff.nombre || '').split(' ')[0];

  return (
    <div
      onClick={cerrar}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-8 text-center bg-paper cursor-pointer"
      style={{ opacity: saliendo ? 0 : 1, transition: 'opacity 450ms ease' }}
    >
      <p className="font-display italic text-brand-700 text-lg mb-6">Las Pestañas de Julia</p>
      <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink mb-5">
        {esViernes ? '¡Feliz viernes' : saludo()}, {nombre}{esViernes ? '!' : ''} <span className="inline-block">{esViernes ? '🎉' : '✨'}</span>
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
