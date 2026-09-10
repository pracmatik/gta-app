#!/usr/bin/env node
'use strict';
/*
 * Test de la RECONCILIACIÓ PER CAPÍTOL i del total general (blindatge 17/07).
 * Dades 100% FICTÍCIES (cap dada real de client — aquest test pot viure en un repo públic).
 * Extreu les funcions REALS de app_gta.html (mateixa tècnica que regres.js) i comprova:
 *   - extractCapTotals: llegeix subtotals "TOTAL CAPITOL/CAPÍTULO X" en format PDF (€) i Excel aplanat (números pelats)
 *   - reconciliaCapitols: capítols que quadren → CAP avís; capítol que no quadra → avís visible + marca REVISAR (capAlert)
 *   - document sense subtotals impresos → no aplica (cap avís inventat)
 *   - i18n ca/es
 *   - extractDocTotal: camí Excel aplanat (línia forta sense "€") funciona; una línia "total partida" NO fabrica un fals total
 *
 * Ús: node tests/reconciliacio.js [ruta_a_index.html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('OK   ' + msg);
  else { fails++; console.log('FAIL ' + msg); }
}

// --- extracció de blocs <script> i funcions (idèntic criteri que regres.js) ---
function scriptBlocks(h) {
  const out = []; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(h))) { if (/\bsrc\s*=/.test(m[1])) continue; out.push(m[2]); }
  return out;
}
function extractFunction(src, name) {
  const pats = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of pats) {
    const m = pat.exec(src); if (!m) continue;
    const braceStart = src.indexOf('{', m.index); if (braceStart === -1) continue;
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    if (pat === pats[1] && src[i] === ';') i++;
    return src.slice(m.index, i);
  }
  return null;
}

const blocks = scriptBlocks(html);
const NEEDED = ['_parseImportCell', 'extractDocTotal', 'extractCapTotals', 'reconciliaCapitols', 'isNoSuma'];
const srcs = [];
for (const name of NEEDED) {
  let s = null;
  for (const b of blocks) { s = extractFunction(b, name); if (s) break; }
  if (!s) { console.log('FAIL no s\'ha trobat la funció ' + name + ' a ' + HTML_PATH); process.exit(1); }
  srcs.push(s);
}
const ctx = vm.createContext({});
// eur simplificat per al sandbox (només formata; la lògica sota prova no depèn del format exacte)
vm.runInContext('function eur(n){return (Math.round((+n||0)*100)/100).toFixed(2).replace(".",",")+" €";}', ctx);
vm.runInContext(srcs.join('\n'), ctx);
const F = name => vm.runInContext(name, ctx);
const extractDocTotal = F('extractDocTotal');
const extractCapTotals = F('extractCapTotals');
const reconciliaCapitols = F('reconciliaCapitols');

// ---------- DADES FICTÍCIES ----------
// Cas 1 · estil PDF amb € — tots els capítols QUADREN (cap avís)
const DOC_PDF_OK = [
  'PRESSUPOST DE REFORMA FICTÍCIA — CARRER INVENTAT 123',
  'CAPITOL 01 — TREBALLS PREVIS',
  '1.1 Partida fictícia u 10,00 100,00 1.000,00',
  '1.2 Una altra partida fictícia u 5,00 100,00 500,00',
  'TOTAL CAPITOL 01 .................... 1.500,00 €',
  'CAPITOL 02 — ACABATS',
  '2.1 Partida d\'acabat fictícia m2 20,00 50,00 1.000,00',
  'TOTAL CAPITOL 02 .................... 1.000,00 €',
  'TOTAL PRESSUPOST D\'EXECUCIÓ ......... 2.500,00 €',
].join('\n');
const ROWS_OK = [
  { tipo: 'cap', desc: '1. TREBALLS PREVIS' },
  { tipo: 'part', num: '1.1', desc: 'Partida fictícia', ut: 'u', amid: 10, preu: 100 },
  { tipo: 'part', num: '1.2', desc: 'Una altra partida fictícia', ut: 'u', amid: 5, preu: 100 },
  { tipo: 'cap', desc: '2. ACABATS' },
  { tipo: 'part', num: '2.1', desc: 'Partida d\'acabat fictícia', ut: 'm2', amid: 20, preu: 50 },
];

const capsOK = extractCapTotals(DOC_PDF_OK);
ok(capsOK && capsOK['1'] === 1500 && capsOK['2'] === 1000, 'extractCapTotals (PDF, €): llegeix els 2 subtotals de capítol');
ok(extractDocTotal(DOC_PDF_OK) === 2500, 'extractDocTotal (PDF, €): total general intacte (2.500,00)');
const avOK = reconciliaCapitols(JSON.parse(JSON.stringify(ROWS_OK)), DOC_PDF_OK, false);
ok(Array.isArray(avOK) && avOK.length === 0, 'capítols que QUADREN → cap avís (cap fals positiu)');

// Cas 2 · un capítol NO quadra (al document el capítol 2 imprimeix 2.000,00 € però la suma reconstruïda és 1.000)
const DOC_PDF_KO = DOC_PDF_OK.replace('TOTAL CAPITOL 02 .................... 1.000,00 €', 'TOTAL CAPITOL 02 .................... 2.000,00 €');
const rowsKO = JSON.parse(JSON.stringify(ROWS_OK));
const avKO = reconciliaCapitols(rowsKO, DOC_PDF_KO, false);
ok(avKO.length === 1, 'capítol que NO quadra → exactament 1 avís (mai en silenci)');
ok(avKO.length === 1 && /no quadra amb el subtotal del document/.test(avKO[0]), 'avís en català amb el text esperat');
ok(avKO.length === 1 && /2\b.*ACABATS|ACABATS/.test(avKO[0]), 'l\'avís identifica el capítol afectat');
ok(rowsKO[3].capAlert && /REVISAR/.test(rowsKO[3].capAlert), 'marca de REVISAR (capAlert) posada al capítol que no quadra');
ok(!rowsKO[0].capAlert, 'el capítol que quadra NO queda marcat');
ok(!rowsKO.some(r => r.tipo === 'part' && r.flag), 'cap flag de partida afegit (no bloqueja el gate del CSV)');
const avKOes = reconciliaCapitols(JSON.parse(JSON.stringify(ROWS_OK)), DOC_PDF_KO, true);
ok(avKOes.length === 1 && /no cuadra con el subtotal del documento/.test(avKOes[0]), 'i18n: avís en castellà amb ES=true');

// Cas 3 · camí EXCEL APLANAT (números pelats, sense €, columnes amb "|")
const DOC_XLS = [
  '### ZONA: Full1',
  'PRESSUPOST FICTICI OBRA INVENTADA',
  'CAPITOL 1 | TREBALLS PREVIS',
  '1.1 | Partida fictícia | u | 10 | 100 | 1000',
  '1.2 | Una altra partida fictícia | u | 5 | 100 | 500',
  'TOTAL CAPITOL 1 | 1500.00',
  'CAPITOL 2 | ACABATS',
  '2.1 | Partida d\'acabat fictícia | m2 | 20 | 50 | 1000',
  'TOTAL CAPITOL 2 | 2000.00',
  'TOTAL PRESSUPOST | 3000.00',
].join('\n');
const capsX = extractCapTotals(DOC_XLS);
ok(capsX && capsX['1'] === 1500 && capsX['2'] === 2000, 'extractCapTotals (Excel aplanat, sense €): llegeix els 2 subtotals');
ok(extractDocTotal(DOC_XLS) === 3000, 'extractDocTotal (Excel aplanat): total general en línia forta sense € → 3.000');
const rowsX = JSON.parse(JSON.stringify(ROWS_OK));
const avX = reconciliaCapitols(rowsX, DOC_XLS, false);
ok(avX.length === 1 && rowsX[3].capAlert, 'reconciliació al camí Excel: capítol 2 no quadra (1.000 vs 2.000) → avís + marca');

// Cas 4 · document SENSE subtotals impresos → no aplica (cap avís inventat)
const DOC_SENSE = ['PRESSUPOST FICTICI', '1.1 Partida fictícia u 10,00 100,00 1.000,00', 'TOTAL PRESSUPOST 1.000,00 €'].join('\n');
ok(extractCapTotals(DOC_SENSE) === null, 'document sense subtotals de capítol → extractCapTotals null');
ok(reconciliaCapitols(JSON.parse(JSON.stringify(ROWS_OK)), DOC_SENSE, false).length === 0, 'sense subtotals impresos → cap avís (no aplica)');

// Cas 5 · prudència del fallback sense €
ok(extractDocTotal('total partida | 100.00') === null, 'una línia "total partida" sense € NO fabrica un fals total general');
ok(extractCapTotals('TOTAL CAPITOL 1.2') === null, 'un "TOTAL CAPITOL 1.2" sense import (el codi no compta com a import) → cap subtotal inventat');
ok(extractCapTotals('TOTAL CAPITOLS 1.500,00 €') === null, '"TOTAL CAPITOLS" (total general) no es confon amb un subtotal de capítol');

// Cas 6 · prudència amb partides no jutjables: capítol amb una partida sense preu → NO es jutja (cap fals positiu)
const rowsSensePreu = JSON.parse(JSON.stringify(ROWS_OK));
rowsSensePreu[4].preu = 0; // el capítol 2 ja no es pot jutjar
const avSP = reconciliaCapitols(rowsSensePreu, DOC_PDF_KO, false);
ok(avSP.length === 0 && !rowsSensePreu[3].capAlert, 'capítol amb partida sense preu fiable → no es jutja (millor cap senyal que una d\'enganyosa)');

// Cas 7 · mateix codi imprès dues vegades amb imports DIFERENTS → ambigu, es descarta aquell codi
const DOC_DUP = [DOC_PDF_OK, 'TOTAL CAPITOL 02 .................... 9.999,99 €'].join('\n');
const capsDup = extractCapTotals(DOC_DUP);
ok(capsDup && capsDup['1'] === 1500 && !('2' in capsDup), 'codi de capítol repetit amb imports diferents → es descarta (cap fals positiu)');

console.log('');
if (fails) { console.log('RESULTADO: ' + fails + ' FAIL'); process.exit(1); }
console.log('RESULTADO: TODO OK');
