import React, { useState, useEffect, useCallback } from 'react';
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

  // Edición de nombre de personal
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingStaffNombre, setEditingStaffNombre] = useState('');

  // Edición de un servicio del catálogo
  const [editingServicioId, setEditingServicioId] = useState(null);
  const [editingServicioCategoria, setEditingServicioCategoria] = useState('');
  const [editingServicioSubtipo, setEditingServicioSubtipo] = useState('');

  // Diseños cambiados pendientes de cargar en Booksy
  const [disenosCambiados, setDisenosCambiados] = useState([]);

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase.from('staff').select('*').order('nombre');
    if (data) setStaffList(data);
  }, []);

  const fetchCatalogo = useCallback(async () => {
    const { data } = await supabase.from('servicios_catalogo').select('*').order('categoria').order('orden');
    if (data) setCatalogo(data);
  }, []);

  const fetchDisenosCambiados = useCallback(async () => {
    const { data } = await supabase
      .from('service_records')
      .select('*, clients(nombre), staff:staff_id(nombre)')
      .eq('diseno_cambio_pendiente', true)
      .order('fecha', { ascending: false });
    if (data) setDisenosCambiados(data);
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchCatalogo();
    fetchDisenosCambiados();
  }, [fetchStaff, fetchCatalogo, fetchDisenosCambiados]);

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

  const iniciarEdicionNombre = (s) => {
    setEditingStaffId(s.id);
    setEditingStaffNombre(s.nombre);
  };

  const guardarNombreStaff = async (id) => {
    if (!editingStaffNombre.trim()) return;
    await supabase.from('staff').update({ nombre: editingStaffNombre.trim() }).eq('id', id);
    setEditingStaffId(null);
    setEditingStaffNombre('');
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

  const iniciarEdicionServicio = (s) => {
    setEditingServicioId(s.id);
    setEditingServicioCategoria(s.categoria);
    setEditingServicioSubtipo(s.subtipo);
  };

  const guardarServicio = async (id) => {
    if (!editingServicioCategoria.trim() || !editingServicioSubtipo.trim()) return;
    const { error } = await supabase
      .from('servicios_catalogo')
      .update({ categoria: editingServicioCategoria.trim(), subtipo: editingServicioSubtipo.trim() })
      .eq('id', id);
    if (!error) {
      setEditingServicioId(null);
      fetchCatalogo();
    } else {
      alert('No se pudo guardar (¿ya existe esa combinación de categoría y subtipo?).');
    }
  };

  const marcarDisenoActualizado = async (id) => {
    await supabase.from('service_records').update({ diseno_cambio_pendiente: false }).eq('id', id);
    fetchDisenosCambiados();
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      {disenosCambiados.length > 0 && (
        <div className="mb-6 bg-blush-50 border-2 border-blush-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-blush-600 mb-3">
            🎨 Diseños cambiados pendientes de Booksy ({disenosCambiados.length})
          </h3>
          <div className="space-y-2">
            {disenosCambiados.map((r) => (
              <div key={r.id} className="flex justify-between items-center bg-white p-3 rounded-lg text-sm">
                <div>
                  <span className="font-semibold">{r.clients?.nombre}</span>{' '}
                  <span className="text-gray-500">→ nuevo diseño: {r.diseno_pestanas}</span>
                  <p className="text-xs text-gray-400">
                    {new Date(r.fecha).toLocaleDateString('es-ES')} · Atendió: {r.staff?.nombre}
                  </p>
                </div>
                <button
                  onClick={() => marcarDisenoActualizado(r.id)}
                  className="text-xs bg-blush-500 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blush-600 whitespace-nowrap ml-2"
                >
                  Ya lo actualicé ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('personal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'personal' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Personal
        </button>
        <button
          onClick={() => setTab('catalogo')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'catalogo' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
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
            <button type="submit" className="col-span-2 bg-brand-600 text-white py-2 rounded-lg text-sm font-semibold">
              Vincular personal
            </button>
          </form>

          <div className="space-y-2">
            {staffList.map((s) => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                {editingStaffId === s.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editingStaffNombre}
                      onChange={(e) => setEditingStaffNombre(e.target.value)}
                      className="p-1.5 border rounded-lg text-sm flex-1"
                    />
                    <button
                      onClick={() => guardarNombreStaff(s.id)}
                      className="text-xs bg-brand-600 text-white px-2 py-1.5 rounded-lg font-medium"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingStaffId(null)}
                      className="text-xs text-gray-400 px-1"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.nombre}</span>
                    <span className="text-xs text-gray-400">({s.rol})</span>
                    <button
                      onClick={() => iniciarEdicionNombre(s)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      ✏️ Editar nombre
                    </button>
                  </div>
                )}
                <button
                  onClick={() => toggleStaffActivo(s.id, s.activo)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium whitespace-nowrap ml-2 ${s.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
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
            <button type="submit" className="col-span-2 bg-brand-600 text-white py-2 rounded-lg text-sm font-semibold">
              Añadir servicio
            </button>
          </form>

          <div className="space-y-2">
            {catalogo.map((s) => (
              <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                {editingServicioId === s.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editingServicioCategoria}
                      onChange={(e) => setEditingServicioCategoria(e.target.value)}
                      placeholder="Categoría"
                      className="p-1.5 border rounded-lg text-sm flex-1"
                    />
                    <input
                      value={editingServicioSubtipo}
                      onChange={(e) => setEditingServicioSubtipo(e.target.value)}
                      placeholder="Subtipo"
                      className="p-1.5 border rounded-lg text-sm flex-1"
                    />
                    <button
                      onClick={() => guardarServicio(s.id)}
                      className="text-xs bg-brand-600 text-white px-2 py-1.5 rounded-lg font-medium whitespace-nowrap"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingServicioId(null)}
                      className="text-xs text-gray-400 px-1"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.categoria}</span>
                    <span className="text-gray-400">— {s.subtipo}</span>
                    <button
                      onClick={() => iniciarEdicionServicio(s)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      ✏️ Editar
                    </button>
                  </div>
                )}
                <button
                  onClick={() => toggleServicioActivo(s.id, s.activo)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium whitespace-nowrap ml-2 ${s.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
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
