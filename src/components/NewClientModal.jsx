import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { enriquecerClientas, resumenClienta } from '../lib/clientInfo';

export default function NewClientModal({ currentStaff, onClose, onCreated }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [alergias, setAlergias] = useState('');
  const [profesionalHabitual, setProfesionalHabitual] = useState('');
  const [notasGenerales, setNotasGenerales] = useState('');
  const [profesionales, setProfesionales] = useState([]);
  const [saving, setSaving] = useState(false);
  const [coincidencias, setCoincidencias] = useState(null);

  useEffect(() => {
    supabase
      .from('staff')
      .select('id, nombre')
      .eq('rol', 'profesional')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => data && setProfesionales(data));
  }, []);

  const escapar = (s) => s.replace(/[%_\\]/g, '\\$&');

  const crear = async () => {
    setSaving(true);
    // Alta de clienta = solo datos base. No genera ningún registro de
    // servicio ni historial con fecha.
    const { data, error } = await supabase
      .from('clients')
      .insert([{
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        alertas_salud: alergias,
        profesional_habitual_id: profesionalHabitual || null,
        notas_generales: notasGenerales,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    // Ya vio las coincidencias y eligió "crear igual": exige teléfono.
    if (coincidencias && coincidencias.length > 0) {
      if (!telefono.trim()) return;
      await crear();
      return;
    }

    setSaving(true);
    const filtros = ['nombre.ilike.' + escapar(nombre.trim()).replace(/[,()]/g, ' ')];
    if (telefono.trim()) filtros.push('telefono.eq.' + telefono.trim().replace(/[,()]/g, ' '));
    const { data: similares } = await supabase
      .from('clients')
      .select('*')
      .or(filtros.join(','))
      .limit(8);
    setSaving(false);

    if (similares && similares.length > 0) {
      setCoincidencias(await enriquecerClientas(similares));
      return;
    }
    await crear();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-ink mb-1">Nueva clienta</h3>
        <p className="text-xs text-gray-400 mb-4">Solo sus datos básicos. El servicio se carga aparte cuando venga al salón.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1">NOMBRE</label>
            <input
              required
              autoFocus
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setCoincidencias(null);
              }}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">
              TELÉFONO{coincidencias && coincidencias.length > 0 ? ' (obligatorio)' : ''}
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">ALERGIAS</label>
            <textarea
              rows="2"
              placeholder="Alergias, sensibilidades, contraindicaciones..."
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">PROFESIONAL DE PREFERENCIA (si tiene)</label>
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
          <div>
            <label className="text-xs font-semibold block mb-1">HISTORIAL Y OBSERVACIONES</label>
            <textarea
              rows="3"
              placeholder="Notas generales de la clienta (no es un registro de visita)..."
              value={notasGenerales}
              onChange={(e) => setNotasGenerales(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          {coincidencias && coincidencias.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                Ya existe{coincidencias.length > 1 ? 'n' : ''} {coincidencias.length} clienta
                {coincidencias.length > 1 ? 's' : ''} parecida{coincidencias.length > 1 ? 's' : ''}:
              </p>
              {coincidencias.map((c) => (
                <div key={c.id} className="bg-white rounded-lg border border-amber-100 p-2">
                  <p className="text-sm font-semibold text-ink">{c.nombre}</p>
                  <p className="text-xs text-gray-500">{resumenClienta(c)}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onCreated(c);
                      onClose();
                    }}
                    className="text-xs text-brand-600 font-semibold mt-1 hover:underline"
                  >
                    Es ella → usar esta ficha
                  </button>
                </div>
              ))}
              <p className="text-xs text-amber-800">
                Si es otra persona, escribe su teléfono arriba y pulsa "Crear igual".
              </p>
            </div>
          )}
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
              disabled={saving || (coincidencias && coincidencias.length > 0 && !telefono.trim())}
              className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Guardando...' : coincidencias && coincidencias.length > 0 ? 'Crear igual' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
