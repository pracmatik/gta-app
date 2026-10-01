#!/usr/bin/env node
'use strict';
/*
 * GUARDIÁN DE COHERENCIA DE isNoSuma / isNoSumaR — datos 100% ficticios.
 *
 * POR QUÉ EXISTE (17-jul-2026)
 * La regla "esta fila NO suma" (opción GTA, fila con estado, o descripción que
 * dice "no suma") está escrita CUATRO veces en la app:
 *    · isNoSuma   — bloque principal (pantalla)
 *    · isNoSuma   — módulo GTA_EXCEL   (exportador Excel)
 *    · isNoSumaR  — módulo GTA_PDF     (exportador PDF)
 *    · isNoSumaR  — módulo GTA_PDFM    (exportador PDF “molde”)
 *
 * La duplicación es DELIBERADA, no un descuido: los tres módulos son UMD
 * autocontenidos y el arnés los ejecuta cada uno en su propio sandbox aislado
 * (test_opcions.js no carga el bloque principal). Quitar una definición para
 * "unificar" produce ReferenceError y revienta los exportadores. NO UNIFICAR.
 *
 * El riesgo real es otro: que alguien cambie la regla en unas copias y no en
 * otras. Entonces pantalla, PDF, Excel y CSV dejarían de sumar lo mismo Y NADIE
 * SE ENTERARÍA: cuatro totales distintos del mismo presupuesto, sin un solo
 * error. Es exactamente la enfermedad que perseguimos: el fallo silencioso.
 *
 * QUÉ HACE: extrae las 4 definiciones del HTML, normaliza el nombre de la
 * función y el del parámetro, y exige que sigan siendo IDÉNTICAS —en texto y en
 * comportamiento sobre una tabla de casos—. Si divergen, falla y dice dónde.
 *
 * Uso: node tests/isnosuma_coherent.js [ruta_a_index.html]
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const ESPERADAS = 4; // pantalla + GTA_EXCEL + GTA_PDF + GTA_PDFM. Si cambia, que sea una decisión consciente.

let fail = 0;
const ck = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALLO ') + msg); if (!cond) fail++; };
const linea = (idx) => html.slice(0, idx).split('\n').length;

// --- Extracción: acepta `function isNoSuma(r){return ...;}` y `const isNoSuma=(x)=>...;`
const defs = [];
const RX = /(?:function\s+(isNoSumaR?)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+([\s\S]*?);?\s*\}|(?:const|let|var)\s+(isNoSumaR?)\s*=\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*([^\n]*?);?\s*$)/gm;
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
    { gta: 'opc' }, { estat: 'pendent' }, { desc: 'Partida que no suma' },
    { desc: 'NO   SUMA' }, { desc: 'partida normal' }, { gta: '', estat: '', desc: '' }, {},
  ];
  const fns = defs.map(d => ({ d, f: new Function(d.param, 'return ' + d.cos) }));
  for (const { d, f } of fns.slice(1)) {
    const diff = CASOS.filter((c, i) => !!f(c) !== !!fns[0].f(c)).length;
    ck(diff === 0, 'mismo veredicto en ' + CASOS.length + ' casos: ' + d.nom + '@' + d.ln
      + (diff ? ' → ' + diff + ' discrepancia(s) con ' + fns[0].d.nom + '@' + fns[0].d.ln : ''));
  }
}

console.log('\n== RESULTADO:', fail ? 'HAY FALLOS (' + fail + ')' : 'VERDE', '==');
process.exit(fail ? 1 : 0);
