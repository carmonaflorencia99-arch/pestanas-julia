import React, { useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import EscanerQR from './EscanerQR';
import SelectorReferencia from './SelectorReferencia';
import { avisoSonoro, codigoCorto, nombreReferencia } from '../../utils/inventario';

// Alta de cajas: recuento inicial del almacén y entradas de pedidos nuevos.
// Se elige tipo y largo una vez y se escanean seguidas todas las cajas de ese montón.
export default function EntradasRecuento({ referencias, stock, onCambios }) {
  const [origen, setOrigen] = useState('recuento');
  const [ref, setRef] = useState(null);
  const [registro, setRegistro] = useState([]); // lecturas de esta sesión
  const [porReferencia, setPorReferencia] = useState({}); // id -> cajas añadidas ahora
  const [cantidadSinQR, setCantidadSinQR] = useState('');
  const refActual = useRef(null);
  refActual.current = ref;

  const enAlmacen = (id) => {
    const fila = stock.find((s) => s.referencia_id === id);
    return fila ? fila.en_almacen : 0;
  };

  const anotar = (entrada) => setRegistro((r) => [{ ...entrada, id: Date.now() + Math.random() }, ...r].slice(0, 40));

  const sumar = (id, n) => setPorReferencia((p) => ({ ...p, [id]: (p[id] || 0) + n }));

  const alLeerCodigo = async (codigo) => {
    const referencia = refActual.current;
    if (!referencia) return;
    const { data, error } = await supabase.rpc('inv_alta_caja', {
      p_codigo: codigo,
      p_referencia_id: referencia.id,
      p_origen: origen,
    });
    if (error) {
      avisoSonoro('error');
      anotar({ ok: false, texto: `Error al guardar ${codigoCorto(codigo)}. Vuelve a escanearla.` });
      return;
    }
    if (data.estado === 'ok') {
      avisoSonoro('ok');
      sumar(referencia.id, 1);
      anotar({ ok: true, texto: `${nombreReferencia(referencia)} · ${codigoCorto(codigo)}` });
      onCambios();
      return;
    }
    avisoSonoro('error');
    const registrada = `${data.tipo} · ${data.largo} mm`;
    if (data.estado === 'duplicada') {
      const distinta = data.tipo !== referencia.tipo || data.largo !== referencia.largo;
      anotar({
        ok: false,
        texto: `${codigoCorto(codigo)} ya estaba registrada como ${registrada}. No se ha contado otra vez.${
          distinta ? ' ⚠️ Es de otro tipo o largo: revísala en Movimientos.' : ''
        }`,
      });
    } else {
      anotar({
        ok: false,
        texto: `${codigoCorto(codigo)} (${registrada}) figura como sacada. Si la han devuelto, búscala en Movimientos y pulsa «Devolver».`,
      });
    }
  };

  const altaSinQR = async (e) => {
    e.preventDefault();
    const n = parseInt(cantidadSinQR, 10);
    if (!ref || !n || n < 1) return;
    const { error } = await supabase.rpc('inv_alta_sin_codigo', {
      p_referencia_id: ref.id,
      p_cantidad: n,
      p_origen: origen === 'recuento' ? 'recuento' : 'manual',
    });
    if (error) {
      alert('No se han podido añadir las cajas.');
      return;
    }
    avisoSonoro('ok');
    sumar(ref.id, n);
    anotar({ ok: true, texto: `${nombreReferencia(ref)} · ${n} ${n === 1 ? 'caja' : 'cajas'} sin QR` });
    setCantidadSinQR('');
    onCambios();
  };

  const resumen = Object.entries(porReferencia)
    .map(([id, n]) => ({ ref: referencias.find((r) => r.id === id), n }))
    .filter((x) => x.ref);
  const totalSesion = resumen.reduce((n, x) => n + x.n, 0);

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {[
          ['recuento', 'Recuento inicial'],
          ['pedido', 'Pedido nuevo'],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            onClick={() => setOrigen(valor)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              origen === valor ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500 mb-3">
            1. Elige el tipo y el largo del montón que vas a escanear.
          </p>
          <SelectorReferencia referencias={referencias} valor={ref ? ref.id : null} onChange={setRef} compacto />

          {ref && (
            <form onSubmit={altaSinQR} className="mt-5 flex gap-2 items-center bg-gray-50 rounded-xl p-3">
              <span className="text-xs text-gray-500">Cajas sin QR:</span>
              <input
                type="number"
                min="1"
                max="500"
                value={cantidadSinQR}
                onChange={(e) => setCantidadSinQR(e.target.value)}
                className="w-20 p-2 border rounded-lg text-sm"
                placeholder="0"
              />
              <button type="submit" className="text-xs bg-gray-800 text-white px-3 py-2 rounded-lg">
                Añadir
              </button>
            </form>
          )}
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-3">2. Pasa las cajas por la cámara, una detrás de otra.</p>
          {ref ? (
            <>
              <div className="bg-brand-600 text-white rounded-xl px-4 py-3 mb-3 flex justify-between items-center">
                <div>
                  <p className="text-xs opacity-80">Escaneando como</p>
                  <p className="text-xl font-bold">{nombreReferencia(ref)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">En almacén</p>
                  <p className="text-2xl font-bold">{enAlmacen(ref.id)}</p>
                </div>
              </div>
              <EscanerQR onCodigo={alLeerCodigo} />
            </>
          ) : (
            <div className="h-64 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-400 text-center p-6">
              Elige primero tipo y largo para abrir la cámara
            </div>
          )}
        </div>
      </div>

      {(registro.length > 0 || totalSesion > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Últimas lecturas</p>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {registro.map((r) => (
                <div
                  key={r.id}
                  className={`text-sm rounded-lg px-3 py-2 ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
                >
                  {r.ok ? '✓ ' : '✕ '}
                  {r.texto}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Añadidas en esta sesión: {totalSesion}
            </p>
            <div className="space-y-1">
              {resumen.map((x) => (
                <div key={x.ref.id} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span>{nombreReferencia(x.ref)}</span>
                  <span className="font-bold">+{x.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
