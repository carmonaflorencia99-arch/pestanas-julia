// Utilidades compartidas del inventario de cajas de pestañas.

// Del texto leído en el QR saca el código único de la caja.
// Las cajas de DeceMars llevan un enlace del tipo
//   http://suyuan.decemars.cn/scan.html?ST=A&tid=91856608892943
// y lo único que nos interesa es el número "tid" (distinto en cada caja).
// Si el QR es de otra marca, se usa el texto completo como código.
export function extraerCodigo(texto) {
  if (!texto) return null;
  const limpio = String(texto).trim();
  const match = limpio.match(/[?&]tid=([^&#\s]+)/i);
  if (match) return decodeURIComponent(match[1]);
  if (!limpio || limpio.length > 300) return null;
  return limpio;
}

// Versión corta del código para mostrar en pantalla (últimas 6 cifras).
export function codigoCorto(codigo) {
  if (!codigo) return 'sin QR';
  return codigo.length > 8 ? `…${codigo.slice(-6)}` : codigo;
}

export function nombreReferencia(ref) {
  if (!ref) return '';
  return `${ref.tipo} · ${ref.largo} mm`;
}

// Agrupa las referencias por tipo, respetando el orden definido.
// Devuelve [{ tipo, orden_tipo, activo, refs: [...] }]
export function agruparPorTipo(referencias) {
  const mapa = new Map();
  referencias.forEach((r) => {
    if (!mapa.has(r.tipo)) {
      mapa.set(r.tipo, { tipo: r.tipo, orden_tipo: r.orden_tipo, refs: [] });
    }
    mapa.get(r.tipo).refs.push(r);
  });
  return Array.from(mapa.values())
    .map((g) => ({
      ...g,
      activo: g.refs.some((r) => r.activo),
      refs: g.refs.sort((a, b) => a.largo - b.largo),
    }))
    .sort((a, b) => a.orden_tipo - b.orden_tipo || a.tipo.localeCompare(b.tipo));
}

// Una referencia está "baja" cuando quedan tantas cajas como su mínimo
// o menos. Con mínimo 0 nunca avisa (sirve para referencias que no se piden).
export function estaBaja(fila) {
  return fila.stock_minimo > 0 && fila.en_almacen <= fila.stock_minimo;
}

export function inicioDeHoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function formatearFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

// Pitido corto + vibración para confirmar cada lectura sin mirar la pantalla.
let audioCtx = null;
export function avisoSonoro(tipo = 'ok') {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const notas = tipo === 'ok' ? [[880, 0, 0.09]] : [[330, 0, 0.14], [262, 0.17, 0.2]];
      notas.forEach(([freq, inicio, dur]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t0 = audioCtx.currentTime + inicio;
        osc.start(t0);
        osc.stop(t0 + dur);
      });
    }
  } catch (e) {
    // sin sonido no pasa nada
  }
  try {
    if (navigator.vibrate) navigator.vibrate(tipo === 'ok' ? 60 : [80, 60, 80]);
  } catch (e) {
    // dispositivo sin vibración
  }
}
