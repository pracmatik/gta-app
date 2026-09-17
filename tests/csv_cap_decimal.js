#!/usr/bin/env node
'use strict';
/*
 * INTERRUPTOR DE NUMERACIÓ DE CAPÍTOL AL CSV DE LA INTRANET (25/07/2026).
 * La tècnica va preguntar el 24/07 si la intranet accepta capítols «1.1». Mentre GTA no ho confirmi,
 * el CSV surt amb enters correlatius (l'única forma acceptada per escrit). El canvi ja està fet i
 * PROVAT darrere de l'interruptor window.CSV_CAP_DECIMAL: s'encén en un minut, sense desenvolupar res.
 *
 * Aquest guardià comprova LES DUES posicions de l'interruptor amb les funcions REALS de l'app:
 *   OFF (per defecte) → capítol «1», «2»… (comportament d'avui, cap regressió)
 *   ON               → capítol «1.1», «3.2»… (el número del tècnic, com ja fan pantalla/Excel/PDF)
 * i que en tots dos casos el fitxer passa el candau csvIntranetCheck (cap cel·la buida, cap fila mal formada).
 *
 * Ús: node tests/test_csv_cap_decimal.js [ruta_html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML_PATH) { console.error('X no trobo app_gta.html'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

function extractFunction(src, name) {
  const patterns = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of patterns) {
    const m = pat.exec(src); if (!m) continue;
    const b = src.indexOf('{', m.index); if (b === -1) continue;
    let d = 0, i = b;
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
    let e = i; if (pat === patterns[1] && src[e] === ';') e++;
    return src.slice(m.index, e);
  }
  return null;
}
const FUNCS = ['num2', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef', 'rowGross', 'pctBase', 'pctBaseAt', 'rowTotal', 'comma', 'csvUnit', 'capNumOf', 'renumberRows', 'csvBuildLines', 'csvIntranetCheck'];

function build(decimal) {
  const sb = { console, isFinite, Math, parseFloat, parseInt, Number, String, Array, Object, JSON, RegExp, _COEF: 1.05, window: { CSV_CAP_DECIMAL: decimal } };
  vm.createContext(sb);
  const parts = ['function coef(){const c=parseFloat(_COEF);return isFinite(c)&&c>0?c:1;}'];
  for (const n of FUNCS) {
    const s = extractFunction(html, n);
    if (!s) { console.error('X funció no trobada al HTML: ' + n); process.exit(1); }
    parts.push(s);
  }
  new vm.Script(parts.join('\n'), { filename: 'csv.js' }).runInContext(sb);
  return sb;
}

// obra de prova: el tècnic escriu els seus números amb decimals, com fa a les obres reals
const ROWS = [
  { tipo: 'cap', desc: '1.1 ENDERROCS I TREBALLS PREVIS' },
  { tipo: 'part', desc: 'Repicat de revestiment', ut: 'm2', amid: 42.5, preu: 18.6 },
  { tipo: 'part', desc: 'Retirada de runa', ut: 'm3', amid: 6, preu: 44 },
  { tipo: 'cap', desc: '1.2 FAÇANA' },
  { tipo: 'part', desc: 'Arrebossat', ut: 'm2', amid: 120, preu: 26.4 },
  { tipo: 'cap', desc: '2. COBERTA' },
  { tipo: 'part', desc: 'Impermeabilització', ut: 'm2', amid: 30, preu: 41.2 },
];
const idsCap = (L) => L.map(l => l.split(';')).filter(c => c[0] && c[0] === c[1] && c[0] !== 'ID1').map(c => c[0]);
const idsPart = (L) => L.map(l => l.split(';')).filter(c => c[0] === '' && /^\d/.test(c[1] || '')).map(c => c[1]);

for (const decimal of [false, true]) {
  const sb = build(decimal);
  const rows = JSON.parse(JSON.stringify(ROWS));
  sb.renumberRows(rows);
  const L = sb.csvBuildLines(rows, 1.05, 'OBRA DE PROVA · NUMERACIÓ', 'G26.999   Prova', 'ca');
  const caps = idsCap(L), parts = idsPart(L);
  console.log('\n— interruptor ' + (decimal ? 'ENCÈS (número del tècnic)' : 'APAGAT (enters correlatius, com avui)') + ' —');
  console.log('  capítols al CSV: ' + caps.join(' / ') + '   ·   partides: ' + parts.join(' / '));
  if (!decimal) {
    check('OFF · els capítols surten com a enters (comportament actual, cap regressió)', caps.join(',') === '1,1,2');
  } else {
    check('ON · el capítol respecta el número del tècnic (1.1 / 1.2 / 2)', caps.join(',') === '1.1,1.2,2');
    check('ON · les partides queden penjades del seu capítol (1.1.1, 1.2.1, 2.1)', parts[0] === '1.1.1' && parts.includes('1.2.1') && parts.includes('2.1'));
  }
  // el candau de la intranet ha de passar en TOTS DOS casos: una sola fila mal formada rebutja el fitxer sencer
  let txt = L.slice();
  while (txt.length < 3997) txt.push(';;;;;;;');
  const probs = sb.csvIntranetCheck('﻿' + txt.join('\r\n') + '\r\n');
  check((decimal ? 'ON' : 'OFF') + ' · el fitxer passa el candau de la intranet (0 problemes)', probs.length === 0);
  check((decimal ? 'ON' : 'OFF') + ' · el subtotal de capítol porta el mateix número que el capítol',
    L.some(l => l.indexOf('SUBTOTAL CAPITOL ' + caps[0]) >= 0));
}

// 27/07/2026 · L'INTERRUPTOR JA VA ENCÈS, I AQUEST GUARDIÀ HO EXIGEIX.
// Va estar apagat des del 25/07 esperant una sola confirmació: que la intranet de GTA empassés el
// format «1.1». L'administració ho va provar amb els dos CSV que li vam enviar i ho va confirmar per escrit
// el 27/07 a les 13:30 («Respecte els dos CSV tot dos es carreguen be a la nostra intranet»), i el
// mateix dia se li va dir per correu que el deixàvem amb el format 1.1. Apagar-lo ara seria desdir-se
// d'una cosa promesa per escrit al client: si algú el torna a apagar, aquest guardià surt en vermell.
check('l\'interruptor va ENCÈS al codi desplegat (promès per correu a l\'administració el 27/07)', /window\.CSV_CAP_DECIMAL\s*=\s*true/.test(html));
check('l\'interruptor existeix i es llegeix al generador de CSV', /window\.CSV_CAP_DECIMAL===true/.test(html));

console.log(ko === 0 ? ('\n== CSV · NUMERACIÓ DE CAPÍTOL OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
