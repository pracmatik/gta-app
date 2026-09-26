#!/usr/bin/env node
'use strict';
/*
 * Guardià de dues peticions escrites de la tècnica (21/07/2026):
 *
 *  A) TOTAL DE SECCIÓ PER OPCIÓ. «s'ha de poder veure el subtotal de TOTES LES PARTIDES + A / TOTES
 *     LES PARTIDES + B, tan del capítol, de la secció i del total final.» El capítol i el total final
 *     ja hi eren des del 16/07; faltava el nivell de SECCIÓ.
 *
 *  B) PREUS LLIGATS. «que es lliguin els preus de partides. A vegades una mateixa partida pot
 *     aparèixer vàries vegades en zones diferents de l'edifici. Per evitar errors en que un preu es
 *     modifiqui i l'altre no, el millor és que els preus estiguin lligats.»
 *     NOTA D'ABAST: això és funcionalitat NOVA, fora de l'OS-01 §2.1 (queda exclosa pel §2.2). S'ha
 *     inclòs sense càrrec com a gest, i així consta al correu al client. Veure la fitxa d'abast.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---------- A) total de secció per opció ----------
check('A · la secció acumula comunes i opcions per separat', h.includes('let secComu=0,secOpc={};'));
check('A · cada partida suma al seu calaix de secció', h.includes('if(r.opcio)secOpc[r.opcio]=num2((secOpc[r.opcio]||0)+G);else secComu=num2(secComu+G);'));
check('A · amb opcions, la secció treu una fila per opció (comunes + X)', h.includes('${eur(num2(secComu+secOpc[X]))}'));
check('A · sense opcions, la secció treu el total de sempre', h.includes('else html+=`<tr class="sectotal"><td></td><td colspan="5">${t("total_sec")} ${esc(secBuf)}</td>'));
check('A · en tancar secció es neteja tot (no s\'arrossega a la següent)', h.includes('secBuf=null;secSum=0;secComu=0;secOpc={};'));
check('A · el capítol per opció segueix intacte', h.includes('${eur(num2(chapComu+chapOpc[X]))}'));
check('A · el total final per opció segueix intacte (totalPerOpcio)', (h.match(/totalPerOpcio\(rows,X\)/g) || []).length >= 2);

// rèplica: comunes 10.000 · A 40.000 · B 25.000 dins d'una secció
const secComu = 10000, secOpc = { A: 40000, B: 25000 };
const files = Object.keys(secOpc).sort().map(X => secComu + secOpc[X]);
check('A · comunes+A = 50.000 i comunes+B = 35.000 (mai els 75.000 de sumar-ho tot)',
  files[0] === 50000 && files[1] === 35000 && files[0] + files[1] !== secComu + secOpc.A + secOpc.B);

// ---------- B) preus lligats ----------
check('B · hi ha el botó 🔗 a la partida', h.includes('data-link="${i}"'));
check('B · hi ha el handler del botó', h.includes('const lkb=e.target.closest("[data-link]");'));
check('B · es pot desfer (pushUndo abans de tocar res)', h.includes('if(lkb){const i=+lkb.dataset.link,r=rows[i];if(!r)return;pushUndo();'));
check('B · el mateix botó deslliga si ja estava lligada', h.includes('if(r.lnk){const g=r.lnk;let n=0;for(const x of rows)if(x&&x.lnk===g){delete x.lnk;n++;}'));
check('B · propaga el preu a tot el grup', h.includes('function propagaPreuLligat(i,f){'));
check('B · la propagació salta si no és el camp preu', h.includes('if(f!=="preu")return 0;'));
check('B · la propagació es dispara en acabar d\'editar (change, no a cada tecla)', h.includes('propagaPreuLligat(i,f);render();});'));
check('B · mai en silenci: diu quantes partides ha canviat', h.includes('"Precio copiado a "+n+" partida(s) vinculada(s)"'));
check('B · si el grup té preus diferents, AVISA abans d\'igualar-los', /NO tienen el mismo precio/.test(h) && /NO tenen el mateix preu/.test(h));
check('B · el grup sobreviu al guardar', h.includes('if(/^L[a-z0-9]{4,24}$/.test(r.lnk||""))o.lnk=r.lnk;'));

// rèplica de l'aparellament per text
const _k = s => String(s || '').split('\n')[0].trim().toUpperCase().replace(/\s+/g, ' ');
const R = [
  { tipo: 'part', desc: 'REPARACIO DE GRIETAS\nsegona línia que no compta', preu: 39 },
  { tipo: 'part', desc: '  reparacio  de   grietas ', preu: 44 },
  { tipo: 'part', desc: 'PINTURA', preu: 12 },
  { tipo: 'part', desc: 'REPARACIO DE GRIETAS', preu: 39 },
  { tipo: 'sub', desc: 'REPARACIO DE GRIETAS', preu: 1 }];
const clau = _k(R[0].desc);
const iguals = R.map((x, j) => (x.tipo === 'part' && _k(x.desc) === clau) ? j : -1).filter(j => j >= 0);
check('B · aparella ignorant majúscules, espais i la 2a línia', JSON.stringify(iguals) === '[0,1,3]');
check('B · NO aparella una línia de desglòs encara que el text coincideixi', !iguals.includes(4));
check('B · detecta que el grup té preus diferents (39 i 44) → ha d\'avisar',
  [...new Set(iguals.map(j => R[j].preu))].length > 1);

// propagació: canviar el preu de la 0 els posa tots a 50
const G = R.map(x => ({ ...x })); for (const j of iguals) G[j].lnk = 'Labc123';
G[0].preu = 50;
let n = 0; for (let j = 0; j < G.length; j++) { if (j === 0 || G[j].lnk !== G[0].lnk) continue; if (G[j].preu !== 50) { G[j].preu = 50; n++; } }
check('B · en canviar-ne un, els altres 2 del grup el segueixen', n === 2 && G[1].preu === 50 && G[3].preu === 50);
check('B · la partida de fora del grup NO es toca', G[2].preu === 12);
check('B · la línia de desglòs NO es toca', G[4].preu === 1);

console.log(ko === 0 ? ('\n== SECCIÓ A/B + PREUS LLIGATS OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
