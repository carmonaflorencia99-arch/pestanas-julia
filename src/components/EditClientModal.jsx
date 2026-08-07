import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function EditClientModal({ client, onClose, onUpdated }) {
  const [nombre, setNombre] = useState(client.nombre || '');
  const [telefono, setTelefono] = useState(client.telefono || '');
  const [alertasSalud, setAlertasSalud] = useState(client.alertas_salud || '');
  const [profesionalHabitual, setProfesionalHabitual] = useState(client.profesional_habitual_id || '');
  const [profesionales, setProfesionales] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('staff')
      .select('id, nombre')
      .eq('rol', 'profesional')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => data && setProfesionales(data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('clients')
      .update({
        nombre,
        telefono,
        alertas_salud: alertasSalud,
        profesional_habitual_id: profesionalHabitual || null,
      })
      .eq('id', client.id)
      .select()
      .single();

    setSaving(false);
    if (!error && data) {
      onUpdated(data);
      onClose();
    } else {
      alert('No se pudo actualizar la clienta.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-ink mb-4">Editar datos de la clienta</h3>
        <p className="text-xs text-gray-400 mb-4">
          Esto actualiza su ficha (no crea un nuevo registro en el historial de servicios).
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1">NOMBRE</label>
            <input
              required
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">TELÉFONO</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">ALERTAS DE SALUD</label>
            <textarea
              rows="3"
              placeholder="Alergias, sensibilidades, contraindicaciones..."
              value={alertasSalud}
              onChange={(e) => setAlertasSalud(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">PROFESIONAL HABITUAL</label>
            <select
              value={profesionalHabitual}
              onChange={(e) => setProfesionalHabitual(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            >
              <option value="">Sin preferencia</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
