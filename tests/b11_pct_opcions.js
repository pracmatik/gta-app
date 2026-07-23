#!/usr/bin/env node
'use strict';
/*
 * Guardià B11 (resposta escrita de la tècnica, 21/07/2026):
 *   «El que fem és comptar el % amb la opció de A/B que tingui major cost.»
 *
 * Les opcions A/B són ALTERNATIVES: només se n'executa una. Fins al 21/07 la base de les partides
 * de % (GESTIÓ DE RESIDUS / SEGURETAT I SALUT / CONTROL DE QUALITAT) SUMAVA TOTES DUES opcions, com
 * si es fessin les dues → el % sortia inflat i el client pagava de més.
 *
 * Base correcta = partides comunes (sense marca d'opció) + UNA sola opció: la de MAJOR COST.
 * Coherent amb la regla que ella ja ens va donar el 16/07 i que ja és al codi: «un cop es separen
 * dues opcions han de ser sempre independents; la suma dels dos no serà mai correcta».
 *
 * PROPIETAT CRÍTICA (la que protegeix les 15 obres reals del corpus i les xifres impreses de
 * Valldaura 122): en un pressupost SENSE opcions el resultat ha de ser EXACTAMENT el d'abans.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const html = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---------- contracte de codi: les 4 còpies del motor ----------
const nUMD = (html.match(/B11: comunes \+ la opció A\/B més cara, mai la suma de les dues/g) || []).length;
check('les 3 còpies UMD (Excel/PDF/pdfmake) porten la base per opció', nUMD === 3);
const nGlob = (html.match(/les opcions A\/B són ALTERNATIVES → base = comunes \+ la MÉS CARA/g) || []).length;
check('les 3 bases globals pctB dels mòduls també', nGlob === 3);
check('l\'editor (pctBase) separa comunes i opcions', /function pctBase\(arr,c\)\{let b=0;const _o=\{\};/.test(html));
check('l\'editor (pctBaseAt) separa comunes i opcions', html.includes('let b=0;const _o={};for(let j=s;j<e;j++){const r=arr[j];if(r&&r.tipo==="part"&&!(+r.pct)&&!isNoSuma(r)){const _g=rowGross(arr,j,c);'));
check('es queda amb el MÀXIM, no amb la suma', (html.match(/for\(const k in _o\)if\(_o\[k\]>_m\)_m=_o\[k\]/g) || []).length >= 4);

// ---------- motor REAL extret del HTML ----------
function extract(name) {
  const pats = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of pats) {
    const m = pat.exec(html); if (!m) continue;
    const bs = html.indexOf('{', m.index); if (bs === -1) continue;
    let d = 0, i = bs;
    for (; i < html.length; i++) { const ch = html[i]; if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) { i++; break; } } }
    if (pat === pats[1] && html[i] === ';') i++;
    return html.slice(m.index, i);
  }
  throw new Error('no trobada: ' + name);
}
const sb = { console, isFinite, Math, parseFloat, Number, String, Array, Object, Set, _COEF: 1 };
vm.createContext(sb);
new vm.Script(['function coef(){return _COEF;}', extract('num2'), extract('subsOf'), extract('unitPrice'),
  extract('isNoSuma'), extract('isSenseCoef'), extract('rowGross'), extract('pctBase'), extract('pctBaseAt'),
  extract('rowTotal'), extract('computeTotal'), extract('totalPerOpcio'), extract('opcioLletres'),
  // rèplica de la fórmula ANTERIOR al 21/07 (base = suma de TOT), per provar que sense opcions no canvia res
  'function pctBaseVELLA(arr,c){let b=0;for(let i=0;i<arr.length;i++){const r=arr[i];if(r.tipo==="part"&&!(+r.pct)&&!isNoSuma(r))b+=rowGross(arr,i,c);}return num2(b);}'
].join('\n')).runInContext(sb);

// cas de referència: comunes 50.000 · opció A 100.000 (la cara) · opció B 80.000 · una partida de 1 %
const AB = [
  { tipo: 'sec', desc: 'BLOC' }, { tipo: 'cap', desc: 'CAP 1' },
  { tipo: 'part', num: '1.1', desc: 'BASTIDA (comuna)', ut: 'pa', amid: 1, preu: 50000 },
  { tipo: 'part', num: '1.2', desc: 'OPCIO A', ut: 'pa', amid: 1, preu: 100000, opcio: 'A' },
  { tipo: 'part', num: '1.3', desc: 'OPCIO B', ut: 'pa', amid: 1, preu: 80000, opcio: 'B' },
  { tipo: 'part', num: '1.4', desc: 'GESTIO DE RESIDUS', ut: 'pa', amid: 1, pct: 1 }];
check('detecta les dues opcions', sb.opcioLletres(AB).join('') === 'AB');
check('la base del % és comunes + la opció MÉS CARA (150.000), no la suma (230.000)', sb.pctBaseAt(AB, 5, 1) === 150000);
check('el 1 % val 1.500 € (abans en valia 2.300: 800 € de més)', sb.rowTotal(AB, 5, 1, 0) === 1500);
check('el total de la opció A quadra al cèntim (150.000 + 1.500)', sb.totalPerOpcio(AB, 'A') === 151500);
check('el total de la opció B porta el mateix % (criteri seu: es compta amb la més cara)', sb.totalPerOpcio(AB, 'B') === 131500);

// l'opció més cara pot ser la B: el criteri és el COST, no la lletra
const BA = JSON.parse(JSON.stringify(AB)); BA[3].preu = 60000; BA[4].preu = 90000; // ara mana la B
check('si la més cara és la B, la base és comunes + B (140.000)', sb.pctBaseAt(BA, 5, 1) === 140000);

// tres opcions
const ABC = JSON.parse(JSON.stringify(AB));
ABC.splice(5, 0, { tipo: 'part', num: '1.35', desc: 'OPCIO C', ut: 'pa', amid: 1, preu: 120000, opcio: 'C' });
check('amb tres opcions es queda amb la més cara (50.000 + 120.000)', sb.pctBaseAt(ABC, 6, 1) === 170000);

// diverses partides dins d'una mateixa opció: se sumen entre elles, i competeix el total de l'opció
const AA = [
  { tipo: 'part', desc: 'comuna', ut: 'pa', amid: 1, preu: 10000 },
  { tipo: 'part', desc: 'A1', ut: 'pa', amid: 1, preu: 30000, opcio: 'A' },
  { tipo: 'part', desc: 'A2', ut: 'pa', amid: 1, preu: 30000, opcio: 'A' },
  { tipo: 'part', desc: 'B1', ut: 'pa', amid: 1, preu: 50000, opcio: 'B' },
  { tipo: 'part', desc: 'RESIDUS', ut: 'pa', amid: 1, pct: 1 }];
check('dins d\'una opció les partides SÍ se sumen (A=60.000 guanya a B=50.000)', sb.pctBaseAt(AA, 4, 1) === 70000);

// ---------- PROPIETAT CRÍTICA: sense opcions, idèntic a abans ----------
const pctBaseVELLA = (arr, c) => sb.pctBaseVELLA(arr, c);
const SENSE = [
  { tipo: 'sec', desc: 'BLOC' }, { tipo: 'cap', desc: 'CAP' },
  { tipo: 'part', desc: 'p1', ut: 'm2', amid: 123.45, preu: 67.89 },
  { tipo: 'part', desc: 'p2', ut: 'ml', amid: 7.3, preu: 1234.56 },
  { tipo: 'part', desc: 'p3 no suma', ut: 'pa', amid: 1, preu: 999, gta: 'opc' },
  { tipo: 'part', desc: 'RESIDUS', ut: 'pa', amid: 1, pct: 2 }];
for (const c of [1, 1.15, 1.485]) {
  sb._COEF = c;
  check('sense opcions amb coef ' + c + ': base NOVA == base VELLA (' + sb.pctBase(SENSE, c).toFixed(2) + ')',
    sb.pctBase(SENSE, c) === pctBaseVELLA(SENSE, c));
  check('sense opcions amb coef ' + c + ': pctBaseAt NOVA == VELLA', sb.pctBaseAt(SENSE, 5, c) === pctBaseVELLA(SENSE, c));
}
sb._COEF = 1;

// una partida "no suma" marcada com a opció no ha d'entrar mai a la base
const NS = JSON.parse(JSON.stringify(AB)); NS[3].gta = 'opc'; // l'opció A passa a no sumar
check('una opció marcada NO SUMA no entra a la base (queda comunes + B = 130.000)', sb.pctBaseAt(NS, 5, 1) === 130000);

console.log(ko === 0 ? ('\n== B11 % AMB OPCIONS OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
