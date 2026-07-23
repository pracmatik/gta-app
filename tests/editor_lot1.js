#!/usr/bin/env node
'use strict';
/*
 * Guardià del LOT 1 d'editor (20/07/2026) — 4 punts de Marina:
 *  #6  el botó "+sub" copia la unitat (abans quedava fix "ut").
 *  #9  el botó "%" apareix a partides d'imprevistos/reserva (i c×1 s'amaga quan ja és %).
 *  #8  la línia de càlcul de l'industrial es detecta i es pinta diferent.
 *  #1  la "secció" s'insereix on treballes, no sempre al final.
 * Si algú desfà qualsevol dels quatre, aquí salta (i no a producció amb el client davant).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- #6 unitat auto-copiada ----
check('#6 +sub deriva la unitat (_ut), ja no la fixa', h.includes('_ut=s.length?(rows[s[s.length-1]].ut||"ut"):((r0&&r0.ut)||"ut")') && h.includes('desc:t("sub_def"),ut:_ut,'));
check('#6 ja NO queda el ut:"ut" fix (la regressió)', !h.includes('desc:t("sub_def"),ut:"ut",'));
// rèplica de la lògica de derivació
const deriva = (subsUt, partUt) => subsUt.length ? (subsUt[subsUt.length - 1] || 'ut') : (partUt || 'ut');
check('#6 lògica: amb germans -> copia l\'últim sub', deriva(['m2', 'ml'], '') === 'ml');
check('#6 lògica: sense germans -> unitat de la partida', deriva([], 'm3') === 'm3');
check('#6 lògica: res de res -> "ut" per defecte', deriva([], '') === 'ut');

// ---- #9 botó % a imprevistos ----
check('#9 el gate del % inclou IMPREVIST/RESERVA', h.includes('CONTROL DE CALIDAD|IMPREVIST|RESERVA DE PRESSUPOST|RESERVA DE PRESUPUESTO'));
check('#9 c×1 s\'amaga quan la fila ja és % (!(+r.pct))', h.includes('(!lock&&!(+r.pct)&&/IMPREVIST|RESERVA DE PRESSUPOST|RESERVA DE PRESUPUESTO/'));

// ---- #8 color de la línia industrial ----
check('#8 detecció de la línia industrial per firma determinista', h.includes('/\\(industrial .*=\\s*PVP/i.test(r.desc||"")?" sub-ind"'));
check('#8 hi ha la regla CSS tr.sub-ind', h.includes('tr.sub-ind td{background:var(--accent-tint)}'));

// ---- #1 la secció s'insereix on treballes ----
check('#1 addSec insereix per splice on treballes', h.includes('$("#addSec").addEventListener("click",()=>{pushUndo();const at=(_lastRowI'));
check('#1 hi ha el rastrejador de fila enfocada (focusin)', h.includes('$("#tb").addEventListener("focusin",e=>{const el=e.target.closest("[data-i]");if(el)_lastRowI=+el.dataset.i;})'));
check('#1 addSec ja NO fa rows.push({tipo:"sec"} al final', !h.includes('rows.push({tipo:"sec"'));

console.log(ko === 0 ? ('\n== LOT 1 EDITOR OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
