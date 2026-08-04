import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import ClientList from './components/ClientList';
import ClientFicha from './components/ClientFicha';
import NewClientModal from './components/NewClientModal';
import AdminPanel from './components/AdminPanel';
import { exportRecordsToCsv } from './utils/exportCsv';

export default function App() {
  const [currentStaff, setCurrentStaff] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [view, setView] = useState('fichas'); // 'fichas' | 'admin'
  const [checkingSession, setCheckingSession] = useState(true);

  // Restaurar sesión si ya había un login previo (staff guardado localmente)
  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      const savedStaff = sessionStorage.getItem('currentStaff');
      if (data.session && savedStaff) {
        setCurrentStaff(JSON.parse(savedStaff));
      }
      setCheckingSession(false);
    };
    restoreSession();
  }, []);

  const handleLoggedIn = (staff) => {
    setCurrentStaff(staff);
    sessionStorage.setItem('currentStaff', JSON.stringify(staff));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('currentStaff');
    setCurrentStaff(null);
    setSelectedClient(null);
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-pink-50" />;
  }

  if (!currentStaff) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  const canCreateClient = currentStaff.rol === 'secretaria' || currentStaff.rol === 'admin';

  return (
    <div className="min-h-screen bg-pink-50 p-4 font-sans text-gray-800">
      <header className="max-w-4xl mx-auto mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-pink-600">Las Pestañas de Julia 🌸</h1>
          <p className="text-xs text-gray-400">
            {currentStaff.nombre} · <span className="capitalize">{currentStaff.rol}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentStaff.rol === 'admin' && (
            <>
              <button
                onClick={() => setView('fichas')}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${view === 'fichas' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Fichas
              </button>
              <button
                onClick={() => setView('admin')}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${view === 'admin' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Administración
              </button>
              <button
                onClick={exportRecordsToCsv}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Exportar CSV
              </button>
            </>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {view === 'admin' && currentStaff.rol === 'admin' ? (
          <AdminPanel />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <ClientList
                selectedClient={selectedClient}
                onSelectClient={setSelectedClient}
                onNewClient={() => setShowNewClientModal(true)}
                canCreateClient={canCreateClient}
              />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm md:col-span-2">
              {selectedClient ? (
                <ClientFicha client={selectedClient} currentStaff={currentStaff} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                  <p>Selecciona una clienta a la izquierda para ver su ficha.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showNewClientModal && (
        <NewClientModal
          currentStaff={currentStaff}
          onClose={() => setShowNewClientModal(false)}
          onCreated={(client) => setSelectedClient(client)}
        />
      )}
    </div>
  );
}
