// Catálogo de servicios: agrupa por categoría ignorando mayúsculas, tildes y espacios
// repetidos, para que "Cejas", "cejas " y "CEJAS" salgan siempre en un solo bloque.

const quitarAcentos = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const limpiar = (s) => (s || '').replace(/\s+/g, ' ').trim();

export const claveCategoria = (c) => quitarAcentos(limpiar(c)).toLowerCase();
const claveSub = (s) => quitarAcentos(limpiar(s)).toLowerCase();

// Orden de los bloques: pestañas primero, luego cejas, manicura, pedicura, etc.
const rango = (c) => {
  const k = claveCategoria(c);
  if (/extens/.test(k)) return 0;
  if (/lifting|ceja|pesta/.test(k)) return 1;
  if (/manicur|una/.test(k)) return 2;
  if (/pedicur/.test(k)) return 3;
  if (/depil/.test(k)) return 4;
  if (/micro/.test(k)) return 5;
  return 9;
};

// filas: [{ categoria, subtipo, orden, ... }] → [{ clave, nombre, filas, variantes }]
export function gruposDeCatalogo(filas) {
  const porClave = {};
  [...(filas || [])]
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .forEach((f) => {
      const k = claveCategoria(f.categoria);
      if (!k) return;
      if (!porClave[k]) porClave[k] = { clave: k, filas: [], conteo: {} };
      porClave[k].filas.push(f);
      const raw = limpiar(f.categoria);
      porClave[k].conteo[raw] = (porClave[k].conteo[raw] || 0) + 1;
    });

  return Object.values(porClave)
    .map((g) => {
      const variantes = Object.keys(g.conteo);
      // el nombre que se muestra es el que más se repite
      const nombre = variantes.sort((a, b) => g.conteo[b] - g.conteo[a])[0];
      return { clave: g.clave, nombre, filas: g.filas, variantes };
    })
    .sort((a, b) => rango(a.nombre) - rango(b.nombre) || a.nombre.localeCompare(b.nombre, 'es'));
}

// → { "Extensiones de pestañas": ["Clásicas", "2D", ...], "Manicura": [...] }
export function agruparCatalogo(filas) {
  const out = {};
  gruposDeCatalogo(filas).forEach((g) => {
    const vistos = new Set();
    out[g.nombre] = [];
    g.filas.forEach((f) => {
      const k = claveSub(f.subtipo);
      if (k && !vistos.has(k)) {
        vistos.add(k);
        out[g.nombre].push(limpiar(f.subtipo));
      }
    });
  });
  return out;
}
