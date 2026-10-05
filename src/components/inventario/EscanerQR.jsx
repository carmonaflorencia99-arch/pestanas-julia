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

    const leerFotograma = () => {
      if (cancelado) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && !pausadoRef.current) {
        // Se reduce la imagen para que vaya fluido en tablets antiguas.
        const escala = Math.min(1, 640 / (video.videoWidth || 640));
        const w = Math.floor((video.videoWidth || 640) * escala);
        const h = Math.floor((video.videoHeight || 480) * escala);
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);
          const imagen = ctx.getImageData(0, 0, w, h);
          const resultado = jsQR(imagen.data, w, h, { inversionAttempts: 'dontInvert' });
          if (resultado && resultado.data) {
            const codigo = extraerCodigo(resultado.data);
            const ahora = Date.now();
            const ultimo = ultimoRef.current;
            if (codigo && !(codigo === ultimo.codigo && ahora - ultimo.hora < 3000)) {
              ultimoRef.current = { codigo, hora: ahora };
              onCodigoRef.current(codigo);
            } else if (codigo) {
              ultimoRef.current.hora = ahora;
            }
          }
        }
      }
      temporizador = setTimeout(leerFotograma, 180);
    };

    const arrancar = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Abre la app en Chrome o Safari actualizados.');
        setMostrarManual(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
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
            {pausado ? 'En pausa' : 'Enfoca el QR de la caja'}
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
