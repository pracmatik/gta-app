#!/usr/bin/env node
'use strict';
/*
 * Guardià del CERCADOR DE PREUS (31/07/2026 · correu de la tècnica del 31/07 sobre un pressupost seu).
 *
 * Dues coses que ella va destapar el mateix dia:
 *
 * 1) PREU DUBTÓS. «Moltes tenen avisos de preus a revisar però algunes SÍ que tenen el preu correcte a
 *    l'avís i no ha arribat a posar-lo al preu unitari. En cas de preu dubtós preferim que SÍ que ho posi
 *    a preu unitari deixant l'avís de revisar, sinó al final no s'atrevirà a posar cap preu.»
 *    Abans: el preu es quedava dins del TEXT de l'avís i la casella arribava buida.
 *    Ara: s'escriu a la casella I es queda l'avís.
 *
 * 2) SALTS SILENCIOSOS. «El programa NOMÉS HA INTENTAT valorar 6 partides de 23.» El cercador es saltava
 *    partides sense dir-ho. Els salts tenen motiu, però s'han de DIR (regla de la casa: cap error silenciós).
 *
 * Guardià de CODI (el cercador viu dins del gestor del botó de pujada, no és una funció aïllada que es
 * pugui cridar des d'aquí). Comprova la conducta escrita a la font, i cau si algú la desfà.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- 1 · la branca del preu dubtós -----------------------------------------
const mDub = h.match(/else if\(_p\.estado==="dubte"[^\n]*/);
check('existeix la branca del preu dubtós', !!mDub);
if (mDub) {
  const branca = mDub[0];
  check('1 · el preu dubtós S\'ESCRIU a la casella del preu unitari', /r\.preu\s*=\s*\+_p\.preu/.test(branca));
  check('1 · l\'avís de revisar NO desapareix', /r\.flag\s*=/.test(branca));
  check('1 · l\'avís diu que el preu ja hi és posat', /ya puesto|ja posat/.test(branca));
  check('1 · queda lligat al catàleg (origen i referència)', /r\.origen\s*=\s*"catalog"/.test(branca) && /_p\.cid/.test(branca));
}

// --- 2 · els salts es compten i es diuen -----------------------------------
const mBlk = h.match(/\/\/ A7 · casador de preus[\s\S]{0,4200}?\n\s*if\(_cand\.length>150\)/);
check('existeix el bloc del cercador de preus', !!mBlk);
if (mBlk) {
  const blk = mBlk[0];
  check('2 · es compten les partides saltades per desglòs', /_saltades\.desglos\+\+/.test(blk));
  check('2 · es compten les saltades sense unitat o sense text', /_saltades\.sensedada\+\+/.test(blk));
  check('2 · es compten les saltades per avís propi', /_saltades\.avis\+\+/.test(blk));
  check('2 · es compta el total de partides del pressupost', /_totalPart\+\+/.test(blk));
  check('2 · el resultat SURT com a avís al tècnic (no es queda dins)', /allAvisos\.push\([\s\S]{0,400}intentat valorar|allAvisos\.push\([\s\S]{0,400}intentado valorar/.test(blk));
  check('2 · l\'avís diu quantes de quantes', /_cand\.length\+[\s\S]{0,120}_totalPart/.test(blk));
  check('2 · l\'avís diu el MOTIU de cada salt', /_m\.join/.test(blk));
  // cap salt sense comptar: tots els `continue` del bucle han d'anar precedits d'un comptador
  const bucle = (blk.match(/for\(let _i=0;_i<allRows\.length;_i\+\+\)\{[\s\S]*?\n\s*\}/) || [''])[0];
  const continues = (bucle.match(/continue;/g) || []).length;
  const comptats = (bucle.match(/(_saltades\.\w+\+\+|_jaTePreu\+\+)[^\n]*continue;/g) || []).length;
  check('2 · cap salt es queda sense comptar (' + comptats + ' comptats de ' + (continues - 1) + ' salts reals)', comptats >= continues - 1);
}

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
