#!/usr/bin/env node
'use strict';
/*
 * Guardià de la PRIMERA FILA VISIBLE (25/07/2026 · la tècnica 22 i 24/07: "la primera fila continua oculta").
 *
 * Causa raíz (consell 25/07, verificada empíricament en Chromium): `.tablewrap{overflow:hidden}` convertia el
 * contenidor en el scroll-container de referència del `position:sticky` del thead → el thead quedava DESPLAÇAT
 * permanentment --tbh px cap avall DINS la taula (tapant la fila 1) i a més no s'enganxava sota la topbar en fer
 * scroll. La cura és `overflow:clip`: mateix retall visual (cantonades rodones), però NO crea scroll-container.
 * El fix del 22/07 (--tbh mesurat per JS) era necessari però apuntava a una altra capa; es manté.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

const mTW = h.match(/\.tablewrap\{[^}]*\}/);
check('.tablewrap existeix', !!mTW);
if (mTW) {
  check('.tablewrap fa servir overflow:clip (NO crea scroll-container)', /overflow:clip/.test(mTW[0]));
  check(".tablewrap ja NO té overflow:hidden (que desplaçava el thead sobre la fila 1)", !/overflow:hidden/.test(mTW[0]));
  check('.tablewrap conserva el retall visual (border-radius)', /border-radius/.test(mTW[0]));
}
check('el thead segueix sticky amb top mesurat (--tbh)', /thead th\{[^}]*position:sticky[^}]*top:var\(--tbh/.test(h) || (/thead th\{[^}]*top:var\(--tbh/.test(h) && /thead th\{[^}]*position:sticky/.test(h)));
check('el JS que mesura la topbar (--tbh) segueix viu', h.includes("--tbh") && /ResizeObserver/.test(h));
check('scroll-margin de les files es manté (ancoratges no tapats)', /scroll-margin-top/.test(h));

console.log(ko === 0 ? ('\n== PRIMERA FILA OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
