import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import EditClientModal from './EditClientModal';
import CampoEditable from './CampoEditable';

export default function ClientFicha({ client, currentStaff, onClientUpdated, onClientDeleted }) {
  const [records, setRecords] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showEditClient, setShowEditClient] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const puedeEditarClienta = currentStaff.rol === 'admin' || currentStaff.rol === 'secretaria';
  const puedeBorrarClienta = currentStaff.rol === 'admin';
  const puedeCargar = currentStaff.rol === 'profesional' || currentStaff.rol === 'admin' || currentStaff.rol === 'secretaria';

  const emptyForm = {
    categoria_servicio: '',
    subtipo_servicio: '',
    historial_observaciones: '',
    staff_id: currentStaff.rol === 'profesional' ? currentStaff.id : '',
  };
  const [form, setForm] = useState(emptyForm);
  const [profesionales, setProfesionales] = useState([]);

  const necesitaElegirProfesional = currentStaff.rol !== 'profesional';

  useEffect(() => {
    if (necesitaElegirProfesional) {
      supabase
        .from('staff')
        .select('id, nombre')
        .eq('rol', 'profesional')
        .eq('activo', true)
        .order('nombre')
        .then(({ data }) => data && setProfesionales(data));
    }
  }, [necesitaElegirProfesional]);

  const fetchCatalogo = useCallback(async () => {
    const { data } = await supabase
      .from('servicios_catalogo')
      .select('categoria, subtipo')
      .eq('activo', true)
      .order('orden');
    if (data) {
      const grouped = {};
      data.forEach((s) => {
        if (!grouped[s.categoria]) grouped[s.categoria] = [];
        grouped[s.categoria].push(s.subtipo);
      });
      setCatalogo(grouped);
      const firstCat = Object.keys(grouped)[0];
      if (firstCat) {
        setForm((f) => ({ ...f, categoria_servicio: firstCat, subtipo_servicio: grouped[firstCat][0] }));
      }
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('service_records')
      .select('*, staff:staff_id(nombre)')
      .eq('client_id', client.id)
      .order('fecha', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  }, [client.id]);

  const [profesionalHabitual, setProfesionalHabitual] = useState(null);
  useEffect(() => {
    if (client.profesional_habitual_id) {
      supabase
        .from('staff')
        .select('nombre')
        .eq('id', client.profesional_habitual_id)
        .single()
        .then(({ data }) => data && setProfesionalHabitual(data.nombre));
    } else {
      setProfesionalHabitual(null);
    }
  }, [client.profesional_habitual_id]);

  useEffect(() => {
    fetchCatalogo();
  }, [fetchCatalogo]);

  useEffect(() => {
    fetchRecords();
    setEditingId(null);
  }, [fetchRecords]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase
        .from('service_records')
        .update({
          categoria_servicio: form.categoria_servicio,
          subtipo_servicio: form.subtipo_servicio,
          historial_observaciones: form.historial_observaciones,
        })
        .eq('id', editingId);
      if (!error) {
        setEditingId(null);
        fetchRecords();
      } else {
        alert('No se pudo actualizar la ficha.');
      }
      return;
    }

    const { error } = await supabase.from('service_records').insert([
      {
        client_id: client.id,
        staff_id: form.staff_id || currentStaff.id,
        categoria_servicio: form.categoria_servicio,
        subtipo_servicio: form.subtipo_servicio,
        historial_observaciones: form.historial_observaciones,
      },
    ]);

    if (!error) {
      setForm((f) => ({ ...f, historial_observaciones: '' }));
      fetchRecords();
    } else {
      alert('No se pudo guardar la ficha.');
    }
  };

  const handleEdit = (rec) => {
    setEditingId(rec.id);
    setForm({
      categoria_servicio: rec.categoria_servicio,
      subtipo_servicio: rec.subtipo_servicio,
      historial_observaciones: rec.historial_observaciones || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
    const { error } = await supabase.from('service_records').delete().eq('id', id);
    if (!error) fetchRecords();
  };

  const puedeEditarRegistro = (rec) =>
    currentStaff.rol === 'admin' || currentStaff.rol === 'secretaria' || rec.staff_id === currentStaff.id;

  // Para borrar basta escribir "borrar" (sin importar mayúsculas, tildes ni espacios).
  const normaliza = (t) =>
    (t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const confirmacionOk = normaliza(confirmText) === 'borrar';

  // Guarda un dato de la clienta directamente desde la ficha.
  const guardarCampo = async (campo, valor) => {
    const { data, error } = await supabase
      .from('clients')
      .update({ [campo]: valor })
      .eq('id', client.id)
      .select()
      .single();
    if (error || !data) {
      alert('No se pudo guardar el cambio.');
      return false;
    }
    onClientUpdated?.(data);
    return true;
  };

  // Añade una nota rápida (con la fecha) al final del historial y observaciones de la clienta.
  const [notaRapida, setNotaRapida] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const anadirNota = async () => {
    const texto = notaRapida.trim();
    if (!texto) return;
    setGuardandoNota(true);
    const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const previo = (client.notas_generales || '').trim();
    const ok = await guardarCampo('notas_generales', `${previo ? previo + '\n' : ''}${hoy}: ${texto}`);
    setGuardandoNota(false);
    if (ok) setNotaRapida('');
  };

  const handleDeleteClient = async () => {
    if (!confirmacionOk) return;
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    setDeleting(false);
    if (!error) {
      onClientDeleted?.();
    } else {
      alert('No se pudo borrar la clienta.');
    }
  };

  return (
    <div>
      <div className="border-b pb-4 mb-4 flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-3">
          <h2 className="text-lg font-bold text-ink uppercase">{client.nombre}</h2>
          {client.flowww_id && <p className="text-xs text-gray-400 mb-2">Nº de clienta en Flowww: {client.flowww_id}</p>}
          <div className="space-y-1.5 mt-2">
            <CampoEditable
              etiqueta="Teléfono"
              valor={client.telefono}
              vacio="Sin teléfono"
              puedeEditar={puedeEditarClienta}
              onGuardar={(v) => guardarCampo('telefono', v.trim())}
            />
            <CampoEditable
              etiqueta="Alertas de salud"
              valor={client.alertas_salud}
              vacio="Ninguna registrada"
              multilinea
              colorValor="text-red-500 font-medium"
              puedeEditar={puedeEditarClienta}
              onGuardar={(v) => guardarCampo('alertas_salud', v.trim())}
            />
            <CampoEditable
              etiqueta="Profesional"
              valor={client.profesional_habitual_id || ''}
              vacio="Sin preferencia"
              opciones={[{ value: '', label: 'Sin preferencia' }, ...profesionales.map((p) => ({ value: p.id, label: p.nombre }))]}
              mostrar={() => (profesionalHabitual ? `⭐ ${profesionalHabitual}` : '')}
              colorValor="text-blush-600 font-medium"
              puedeEditar={puedeEditarClienta}
              onGuardar={(v) => guardarCampo('profesional_habitual_id', v || null)}
            />
            <CampoEditable
              etiqueta="Historial y observaciones"
              valor={client.notas_generales}
              vacio="Sin notas"
              multilinea
              puedeEditar={puedeEditarClienta}
              onGuardar={(v) => guardarCampo('notas_generales', v.trim())}
            />
          </div>

          {puedeEditarClienta && (
            <div className="mt-3 flex gap-2">
              <input
                value={notaRapida}
                onChange={(e) => setNotaRapida(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    anadirNota();
                  }
                }}
                placeholder="➕ Añadir información (se guarda con la fecha)…"
                className="flex-1 p-2 border rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={anadirNota}
                disabled={!notaRapida.trim() || guardandoNota}
                className="bg-brand-600 text-white text-xs font-semibold px-3 rounded-lg disabled:opacity-40"
              >
                {guardandoNota ? '...' : 'Añadir'}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {puedeEditarClienta && (
            <button
              onClick={() => setShowEditClient(true)}
              className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 whitespace-nowrap"
            >
              ✏️ Editar datos
            </button>
          )}
          {puedeBorrarClienta && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 whitespace-nowrap"
            >
              🗑️ Borrar clienta
            </button>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-red-600 mb-2">Borrar a {client.nombre}</h3>
            <p className="text-xs text-gray-500 mb-4">
              Esto borra <strong>todo su historial de servicios y asignaciones para siempre</strong>. No se puede deshacer.{' '}
              {records.length > 0 && <> Tiene <strong>{records.length}</strong> servicio{records.length > 1 ? 's' : ''} registrado{records.length > 1 ? 's' : ''}. </>}Para confirmar, escribe la palabra <strong>borrar</strong>.
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="borrar"
              className="w-full p-2 border rounded-lg text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText('');
                }}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={!confirmacionOk || deleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                {deleting ? 'Borrando...' : 'Borrar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditClient && (
        <EditClientModal
          client={client}
          onClose={() => setShowEditClient(false)}
          onUpdated={(updated) => {
            onClientUpdated?.(updated);
          }}
        />
      )}

      {puedeCargar && Object.keys(catalogo).length > 0 && (
        <form onSubmit={handleSave} className="space-y-4 bg-brand-50/60 p-4 rounded-xl border border-brand-100 mb-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-brand-700">
              {editingId ? 'Editando registro' : 'Nueva carga en talonario'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {necesitaElegirProfesional && !editingId && (
            <div>
              <label className="text-xs font-semibold block mb-1">PROFESIONAL QUE ATIENDE</label>
              <select
                value={form.staff_id}
                onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              >
                <option value="">Seleccionar...</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">CATEGORÍA SERVICIO</label>
              <select
                value={form.categoria_servicio}
                onChange={(e) => {
                  const cat = e.target.value;
                  setForm({ ...form, categoria_servicio: cat, subtipo_servicio: catalogo[cat][0] });
                }}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              >
                {Object.keys(catalogo).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">SERVICIO ESPECÍFICO</label>
              <select
                value={form.subtipo_servicio}
                onChange={(e) => setForm({ ...form, subtipo_servicio: e.target.value })}
                className="w-full p-2 border rounded-lg text-sm bg-white"
              >
                {(catalogo[form.categoria_servicio] || []).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">HISTORIAL Y OBSERVACIONES</label>
            <textarea
              rows="2"
              placeholder="Mapeo utilizado, reacciones, comentarios..."
              value={form.historial_observaciones}
              onChange={(e) => setForm({ ...form, historial_observaciones: e.target.value })}
              className="w-full p-2 border rounded-lg text-sm bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={necesitaElegirProfesional && !editingId && !form.staff_id}
            className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-brand-700 transition disabled:opacity-40"
          >
            {editingId ? 'Guardar cambios' : 'Guardar ficha'}
          </button>
        </form>
      )}

      <h3 className="font-semibold text-sm text-gray-700 mb-3">Historial de servicios anteriores</h3>
      <div className="space-y-3">
        {loading && <p className="text-xs text-gray-400">Cargando...</p>}
        {!loading && records.length === 0 && (
          <p className="text-xs text-gray-400">No hay registros previos para esta clienta.</p>
        )}
        {records.map((rec) => (
          <div key={rec.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
            <div className="flex justify-between font-semibold text-xs text-gray-500 mb-1">
              <span>{new Date(rec.fecha).toLocaleDateString('es-ES')}</span>
              <span className="text-brand-600">Atendió: {rec.staff?.nombre || '—'}</span>
            </div>
            <p className="font-bold text-ink">
              {rec.categoria_servicio}: <span className="font-normal">{rec.subtipo_servicio}</span>
            </p>
            {rec.historial_observaciones === 'Pendiente de cargar historial' ? (
              <p className="mt-2 text-xs bg-red-50 p-2 rounded border border-red-200 text-red-600 font-semibold">
                📝 Pendiente de cargar historial — usa "Editar" para completarlo
              </p>
            ) : (
              rec.historial_observaciones && (
                <p className="mt-2 text-xs bg-white p-2 rounded border border-gray-200 text-gray-700">
                  <strong>Observaciones:</strong> {rec.historial_observaciones}
                </p>
              )
            )}
            {puedeEditarRegistro(rec) && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => handleEdit(rec)}
                  className="text-xs text-brand-600 font-medium hover:underline"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(rec.id)}
                  className="text-xs text-red-500 font-medium hover:underline"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
