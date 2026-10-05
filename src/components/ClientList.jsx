import React, { useState, useEffect } from 'react';
import { buscarClientas, enriquecerClientas, resumenClienta, nombresRepetidos } from '../lib/clientInfo';

export default function ClientList({ selectedClient, onSelectClient, onNewClient, canCreateClient }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setLoading(true);
      const base = await buscarClientas(debouncedSearch, 50);
      const completas = await enriquecerClientas(base);
      if (!cancelado) {
        setClients(completas);
        setLoading(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [debouncedSearch]);

  // Si se edita la clienta seleccionada, refrescamos la lista.
  useEffect(() => {
    if (selectedClient) {
      setClients((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? { ...c, ...selectedClient } : c))
      );
    }
  }, [selectedClient]);

  const esRepetido = nombresRepetidos(clients);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-ink">Clientas</h2>
        {canCreateClient && (
          <button
            onClick={onNewClient}
            className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-brand-700"
          >
            + Nueva
          </button>
        )}
      </div>
      <input
        placeholder="Buscar por nombre o teléfono..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded-lg text-sm mb-3"
      />
      <div className="space-y-2 max-h-[65vh] overflow-y-auto">
        {loading && clients.length === 0 && <p className="text-xs text-gray-400">Cargando...</p>}
        {!loading && clients.length === 0 && (
          <p className="text-xs text-gray-400">No se encontró ninguna clienta.</p>
        )}
        {clients.map((c) => {
          const activa = selectedClient && selectedClient.id === c.id;
          return (
            <div
              key={c.id}
              onClick={() => onSelectClient(c)}
              className={`p-3 rounded-lg cursor-pointer border text-sm ${
                activa ? 'bg-brand-100 border-brand-400' : 'border-gray-100 hover:bg-brand-50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-semibold text-ink">{c.nombre}</p>
                {esRepetido(c) && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Mismo nombre
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{resumenClienta(c)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
