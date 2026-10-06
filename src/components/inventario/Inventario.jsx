import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import StockTabla from './StockTabla';
import EntradasRecuento from './EntradasRecuento';
import Movimientos from './Movimientos';
import ReferenciasAdmin from './ReferenciasAdmin';
import SacarCajaModal from './SacarCajaModal';

// Sección de inventario de cajas de pestañas (solo admin).
export default function Inventario({ onStockCambiado }) {
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState([]);
  const [referencias, setReferencias] = useState([]);
  const [error, setError] = useState('');
  const [sacando, setSacando] = useState(false);

  const cargar = useCallback(async () => {
    const [st, refs] = await Promise.all([
      supabase.from('inv_stock').select('*'),
      supabase.from('inv_referencias').select('*').order('orden_tipo').order('largo'),
    ]);
    if (st.error || refs.error) {
      setError(
        'No se ha podido cargar el inventario. Si es la primera vez, falta ejecutar schema_inventario.sql en Supabase.'
      );
      return;
    }
    setError('');
    setStock(st.data || []);
    setReferencias(refs.data || []);
    if (onStockCambiado) onStockCambiado();
  }, [onStockCambiado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tabs = [
    ['stock', 'Stock'],
    ['entradas', 'Recuento y entradas'],
    ['movimientos', 'Movimientos'],
    ['referencias', 'Referencias'],
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([valor, texto]) => (
            <button
              key={valor}
              onClick={() => setTab(valor)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === valor ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSacando(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-blush-500 text-white hover:bg-blush-600"
        >
          Sacar caja
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4">{error}</div>}

      {!error && tab === 'stock' && <StockTabla stock={stock} onCambios={cargar} />}
      {!error && tab === 'entradas' && (
        <EntradasRecuento referencias={referencias} stock={stock} onCambios={cargar} />
      )}
      {!error && tab === 'movimientos' && <Movimientos referencias={referencias} onCambios={cargar} />}
      {!error && tab === 'referencias' && <ReferenciasAdmin referencias={referencias} onCambios={cargar} />}

      {sacando && <SacarCajaModal color="brand" onClose={() => setSacando(false)} onRegistrada={cargar} />}
    </div>
  );
}
