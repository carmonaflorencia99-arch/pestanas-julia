import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// NOTA: crear un usuario nuevo de Supabase Auth desde el navegador con
// la anon key no es posible por seguridad (se necesita la service_role
// key, que nunca debe estar en el frontend). Por eso, el alta de
// personal nuevo se hace en dos pasos: 1) la admin crea el usuario en
// el Dashboard de Supabase (Authentication > Users > Add user, usando
// el PIN como contraseña), 2) pega aquí el UUID resultante para
// vincularlo a un rol. Es un paso manual, pero evita exponer una
// clave peligrosa en el código público.
export default function AdminPanel() {
  const [staffList, setStaffList] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [tab, setTab] = useState('personal');

  const [newStaff, setNewStaff] = useState({ nombre: '', email_auth: '', auth_user_id: '', rol: 'profesional' });
  const [newServicio, setNewServicio] = useState({ categoria: '', subtipo: '' });

  useEffect(() => {
    fetchStaff();
    fetchCatalogo();
  }, []);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('*').order('nombre');
    if (data) setStaffList(data);
  };

  const fetchCatalogo = async () => {
    const { data } = await supabase.from('servicios_catalogo').select('*').order('categoria').order('orden');
    if (data) setCatalogo(data);
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('staff').insert([newStaff]);
    if (!error) {
      setNewStaff({ nombre: '', email_auth: '', auth_user_id: '', rol: 'profesional' });
      fetchStaff();
    } else {
      alert('Error al crear: revisa que el UUID y el email sean correctos y únicos.');
    }
  };

  const toggleStaffActivo = async (id, activo) => {
    await supabase.from('staff').update({ activo: !activo }).eq('id', id);
    fetchStaff();
  };

  const handleAddServicio = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('servicios_catalogo').insert([newServicio]);
    if (!error) {
      setNewServicio({ categoria: '', subtipo: '' });
      fetchCatalogo();
    } else {
      alert('Error al crear el servicio (¿ya existe esa combinación?).');
    }
  };

  const toggleServicioActivo = async (id, activo) => {
    await supabase.from('servicios_catalogo').update({ activo: !activo }).eq('id', id);
    fetchCatalogo();
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('personal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'personal' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Personal
        </button>
        <button
          onClick={() => setTab('catalogo')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'catalogo' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Catálogo de servicios
        </button>
      </div>

      {tab === 'personal' && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
            Para dar de alta a alguien: primero crea su usuario en Supabase Dashboard →
            Authentication → Users → "Add user" (usa un email interno como <em>nombre@laspestanasdejulia.local</em> y
            el PIN como contraseña, mínimo 6 caracteres). Copia el UUID generado y complétalo abajo.
          </div>

          <form onSubmit={handleAddStaff} className="grid grid-cols-2 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
            <input
              required
              placeholder="Nombre"
              value={newStaff.nombre}
              onChange={(e) => setNewStaff({ ...newStaff, nombre: e.target.value })}
              className="p-2 border rounded-lg text-sm"
            />
            <select
              value={newStaff.rol}
              onChange={(e) => setNewStaff({ ...newStaff, rol: e.target.value })}
              className="p-2 border rounded-lg text-sm"
            >
              <option value="profesional">Profesional</option>
              <option value="secretaria">Secretaria</option>
              <option value="admin">Admin</option>
            </select>
            <input
              required
              placeholder="Email interno (ej. maria@laspestanasdejulia.local)"
              value={newStaff.email_auth}
              onChange={(e) => setNewStaff({ ...newStaff, email_auth: e.target.value })}
              className="p-2 border rounded-lg text-sm col-span-2"
            />
            <input
              required
              placeholder="UUID de Supabase Auth"
              value={newStaff.auth_user_id}
              onChange={(e) => setNewStaff({ ...newStaff, auth_user_id: e.target.value })}
              className="p-2 border rounded-lg text-sm col-span-2"
            />
            <button type="submit" className="col-span-2 bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold">
              Vincular personal
            </button>
          </form>

          <div className="space-y-2">
            {staffList.map((s) => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-semibold">{s.nombre}</span>{' '}
                  <span className="text-xs text-gray-400">({s.rol})</span>
                </div>
                <button
                  onClick={() => toggleStaffActivo(s.id, s.activo)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${s.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                >
                  {s.activo ? 'Activa' : 'Inactiva'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'catalogo' && (
        <div>
          <form onSubmit={handleAddServicio} className="grid grid-cols-2 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
            <input
              required
              placeholder="Categoría (ej. Manicura)"
              value={newServicio.categoria}
              onChange={(e) => setNewServicio({ ...newServicio, categoria: e.target.value })}
              className="p-2 border rounded-lg text-sm"
            />
            <input
              required
              placeholder="Subtipo (ej. Semipermanente)"
              value={newServicio.subtipo}
              onChange={(e) => setNewServicio({ ...newServicio, subtipo: e.target.value })}
              className="p-2 border rounded-lg text-sm"
            />
            <button type="submit" className="col-span-2 bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold">
              Añadir servicio
            </button>
          </form>

          <div className="space-y-2">
            {catalogo.map((s) => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-semibold">{s.categoria}</span>
                  <span className="text-gray-400"> — {s.subtipo}</span>
                </div>
                <button
                  onClick={() => toggleServicioActivo(s.id, s.activo)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${s.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                >
                  {s.activo ? 'Activo' : 'Oculto'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
