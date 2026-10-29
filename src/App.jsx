import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import ClientList from './components/ClientList';
import ClientFicha from './components/ClientFicha';
import NewClientModal from './components/NewClientModal';
import AdminPanel from './components/AdminPanel';
import AgendaDia from './components/AgendaDia';
import ColaProfesional from './components/ColaProfesional';
import Inventario from './components/inventario/Inventario';
import { exportRecordsToCsv } from './utils/exportCsv';
import { estaBaja } from './utils/inventario';

export default function App() {
  const [currentStaff, setCurrentStaff] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [view, setView] = useState('fichas'); // 'fichas' | 'agenda' | 'inventario' | 'admin'
  const [checkingSession, setCheckingSession] = useState(true);
  const [cajasPorPedir, setCajasPorPedir] = useState(0);

  // Aviso de stock bajo en la pestaña Inventario (solo admin).
  const revisarStock = useCallback(async () => {
    const { data, error } = await supabase.from('inv_stock').select('en_almacen, stock_minimo, activo');
    if (error || !data) return;
    const hayCajas = data.some((s) => s.en_almacen > 0);
    setCajasPorPedir(hayCajas ? data.filter((s) => s.activo && estaBaja(s)).length : 0);
  }, []);

  useEffect(() => {
    if (currentStaff && currentStaff.rol === 'admin') revisarStock();
  }, [currentStaff, revisarStock]);

  // Restaurar sesión si ya había un login previo (staff guardado localmente)
  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      // Profesionales (tablets del salón): la sesión se recuerda en ese dispositivo hasta que toquen "Salir".
      // Secretaría y administración: solo mientras la pestaña esté abierta.
      let savedStaff = sessionStorage.getItem('currentStaff');
      if (!savedStaff) {
        try {
          const recordada = localStorage.getItem('currentStaffTablet');
          if (recordada && JSON.parse(recordada).rol === 'profesional') savedStaff = recordada;
        } catch (e) {
          /* sin almacenamiento local: se pedirá el PIN */
        }
      }
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
    try {
      if (staff.rol === 'profesional') localStorage.setItem('currentStaffTablet', JSON.stringify(staff));
      else localStorage.removeItem('currentStaffTablet');
    } catch (e) {
      /* ignorar */
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('currentStaff');
    try {
      localStorage.removeItem('currentStaffTablet');
    } catch (e) {
      /* ignorar */
    }
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
      <div className="min-h-screen p-4 sm:p-8">
        <div className="max-w-3xl mx-auto flex justify-between items-center mb-6">
          <p className="font-display italic text-lg font-semibold text-brand-700">Las Pestañas de Julia</p>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 font-semibold bg-white border border-gray-100 shadow-sm px-4 py-2 rounded-full active:bg-gray-50"
          >
            Salir
          </button>
        </div>
        <ColaProfesional currentStaff={currentStaff} />
      </div>
    );
  }

  const navBtn = (id, label, extra = null) => (
    <button
      key={id}
      onClick={() => setView(id)}
      className={`relative px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
        view === id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {extra}
    </button>
  );

  return (
    <div className="min-h-screen p-3 sm:p-6 font-sans text-ink">
      <header className="sticky top-3 z-30 max-w-5xl mx-auto mb-6 bg-white/80 backdrop-blur-md border border-white shadow-sm rounded-2xl px-4 py-3 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-blush-100 flex items-center justify-center font-display italic text-xl font-semibold">
            J
          </div>
          <div>
            <h1 className="font-display italic text-lg font-semibold text-brand-700 leading-tight">
              Las Pestañas de Julia
            </h1>
            <p className="text-xs text-gray-400">
              {currentStaff.nombre} · <span className="capitalize">{currentStaff.rol}</span>
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {navBtn('fichas', 'Fichas')}
          {navBtn('agenda', 'Agenda de hoy')}
          {currentStaff.rol === 'admin' &&
            navBtn(
              'inventario',
              'Inventario',
              cajasPorPedir > 0 && (
                <span
                  title={`${cajasPorPedir} referencias con pocas cajas`}
                  className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blush-500 text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {cajasPorPedir}
                </span>
              )
            )}
          {currentStaff.rol === 'admin' && navBtn('admin', 'Administración')}
        </nav>

        <div className="flex items-center gap-1">
          {currentStaff.rol === 'admin' && (
            <button
              onClick={exportRecordsToCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100"
            >
              Exportar CSV
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        {view === 'admin' && currentStaff.rol === 'admin' && <AdminPanel />}

        {view === 'inventario' && currentStaff.rol === 'admin' && <Inventario onStockCambiado={revisarStock} />}

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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
              {selectedClient ? (
                <ClientFicha
                  client={selectedClient}
                  currentStaff={currentStaff}
                  onClientUpdated={(updated) => setSelectedClient(updated)}
                  onClientDeleted={() => setSelectedClient(null)}
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
