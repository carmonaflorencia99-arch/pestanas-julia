import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import ClientList from './components/ClientList';
import ClientFicha from './components/ClientFicha';
import NewClientModal from './components/NewClientModal';
import AdminPanel from './components/AdminPanel';
import AgendaDia from './components/AgendaDia';
import ColaProfesional from './components/ColaProfesional';
import { exportRecordsToCsv } from './utils/exportCsv';

export default function App() {
  const [currentStaff, setCurrentStaff] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [view, setView] = useState('fichas'); // 'fichas' | 'agenda' | 'admin'
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
    return <div className="min-h-screen bg-paper" />;
  }

  if (!currentStaff) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  const canCreateClient = currentStaff.rol === 'secretaria' || currentStaff.rol === 'admin';

  // Vista dedicada de tablet para profesionales: solo su cola de hoy,
  // sin buscador general ni el resto de la navegación.
  if (currentStaff.rol === 'profesional') {
    return (
      <div className="min-h-screen bg-paper p-4 sm:p-8">
        <div className="max-w-3xl mx-auto flex justify-end mb-2">
          <button onClick={handleLogout} className="text-sm text-gray-400 active:text-gray-600">
            Salir
          </button>
        </div>
        <ColaProfesional currentStaff={currentStaff} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-4 font-sans text-ink">
      <header className="max-w-4xl mx-auto mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="font-display italic text-xl font-semibold text-brand-700 leading-tight">
            Las Pestañas de Julia
            <svg className="brand-swash" viewBox="0 0 46 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 6C10 1 16 1 23 4C30 7 36 7 44 2" stroke="#EF9FB6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </h1>
          <p className="text-xs text-gray-400">
            {currentStaff.nombre} · <span className="capitalize">{currentStaff.rol}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('fichas')}
            className={`px-3 py-2 rounded-lg text-xs font-medium ${view === 'fichas' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Fichas
          </button>
          <button
            onClick={() => setView('agenda')}
            className={`px-3 py-2 rounded-lg text-xs font-medium ${view === 'agenda' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Agenda de hoy
          </button>
          {currentStaff.rol === 'admin' && (
            <>
              <button
                onClick={() => setView('admin')}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${view === 'admin' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
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
        {view === 'admin' && currentStaff.rol === 'admin' && <AdminPanel />}

        {view === 'agenda' && <AgendaDia currentStaff={currentStaff} />}

        {view === 'fichas' && (
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
                <ClientFicha
                  client={selectedClient}
                  currentStaff={currentStaff}
                  onClientUpdated={(updated) => setSelectedClient(updated)}
                />
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
