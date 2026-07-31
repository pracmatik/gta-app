#!/usr/bin/env node
'use strict';
/*
 * Guardià de la TRANSCRIPCIÓ JSJ (25/07/2026 · P4 del consell — «Obra-AB»).
 *
 * Els dos fitxers reals que van fallar (fixtures congelades a fixtures_jsj/):
 *  - exec_1912: PDF escanejat — només la pàgina de condicions legals tenia text; la IA va tornar 1 capítol i
 *    0 partides i l'app va dir «Esborrany generat» amb l'editor buit. Cura: gate anti-escanejat + guàrdia
 *    post-IA (mai un esborrany sense CAP partida).
 *  - exec_1913: merge de PDFs amb 58 capçaleres «N ATxxxxxx ut Títol» (estil CYPE/arquitecte) que les famílies
 *    fixes _RE_MARCA/_RE_FI no cobreixen → structEnd es desbordava i les 60 partides van quedar d'UNA línia.
 *    Cura: àncores AUTOCALIBRADES per document (per paràmetre, mai mutant les const), localitzador per
 *    assignació fila↔bloc (immune al desordre del merge), recuperació per trams en ordre de DOCUMENT
 *    (mai duplicats) i títol separat del cos amb \n (majusculesTitols només toca el títol real).
 */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- estàtic: les peces existeixen i on toquen ----
check('gate anti-escanejat: cens de pàgines amb text al lector PDF', h.includes('window._lastTextPages=pageLines'));
check('gate anti-escanejat: doble condició (majoria buides + text ínfim)', h.includes('_buides.length>_np*0.5') && h.includes('amidament.length<200*_np'));
check('i18n ing_escanejat en ca i es', (h.match(/ing_escanejat:"/g) || []).length === 2);
check('i18n ing_cap_partida en ca i es', (h.match(/ing_cap_partida:"/g) || []).length === 2);
check('guàrdia post-IA: mai esborrany sense CAP partida', h.includes('if(!allRows.some(r=>r&&r.tipo==="part")){ toast(_scanAvis||t("ing_cap_partida"),true); return; }'));
check('la guàrdia va DESPRÉS de recoverSkippedParts i ABANS de capturar _draftIA',
  h.indexOf('recoverSkippedParts(allRows,amidament,allAvisos)') < h.indexOf('t("ing_cap_partida")') &&
  h.indexOf('t("ing_cap_partida")') < h.indexOf('const _draftIA=JSON.parse'));
check('àncores calibrades per PARÀMETRE (les const no es muten)', h.includes('function _calibraMarca(') && h.includes('const _RE_MARCA=[') && h.includes('const _RE_FI=['));
check('localitzador calibrat per assignació fila↔bloc', h.includes('function _locateRowsCal('));
check('recover per trams en ordre de DOCUMENT (mai duplicats)', h.includes('const ord=idxs.slice().sort((a,b)=>loc[a]-loc[b])'));

// ---- funcional: extreu les funcions reals del HTML ----
function extractFn(name) {
  const s = h.indexOf('function ' + name + '(');
  if (s < 0) throw new Error('no trobo ' + name);
  let i = h.indexOf('{', s), d = 0;
  for (; i < h.length; i++) { if (h[i] === '{') d++; else if (h[i] === '}') { d--; if (d === 0) return h.slice(s, i + 1); } }
  throw new Error('claus desbalancejades ' + name);
}
function extractArr(name) { const s = h.indexOf('const ' + name + '='); if (s < 0) throw new Error('no ' + name); const e = h.indexOf('\n];', s); return h.slice(s, e + 3); }
function extractLine(name) { const s = h.indexOf('const ' + name + '='); if (s < 0) throw new Error('no ' + name); return h.slice(s, h.indexOf(';', s) + 1); }
let api = null;
try {
  const code = [extractLine('_REPAIR_CAP'), extractArr('_RE_FI'), extractArr('_RE_MARCA'), extractLine('_UT_DOC'),
    extractFn('_dehyphen'), extractFn('_cleanLit'), extractFn('_stripMeasureTail'), extractFn('_locateRows'),
    extractFn('_locateRowsCal'), extractFn('_scanMarques'), extractFn('_calibraMarca'), extractFn('_iniciAmbTitol'),
    extractFn('_titolAmbSalt'), extractFn('_treuNumsSolts'), extractFn('repairDescsFromSource'), extractFn('recoverSkippedParts'),
    extractFn('estimateCoverage'), extractFn('majusculesTitols'), extractFn('_rangPagines')].join('\n');
  api = new Function('IDIOMA', code + '\nreturn {_cleanLit,_calibraMarca,_scanMarques,_locateRows,_locateRowsCal,repairDescsFromSource,recoverSkippedParts,estimateCoverage,majusculesTitols,_rangPagines};')('ca');
} catch (e) { check('compilen les funcions del motor', false); console.error('   ' + e.message); }

// CONFIDENCIALITAT (25/07): les fixtures són TEXT REAL del client i NO es publiquen al repo públic — la part
// funcional del test només corre en local (on ja s'ha verificat); al CI públic passen només els checks estàtics.
if (!fs.existsSync(path.join(__dirname, 'fixtures_jsj'))) {
  console.log(ko === 0 ? ('\n== TRANSCRIPCIÓ JSJ (només estàtic — fixtures privades absents) OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
  process.exit(ko ? 1 : 0);
}
const FIX = p => fs.readFileSync(path.join(__dirname, 'fixtures_jsj', p), 'utf8');

if (api) {
  // ================= exec_1913 (merge amb capçaleres CYPE) =================
  const src13 = FIX('exec_1913_amidament.txt');
  const rows = JSON.parse(FIX('exec_1913_rows_ia.json'));
  const S = api._cleanLit(src13);
  const cal = api._calibraMarca(S);
  check('1913: el patró del document es calibra (cal actiu)', !!cal);
  check('1913: el text es segmenta en 58 blocs (les 58 àncores reals)', cal && api._scanMarques(S, cal.marca).length === 58);
  check('1913: cobertura estimada = 58 (abans les capçaleres no comptaven i callava)', api.estimateCoverage(src13) === 58);

  const parts0 = rows.filter(r => r.tipo === 'part');
  check('1913: punt de partida real — 60 partides, CAP amb cos (totes d\'una línia)', parts0.length === 60 && parts0.every(p => !String(p.desc).includes('\n')));

  const avisos = [], nRows0 = rows.length;
  const fixed = api.repairDescsFromSource(rows, src13, avisos);
  const parts = rows.filter(r => r.tipo === 'part');
  const multi = parts.filter(p => String(p.desc).includes('\n')).length;
  check('1913: repair repon el cos de 51 partides (abans 0)', fixed === 51);
  check('1913: 51 partides multi-línia (títol\\ncos) — la majoria de les 60', multi === 51 && multi > 30);
  check('1913: cap fila absorbida per error (les 74 files segueixen)', rows.length === nRows0);
  // CERO fusions: cap desc no conté una ALTRA capçalera del patró a dins
  const reHdr = new RegExp('\\s\\d{1,3}\\s+[A-Z]{1,3}\\d{4,8}\\s+(?:m2|m|u|pa|ut|ud|ml|kg|h)\\s+[A-ZÀ-ÚÑÇ]');
  check('1913: CERO fusions (cap capçalera d\'una altra partida dins una desc)', parts.every(p => !reHdr.test(api._cleanLit(p.desc))));

  const rec = api.recoverSkippedParts(rows, src13, avisos);
  const partsFinal = rows.filter(r => r.tipo === 'part');
  check('1913: recover recupera EXACTAMENT els 7 blocs sense fila (51+7=58, cada bloc un sol cop)', rec === 7 && partsFinal.length === 67);
  const nous = partsFinal.filter(p => p.flag && /PENDENT/.test(p.flag) && /recuperada/.test(p.flag));
  check('1913: les recuperades mai inventen diners (amid 0 + flag PENDENT)', nous.length === 7 && nous.every(p => p.amid === 0 && !(+p.preu)));
  check('1913: les 9 files no verificables s\'avisen (mai en silenci)', avisos.some(a => /9 partida\/es sense literal/.test(a)));

  // honestedat de títol: majusculesTitols només toca el títol, el cos queda literal
  api.majusculesTitols(rows);
  const p0 = partsFinal.find(p => /^MONTAJE Y DESMONTAJE DE TORRE/.test(String(p.desc)));
  check('1913: títol en majúscules, cos literal en minúscules (fi de l\'amplificador)',
    !!p0 && /^MONTAJE Y DESMONTAJE DE TORRE MÓVIL DE ANDAMIO TUBULAR HOMOLOGADO\n/.test(p0.desc) && /con ruedas bloqueables/.test(p0.desc.split('\n').slice(1).join('\n')));
  const cosIntacte = partsFinal.filter(p => { const ls = String(p.desc).split('\n'); return ls.length > 1 && /[a-zà-ÿ]/.test(ls.slice(1).join(' ')); }).length;
  check('1913: el cos es preserva en minúscules a les 51+7 reconstruïdes', cosIntacte >= 51);

  // el calibratge no muta estat entre crides (res no es filtra d\'una pujada a la següent)
  const n1 = api._scanMarques(S, api._calibraMarca(S).marca).length;
  const n2 = api._scanMarques(S, api._calibraMarca(S).marca).length;
  check('calibratge sense estat compartit entre pujades (58 = 58)', n1 === 58 && n2 === 58);

  // ================= exec_1912 (PDF escanejat: només pàgina legal) =================
  const src12 = FIX('exec_1912_amidament.txt');
  const S12 = api._cleanLit(src12);
  check('1912: cap patró calibrable ni àncores fixes (text legal, no amidament)', api._calibraMarca(S12) === null && api._scanMarques(S12).length === 0);
  check('1912: cobertura estimada 0 (res que sembli una partida)', api.estimateCoverage(src12) === 0);
  const rows12 = [{ tipo: 'cap', desc: 'CONDICIONES GENERALES' }]; // el que va tornar la IA de debò: 1 cap, 0 partides
  const av12 = [];
  api.repairDescsFromSource(rows12, src12, av12);
  api.recoverSkippedParts(rows12, src12, av12);
  check('1912: el motor NO inventa cap partida del text legal', rows12.filter(r => r.tipo === 'part').length === 0);
  check('1912: amb [{tipo:cap}] la guàrdia post-IA bloquejaria (cap fila «part»)', !rows12.some(r => r && r.tipo === 'part'));
  check('rang de pàgines llegible per a l\'avís: [2..9,11] → «2–9, 11»', api._rangPagines([2, 3, 4, 5, 6, 7, 8, 9, 11]) === '2–9, 11');

  // ================= desordre (merge) sense patró calibrable: passa 2 del cursor =================
  const blocs = ['1 AT000001 m2 Bloc A titol llarg de prova per localitzar', 'Cos del bloc A amb text suficient per a un probe fiable de veritat.',
    '2 AT000002 m2 Bloc B titol llarg de prova per localitzar tambe', 'Cos del bloc B amb mes text suficient per a un altre probe fiable.',
    '3 AT000003 m2 Bloc C titol llarg diferent de prova per localitzar', 'Cos del bloc C amb encara mes text suficient per al probe fiable.'];
  const srcDes = [blocs[0], blocs[1], blocs[4], blocs[5], blocs[2], blocs[3]].join('\n'); // el merge desordena: A, C, B
  const rDes = [{ tipo: 'part', desc: 'Bloc A titol llarg de prova per localitzar' }, { tipo: 'part', desc: 'Bloc B titol llarg de prova per localitzar tambe' }, { tipo: 'part', desc: 'Bloc C titol llarg diferent de prova per localitzar' }];
  const SD = api._cleanLit(srcDes);
  const locD = api._locateRows(rDes, SD, SD.toLowerCase());
  check('desordre: la passa 2 rescata la fila que el cursor perdia (3/3 localitzades)', locD.every(x => x >= 0));

  // ================= títols repetits x8 REALS (regressió Obra-G): l\'ordre segueix manant =================
  let src8 = ''; for (let i = 0; i < 8; i++) src8 += (i + 1) + '.0' + (i + 1) + ' m2 Veladura silicats potassics aplicada sobre parament vertical\nMesura zona ' + (i + 1) + ' 12,00 3,00 36,00\n';
  const r8 = []; for (let i = 0; i < 8; i++) r8.push({ tipo: 'part', desc: 'Veladura silicats potassics aplicada sobre parament vertical' });
  const S8 = api._cleanLit(src8);
  const loc8 = api._locateRows(r8, S8, S8.toLowerCase());
  check('títols repetits x8: 8/8 localitzats i estrictament creixents (cap robatori)', loc8.every((x, i) => x >= 0 && (i === 0 || x > loc8[i - 1])));

  // ================= honestedat (ii): 0 àncores reconeixibles → mai el fals «no hi falta res» =================
  const srcNo = ['Primer parell de frases prou llargues per poder localitzar la primera partida sense cap codi davant, amb text normal de descripcio de feina de rehabilitacio.',
    'Segona frase tambe prou llarga per poder localitzar la segona partida, igualment sense cap codi ni unitat que faci de marca reconeixible.'].join('\n');
  const rNo = [{ tipo: 'part', num: '2.2', desc: 'Primer parell de frases prou llargues per poder localitzar la primera partida' },
    { tipo: 'part', num: '2.4', desc: 'Segona frase tambe prou llarga per poder localitzar la segona partida' }];
  const avNo = [];
  api.recoverSkippedParts(rNo, srcNo, avNo);
  check('0 àncores + salt 2.2→2.4: diu «NO es pot verificar contra el document»', avNo.some(a => /NO es pot verificar contra el document/.test(a)));
  check('0 àncores: MAI el fals «no hi falta res»', !avNo.some(a => /no hi falta res/.test(a)));
}

// ---- sintaxi: els 12 blocs <script> inline compilen amb node --check ----
{
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, blocks = []; while ((m = re.exec(h))) blocks.push(m[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gta-syn-'));
  let bad = 0;
  blocks.forEach((b, i) => {
    const f = path.join(tmp, 'b' + i + '.js');
    fs.writeFileSync(f, b);
    try { cp.execSync('node --check ' + JSON.stringify(f), { stdio: 'pipe' }); }
    catch (e) { bad++; console.error('   sintaxi X bloc ' + i + ': ' + String(e.stderr).slice(0, 200)); }
  });
  check('els ' + blocks.length + ' blocs <script> inline passen node --check', blocks.length === 12 && bad === 0);
}

console.log(ko === 0 ? ('\n== TRANSCRIPCIÓ JSJ OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
