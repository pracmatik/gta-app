#!/usr/bin/env node
'use strict';
/*
 * GUARDIÁN DE COHERENCIA DE isSenseCoef / isSenseCoefR — datos 100% ficticios.
 *
 * POR QUÉ EXISTE (17-jul-2026)
 * La regla "IMPREVISTOS / reserva de presupuesto SIN coeficiente regulador" (ratificada por
 * escrito por Marina el 17/07/2026, correo «Dues regles de criteri per confirmar»: una reserva
 * es un % o cantidad REAL del total de la obra, no admite plus de coeficiente) está escrita
 * CUATRO veces en la app, con el MISMO patrón deliberado que isNoSuma:
 *    · isSenseCoef  — bloque principal (pantalla + CSV)
 *    · isSenseCoef  — módulo GTA_EXCEL   (exportador Excel)
 *    · isSenseCoefR — módulo GTA_PDF     (exportador PDF)
 *    · isSenseCoefR — módulo GTA_PDFM    (exportador PDF “molde”)
 *
 * Los tres módulos son UMD autocontenidos y corren en sandboxes aislados: NO UNIFICAR
 * (produciría ReferenceError). El riesgo real es la divergencia silenciosa: cambiar el ancla
 * en unas copias y no en otras haría que pantalla, PDF, Excel y CSV dejaran de sumar lo mismo
 * SIN un solo error. Este guardián extrae las 4 definiciones, normaliza nombre y parámetro,
 * y exige que sigan siendo IDÉNTICAS en texto y en comportamiento.
 *
 * Uso: node tests/test_sensecoef_coherent.js [ruta_a_app_gta.html]
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = process.argv[2] || ['app_gta.html','index.html'].map(f=>path.join(__dirname,'..',f)).find(fs.existsSync) || path.join(__dirname,'..','index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const ESPERADAS = 4; // pantalla + GTA_EXCEL + GTA_PDF + GTA_PDFM. Si cambia, que sea una decisión consciente.

let fail = 0;
const ck = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALLO ') + msg); if (!cond) fail++; };
const linea = (idx) => html.slice(0, idx).split('\n').length;

// --- Extracción: acepta `function isSenseCoef(r){return ...;}` y `const isSenseCoef=(x)=>...;`
const defs = [];
const RX = /(?:function\s+(isSenseCoefR?)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+([\s\S]*?);?\s*\}|(?:const|let|var)\s+(isSenseCoefR?)\s*=\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([^\n]*?);?\s*$)/gm;
for (let m; (m = RX.exec(html));) {
  const nom = m[1] || m[4], param = m[2] || m[5];
  let cos = (m[3] !== undefined ? m[3] : m[6]).trim().replace(/;$/, '');
  if (/^\{/.test(cos)) cos = cos.replace(/^\{\s*return\s+/, '').replace(/;?\s*\}$/, ''); // arrow con cuerpo entre llaves
  defs.push({ nom, param, cos, ln: linea(m.index) });
}

// Si el extractor deja de ver las 4, el test NO puede quedarse verde: sería ciego.
ck(defs.length === ESPERADAS,
  'extraídas ' + defs.length + '/' + ESPERADAS + ' definiciones [' + defs.map(d => d.nom + '@' + d.ln).join(', ') + ']');

if (defs.length >= 2) {
  // --- 1) Idénticas en texto, una vez normalizados nombre y parámetro
  const norm = (d) => d.cos.replace(new RegExp('\\b' + d.param + '\\b', 'g'), 'A').replace(/\s+/g, '');
  const ref = defs[0];
  for (const d of defs.slice(1)) {
    ck(norm(d) === norm(ref),
      'misma lógica que ' + ref.nom + '@' + ref.ln + ': ' + d.nom + '@' + d.ln
      + (norm(d) === norm(ref) ? '' : '\n       esperado: ' + norm(ref) + '\n       obtenido: ' + norm(d)));
  }

  // --- 2) Idénticas en comportamiento (por si alguien reescribe una copia "equivalente" que no lo es)
  const CASOS = [
    { tipo: 'part', desc: 'IMPREVISTOS\n- Reserva de pressupost per imprevistos' },   // ancla por título → true
    { tipo: 'part', desc: 'RESERVA DE PRESUPUESTO' },                                  // castellano → true
    { tipo: 'part', desc: 'reserva de pressupost del 10%' },                           // minúsculas → true
    { tipo: 'part', desc: 'IMPREVISTOS', scoef: 'off' },                               // técnico la desancló → false
    { tipo: 'part', desc: 'Partida normal\nel cos parla de reserva de pressupost' },   // solo en el CUERPO → false
    { tipo: 'sub', desc: 'IMPREVISTOS' },                                              // no es partida → false
    { tipo: 'part', desc: 'ENDERROC DE COBERTA' },                                     // normal → false
    { tipo: 'part' }, {},                                                              // vacíos → false
  ];
  const fns = defs.map(d => ({ d, f: new Function(d.param, 'return ' + d.cos) }));
  // El ancla del bloque principal debe dar el veredicto esperado (true en los 3 primeros, false en el resto)
  const ESPERADO = [true, true, true, false, false, false, false, false, false];
  const mal = CASOS.filter((c, i) => !!fns[0].f(c) !== ESPERADO[i]).length;
  ck(mal === 0, 'ancla del bloque principal: veredicto esperado en ' + CASOS.length + ' casos ficticios'
    + (mal ? ' → ' + mal + ' caso(s) mal' : ''));
  for (const { d, f } of fns.slice(1)) {
    const diff = CASOS.filter((c) => !!f(c) !== !!fns[0].f(c)).length;
    ck(diff === 0, 'mismo veredicto en ' + CASOS.length + ' casos: ' + d.nom + '@' + d.ln
      + (diff ? ' → ' + diff + ' discrepancia(s) con ' + fns[0].d.nom + '@' + fns[0].d.ln : ''));
  }
}

console.log('\n== RESULTADO:', fail ? 'HAY FALLOS (' + fail + ')' : 'VERDE', '==');
process.exit(fail ? 1 : 0);
