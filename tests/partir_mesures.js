#!/usr/bin/env node
'use strict';
/*
 * Guardià de la REGLA DE LA CASA «partida que agrupa diverses mesures» (correu de la tècnica 17/07/2026,
 * «Conversió a CSV»): una partida "1 PA" que porta a dins paviment (m²) + dos elements (ml) s'ha de partir
 * en una partida per mesura, amb el MATEIX text, indicant al títol de què és cadascuna i amb la seva unitat.
 * IMPORTANT: el sistema NOMÉS ho PROPOSA (botó). Partir-ho automàticament està APARCAT per acord exprés
 * amb la tècnica (GRUP 3 del correu 16/07) — el sistema no reescriu documents pel seu compte.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- contracte de codi ----
check('existeix el detector agrupaMesures', h.includes('function agrupaMesures(arr,i){'));
check('hi ha el botó de proposta (data-partir)', h.includes('data-partir="${i}"'));
check('hi ha el handler', h.includes('const ptb=e.target.closest("[data-partir]");if(ptb){'));
check('demana confirmació abans de partir (mai automàtic)', /if\(!confirm\(ES\?`Se crearán \$\{kids\.length\} partidas/.test(h));
check('es pot desfer (pushUndo)', h.includes('))return;pushUndo();const _base=String(r.desc||"")'));
// A1 (resposta escrita de la tècnica 21/07): el distintiu va amb PUNT i en MAJÚSCULES
// («PAVIMENTO CERÁMICO. PAVIMENTO»), NO entre parèntesis — és el format que la seva intranet ja va acceptar.
check('conserva el text sencer i afegeix el concepte al títol', h.includes('desc:_tit.replace(/[.\\s]+$/,"")+(conc?". "+conc.toUpperCase():"")+_resta'));
check('A1 · el distintiu va amb PUNT i MAJÚSCULES (no entre parèntesis)', h.includes('". "+conc.toUpperCase()') && !h.includes('(conc?" ("+conc+")":"")'));
const _fmt = (tit, conc) => tit.replace(/[.\s]+$/, "") + (conc ? ". " + conc.toUpperCase() : "");
check('A1 · format correcte: "PAVIMENTO CERÁMICO. PAVIMENTO"', _fmt("PAVIMENTO CERÁMICO", "pavimento") === "PAVIMENTO CERÁMICO. PAVIMENTO");
check('A1 · no duplica el punt si el títol ja n\'acaba amb un', _fmt("PAVIMENTO CERÁMICO.", "mimbeles") === "PAVIMENTO CERÁMICO. MIMBELES");
check('numera les noves com 4.6.1 / 4.6.2 …', h.includes('num:(r.num?String(r.num)+"."+(ix+1):"")'));
check('cada nova partida agafa la SEVA unitat', h.includes('ut:s.ut||"",amid:s.amid,preu:s.preu'));
check('avisa si el total canvia (mai en silenci)', h.includes('const _dif=num2(_despres-_abans);') && h.includes('ATENCIÓ: el total canvia'));

// ---- lògica real del detector (rèplica) ----
function agrupaMesures(arr, i) {
  const r = arr[i]; if (!r || r.tipo !== 'part') return null;
  let j = i + 1; const kids = [];
  while (j < arr.length && (arr[j].tipo === 'sub' || arr[j].tipo === 'subv')) { kids.push(j); j++; }
  if (kids.length < 2) return null;
  const us = new Set(kids.map(k => String(arr[k].ut || '').trim().toLowerCase()).filter(Boolean));
  return us.size >= 2 ? kids : null;
}
// cas REAL de la tècnica: "1 PA" amb paviment (m2) + mimbeles (ml) + vierteaguas (ml)
const CAS = [{ tipo: 'part', num: '4.6', ut: 'PA', amid: 1, desc: 'REPARACIO TERRAT\nDescripcio llarga que s ha de conservar' },
  { tipo: 'sub', ut: 'm2', amid: 30, preu: 50, desc: 'pavimento' },
  { tipo: 'sub', ut: 'ml', amid: 12, preu: 40, desc: 'mimbeles' },
  { tipo: 'sub', ut: 'ml', amid: 8, preu: 35, desc: 'vierteaguas' }];
check('detecta el cas real (PA amb m2 + ml + ml)', (agrupaMesures(CAS, 0) || []).length === 3);
check('NO proposa res si totes les línies van en la mateixa unitat',
  agrupaMesures([{ tipo: 'part', ut: 'm2', amid: 10 }, { tipo: 'sub', ut: 'm2', amid: 5, preu: 1 }, { tipo: 'sub', ut: 'm2', amid: 5, preu: 1 }], 0) === null);
check('NO proposa res amb una sola línia de càlcul',
  agrupaMesures([{ tipo: 'part', ut: 'PA', amid: 1 }, { tipo: 'sub', ut: 'ml', amid: 5, preu: 1 }], 0) === null);
check('NO proposa res en una partida sense desglòs',
  agrupaMesures([{ tipo: 'part', ut: 'm2', amid: 10, preu: 5 }], 0) === null);

// ---- el total es conserva en partir (partida composta) ----
const coef = 1.15, r2 = n => Math.round(n * 100) / 100;
const kids = CAS.slice(1);
const sumaFilles = kids.reduce((a, k) => a + k.amid * k.preu, 0);
const abans = r2(r2(sumaFilles / CAS[0].amid) * coef * CAS[0].amid); // preu compost x coef x amidament
const despres = r2(kids.reduce((a, k) => a + r2(k.preu * coef * k.amid), 0));
check('partir NO canvia el total del pressupost (composta)', Math.abs(abans - despres) < 0.02);

console.log(ko === 0 ? ('\n== PARTIR MESURES OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
