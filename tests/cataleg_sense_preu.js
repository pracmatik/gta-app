#!/usr/bin/env node
'use strict';
/*
 * Guardià «SI LA PARTIDA ÉS DEL SEU CATÀLEG, S'HA DE DIR» (31/07/2026).
 *
 * Criteri seu, escrit i repetit «molts cops» (C-005): «aquestes partides ni tenen preu ni tindran
 * mai preu perquè depèn de cada obra». Són 72 de les 283 fitxes del seu catàleg.
 *
 * Què passava: quan la partida de l'arquitecte era EXACTAMENT una d'aquestes, el cercador responia
 * 'cap' — que vol dir «no és al vostre catàleg». És fals, i el tècnic es quedava sense saber que la
 * partida SÍ que és seva i que l'únic que falta és posar-hi l'import d'aquesta obra.
 * Mesurat el 31/07 amb 12 fitxes seves reals enviades amb el seu propi text: 12 de 12 deien 'cap'.
 * Després del canvi: 18 de 18 (12 sense preu + 6 de control amb preu).
 *
 * Aquest guardià vigila la part de l'aplicació. Exigeix que:
 *   · existeixi la resposta 'sense_preu' i que digui QUINA fitxa del catàleg és,
 *   · la casella del preu es quedi BUIDA (mai un zero que sembli un preu),
 *   · i que l'aplicació segueixi entenent totes les respostes del cercador.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); if (extra) console.error('     ' + extra); } };

// ── 1 · la resposta nova existeix i es fa servir ──────────────────────────
const mBranch = h.match(/else if\(_p\.estado==="sense_preu"[\s\S]{0,700}?_np\+\+;\}/);
check('l\'aplicació entén que una partida pot ser del catàleg i no tenir preu', !!mBranch,
  'sense això, el cercador ho diu i l\'aplicació no ho ensenya: el tècnic no se n\'assabenta');
const branch = mBranch ? mBranch[0] : '';

// ── 2 · la casella del preu es queda BUIDA ────────────────────────────────
check('no s\'escriu cap preu en aquestes partides', !/r\.preu\s*=/.test(branch),
  'un zero o un preu inventat aquí és exactament el que ells van reclamar que no passés mai');
check('tampoc s\'hi enganxa el preu d\'una altra fitxa', !/cidPreu|origen="catalog"/.test(branch));

// ── 3 · l'avís diu QUINA fitxa del catàleg és ─────────────────────────────
check('l\'avís diu de quina fitxa del seu catàleg es tracta', /_p\.font/.test(branch),
  'sense el nom, el tècnic ha de buscar-la a mà: era la queixa del 31/07 sobre els preus «segurs»');
check('l\'avís està en els dos idiomes', /SIN PRECIO EN VUESTRO CATÁLOGO/.test(branch) && /SENSE PREU AL VOSTRE CATÀLEG/.test(branch));
check('l\'avís diu clarament que el preu el posen ells', /lo ponéis vosotros/.test(branch) && /l'hi poseu vosaltres/.test(branch),
  'no és un error del programa ni una dada que falti: és el seu criteri');
check('l\'avís NO afirma que la fitxa sigui aquesta: demana que ho confirmin',
  /confirmad que es esta/.test(branch) && /confirmeu que és aquesta/.test(branch),
  'mesurat 31/07 amb el seu fitxer real: 2 de 5 casaven amb una fitxa que no era. Afirmar-ho seria el mateix error que ens van reclamar aquest matí amb els preus «segurs»');
const missatge = (branch.match(/r\.flag=\(([\s\S]*?)\)\+\(_f0/) || [, ''])[1];
check('el text que llegeix el tècnic no ho presenta com una cosa que falla',
  !!missatge && !/PENDENT|PENDIENTE|ERROR|FALTA|NO SE HA|NO S'HA/i.test(missatge),
  'C-005: «el sistema debe aceptarlo como normal, no como dato que falta»');

// ── 4 · surten al resum de la lectura ─────────────────────────────────────
check('es compten a part i surten al resum', /_np=0/.test(h) && /_np\|\|/.test(h) && /allAvisos\.push/.test(h) && /sense preu \(l'hi poseu vosaltres\)/.test(h));

// ── 5 · la fitxa és seva però al catàleg hi és amb una ALTRA unitat (31/07) ──
const mUt = h.match(/else if\(_p\.estado==="altra_unitat"[\s\S]{0,800}?_nu\+\+;\}/);
check('l\'aplicació diu quan la fitxa és seva però amb una altra unitat', !!mUt,
  'mesurat amb un pressupost seu real: una fitxa del catàleg que va per metre lineal no es trobava perquè l\'amidament venia en metres quadrats, i la partida es quedava muda');
const brUt = mUt ? mUt[0] : '';
check('en aquest cas TAMPOC s\'escriu cap preu', !/r\.preu\s*=/.test(brUt),
  'un preu per metre lineal posat sobre metres quadrats és un error de diners');
check('es diuen les DUES unitats: la seva i la de l\'amidament', /_p\.unitat/.test(brUt) && /r\.ut/.test(brUt));
check('i es nomena la fitxa del seu catàleg', /_p\.font/.test(brUt));
check('en els dos idiomes', /ESTÁ EN VUESTRO CATÁLOGO PERO EN /.test(brUt) && /ÉS AL VOSTRE CATÀLEG PERÒ EN /.test(brUt));
check('surten al resum, comptades a part', /_nu=0/.test(h) && /\|\|_nu\)allAvisos\.push/.test(h));

// ── 6 · l'aplicació entén TOTES les respostes del cercador ────────────────
for (const est of ['segur', 'dubte', 'composta', 'sense_preu', 'altra_unitat'])
  check('sap què fer quan el cercador diu «' + est + '»', new RegExp('_p\\.estado==="' + est + '"').test(h),
    'si el cercador respon una cosa que l\'aplicació no mira, la partida es queda igual i ningú se n\'assabenta');

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
