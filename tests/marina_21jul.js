#!/usr/bin/env node
'use strict';
/*
 * Guardià del 21/07/2026 — dues coses, i la segona és una RETIRADA demanada pel client.
 *
 *  A) EL SUBTOTAL NO POT DESAPARÈIXER. La tècnica: «Per molt que el total sigui 0€ hauria d'aparèixer
 *     igualment el SUBTOTAL CAPITOL 0€.» Abans la pantalla només el pintava si sumava >0.
 *
 *  B) EL BOTÓ «DESGLÒS» ESTÀ RETIRAT, A PETICIÓ EXPRESSA DEL CLIENT.
 *     La Yolanda (21/07): «podeu tornar a deixar-ho com abans, sense la opció del desglòs que apareix ara?»
 *     La Marina (21/07): «demanem sisplau treure aquesta nova funcionalitat per evitar errors.»
 *
 *     El defecte que van veure era real i era NOSTRE: el botó recollia a `kids` les línies de càlcul
 *     (que sumen) I les informatives (que no sumen), i les convertia TOTES a línia de càlcul. Marina:
 *     «reconverteix totes les linies a càlcul, ho fossin o no anteriorment». En una partida amb dues
 *     línies que sumaven i tres informatives a 0, prémer el botó ho igualava tot i es perdia la
 *     distinció que el tècnic havia fet a mà.
 *
 *     AQUEST GUARDIÀ EXISTEIX PERQUÈ NO TORNI SOL. Si algú el reintrodueix, que sigui perquè el client
 *     l'ha tornat a demanar per escrit — i llavors que canviï aquest fitxer a consciència.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---------- A) el subtotal es veu sempre ----------
check('A · el subtotal de capítol ja NO depèn de que sumi >0', h.includes('const flushCap=()=>{if(chapBuf!==null){'));
// (21/07 tarda: flushSec passa a treure una fila per opció A/B; la condició segueix sent NOMÉS
//  «existeix la secció», mai un import >0 — que és el que aquest test vigila.)
check('A · el total de secció ja NO depèn de que sumi >0', h.includes('const flushSec=()=>{flushCap();if(secBuf!==null){'));
check('A · ha desaparegut la condició antiga del capítol', !h.includes('chapBuf!==null&&(chapSum>0||chapOpcSum>0)'));
check('A · ha desaparegut la condició antiga de la secció', !h.includes('secBuf!==null&&secSum>0'));
const pinta = (chapBuf) => chapBuf !== null;
check('A · cas de la tècnica: capítol amb amidament 0 → el subtotal SURT', pinta('NOU CAPÍTOL') === true);

// ---------- B) la retirada, peça per peça ----------
check('B · no hi ha el botó a la taula', !h.includes('data-calcmode') && !h.includes('calcmodebtn'));
check('B · no hi ha el handler que reconvertia les línies', !h.includes('closest("[data-calcmode]")'));
check('B · no queda cap etiqueta «Σ desglòs» ni «⇄ desglòs»', !h.includes('Σ desglòs') && !h.includes('⇄ desglòs') && !h.includes('⇄ desglose'));
check('B · no queda el concepte calcMode enlloc', !h.includes('calcMode'));
check('B · el guardià torna a ser el d\'abans (sense excepció de calcMode)', h.includes('if(p.tipo!=="part"||(+p.pct))continue;'));
check('B · no es guarda calcMode a la base de dades', !/o\.calcMode/.test(h));

// la promoció automàtica que es va afegir el mateix 21/07 al botó «+sub» tenia el MATEIX defecte
check('B · «+sub» ja no promou les línies informatives', !h.includes('for(const k of _dem)rows[k].tipo="sub"'));
check('B · «+sub» ja no demana confirmació de canvi de preu', !/Esta partida tiene .* línea\(s\) de cálculo que AHORA NO se suman/.test(h));
check('B · «+sub» crea una línia normal, sense marques', h.includes('rows.splice(at,0,{tipo:"sub",desc:t("sub_def"),ut:_ut,amid:(r0&&r0.amid)||1,preu:0});render();}});'));
check('B · no queden ni manual ni preuOrig', !h.includes('manual:1') && !h.includes('preuOrig'));

// el que SÍ es queda del 20/07: el desglòs informatiu ENSENYA el seu preu (era el bloqueig real de
// Salamanca — la casella sortia buida i no es podien veure els números). Això no ho van qüestionar.
check('B · el desglòs informatiu segueix ensenyant el seu preu', /Desglòs informatiu: no suma/.test(h) && /Desglose informativo: no suma/.test(h));
check('B · el text d\'ajuda ja NO envia a un botó que no existeix',
  !/Fes servir «⇄/.test(h) && !/Usa «⇄/.test(h));

// afegir una línia continua sent reversible (millora que es queda)
check('B · afegir una línia de desglòs es pot desfer', /_ut=s\.length\?\(rows\[s\[s\.length-1\]\]\.ut\|\|"ut"\):\(\(r0&&r0\.ut\)\|\|"ut"\);pushUndo\(\);/.test(h));

// ---------- lògica del guardià, tal com queda ----------
function guardia(rows) {
  const out = rows.map(r => ({ ...r }));
  for (let i = 0; i < out.length; i++) {
    const p = out[i]; if (p.tipo !== 'part' || (+p.pct)) continue;
    let j = i + 1; const subIdx = [];
    while (j < out.length && (out[j].tipo === 'sub' || out[j].tipo === 'subv')) { if (out[j].tipo === 'sub') subIdx.push(j); j++; }
    if (subIdx.length) {
      const exp = +p.preu;
      if (exp > 0) {
        let x = 0; for (const k of subIdx) x += (+out[k].amid || 0) * (+out[k].preu || 0);
        const imp = (+p.amid) ? x / (+p.amid) : 0;
        if (imp > 0) { const dif = Math.abs(imp - exp);
          if (dif > 1 && dif > 0.005 * exp) { for (const k of subIdx) out[k].tipo = 'subv'; }
          else { delete p.preu; } } } }
    i = j - 1; }
  return out;
}
// cas real de la captura de la tècnica: dues línies que sumen + tres informatives a 0
const CAS = [
  { tipo: 'part', num: '1.1', desc: 'PREPARACION SOPORTE', ut: 'm2', amid: 290, preu: 33 },
  { tipo: 'sub', desc: 'repicat', ut: 'm2', amid: 290, preu: 22 },
  { tipo: 'sub', desc: 'pendents', ut: 'm2', amid: 290, preu: 11 },
  { tipo: 'subv', desc: 'Cubierta escalera B', ut: 'm2', amid: 136, preu: 0 },
  { tipo: 'subv', desc: 'Cubierta escalera C', ut: 'm2', amid: 79, preu: 0 },
  { tipo: 'subv', desc: 'Cubierta escalera D', ut: 'm2', amid: 75, preu: 0 }];
const r = guardia(CAS);
check('B · les informatives segueixen sent informatives (no s\'igualen)',
  r[3].tipo === 'subv' && r[4].tipo === 'subv' && r[5].tipo === 'subv');
check('B · les de càlcul segueixen sent de càlcul', r[1].tipo === 'sub' && r[2].tipo === 'sub');
check('B · 22 + 11 = 33 quadra amb el preu imprès → el preu es deriva del desglòs', r[0].preu === undefined);

console.log(ko === 0 ? ('\n== 21/07 (subtotal + retirada del desglòs) OK -- ' + ok + '/' + (ok + ko) + ' ==')
  : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
