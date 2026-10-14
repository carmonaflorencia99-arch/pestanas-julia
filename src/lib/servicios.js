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
