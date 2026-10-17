#!/usr/bin/env node
'use strict';
/*
 * Guardià de la LECTURA DE PDF amb estructura de capítols (22/07/2026 · bug la tècnica 0/9 capítols).
 *
 * Per què: la rama PDF feia `tc.items.map(i=>i.str).join(" ")` — aplanava tot a text i DESCARTAVA
 * la posició (x) i l'alçada de font, que és on viu la jerarquia. Resultat: 9 capítols fusionats en 1
 * i partides saltades en salts de pàgina. Cura: reconstruir línies per Y, conservar x i alçada, i
 * marcar els capítols (columna esquerra + font més alta que el cos + no repetit) amb "##CAP##".
 * Verificat E2E amb l'Obra-AC real: 9/9 capítols, 0 falsos, 31/31 partides.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

check('ja NO aplana el PDF amb items.map(i=>i.str).join a nivell de pàgina',
  !h.includes('tc.items.map(i=>i.str).join(" ").replace(/[ \\t]+/g," ").trim())'));
check('reconstrueix línies agrupant items per posició Y (transform[5])', h.includes('it.transform[5]'));
check('conserva la X (transform[4]) i l\'alçada de font (transform[3])',
  h.includes('transform[4]') && h.includes('transform[3]'));
check('marca els capítols amb ##CAP##', h.includes('"##CAP## "'));
check('el capítol és columna esquerra + font més alta que el cos', h.includes('l.x<=leftEdge+10') && h.includes('l.h>=bodyH+1.5'));
check('auto-calibratge del marge esquerre i l\'alçada del cos per document', h.includes('const leftEdge=Math.min') && h.includes('const bodyH='));
// 26/07: la guarda antiga («amb UNA lletra ja no és mobiliari») era INSUFICIENT — les files d'amidament
// porten lletres per la fórmula C#*D#*E#*F# i s'esborraven com a capçalera repetida. Ara calen DUES guardes.
// El comportament (no el text del codi) el prova tests/test_files_amidament_sense_text.js.
check('GUARDA DE PARAULA: cal una paraula de 3+ lletres per considerar una línia mobiliari', h.includes('/[a-zà-ÿ]{3,}/i.test(l.t)'));
check('GUARDA DE MESURA: una línia amb amidament o TOTAL mai és mobiliari', h.includes('!_esMesura(l.t)&&'));

console.log(ko === 0 ? ('\n== LECTURA PDF CAPÍTOLS OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
