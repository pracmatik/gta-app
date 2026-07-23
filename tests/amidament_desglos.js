#!/usr/bin/env node
'use strict';
/*
 * Guardià del DESGLOSSAMENT D'AMIDAMENT per zona (22/07/2026 · correu Yolanda/Marina: el sistema "ja no copia el
 * desglossat de les partides on divideix l'amidament en els llocs on s'ha d'actuar").
 *
 * Per què: el BC3 porta, a cada registre ~M, les línies d'amidament (lloc + parcial); el lector només en guardava el
 * TOTAL i tirava el desglòs. Cura determinista: parsejar les línies (grups de 6 camps FIEBDC-3) i mostrar-les sota la
 * partida com a INFORMACIÓ — MAI toca l'amidament ni el total. Dades sintètiques (mai fitxers de client aquí).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- estàtic ----
check('existeix parseMesuraDetall', h.includes('function parseMesuraDetall('));
check('el parser de ~M omplena measureDetails', h.includes('measureDetails['));
check('mostra el desglòs sota la partida (etiqueta Amidament/Medición)', h.includes('"Amidament: "') && h.includes('"Medición: "'));
check('deixa clar que NO toca l\'amidament ni el total', /no toca mai l'amidament/.test(h));

// ---- funcional ----
function extractFn(name) {
  const s = h.indexOf('function ' + name + '(');
  if (s < 0) throw new Error('no trobo ' + name);
  let i = h.indexOf('{', s), d = 0;
  for (; i < h.length; i++) { if (h[i] === '{') d++; else if (h[i] === '}') { d--; if (d === 0) return h.slice(s, i + 1); } }
}
let pmd;
try { pmd = new Function(extractFn('parseMesuraDetall') + '\nreturn parseMesuraDetall;')(); }
catch (e) { check('compila parseMesuraDetall', false); console.error('   ' + e.message); }

if (pmd) {
  // 2 zones (com la partida real de balcons): total = 44,16 + 19,2 = 63,36
  const dos = pmd('\\Balcones\\16\\1.15\\2.4\\\\\\Balconeras\\16\\2.4\\0.5\\\\1\\\\\\\\\\\\');
  check('dues zones detectades', dos.length === 2 && dos[0].lloc === 'Balcones' && dos[1].lloc === 'Balconeras');
  check('parcial calculat bé (16×1,15×2,4 = 44,16)', dos[0].parcial === 44.16);
  check('la suma dels parcials = total real (63,36)', Math.round((dos[0].parcial + dos[1].parcial) * 100) / 100 === 63.36);

  // 1 zona amb N×L
  const una = pmd('\\Cantos de balcones\\16\\4.7\\\\\\1\\\\\\\\\\\\');
  check('una zona (16×4,7 = 75,2)', una.length === 1 && una[0].lloc === 'Cantos de balcones' && una[0].parcial === 75.2);

  // línia SENSE lloc anotat → s'omet (mai s'inventa)
  check('línia sense lloc → omesa', pmd('\\\\16\\4.7\\\\\\').length === 0);
  // línia amb lloc però sense cap número → omesa
  check('línia sense números → omesa', pmd('\\NomesText\\\\\\\\\\').length === 0);
  // buit → []
  check('buit → cap línia', pmd('').length === 0 && pmd(null).length === 0);
}

// ---- 23/07: el desglòs és INFORMATIU (pantalla/Excel/PDF) i NO ha d'anar al conversor de la intranet ----
check('BC3: el desglòs només s\'afegeix si reconcilia amb el total (deduccions/fórmules → omès)',
  /reduce\(\(a,d\)=>a\+d\.parcial,0\)/.test(h) && /reconcilia amb el total/.test(h));
const mCsv = h.match(/const csvTitol=s=>\{[\s\S]*?\};/);
check('csvTitol (títol per a la intranet) treu el desglòs', !!mCsv && /Medición\|Amidament/.test(mCsv[0]));
if (mCsv) {
  const csvTitol = new Function('return ' + mCsv[0].replace(/^const csvTitol=/, '').replace(/;\s*$/, ''))();
  check('FUNCIONAL · csvTitol treu la línia de desglòs abans d\'anar a la intranet',
    csvTitol('CONCEPTE\ncos llarg\nMedición: Balcones 16×1,15 = 18,4') === 'CONCEPTE\ncos llarg');
  check('FUNCIONAL · csvTitol NO toca un títol normal', csvTitol('Partida simple') === 'Partida simple');
  check('FUNCIONAL · csvTitol manté la cura del guió del títol (intranet)',
    csvTitol('DESMONTAJE-MONTAJE\ncos') === 'DESMONTAJE–MONTAJE\ncos');
}

console.log(ko === 0 ? ('\n== DESGLOSSAMENT AMIDAMENT OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
