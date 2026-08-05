import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function NewClientModal({ currentStaff, onClose, onCreated }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [alertasSalud, setAlertasSalud] = useState('');
  const [profesionalHabitual, setProfesionalHabitual] = useState('');
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
      .insert([{
        nombre,
        telefono,
        alertas_salud: alertasSalud,
        profesional_habitual_id: profesionalHabitual || null,
        creado_por: currentStaff.id,
      }])
      .select()
      .single();

    setSaving(false);
    if (!error && data) {
      onCreated(data);
      onClose();
    } else {
      alert('No se pudo crear la clienta.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-800 mb-4">Nueva clienta</h3>
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
              rows="2"
              placeholder="Alergias, sensibilidades, contraindicaciones..."
              value={alertasSalud}
              onChange={(e) => setAlertasSalud(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">PROFESIONAL HABITUAL (opcional)</label>
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
              className="flex-1 bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
