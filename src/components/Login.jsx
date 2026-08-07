import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// La profesional/secretaria elige su nombre de una lista y escribe
// su PIN. Por debajo, esto hace un login normal de Supabase Auth
// usando un email interno asociado a su registro de staff.
export default function Login({ onLoggedIn }) {
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, nombre, rol, email_auth')
      .eq('activo', true)
      .order('nombre');
    if (!error && data) setStaffList(data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      setError('Selecciona tu nombre primero.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: selectedStaff.email_auth,
      password: pin,
    });

    setLoading(false);

    if (authError) {
      setError('PIN incorrecto. Inténtalo de nuevo.');
      return;
    }

    onLoggedIn(selectedStaff, data.session);
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <h1 className="font-display italic text-2xl font-semibold text-brand-700 text-center leading-tight">
          Las Pestañas de Julia
        </h1>
        <svg className="brand-swash mx-auto mb-2" viewBox="0 0 46 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 6C10 1 16 1 23 4C30 7 36 7 44 2" stroke="#EF9FB6" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-xs text-gray-400 text-center mb-6">Fichas técnicas · Acceso del equipo</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-2 text-gray-600">¿Quién eres?</label>
            <div className="grid grid-cols-2 gap-2">
              {staffList.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSelectedStaff(s)}
                  className={`p-2 rounded-lg text-sm border transition ${
                    selectedStaff?.id === s.id
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1 text-gray-600">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-3 border rounded-lg text-center text-lg tracking-widest focus:outline-brand-500"
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-700 transition disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
