#!/usr/bin/env node
'use strict';
/*
 * Guardià (auditoria del codi antic, 19/07/2026):
 *  · sanitizeRows: un amidament/preu que arriba com a TEXT es-ES ("21,58") NO es pot truncar a 21 en silenci.
 *  · extractDocTotal / reMoney: un total SENSE separador de milers ("12345,67 €") NO pot casar el sufix ("345,67").
 * Extreu les funcions REALS de l'HTML de producció i les prova amb dades sintètiques.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('✗ no trobo index.html'); process.exit(1); }
const html = fs.readFileSync(HTML, 'utf8');

function extractFn(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(html);
  if (!m) throw new Error('no trobo la funció ' + name);
  const braceStart = html.indexOf('{', m.index);
  let depth = 0, i = braceStart;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
  return html.slice(m.index, i);
}

const ctx = { String, parseFloat, isFinite, Number, Math, Array, RegExp, IDIOMA: 'ca', num2: x => Math.round(x * 100) / 100 };
vm.createContext(ctx);
vm.runInContext(
  extractFn('sanitizeRows') + '\n' +
  extractFn('_parseImportCell') + '\n' +
  extractFn('extractDocTotal') + '\n' +
  'this._san=sanitizeRows; this._doc=extractDocTotal;', ctx);

let ok = 0, ko = 0;
const near = (a, b) => Math.abs(a - b) < 0.001;
const check = (n, c) => { if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.error('  ✗ ' + n); } };

const san = rows => ctx._san(rows);
const one = (amid, preu) => { const o = san([{ tipo: 'part', desc: 'X', ut: 'm²', amid, preu }]); return o && o[0]; };

check("amid '21,58' (text) -> 21.58, no 21", near(one('21,58', 30).amid, 21.58));
check("amid '1.234,56' (text, milers) -> 1234.56", near(one('1.234,56', 30).amid, 1234.56));
check("amid 21.58 (NÚMERO) -> intacte 21.58", near(one(21.58, 30).amid, 21.58));
check("amid '500.250,75' (milers grans) -> 500250.75", near(one('500.250,75', 1).amid, 500250.75));
check("preu '129,01' (text) -> 129.01, no 129", near(one(5, '129,01').preu, 129.01));
check("preu 129.01 (NÚMERO) -> intacte", near(one(5, 129.01).preu, 129.01));
check("preu text no numèric ('Pendent') -> sense preu (fallback intacte)", one(5, 'Pendent de valorar').preu === '');
check("amid buit -> queda '' (sense mesura)", one('', 30).amid === '');

const doc = t => ctx._doc(t);
check("total FORT '12345,67 €' -> recupera 12345.67 (fallback), MAI el sufix 345,67", near(doc('TOTAL PRESSUPOST 12345,67 €'), 12345.67));
check("total FEBLE '12345,67 €' -> null (cap alarma), MAI 345,67", doc('TOTAL 12345,67 €') !== 345.67 && !near(doc('TOTAL 12345,67 €') || 0, 345.67));
check("total canònic '12.345,67 €' -> 12345.67", near(doc('TOTAL PRESSUPOST 12.345,67 €'), 12345.67));
check("total '500.250,75 €' -> 500250.75", near(doc('TOTAL PRESSUPOST: 500.250,75 €'), 500250.75));
check("total amb milers per espai '12 345,67 €' -> 12345.67", near(doc('TOTAL PRESUPUESTO 12 345,67 €'), 12345.67));
check("import '842,50 €' -> 842.50 (4 xifres, cap sufix possible)", near(doc('TOTAL 842,50 €'), 842.50));

console.log(ko === 0 ? `\n== es-ES NÚMEROS/TOTALS OK — ${ok}/${ok + ko} ==` : `\n== FALLA — ${ko} de ${ok + ko} ==`);
process.exit(ko === 0 ? 0 : 1);
