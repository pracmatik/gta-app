#!/usr/bin/env node
'use strict';
/*
 * Guardià del CANDAU de paritat REAL (via exp. 1, troballa #7 de l'auditoria 18/07).
 * test_paritat_fitxers.js comprova que Excel/PDF quadren, però amb una CÒPIA local del parser de totals.
 * Aquest test extreu del HTML les funcions REALS del candau (_parMoney/_parTexts/_parTotals) — les mateixes
 * que decideixen si un fitxer surt o es bloqueja en producció — i les prova. Si algú les canvia i deixen de
 * llegir un total, aquí salta (no a producció amb el client davant).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML_PATH) { console.error('✗ No trobo app_gta.html ni index.html'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');

function extractFn(name) {
  for (const pat of [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')]) {
    const m = pat.exec(html); if (!m) continue;
    const braceStart = html.indexOf('{', m.index);
    let depth = 0, i = braceStart;
    for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
    let end = i; if (pat.source.startsWith('const') && html[end] === ';') end++;
    return html.slice(m.index, end);
  }
  throw new Error('funció del candau no trobada: ' + name);
}

// _PARITAT_LABEL és una const regex (sense claus) → s'extreu amb un match de línia, no amb l'extractor de blocs
const _labMatch = html.match(/const\s+_PARITAT_LABEL\s*=\s*(\/[^;]+\/[a-z]*)\s*;/);
if (!_labMatch) { console.error('✗ no trobo _PARITAT_LABEL al HTML'); process.exit(1); }
const ctx = { RegExp, String, parseFloat, Math, Array, isFinite, Number, Object };
vm.createContext(ctx);
vm.runInContext('const _PARITAT_LABEL=' + _labMatch[1] + ';\n' + extractFn('_parMoney') + '\n' + extractFn('_parTexts') + '\n' + extractFn('_parTotals') + '\nthis._pm=_parMoney;this._pt=_parTexts;this._pT=_parTotals;', ctx);

let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.error('  ✗ ' + n); } };

// _parMoney: format REAL de sortida (eur() amb useGrouping:true → SEMPRE separador de milers)
check('_parMoney 1.234.567,89', Math.abs(ctx._pm('1.234.567,89') - 1234567.89) < 0.001);
check('_parMoney 854.061,08 (obra real Valldaura)', Math.abs(ctx._pm('854.061,08') - 854061.08) < 0.001);
check('_parMoney import petit 999,99', Math.abs(ctx._pm('999,99') - 999.99) < 0.001);
check('_parMoney text sense import → null', ctx._pm('TOTAL PRESSUPOST') === null);

// _parTotals: troba el total darrere de l'etiqueta (mateixa línia o següents)
check('_parTotals mateixa línia', JSON.stringify(ctx._pT(['TOTAL PRESSUPOST 142.073,00 €'])) === JSON.stringify([142073.00]));
check('_parTotals línia següent', JSON.stringify(ctx._pT(['TOTAL PRESSUPOST', '', '142.073,00 €'])) === JSON.stringify([142073.00]));
check('_parTotals sense etiqueta → buit', ctx._pT(['Subtotal', '100,00 €']).length === 0);

// _parTexts: aplana l'estructura de pdfmake (text/content/table/stack/columns)
const dd = { content: [{ text: 'TOTAL PRESSUPOST' }, { table: { body: [[{ text: '142.073,00 €' }]] } }] };
const texts = ctx._pt(dd.content, []);
check('_parTexts aplana pdfmake', ctx._pT(texts).some(v => Math.abs(v - 142073.00) < 0.02));

// coherència de decisió: un total que NO quadra s'ha de veure diferent (la lògica de bloqueig viu a l'app;
// aquí garantim que l'EXTRACCIÓ que l'alimenta funciona amb els dos formats reals de sortida)
check('extracció != esperat quan divergeix', !ctx._pT(['TOTAL PRESSUPOST 999,99 €']).some(v => Math.abs(v - 142073.00) < 0.02));

console.log(ko === 0 ? `\n== CANDAU PARITAT OK — ${ok}/${ok + ko} ==` : `\n== CANDAU PARITAT FALLA — ${ko} ==`);
process.exit(ko === 0 ? 0 : 1);
