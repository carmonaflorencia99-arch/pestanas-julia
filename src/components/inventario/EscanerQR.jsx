import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { extraerCodigo } from '../../utils/inventario';

// Lector de QR con la cámara trasera de la tablet o el móvil.
// Llama a onCodigo(codigo) cada vez que lee una caja.
// - pausado: la cámara sigue abierta pero no lee (mientras se confirma algo).
// - La misma caja no se vuelve a leer hasta pasados unos segundos, para
//   que no cuente dos veces si se queda delante de la cámara.
export default function EscanerQR({ onCodigo, pausado = false, alto = 'h-64' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const ultimoRef = useRef({ codigo: null, hora: 0 });
  const pausadoRef = useRef(pausado);
  const onCodigoRef = useRef(onCodigo);

  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [mostrarManual, setMostrarManual] = useState(false);

  pausadoRef.current = pausado;
  onCodigoRef.current = onCodigo;

  useEffect(() => {
    let cancelado = false;
    let temporizador = null;

    // Lector nativo del sistema (Chrome en Android y Safari reciente):
    // más rápido y lee mejor QR pequeños o con brillo. Si no existe, jsQR.
    let detectorNativo = null;
    try {
      if ('BarcodeDetector' in window) {
        detectorNativo = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch (e) {
      detectorNativo = null;
    }
    let vuelta = 0;

    const entregar = (texto) => {
      const codigo = extraerCodigo(texto);
      if (!codigo) return;
      const ahora = Date.now();
      const ultimo = ultimoRef.current;
      if (!(codigo === ultimo.codigo && ahora - ultimo.hora < 3000)) {
        ultimoRef.current = { codigo, hora: ahora };
        onCodigoRef.current(codigo);
      } else {
        ultimoRef.current.hora = ahora;
      }
    };

    // jsQR: alterna entre el centro de la imagen a resolución real (para
    // QR pequeños, que es lo habitual en las cajas) y la imagen completa.
    const leerConJsQR = (video, canvas) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;
      let w;
      let h;
      if (vuelta % 2 === 0) {
        const lado = Math.min(vw, vh, 720);
        sx = Math.floor((vw - lado) / 2);
        sy = Math.floor((vh - lado) / 2);
        sw = lado;
        sh = lado;
        w = lado;
        h = lado;
      } else {
        const escala = Math.min(1, 800 / vw);
        w = Math.floor(vw * escala);
        h = Math.floor(vh * escala);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      const imagen = ctx.getImageData(0, 0, w, h);
      const resultado = jsQR(imagen.data, w, h, { inversionAttempts: 'attemptBoth' });
      return resultado && resultado.data ? resultado.data : null;
    };

    const leerFotograma = async () => {
      if (cancelado) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && !pausadoRef.current) {
        vuelta += 1;
        try {
          if (detectorNativo) {
            const encontrados = await detectorNativo.detect(video);
            if (encontrados && encontrados.length && encontrados[0].rawValue) {
              entregar(encontrados[0].rawValue);
            } else if (vuelta % 3 === 0) {
              // de vez en cuando también jsQR, por si el nativo falla con esa caja
              const texto = leerConJsQR(video, canvas);
              if (texto) entregar(texto);
            }
          } else {
            const texto = leerConJsQR(video, canvas);
            if (texto) entregar(texto);
          }
        } catch (e) {
          detectorNativo = null;
        }
      }
      if (!cancelado) temporizador = setTimeout(leerFotograma, detectorNativo ? 120 : 150);
    };

    const arrancar = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Abre la app en Chrome o Safari actualizados.');
        setMostrarManual(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // Enfoque automático continuo si la cámara lo permite (ayuda con cajas cerca).
        try {
          const pista = stream.getVideoTracks()[0];
          const capacidades = pista.getCapabilities ? pista.getCapabilities() : {};
          if (capacidades.focusMode && capacidades.focusMode.includes('continuous')) {
            await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch (e) {
          // no todas las cámaras lo permiten
        }
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        leerFotograma();
      } catch (e) {
        if (e && e.name === 'NotAllowedError') {
          setError('No hay permiso para usar la cámara. Actívalo en los ajustes del navegador y vuelve a abrir esta pantalla.');
        } else {
          setError('No se ha podido abrir la cámara.');
        }
        setMostrarManual(true);
      }
    };

    arrancar();

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const enviarManual = (e) => {
    e.preventDefault();
    const codigo = extraerCodigo(manual);
    if (codigo) {
      ultimoRef.current = { codigo, hora: Date.now() };
      onCodigo(codigo);
    }
    setManual('');
  };

  return (
    <div>
      {!error && (
        <div className={`relative ${alto} bg-gray-900 rounded-2xl overflow-hidden`}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-44 h-44 rounded-2xl border-4 ${pausado ? 'border-white/30' : 'border-white/80'}`}
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)' }}
            />
          </div>
          <p className="absolute bottom-2 inset-x-0 text-center text-xs text-white/80">
            {pausado ? 'En pausa' : 'Pon el QR dentro del cuadro, a un palmo de la cámara'}
          </p>
        </div>
      )}
      {error && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{error}</div>}
      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-2 text-center">
        {!mostrarManual ? (
          <button type="button" onClick={() => setMostrarManual(true)} className="text-xs text-gray-400 underline">
            ¿No lee el QR? Escribir el código
          </button>
        ) : (
          <form onSubmit={enviarManual} className="flex gap-2 mt-1">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Código o enlace del QR"
              className="flex-1 p-2 border rounded-lg text-sm"
            />
            <button type="submit" className="px-4 bg-gray-800 text-white text-sm rounded-lg">
              OK
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
