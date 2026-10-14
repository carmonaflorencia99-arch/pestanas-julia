// Detección automática del servicio a partir del historial de la clienta.

const quitarAcentos = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lee el texto del historial / mapeo y devuelve el tipo de extensión:
// 'mega' | 'volumen' | '2d' | 'clasicas' | null
export function inferirTipoExtension(texto) {
  const t = quitarAcentos(texto).toLowerCase();
  if (!t.trim()) return null;

  // Cada tipo tiene sus pistas; si el historial menciona varios tipos,
  // manda el que aparece primero en el texto.
  const reglas = [
    // 10D / mega → mega volumen
    ['mega', [/mega/, /(^|[^\d.])10\s?d(?![a-z])/]],
    // 3D / 4D / volumen → volumen
    ['volumen', [/volum/, /(^|[^\d.])[34]\s?d(?![a-z])/]],
    // 2D, o "V" con grosor 0.15 / 0.20 (V.015, V0.20, V 0.15 ...) → 2D
    ['2d', [/(^|[^\d.])2\s?d(?![a-z])/]],
    // mtc, bpc, bpd, 0.25 C / 0.25 D, matte c/d ... → clásicas
    ['clasicas', [/(^|[^a-z])(mt|bp)\s?[a-z](?![a-z])/, /(^|[^\d])0?\.25(?!\d)/, /(^|[^a-z])mat+e?\s?[cd](?![a-z])/]],
  ];

  const esV = t.match(/(^|[^a-z])v(?![a-z])/);
  const grosorV = /(^|[^\d])0?\.(0?15|20?)(?!\d)/.test(t);

  let mejor = null;
  let mejorPos = Infinity;
  const probar = (tipo, pos) => {
    if (pos >= 0 && pos < mejorPos) {
      mejor = tipo;
      mejorPos = pos;
    }
  };
  reglas.forEach(([tipo, res]) => res.forEach((re) => probar(tipo, t.search(re))));
  if (esV && grosorV) probar('2d', esV.index);
  return mejor;
}

// Clasifica un nombre de servicio del catálogo ("Reposición 2D" → '2d')
export function tipoDeSubtipo(subtipo) {
  const t = quitarAcentos(subtipo).toLowerCase();
  if (/mega/.test(t)) return 'mega';
  if (/volum/.test(t)) return 'volumen';
  if (/(^|[^\d])2\s?d(?![a-z])/.test(t)) return '2d';
  if (/clasic/.test(t)) return 'clasicas';
  return null;
}

const esReposicion = (subtipo) => /reposici/i.test(quitarAcentos(subtipo));

// Busca en el catálogo { categoria: [subtipos] } el servicio de extensiones
// que corresponde a un tipo. Si reposicion=true prefiere "Reposición ...".
export function buscarServicioExtension(catalogo, tipo, reposicion = true) {
  const candidatos = [];
  Object.keys(catalogo).forEach((cat) => {
    if (!/pesta/i.test(quitarAcentos(cat)) || !/extens/i.test(quitarAcentos(cat))) return;
    catalogo[cat].forEach((sub) => {
      if (tipoDeSubtipo(sub) === tipo) candidatos.push({ categoria_servicio: cat, subtipo_servicio: sub });
    });
  });
  if (candidatos.length === 0) return null;
  return (
    candidatos.find((c) => esReposicion(c.subtipo_servicio) === reposicion) || candidatos[0]
  );
}

// Dado el último servicio registrado de la clienta, devuelve el servicio
// que lo más probable es que venga a hacerse ahora (extensiones → reposición).
export function proximoServicioDesde(catalogo, categoria, subtipo) {
  const tipo = tipoDeSubtipo(subtipo);
  const esExtension = /pesta/i.test(quitarAcentos(categoria)) && /extens/i.test(quitarAcentos(categoria));
  if (esExtension && tipo) {
    const repo = (catalogo[categoria] || []).find(
      (s) => tipoDeSubtipo(s) === tipo && esReposicion(s)
    );
    if (repo) return { categoria_servicio: categoria, subtipo_servicio: repo };
  }
  return { categoria_servicio: categoria, subtipo_servicio: subtipo };
}

// ---------- Servicio según el último servicio que tenía en Flowww ----------

// Busca en el catálogo { categoria: [subtipos] } una categoría y subtipo por texto.
function buscarEnCatalogo(catalogo, catRe, subRes) {
  const cats = Object.keys(catalogo).filter((c) => catRe.test(quitarAcentos(c).toLowerCase()));
  for (const re of subRes) {
    for (const cat of cats) {
      const sub = catalogo[cat].find((s) => re.test(quitarAcentos(s).toLowerCase()));
      if (sub) return { categoria_servicio: cat, subtipo_servicio: sub };
    }
  }
  if (cats.length && subRes.length === 0) return { categoria_servicio: cats[0], subtipo_servicio: catalogo[cats[0]][0] };
  return null;
}

// "EXTENSIONES DE PESTAÑAS 2D (PRIMERA PUESTA)" → Reposición 2D del catálogo, etc.
export function servicioDesdeFlowww(catalogo, zona) {
  const t = quitarAcentos(zona).toLowerCase();
  if (!t.trim()) return null;

  if (/extensiones de pestanas/.test(t)) {
    let tipo = null;
    if (/mega/.test(t)) tipo = 'mega';
    else if (/volumen/.test(t)) tipo = 'volumen';
    else if (/(^|[^\d])2\s?d(?![a-z])/.test(t)) tipo = '2d';
    else if (/clasic/.test(t)) tipo = 'clasicas';
    return tipo ? buscarServicioExtension(catalogo, tipo, true) : null; // "mix" y otros: se deduce del historial
  }
  if (/lifting/.test(t)) return buscarEnCatalogo(catalogo, /lifting|cejas/, [/lifting de pestanas/, /lifting/]);
  if (/laminado/.test(t)) return buscarEnCatalogo(catalogo, /lifting|cejas/, [/laminado/]);
  if (/depilacion de cejas|depilacion y tinte de cejas/.test(t))
    return buscarEnCatalogo(catalogo, /lifting|cejas/, [/depilacion de cejas con hilo/, /depilacion de cejas/]);
  if (/belleza pies|pedicura/.test(t))
    return buscarEnCatalogo(catalogo, /pedicur/, [/semiperm/.test(t) ? /semiperm/ : /tradicion/, /pedicura/]);
  if (/acrygel|acrigel|unas nuevas|bano de gel|relleno/.test(t))
    return buscarEnCatalogo(catalogo, /manicur/, [/esculp|gel/]);
  if (/esmaltado|manicura/.test(t))
    return buscarEnCatalogo(catalogo, /manicur/, [/semiperm/.test(t) ? /semiperm/ : /tradicion/, /manicura/]);
  return null;
}

// ¿Es un servicio de extensiones de pestañas? (el único que exige historial/diseño)
export function esExtensionPestanas(categoria, subtipo) {
  const t = quitarAcentos(`${categoria || ''} ${subtipo || ''}`).toLowerCase();
  return t.includes('extens') && t.includes('pesta');
}

// Servicio de extensiones "nuevo" (no reposición) para una clienta que se hace extensiones por primera vez.
export function servicioPuestaNueva(catalogo) {
  const cat = Object.keys(catalogo).find(
    (c) => /extens/.test(quitarAcentos(c).toLowerCase()) && /pesta/.test(quitarAcentos(c).toLowerCase())
  );
  if (!cat || !catalogo[cat].length) return null;
  const sub = catalogo[cat].find((x) => !esReposicion(x)) || catalogo[cat][0];
  return { categoria_servicio: cat, subtipo_servicio: sub };
}

export const TEXTO_PUESTA_NUEVA = 'Puesta nueva';
