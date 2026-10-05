import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import EscanerQR from './EscanerQR';
import SelectorReferencia from './SelectorReferencia';
import { avisoSonoro, codigoCorto, formatearFechaHora } from '../../utils/inventario';

// Registrar las cajas que se sacan del almacén.
// La usan las profesionales (desde su agenda) y la admin.
// Pasos: escanear → confirmar → listo (y se puede seguir con otra caja).
// Si la caja no tiene QR o el QR no estaba dado de alta, se elige tipo y largo a mano.
export default function SacarCajaModal({ onClose, onRegistrada, color = 'pink' }) {
  const [referencias, setReferencias] = useState([]);
  const [paso, setPaso] = useState('escanear'); // escanear | confirmar | elegir | aviso
  const [codigo, setCodigo] = useState(null);
  const [info, setInfo] = useState(null); // { tipo, largo, referencia_id }
  const [refElegida, setRefElegida] = useState(null);
  const [aviso, setAviso] = useState('');
  const [hecho, setHecho] = useState('');
  const [contador, setContador] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const principal = color === 'pink' ? 'bg-pink-600 active:bg-pink-700' : 'bg-brand-600 active:bg-brand-700';

  useEffect(() => {
    supabase
      .from('inv_referencias')
      .select('*')
      .order('orden_tipo')
      .order('largo')
      .then(({ data }) => setReferencias(data || []));
  }, []);

  useEffect(() => {
    if (!hecho) return undefined;
    const t = setTimeout(() => setHecho(''), 3500);
    return () => clearTimeout(t);
  }, [hecho]);

  const volverAEscanear = () => {
    setPaso('escanear');
    setCodigo(null);
    setInfo(null);
    setRefElegida(null);
    setAviso('');
  };

  const alLeerCodigo = async (cod) => {
    if (paso !== 'escanear') return;
    setCodigo(cod);
    const { data, error } = await supabase.rpc('inv_consultar_codigo', { p_codigo: cod });
    if (error) {
      avisoSonoro('error');
      setAviso('No se ha podido comprobar la caja. Revisa la conexión e inténtalo de nuevo.');
      setPaso('aviso');
      return;
    }
    if (data.estado === 'desconocido') {
      avisoSonoro('error');
      setPaso('elegir');
      return;
    }
    avisoSonoro('ok');
    setInfo(data);
    setPaso('confirmar');
  };

  const registrar = async (cod, referenciaId) => {
    setGuardando(true);
    const { data, error } = await supabase.rpc('inv_registrar_salida', {
      p_codigo: cod,
      p_referencia_id: referenciaId,
    });
    setGuardando(false);

    if (error) {
      avisoSonoro('error');
      setAviso('No se ha podido registrar. Revisa la conexión e inténtalo de nuevo.');
      setPaso('aviso');
      return;
    }
    if (data.estado === 'ya_sacada') {
      avisoSonoro('error');
      setAviso(
        `Esta caja (${data.tipo} · ${data.largo} mm) ya figura como sacada` +
          (data.salida_por ? ` por ${data.salida_por}` : '') +
          (data.salida_en ? ` (${formatearFechaHora(data.salida_en)})` : '') +
          '. No se ha vuelto a descontar.'
      );
      setPaso('aviso');
      return;
    }
    if (data.estado === 'desconocido') {
      setPaso('elegir');
      return;
    }

    avisoSonoro('ok');
    setContador((n) => n + 1);
    setHecho(`✓ ${data.tipo} · ${data.largo} mm registrada`);
    if (onRegistrada) onRegistrada();
    volverAEscanear();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Sacar caja del almacén</h3>
            {contador > 0 && (
              <p className="text-xs text-gray-400">
                {contador} {contador === 1 ? 'caja registrada' : 'cajas registradas'} ahora
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 text-sm font-medium px-3 py-2 active:text-gray-600">
            Cerrar
          </button>
        </div>

        {hecho && (
          <div className="mb-3 bg-green-50 border-2 border-green-200 text-green-700 font-semibold rounded-xl p-3 text-center">
            {hecho}
          </div>
        )}

        {/* La cámara se mantiene abierta mientras se escanea o confirma */}
        {(paso === 'escanear' || paso === 'confirmar') && (
          <EscanerQR onCodigo={alLeerCodigo} pausado={paso !== 'escanear'} />
        )}

        {paso === 'escanear' && (
          <button
            onClick={() => {
              setCodigo(null);
              setPaso('elegir');
            }}
            className="w-full mt-3 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold active:bg-gray-50"
          >
            La caja no tiene QR
          </button>
        )}

        {paso === 'confirmar' && info && (
          <div className="mt-4 border-2 border-gray-200 rounded-2xl p-5 text-center">
            <p className="text-xs text-gray-400 mb-1">Caja {codigoCorto(codigo)}</p>
            <p className="text-3xl font-bold text-gray-800">{info.tipo}</p>
            <p className="text-2xl font-semibold text-gray-600 mb-5">{info.largo} mm</p>
            <div className="flex gap-3">
              <button
                onClick={volverAEscanear}
                className="px-5 py-4 rounded-xl bg-gray-100 text-gray-600 font-semibold active:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                disabled={guardando}
                onClick={() => registrar(codigo, null)}
                className={`flex-1 py-4 rounded-xl text-white text-lg font-semibold disabled:opacity-50 ${principal}`}
              >
                {guardando ? 'Guardando…' : 'Sí, la saco'}
              </button>
            </div>
          </div>
        )}

        {paso === 'elegir' && (
          <div>
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              {codigo
                ? 'Esta caja no estaba dada de alta en el inventario. Elige qué caja es:'
                : 'Elige qué caja has sacado:'}
            </div>
            <SelectorReferencia
              referencias={referencias}
              valor={refElegida ? refElegida.id : null}
              onChange={setRefElegida}
              color={color}
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={volverAEscanear}
                className="px-5 py-4 rounded-xl bg-gray-100 text-gray-600 font-semibold active:bg-gray-200"
              >
                Volver
              </button>
              <button
                disabled={!refElegida || guardando}
                onClick={() => registrar(codigo, refElegida.id)}
                className={`flex-1 py-4 rounded-xl text-white text-lg font-semibold disabled:opacity-40 ${principal}`}
              >
                {guardando
                  ? 'Guardando…'
                  : refElegida
                  ? `Sacar ${refElegida.tipo} · ${refElegida.largo} mm`
                  : 'Elige tipo y largo'}
              </button>
            </div>
          </div>
        )}

        {paso === 'aviso' && (
          <div className="mt-2">
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-red-700 text-center mb-4">
              {aviso}
            </div>
            <button
              onClick={volverAEscanear}
              className={`w-full py-4 rounded-xl text-white text-lg font-semibold ${principal}`}
            >
              Escanear otra caja
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
