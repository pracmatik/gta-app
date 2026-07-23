#!/usr/bin/env node
'use strict';
/*
 * Guardià del COMPARADOR abans/després per partida (22/07/2026 · punt 2 correu Marina).
 *
 * Per què: el panell «Comparar abans/després» d'una lliçó pendent només mostrava els NOMS de les
 * partides que canvien, no el valor abans→després. Marina no podia entendre l'efecte de la regla.
 * Cura: el webhook envia objectes {desc, preu_sense, preu_amb, import_sense, import_amb} i el front
 * (_exLine) els pinta com «preu: X → Y». COMPATIBLE cap enrere: si arriba un string, es pinta el nom.
 * Guardià CONDUCTUAL: extreu _exLine i comprova els dos camins (objecte i string).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- Llegeix les 3 claus que envia el webhook -------------------------------
check('el front llegeix exemples.modificades', h.includes('c.exemples&&c.exemples.modificades'));
check('el front llegeix exemples.afegides', h.includes('c.exemples&&c.exemples.afegides'));
check('el front llegeix exemples.eliminades', h.includes('c.exemples&&c.exemples.eliminades'));

// --- Extreu _exLine i comprova el comportament ------------------------------
const m = h.match(/const _exLine=\(x,tipus\)=>\{[\s\S]*?\n {6}\};/);
check('existeix la funció _exLine', !!m);
let exLine = null;
if (m) { try {
  exLine = new Function('es', 'esc', 'eu', m[0] + '\nreturn _exLine;')(false, s => String(s == null ? '' : s), n => (+n).toFixed(2) + ' €');
} catch (e) { console.error('  X  no s\'ha pogut evaluar _exLine: ' + e.message); } }

if (exLine) {
  const objMod = exLine({ desc: 'Partida A', ut: 'm2', preu_sense: 22, preu_amb: 30, import_sense: 220, import_amb: 300 }, 'mod');
  check('OBJECTE modificat: pinta el preu ABANS→DESPRÉS (22 → 30)', objMod.includes('22.00') && objMod.includes('30.00') && objMod.includes('→'));
  check('OBJECTE modificat: mostra el nom de la partida', objMod.includes('Partida A'));
  const objAdd = exLine({ desc: 'Partida C', import_amb: 50 }, 'add');
  check('OBJECTE afegit: marca «＋» i l\'import', objAdd.includes('＋') && objAdd.includes('50.00'));
  const objDel = exLine({ desc: 'Partida B', import_sense: 100 }, 'del');
  check('OBJECTE eliminat: marca «−» i l\'import', objDel.includes('−') && objDel.includes('100.00'));
  const str = exLine('Sanejament peces llinda', 'mod');
  check('STRING (compat cap enrere): pinta el nom tal qual', str.includes('Sanejament peces llinda'));
}

console.log(ko === 0 ? ('\n== COMPARADOR EXEMPLES OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
