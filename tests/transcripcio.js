#!/usr/bin/env node
'use strict';
/*
 * Test de la capa determinista de transcripción (index.html) — datos 100% FICTICIOS.
 *
 * Cubre los 4 modos de fallo detectados el 15-jul-2026 en la transcripción IA:
 *  MODO 1 · corte a media frase: la IA devuelve la descripción truncada.
 *  MODO 2 · palabras partidas por guiones de fin de línea del PDF ("so- porte").
 *  MODO 3 · partidas solo con el título, sin descripción.
 *  MODO 4 · título y descripción divididos en dos partidas distintas.
 * Y las dos garantías de limpieza: cabeceras/pies de página repetidos fuera,
 * y líneas de medición ("Total partida", puntos de guía, filas de números) fuera del texto.
 *
 * Extrae las funciones reales de index.html igual que tests/regres.js.
 * Uso: node tests/transcripcio.js [ruta_a_index.html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

function extract(name) {
  const pats = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of pats) {
    const m = pat.exec(html);
    if (!m) continue;
    const open = html.slice(m.index).search(/[{[]/);
    if (open === -1) continue;
    const oc = html[m.index + open], cc = oc === '{' ? '}' : ']';
    let d = 0, i = m.index + open;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (ch === oc) d++;
      else if (ch === cc) { d--; if (d === 0) { i++; break; } }
    }
    if (html[i] === ';') i++;
    return html.slice(m.index, i);
  }
  throw new Error('funcion no encontrada en el HTML: ' + name);
}

const NAMES = ['_dehyphen', '_stripPageArtifacts', '_cleanLit', '_RE_FI', '_RE_MARCA', '_scanMarques', '_iniciAmbTitol', '_stripMeasureTail', '_locateRows', 'repairDescsFromSource', 'recoverSkippedParts'];
const capM = /const _REPAIR_CAP=\d+;/.exec(html);
if (!capM) throw new Error('_REPAIR_CAP no encontrado');
const sb = { console, isFinite, Math, parseFloat, Number, String, Array, Object, RegExp, IDIOMA: 'ca' };
vm.createContext(sb);
new vm.Script([capM[0]].concat(NAMES.map(extract)).join('\n'), { filename: 'transcripcio_engine.js' }).runInContext(sb);

let fail = 0;
const ck = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL'), msg); if (!cond) fail++; };

// --- fuente FICTICIA: 3 "páginas" como las produce la extracción PDF (una línea por página) ---
const HDR = 'PRESUPUESTO FICTICIO OBRA DE PRUEBA HOJA DE MEDICIONES ';
const FT = ' 1 de enero de 2026 Página ';
const pages = [
  HDR + '1 CAPITULO 1.- TRABAJOS DE PRUEBA 1.1.- Pintura de fachada M2 Aplicación de pintura elástica de color blanco, incluyendo la preparación del so- porte y dos manos de acabado con producto tipo PRE- MIUM XL. NOTA: Se considera únicamente la fachada principal del edificio de prueba. Zona delantera….120,00 M2 Zona trasera….. 80,00 M2 Total partida …………………. 200,00 M2' + FT + '1',
  HDR + '2 1.2.- Reparación de cornisa M2 Saneado de zonas sueltas con medios manuales hasta base firme. Reposición de volúmenes con mortero de reparación tipo GENERICO-R, siguiendo la geo- metría original. NOTA: Se considera una reparación del 10% de la superficie total. Cornisa delantera 1 12,00 0,40 4,80 1.3.- Impermeabilización de cubierta M2 Extendido de membrana líquida en dos capas sobre soporte limpio, incluyendo refuerzos en encuentros y prueba de estanqueidad final. Faldón principal….90,00 M2 Total partida …………………. 90,00 M2' + FT + '2',
  HDR + '3 1.4.- Limpieza general Ud Limpieza final de obra con retirada de restos a vertedero autorizado. Escalera B- Ejemplo….. 1 UD Total partida ………… 1 UD' + FT + '3',
];

// --- réplica exacta del final de la rama PDF de extractAmidament ---
const src = sb._dehyphen(sb._stripPageArtifacts(pages).filter(Boolean).join('\n'));

// MODO 2 · des-guionado
ck(src.includes('soporte') && !src.includes('so- porte'), 'MODO 2: "so- porte" -> "soporte"');
ck(src.includes('PREMIUM XL') && !src.includes('PRE- MIUM'), 'MODO 2: "PRE- MIUM" -> "PREMIUM" (continuación en mayúscula)');
ck(src.includes('geometría') && !src.includes('geo- metría'), 'MODO 2: "geo- metría" -> "geometría"');
ck(src.includes('B- Ejemplo'), 'MODO 2: "Escalera B- Ejemplo" NO se une (etiqueta de medición, no palabra partida)');
// limpieza de cabeceras/pies repetidos
ck(!src.includes('HOJA DE MEDICIONES'), 'cabecera repetida de página eliminada');
ck(!/Página \d/.test(src), 'pie de página repetido eliminado');

// --- filas como las devuelve la IA, una por modo de fallo ---
const rows = [
  { tipo: 'cap', desc: 'CAPITULO 1.- TRABAJOS DE PRUEBA' },
  // MODO 1: cortada a media frase
  { tipo: 'part', num: '1.1', desc: 'Pintura de fachada M2 Aplicación de pintura elástica de color blanco, incluyendo la preparación del', ut: 'M2', amid: 200, preu: 0 },
  // MODO 3: solo el título
  { tipo: 'part', num: '1.2', desc: 'Reparación de cornisa', ut: 'M2', amid: 4.8, preu: 0 },
  // MODO 4: título en una partida...
  { tipo: 'part', num: '1.3', desc: 'Impermeabilización de cubierta', ut: 'M2', amid: '', preu: 0 },
  // ...y su descripción en OTRA partida (sin precio ni medición propios)
  { tipo: 'part', num: '1.4', desc: 'Extendido de membrana líquida en dos capas sobre soporte limpio, incluyendo refuerzos en encuentros y prueba de estanqueidad final.', ut: '', amid: 90, preu: 0 },
  // partida completa y normal (ancla siguiente)
  { tipo: 'part', num: '1.5', desc: 'Limpieza general Ud Limpieza final de obra con retirada de restos a vertedero autorizado.', ut: 'Ud', amid: 1, preu: 0 },
  // desc inventada por la IA (no está en el documento) → debe avisar, nunca callar
  { tipo: 'part', num: '1.6', desc: 'Partida imaginaria que no existe en el documento original de prueba.', ut: 'pa', amid: 1, preu: 0 },
];
const avisos = [];
const nFix = sb.repairDescsFromSource(rows, src, avisos);
const parts = rows.filter(r => r.tipo === 'part');
console.log('reparadas:', nFix, '· partidas tras fusión:', parts.length);
console.log('avisos:', JSON.stringify(avisos, null, 1));

// MODO 1 · reconstrucción sin umbral de longitud
const p11 = parts[0];
ck(p11.desc.includes('NOTA: Se considera únicamente la fachada principal'), 'MODO 1: 1.1 recupera el texto completo hasta la NOTA');
ck(p11.desc.includes('soporte y dos manos'), 'MODO 1: 1.1 continúa donde la IA cortó, sin guiones');
// MODO 3 · título solo
const p12 = parts[1];
ck(p12.desc.includes('GENERICO-R') && p12.desc.includes('NOTA'), 'MODO 3: 1.2 (solo título) recupera descripción completa');
// MODO 4 · fusión de partida dividida
const p13 = parts[2];
ck(parts.length === 5, 'MODO 4: la fila-fragmento se ha fusionado (5 partidas, no 6)');
ck(p13.desc.includes('prueba de estanqueidad final'), 'MODO 4: 1.3 contiene la descripción que estaba en la fila separada');
ck(+p13.amid === 90, 'MODO 4: la medición de la fila fusionada se hereda (90)');
// limpieza: nada de mediciones dentro de las descripciones
for (const r of parts) {
  ck(!/Total partida|Zona delantera|Cornisa delantera \d|Faldón principal…|\.{3,}\s*\d/.test(r.desc), 'sin líneas de medición dentro: ' + r.num);
}
// ningún error silencioso: la desc no localizable genera aviso visible
ck(avisos.some(a => /sense literal|sin literal/.test(a)), 'aviso visible por la partida sin literal localizado');
ck(avisos.some(a => /fusionat|fusionado/.test(a)), 'aviso visible por la fusión de la partida dividida');
// nunca acortar: la partida completa 1.5 conserva su texto
ck(parts[3].desc.includes('vertedero autorizado'), '1.5 (completa) no se acorta');
// la partida imaginaria no se toca
ck(parts[4].desc === 'Partida imaginaria que no existe en el documento original de prueba.', '1.6 (inventada) queda intacta');

// --- MODO 5 (16-jul-2026) · título separado del cuerpo: la IA devuelve el CUERPO sin la primera línea ---
// El literal reconstruido debe EMPEZAR por la línea de título del documento (título incluido por construcción,
// anclando en el código de la propia partida), no solo completar el cuerpo hacia delante.
const rowsT = [
  { tipo: 'cap', desc: 'CAPITULO 1.- TRABAJOS DE PRUEBA' },
  { tipo: 'part', num: '1.1', desc: 'Aplicación de pintura elástica de color blanco, incluyendo la preparación del soporte y dos manos de acabado con producto tipo PREMIUM XL.', ut: 'M2', amid: 200, preu: 0 },
  { tipo: 'part', num: '1.2', desc: 'Saneado de zonas sueltas con medios manuales hasta base firme. Reposición de volúmenes con mortero de reparación tipo GENERICO-R, siguiendo la geometría original.', ut: 'M2', amid: 4.8, preu: 0 },
];
const avisosT = [];
const nFixT = sb.repairDescsFromSource(rowsT, src, avisosT);
console.log('MODO 5 · reparadas:', nFixT, '· avisos:', JSON.stringify(avisosT));
ck(rowsT[1].desc.startsWith('Pintura de fachada'), "MODO 5: 1.1 (cuerpo sin título) EMPIEZA por el título 'Pintura de fachada'");
ck(rowsT[1].desc.includes('NOTA: Se considera únicamente la fachada principal'), 'MODO 5: 1.1 conserva el cuerpo completo hasta la NOTA');
ck(rowsT[2].desc.startsWith('Reparación de cornisa'), "MODO 5: 1.2 (cuerpo sin título) EMPIEZA por el título 'Reparación de cornisa'");
ck(!/Total partida|Zona delantera|\.{3,}\s*\d/.test(rowsT[1].desc + rowsT[2].desc), 'MODO 5: sin líneas de medición dentro');

// --- GUARDIÁN DE PARTIDAS SALTADAS (16-jul-2026) · el motor devuelve MENOS partidas de las que hay en el documento ---
// (a) Fuente ficticia con 5 partidas, el motor solo devuelve 3 → las 2 ausentes se recuperan LITERALES del
//     documento, con medición 0 + flag PENDENT (nunca se inventa un importe) e insertadas en su posición.
const pagesG = [
  HDR + '1 CAPITULO 2.- REVESTIMIENTOS 2.1.- Picado de revoco en mal estado M2 Repicado de las zonas sueltas del revestimiento existente hasta llegar a base firme, con medios manuales. Zona norte….40,00 M2 Total partida …………………. 40,00 M2 2.2.- Enfoscado maestreado M2 Enfoscado de mortero de cal en dos capas sobre soporte previamente humedecido, acabado fratasado. Paño principal….35,00 M2 Total partida …………………. 35,00 M2' + FT + '1',
  HDR + '2 2.3.- Malla de refuerzo M2 Colocación de malla de fibra de vidrio embebida en la capa intermedia del enfoscado, con solapes mínimos de diez centímetros. Paño principal….35,00 M2 2.4.- Puente de unión Ud Aplicación de resina de adherencia en encuentros de materiales distintos, según indicaciones del fabricante. Encuentros varios….6,00 UD 2.5.- Pintura mineral M2 Aplicación de dos manos de pintura mineral al silicato sobre el enfoscado curado, color a definir por la dirección facultativa. Paño principal….35,00 M2 Total partida …………………. 35,00 M2' + FT + '2',
];
const srcG = sb._dehyphen(sb._stripPageArtifacts(pagesG).filter(Boolean).join('\n'));
const rowsG = [
  { tipo: 'cap', desc: 'CAPITULO 2.- REVESTIMIENTOS' },
  { tipo: 'part', num: '2.1', desc: 'Picado de revoco en mal estado M2 Repicado de las zonas sueltas del revestimiento existente hasta llegar a base firme, con medios manuales.', ut: 'M2', amid: 40, preu: 0 },
  { tipo: 'part', num: '2.2', desc: 'Enfoscado maestreado M2 Enfoscado de mortero de cal en dos capas sobre soporte previamente humedecido, acabado fratasado.', ut: 'M2', amid: 35, preu: 0 },
  { tipo: 'part', num: '2.5', desc: 'Pintura mineral M2 Aplicación de dos manos de pintura mineral al silicato sobre el enfoscado curado, color a definir por la dirección facultativa.', ut: 'M2', amid: 35, preu: 0 },
];
const avisosG = [];
const nRecG = sb.recoverSkippedParts(rowsG, srcG, avisosG);
console.log('GUARDIÁN (a) · recuperadas:', nRecG, '· avisos:', JSON.stringify(avisosG));
ck(nRecG === 2, 'GUARDIÁN a: fuente con 5 partidas, el motor devuelve 3 → recupera exactamente las 2 ausentes');
ck(rowsG.length === 6 && rowsG[3].num === '2.3' && rowsG[4].num === '2.4', 'GUARDIÁN a: 2.3 y 2.4 insertadas en su posición por numeración');
ck(rowsG[3].desc.startsWith('Malla de refuerzo') && rowsG[3].desc.includes('solapes mínimos de diez centímetros'), 'GUARDIÁN a: 2.3 recuperada con el literal del documento (título + cuerpo)');
ck(rowsG[4].desc.startsWith('Puente de unión') && rowsG[4].desc.includes('indicaciones del fabricante'), 'GUARDIÁN a: 2.4 recuperada con el literal del documento (título + cuerpo)');
ck(+rowsG[3].amid === 0 && /PENDENT|PENDIENTE/.test(rowsG[3].flag || ''), 'GUARDIÁN a: 2.3 sin medición clara → amid 0 + flag PENDENT (nunca inventa importes)');
ck(+rowsG[4].amid === 0 && /PENDENT|PENDIENTE/.test(rowsG[4].flag || ''), 'GUARDIÁN a: 2.4 sin medición clara → amid 0 + flag PENDENT');
ck(!/Total partida|Paño principal…|Encuentros varios…|\.{3,}\s*\d/.test(rowsG[3].desc + rowsG[4].desc), 'GUARDIÁN a: sin líneas de medición dentro de lo recuperado');
ck(avisosG.length === 1 && /recuperad/.test(avisosG[0]), 'GUARDIÁN a: aviso visible de partidas recuperadas (y solo ese)');

// (b) Salto de numeración que TAMBIÉN está en el documento (2.2→2.4 en el propio PDF) → NO se inventa nada,
//     solo se avisa de que la numeración viene así en el archivo.
const pagesS = [
  HDR + '1 CAPITULO 3.- VARIOS 3.1.- Andamio tubular Ud Montaje y desmontaje de andamio homologado para la ejecución de los trabajos descritos. Fachada completa….1,00 UD 3.2.- Gestión de residuos Ud Clasificación y transporte de los residuos generados a gestor autorizado según normativa vigente. Obra completa….1,00 UD 3.4.- Seguridad y salud Ud Medidas de seguridad colectivas e individuales durante toda la duración de la obra. Obra completa….1,00 UD' + FT + '1',
];
const srcS = sb._dehyphen(sb._stripPageArtifacts(pagesS).filter(Boolean).join('\n'));
const rowsS2 = [
  { tipo: 'cap', desc: 'CAPITULO 3.- VARIOS' },
  { tipo: 'part', num: '3.1', desc: 'Andamio tubular Ud Montaje y desmontaje de andamio homologado para la ejecución de los trabajos descritos.', ut: 'Ud', amid: 1, preu: 0 },
  { tipo: 'part', num: '3.2', desc: 'Gestión de residuos Ud Clasificación y transporte de los residuos generados a gestor autorizado según normativa vigente.', ut: 'Ud', amid: 1, preu: 0 },
  { tipo: 'part', num: '3.4', desc: 'Seguridad y salud Ud Medidas de seguridad colectivas e individuales durante toda la duración de la obra.', ut: 'Ud', amid: 1, preu: 0 },
];
const avisosS2 = [];
const nRecS2 = sb.recoverSkippedParts(rowsS2, srcS, avisosS2);
console.log('GUARDIÁN (b) · recuperadas:', nRecS2, '· avisos:', JSON.stringify(avisosS2));
ck(nRecS2 === 0 && rowsS2.length === 4, 'GUARDIÁN b: el 3.3 tampoco está en el documento → NO se inventa ninguna partida');
ck(avisosS2.some(a => /salta de 3\.2 a 3\.4/.test(a)), 'GUARDIÁN b: aviso visible de que la numeración del documento salta de 3.2 a 3.4');
ck(!avisosS2.some(a => /⚠/.test(a)), 'GUARDIÁN b: sin falsa alarma (la numeración viene así en el archivo, no falta nada)');

// (c) Cero recuperaciones espurias: sobre el caso principal ya reparado (todas las partidas presentes,
//     numeración del motor desplazada 1.4→1.5 incluida) el guardián no toca nada ni da falsa alarma.
const avisosMain = [];
const nRecMain = sb.recoverSkippedParts(rows, src, avisosMain);
console.log('GUARDIÁN (c) · recuperadas:', nRecMain, '· avisos:', JSON.stringify(avisosMain));
ck(nRecMain === 0, 'GUARDIÁN c: caso principal completo → 0 recuperaciones espurias');
ck(!avisosMain.some(a => /⚠/.test(a)), 'GUARDIÁN c: sin falsa alarma con la numeración desplazada del motor (1.4→1.5 cubierta por su fila)');

console.log(fail ? '\n== RESULTADO: ' + fail + ' FALLOS ==' : '\n== RESULTADO: TODO OK ==');
process.exit(fail ? 1 : 0);
