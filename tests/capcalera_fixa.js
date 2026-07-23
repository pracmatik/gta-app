#!/usr/bin/env node
'use strict';
/*
 * Guardià de la CAPÇALERA FIXA de la taula (22/07/2026 · punt 4 correu Marina).
 *
 * Per què: la capçalera fixa (thead sticky) estava clavada a top:57px, però la barra superior té
 * flex-wrap i s'envolta a 2 línies segons amplada/zoom (mesurat: 64px). El desajust la deixava mal
 * alineada i tapava la 1a fila. Cura: la capçalera segueix l'ALTURA REAL de la barra (var --tbh,
 * mesurada per JS al carregar + resize + ResizeObserver) i les files tenen scroll-margin-top perquè
 * en saltar a una partida quedi SOTA la capçalera, no amagada.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

check('la capçalera fixa segueix l\'altura real de la barra (var --tbh, no 57px clavat)',
  h.includes('position:sticky;top:var(--tbh,57px)'));
check('el fallback mòbil també fa servir la var (--tbh,53px)', h.includes('thead th{top:var(--tbh,53px)}'));
check('les files tenen scroll-margin-top perquè no quedin sota la capçalera en saltar-hi',
  h.includes('tbody tr{scroll-margin-top:calc(var(--tbh,57px) + 46px)}'));
check('hi ha JS que MESURA la barra i escriu --tbh', h.includes("setProperty('--tbh'") && h.includes('.topbar').valueOf() && h.includes('getBoundingClientRect().height'));
check('s\'actualitza en canviar la mida (resize)', /addEventListener\('resize',setTBH/.test(h));
check('s\'actualitza si la barra mateix canvia d\'alçada (ResizeObserver)', h.includes('new ResizeObserver(setTBH)'));

console.log(ko === 0 ? ('\n== CAPÇALERA FIXA OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
