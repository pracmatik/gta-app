#!/usr/bin/env node
'use strict';
/*
 * Guardià del DESGLOSSAMENT D'AMIDAMENT des del TEXT (PDF/Excel/Word) — 23/07/2026 · correu l'administració/la tècnica.
 *
 * Per què: a l'amidament cada partida va seguida de les seves línies de mesura ("<lloc> <N> <dim> <parcial>") i del
 * total; el pipeline les col·lapsava al total i es perdia ON s'actua. Recuperació determinista amb DOBLE garantia:
 * (1) una línia només és de mesura si el producte dels seus números dona l'últim (el parcial); (2) el desglòs només
 * s'adjunta si la suma dels parcials == el total I concepte+amidament casen amb la partida. Si res no casa: S'OMET.
 * L'objectiu d'aquest guardià és que MAI s'atribueixi un desglòs a la partida equivocada. Dades sintètiques.
 *
 * 24/09/2026 · el desglossament passa de text dins la partida a FILES sota la partida (lloc · unitat · quantitat, sense
 * preu), com als seus pressupostos a mà. Una sola línia de mesura no fa fila (com elles). Les garanties no canvien.
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
    { tipo: 'part', desc: 'Voladizos: Demolición de pavimento', amid: 63.36, ut: 'm²' },
    { tipo: 'part', desc: 'Partida con desglose que NO cuadra', amid: 50 },    // bloc omès → sense desglòs
    { tipo: 'part', desc: 'Voladizos: Demolición de pavimento', amid: 999 },    // MATEIX concepte, amidament DIFERENT → no s'ha d'emparellar
    { tipo: 'part', desc: 'Concepto totalmente distinto', amid: 75.2 },         // MATEIX total, concepte diferent → no s'ha d'emparellar
  ];
  // 24/09/2026 · EN FILES, COM ELLES (683 files de desglossament als seus 25 pressupostos a mà; una sola línia de mesura no en
  // fa: 939 partides sense i només 10 amb una). El que ha de seguir sent impossible: que un lloc vagi a la partida equivocada.
  rows[1].desc += '\nBalcones 16 1,15 2,40 44,16';               // la línia crua de mesura que s'havia colat al text
  const n = attach(rows, SRC);
  const fillsDe = (arr, i) => { const o = []; for (let j = i + 1; j < arr.length && (arr[j].tipo === 'sub' || arr[j].tipo === 'subv'); j++) o.push(arr[j]); return o; };
  const iP = t => rows.findIndex(r => r.tipo === 'part' && r.desc.split('\n')[0] === t && r.amid === (t === 'Voladizos: Demolición de pavimento' ? 63.36 : r.amid));
  const i2 = rows.findIndex(r => r.tipo === 'part' && r.amid === 63.36);
  const f2 = fillsDe(rows, i2);
  check('files NOMÉS a la que té 2 o més llocs i casa concepte+total', n === 1);
  check('partida 2: una fila per lloc (Balcones 44,16 · Balconeras 19,2), sense preu', f2.length === 2 && f2[0].tipo === 'subv' && f2[0].desc === 'Balcones' && f2[0].amid === 44.16 && f2[1].desc === 'Balconeras' && f2[1].amid === 19.2 && f2.every(x => x.preu === '' && x.desglos === true));
  check('la fila porta la unitat de la partida', f2.every(x => x.ut === 'm²'));
  check('la línia crua de mesura surt del text de la partida', rows[i2].desc.indexOf('44,16') < 0);
  check('una sola línia de mesura NO fa fila (com elles)', fillsDe(rows, rows.findIndex(r => r.amid === 75.2 && /Eliminación/.test(r.desc))).length === 0);
  check('ja no s\'escriu cap «Amidament:» dins del text', !rows.some(r => /\n(Amidament|Medición):/.test(r.desc || '')));
  const iNo = rows.findIndex(r => r.amid === 50), i999 = rows.findIndex(r => r.amid === 999), iAl = rows.findIndex(r => /totalmente distinto/.test(r.desc));
  check('la que NO quadrava (suma≠total) queda SENSE desglòs', fillsDe(rows, iNo).length === 0);
  check('ANTI-error: mateix concepte + amidament diferent → NO s\'emparella', fillsDe(rows, i999).length === 0);
  check('ANTI-error: mateix total + concepte diferent → NO s\'emparella', fillsDe(rows, iAl).length === 0);
  check('el total (amidament) no es toca mai', rows.find(r => /Eliminación/.test(r.desc)).amid === 75.2 && rows[i2].amid === 63.36);
  // idempotent: tornar-hi a passar no duplica res
  const abans = rows.length; attach(rows, SRC);
  check('idempotent: una segona passada no duplica les files', rows.length === abans);
  // una partida que ja porta el desglòs en text (esborrany antic o BC3 antic) no es toca
  const ja = [{ tipo: 'part', desc: 'Voladizos: Demolición de pavimento\nAmidament: X', amid: 63.36 }];
  attach(ja, SRC);
  check('no toca una partida que ja té desglòs (esborrany antic)', ja.length === 1 && ja[0].desc === 'Voladizos: Demolición de pavimento\nAmidament: X');
  // amb línies de càlcul («*», sumen) el desglossament va DARRERE: les de càlcul han d'anar enganxades a la partida
  const ambSub = [{ tipo: 'part', desc: 'Voladizos: Demolición de pavimento', amid: 63.36 }, { tipo: 'sub', desc: 'mà d\'obra', ut: 'h', amid: 2, preu: 30 }];
  attach(ambSub, SRC);
  check('amb línies de càlcul, les files van darrere (la de càlcul segueix enganxada)', ambSub.length === 4 && ambSub[1].tipo === 'sub' && ambSub[2].desglos && ambSub[3].desglos);
}

// ---- REGRESSIÓ 23/07 (bug detectat per l'auditoria): una partida amb codi SENSE unitat i amb GUIÓ ("CAT-01
//      Cata…") ha d'obrir bloc propi; si no, la seva mesura es colava a la partida de dalt ("Limpieza de fachada").
if (blocs && attach) {
  const SRC2 = [
    'RYP01001 m² Fachada: Limpieza de paramento de fachada',
    'Descripción de la limpieza de fachada.',
    'Fachada general 1 15,00 25,00 375,00',
    'Fachada posterior 1 10,00 10,00 100,00',
    '475,000',
    'CAT-01 Cata en cajón interior de vivienda',   // codi amb guió i SENSE unitat
    'Descripción de la cata de inspección.',
    'Cata cocina 1 1,00',
    'Cata baño 1 1,00',
    '2,000',
  ].join('\n');
  const rows2 = [
    { tipo: 'part', desc: 'Fachada: Limpieza de paramento de fachada', amid: 475, ut: 'm²' },
    { tipo: 'part', desc: 'Cata en cajón interior de vivienda', amid: 2, ut: 'ut' },
  ];
  attach(rows2, SRC2);
  const llocs = i => { const o = []; for (let j = i + 1; j < rows2.length && rows2[j].tipo === 'subv'; j++) o.push(rows2[j].desc); return o.join('|'); };
  const iL = rows2.findIndex(r => /Limpieza/.test(r.desc)), iC = rows2.findIndex(r => /^Cata en caj/.test(r.desc));
  check('REGRESSIÓ · la limpieza de fachada NO s\'emporta la mesura de la cata', !/cata/i.test(llocs(iL)));
  check('REGRESSIÓ · la limpieza té NOMÉS les seves zones (general + posterior)', llocs(iL) === 'Fachada general|Fachada posterior');
  check('REGRESSIÓ · la cata (codi amb guió, sense unitat) obre bloc i rep les seves', llocs(iC) === 'Cata cocina|Cata baño');
}

console.log(ko === 0 ? ('\n== DESGLÒS PDF/TEXT OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
