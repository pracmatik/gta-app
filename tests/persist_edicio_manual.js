#!/usr/bin/env node
'use strict';
/*
 * Guardià de la PERSISTÈNCIA DE L'EDICIÓ MANUAL (22/07/2026 · bug Marina).
 *
 * Per què: sanitizeRows corria a CADA obertura i reaplicava una reconciliació pensada NOMÉS per a la
 * importació ("el preu imprès guanya" → converteix les línies de càlcul 'sub' en desglòs 'subv' que NO
 * suma i torna el flag). En reobrir un pressupost que la tècnica havia editat a mà, això li ESBORRAVA
 * els desglossos i tornava al preu imprès. Cura: paràmetre ingest; en reobrir (ingest=false) NO es
 * reaplica. Guardià CONDUCTUAL: extreu la funció real i comprova el comportament, no només el text.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- Extreu la funció real i executa-la ------------------------------------
const m = h.match(/function sanitizeRows\(arr,ingest\)[\s\S]*?\n}\n/);
check('sanitizeRows té el paràmetre ingest', !!m);
let SR = null;
if (m) { try { SR = new Function(m[0] + '\nreturn sanitizeRows;')(); } catch (e) { console.error('  X  no s\'ha pogut evaluar sanitizeRows: ' + e.message); } }

const clone = x => JSON.parse(JSON.stringify(x));
const cnt = r => !r ? { sub: 0, subv: 0, fl: 0 } : ({ sub: r.filter(x => x.tipo === 'sub').length, subv: r.filter(x => x.tipo === 'subv').length, fl: r.filter(x => x.tipo === 'part' && x.flag).length });
// Cas Marina: partida amb preu imprès (22) i 2 desglossos manuals que NO quadren amb l'imprès
const CAS = [{ tipo: 'part', num: '2.6', desc: 'FACHADA', ut: 'm2', amid: 10, preu: 22 },
             { tipo: 'sub', desc: 'A', ut: 'm2', amid: 10, preu: 22 },
             { tipo: 'sub', desc: 'B', ut: 'm2', amid: 10, preu: 57 }];

if (SR) {
  const reobrir = cnt(SR(clone(CAS), false));   // reobrir un pressupost desat/editat
  const importar = cnt(SR(clone(CAS), true));    // importació d'un document nou
  check('en REOBRIR (ingest=false) es CONSERVEN les línies de càlcul manuals (sub=2)', reobrir.sub === 2 && reobrir.subv === 0);
  check('en REOBRIR NO reapareix el flag que la tècnica havia validat', reobrir.fl === 0);
  check('en IMPORTAR (ingest=true) el comportament NO canvia (preu imprès guanya → subv)', importar.subv === 2);
}

// --- Els 3 punts de CÀRREGA passen ingest=false ----------------------------
check('reobrir un pressupost passa false (openEditor)', h.includes('sanitizeRows(JSON.parse(JSON.stringify(n.rows)),false)'));
check('restaurar una versió passa false', h.includes('sanitizeRows(JSON.parse(JSON.stringify(snap.rows)),false)'));
check('recuperar un esborrany passa false', h.includes('sanitizeRows(JSON.parse(JSON.stringify(d.rows||rows)),false)'));
// --- La importació NO passa false (segueix reconciliant) --------------------
check('exactament 3 crides passen ,false (les 3 de càrrega; les d\'importació intactes)',
  (h.match(/sanitizeRows\([^;]*,false\)/g) || []).length === 3);

console.log(ko === 0 ? ('\n== PERSISTÈNCIA EDICIÓ MANUAL OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
