#!/usr/bin/env node
'use strict';
/*
 * Guardià dels TÍTOLS EN MAJÚSCULES per defecte (22/07/2026 · correu Yolanda/Marina: "els títols en majúscules
 * abans sortien i ara no").
 *
 * Per què: la regla de literalitat (repairDescsFromSource) copia el text TAL COM ve del document; molts amidaments
 * no venen en majúscules, així que els títols van perdre les majúscules. Cura determinista i GENERAL (IA + BC3,
 * qualsevol projecte): majúscula NOMÉS a la línia de títol — capítol/secció senceres i el concepte (1a línia) de
 * cada partida; el COS de la partida es manté LITERAL (no es toca).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- estàtic ----
check('existeix la funció majusculesTitols', h.includes('function majusculesTitols('));
check("s'aplica a la ingesta (allRows) abans de capturar el draft", h.includes('majusculesTitols(allRows)'));
check('es crida ABANS de capturar _draftIA (no ho llegeix com a canvi del tècnic)',
  h.indexOf('majusculesTitols(allRows)') < h.indexOf('const _draftIA=JSON.parse'));

// ---- funcional (extreu la funció real del HTML i l'executa) ----
function extractFn(name) {
  const s = h.indexOf('function ' + name + '(');
  if (s < 0) throw new Error('no trobo ' + name);
  let i = h.indexOf('{', s), d = 0;
  for (; i < h.length; i++) { if (h[i] === '{') d++; else if (h[i] === '}') { d--; if (d === 0) return h.slice(s, i + 1); } }
  throw new Error('claus desbalancejades');
}
let maj;
try { maj = new Function(extractFn('majusculesTitols') + '\nreturn majusculesTitols;')(); }
catch (e) { check('compila majusculesTitols', false); console.error('   ' + e.message); }

if (maj) {
  const rows = [
    { tipo: 'cap', desc: 'Capítol u: enderrocs' },
    { tipo: 'sec', desc: 'secció a — façana' },
    { tipo: 'part', desc: "reparació de cantell de forjat\nrepicat del formigó i passivat de l'armadura" },
    { tipo: 'part', desc: "desmuntatge d'aire condicionat" },
    { tipo: 'sub', desc: 'Balcones 16 u' },
  ];
  maj(rows);
  check('CAPÍTOL en majúscules', rows[0].desc === 'CAPÍTOL U: ENDERROCS');
  check('SECCIÓ en majúscules', rows[1].desc === 'SECCIÓ A — FAÇANA');
  check('partida: 1a línia (títol) en majúscules', rows[2].desc.split('\n')[0] === 'REPARACIÓ DE CANTELL DE FORJAT');
  check('partida: el COS es manté LITERAL (no es toca)', rows[2].desc.split('\n')[1] === "repicat del formigó i passivat de l'armadura");
  check('partida d\'una sola línia també en majúscules', rows[3].desc === "DESMUNTATGE D'AIRE CONDICIONAT");
  check('sub NO es toca (no és títol; pot ser desglòs de mesura)', rows[4].desc === 'Balcones 16 u');
  check('accents i ç/l·l correctes', maj([{ tipo: 'cap', desc: 'niça l·lògica çava' }])[0].desc === 'NIÇA L·LÒGICA ÇAVA');
}

console.log(ko === 0 ? ('\n== TÍTOLS MAJÚSCULES OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
