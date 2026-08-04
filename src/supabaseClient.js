import { createClient } from '@supabase/supabase-js';

// IMPORTANTE: estas variables se configuran en el hosting (Vercel/Netlify)
// como "Environment Variables", NUNCA se escriben aquí directamente.
// Deben empezar con VITE_ si usas Vite (que es lo que recomienda este proyecto).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
    'Revisa el archivo .env (desarrollo local) o la configuración de Environment Variables en tu hosting.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
