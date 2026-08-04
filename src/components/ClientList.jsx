import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export default function ClientList({ selectedClient, onSelectClient, onNewClient, canCreateClient }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounce de 300ms para no disparar una query por cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('clients').select('*').order('nombre').limit(50);
    if (debouncedSearch) {
      query = query.ilike('nombre', `%${debouncedSearch}%`);
    }
    const { data, error } = await query;
    if (!error && data) setClients(data);
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-gray-700">Clientas</h2>
        {canCreateClient && (
          <button
            onClick={onNewClient}
            className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-lg font-medium hover:bg-pink-200"
          >
            + Nueva
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded-lg mb-3 text-sm focus:outline-pink-500"
      />

      <div className="space-y-2 max-h-[65vh] overflow-y-auto">
        {loading && <p className="text-xs text-gray-400 text-center py-4">Buscando...</p>}
        {!loading && clients.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Sin resultados.</p>
        )}
        {clients.map((client) => (
          <div
            key={client.id}
            onClick={() => onSelectClient(client)}
            className={`p-3 rounded-lg cursor-pointer transition ${
              selectedClient?.id === client.id
                ? 'bg-pink-100 border-pink-400 border'
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <p className="font-semibold text-sm">{client.nombre}</p>
            <p className="text-xs text-gray-500">{client.telefono || 'Sin teléfono'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
