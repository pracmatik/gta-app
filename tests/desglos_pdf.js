#!/usr/bin/env node
'use strict';
/*
 * Guardià del DESGLOSSAMENT D'AMIDAMENT des del TEXT (PDF/Excel/Word) — 23/07/2026 · correu Yolanda/Marina.
 *
 * Per què: a l'amidament cada partida va seguida de les seves línies de mesura ("<lloc> <N> <dim> <parcial>") i del
 * total; el pipeline les col·lapsava al total i es perdia ON s'actua. Recuperació determinista amb DOBLE garantia:
 * (1) una línia només és de mesura si el producte dels seus números dona l'últim (el parcial); (2) el desglòs només
 * s'adjunta si la suma dels parcials == el total I concepte+amidament casen amb la partida. Si res no casa: S'OMET.
 * L'objectiu d'aquest guardià és que MAI s'atribueixi un desglòs a la partida equivocada. Dades sintètiques.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- estàtic ----
check('existeixen _amidamentBlocs i attachDesglosAmidament', h.includes('function _amidamentBlocs(') && h.includes('function attachDesglosAmidament('));
check('garantia 1: el producte HA de donar el parcial', /el producte HA de donar el parcial/.test(h));
check('garantia 2: només s\'adjunta si suma==total (mai atribueix malament)', /mai s'atribueix un desglòs a la partida equivocada/.test(h));
check('s\'aplica al camí no-BC3 a la ingesta', h.includes('attachDesglosAmidament(allRows,amidament)'));

// ---- funcional ----
function extractFn(name) {
  const s = h.indexOf('function ' + name + '(');
  if (s < 0) throw new Error('no trobo ' + name);
  let i = h.indexOf('{', s), d = 0;
  for (; i < h.length; i++) { if (h[i] === '{') d++; else if (h[i] === '}') { d--; if (d === 0) return h.slice(s, i + 1); } }
}
let blocs, attach;
try {
  const f = new Function('IDIOMA', extractFn('_amidamentBlocs') + '\n' + extractFn('attachDesglosAmidament') + '\nreturn {_amidamentBlocs, attachDesglosAmidament};')('ca');
  blocs = f._amidamentBlocs; attach = f.attachDesglosAmidament;
} catch (e) { check('compila les funcions', false); console.error('   ' + e.message); }

if (blocs && attach) {
  const SRC = [
    'DRF01001 m² Voladizos: Eliminación de enfoscado - Vertical',
    'Eliminación de enfoscado de cemento, sin deteriorar el soporte.',
    'Cantos de balcones 16 4,70 75,20',
    '75,200',
    'DUX04001 m² Voladizos: Demolición de pavimento',
    'Balcones 16 1,15 2,40 44,16',
    'Balconeras 16 2,40 0,50 19,20',
    '63,360',
    'XYZ99999 m² Partida con desglose que NO cuadra',
    'Zona rara 3 5,00 99,99',
    '50,000',
  ].join('\n');

  const bs = blocs(SRC);
  check('detecta 2 blocs vàlids (el 3r no quadra suma≠total → omès)', bs.length === 2);
  check('bloc multi-zona: Balcones + Balconeras', bs.some(b => b.zonas.length === 2 && b.zonas[0].lloc === 'Balcones' && b.zonas[1].lloc === 'Balconeras'));

  const rows = [
    { tipo: 'part', desc: 'Voladizos: Eliminación de enfoscado - Vertical', amid: 75.2 },
    { tipo: 'part', desc: 'Voladizos: Demolición de pavimento', amid: 63.36 },
    { tipo: 'part', desc: 'Partida con desglose que NO cuadra', amid: 50 },    // bloc omès → sense desglòs
    { tipo: 'part', desc: 'Voladizos: Demolición de pavimento', amid: 999 },    // MATEIX concepte, amidament DIFERENT → no s'ha d'emparellar
    { tipo: 'part', desc: 'Concepto totalmente distinto', amid: 75.2 },         // MATEIX total, concepte diferent → no s'ha d'emparellar
  ];
  const n = attach(rows, SRC);
  check('adjunta NOMÉS a les 2 que casen concepte+total', n === 2);
  check('partida 1 amb el seu desglòs (Cantos de balcones)', /\nAmidament: Cantos de balcones 16×4,7 = 75,2/.test(rows[0].desc));
  check('partida 2 amb Balcones · Balconeras', /Balcones 16×1,15×2,4 = 44,16 · Balconeras/.test(rows[1].desc));
  check('la que NO quadrava (suma≠total) queda SENSE desglòs', !/\n(Amidament|Medición):/.test(rows[2].desc));
  check('ANTI-error: mateix concepte + amidament diferent → NO s\'emparella', !/\n(Amidament|Medición):/.test(rows[3].desc));
  check('ANTI-error: mateix total + concepte diferent → NO s\'emparella', !/\n(Amidament|Medición):/.test(rows[4].desc));
  check('el total (amidament) no es toca mai', rows[0].amid === 75.2 && rows[1].amid === 63.36);
  // idempotent: una partida que ja porta desglòs (BC3) no es torna a tocar
  const ja = [{ tipo: 'part', desc: 'Voladizos: Eliminación de enfoscado - Vertical\nAmidament: X', amid: 75.2 }];
  attach(ja, SRC);
  check('no toca una partida que ja té desglòs (p.ex. BC3)', ja[0].desc === 'Voladizos: Eliminación de enfoscado - Vertical\nAmidament: X');
}

// ---- REGRESSIÓ 23/07 (bug detectat per l'auditoria): una partida amb codi SENSE unitat i amb GUIÓ ("CAT-01
//      Cata…") ha d'obrir bloc propi; si no, la seva mesura es colava a la partida de dalt ("Limpieza de fachada").
if (blocs && attach) {
  const SRC2 = [
    'RYP01001 m² Fachada: Limpieza de paramento de fachada',
    'Descripción de la limpieza de fachada.',
    'Fachada general 1 15,00 25,00 375,00',
    '375,000',
    'CAT-01 Cata en cajón interior de vivienda',   // codi amb guió i SENSE unitat
    'Descripción de la cata de inspección.',
    'Zona de cata 1 1,00',
    '1,000',
  ].join('\n');
  const rows2 = [
    { tipo: 'part', desc: 'Fachada: Limpieza de paramento de fachada', amid: 375 },
    { tipo: 'part', desc: 'Cata en cajón interior de vivienda', amid: 1 },
  ];
  attach(rows2, SRC2);
  const dLimp = (rows2[0].desc.match(/\n(?:Medición|Amidament): (.+)$/) || [])[1] || '';
  check('REGRESSIÓ · la limpieza de fachada NO s\'emporta la mesura de la cata', !/cata/i.test(dLimp));
  check('REGRESSIÓ · la limpieza té NOMÉS la seva zona (Fachada general = 375)', /Fachada general 1×15×25 = 375/.test(dLimp) && dLimp.indexOf('·') < 0);
  check('REGRESSIÓ · la cata (codi amb guió, sense unitat) obre bloc i rep la seva zona', /Zona de cata/.test(rows2[1].desc));
}

console.log(ko === 0 ? ('\n== DESGLÒS PDF/TEXT OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
