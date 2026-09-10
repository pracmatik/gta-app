#!/usr/bin/env node
'use strict';
/*
 * Guardià de la LLEGIBILITAT del panell «Què ha après el sistema» (23/07/2026 · la tècnica, que NO és tècnica, no
 * entenia res del que sortia per aprovar).
 *
 * Per què: la targeta mostrava el `contexto` en cru ("[tipus:partida_agregada] [decisió:UUID] Obra «OBRA-AC 257» ·
 * presa en signar · aprenentatge v2") i l'actor intern "Sense sessió (escriptura directa a la base)". Cura: `_ctxPla`
 * neteja etiquetes i jerga i deixa NOMÉS l'obra; la feina de nit s'anomena "el sistema" (no l'actor tècnic).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// 27/07: `_ctxPla` ja no és una funció solitària — depèn de `_ctxJerga` (la jerga interna que NO anava
// entre claudàtors: "font:correu … (minat)", "ref. <identificador>") i de l'IDIOMA. Cal extreure les dues
// o no es pot construir per provar-la. I la targeta ara crida `_ctxOn` (obra + frase), que per dins
// segueix passant per `_ctxPla`: el que aquest guardià defensa —que MAI surti el context en cru— es manté.
const mCtx = h.match(/const _ctxPla=c=>[^\n]*?\.trim\(\);/);
const mJer = h.match(/const _ctxJerga=[\s\S]*?pla ratificat\b[^;]*;/);
const mSys = h.match(/const _sysActor=n=>[^\n]*?;/);
check('existeix _ctxPla (neteja el context per a la tècnica)', !!mCtx);
check('existeix _ctxJerga (tradueix la jerga que no anava entre claudàtors)', !!mJer);
check('existeix _sysActor', !!mSys);
check('la targeta neteja el context i JA NO el mostra en cru',
  (h.includes('_ctxPla(l.contexto)') || h.includes('_ctxOn(l.contexto)')) && !h.includes('${esc(l.contexto)}'));
check('el trail NO diu "per <actor>" quan és creada o feina de nit', h.includes('e.accion==="creada"||_sysActor(e.actor_nom)'));

if (mCtx && mJer) {
  const _ctxPla = new Function('IDIOMA', mJer[0] + '\nreturn (' + mCtx[0].replace(/^const _ctxPla=/, '').replace(/;$/, '') + ');')('ca');
  const real = '[tipus:partida_agregada] [decisió:00000000-0000-4000-8000-000000000001] Obra «OBRA-AC 257» · presa en signar · aprenentatge v2';
  check('FUNCIONAL · del context REAL de la captura deixa NOMÉS «Obra «OBRA-AC 257»»', _ctxPla(real) === 'Obra «OBRA-AC 257»');
  check('FUNCIONAL · coeficient igual de net', _ctxPla('[tipus:coeficient] [decisió:00000000-0000-4000-8000-000000000002] Obra «OBRA-AC 257» · presa en signar · aprenentatge v2') === 'Obra «OBRA-AC 257»');
  check('FUNCIONAL · MAI deixa un claudàtor [ ] ni "aprenentatge v2" ni "decisió"', !/\[|aprenentatge v2|decisió|tipus:/i.test(_ctxPla(real)));
  check('FUNCIONAL · buit/null → buit (no trenca)', _ctxPla('') === '' && _ctxPla(null) === '');
}
if (mSys) {
  const _sysActor = new Function('return ' + mSys[0].replace(/^const _sysActor=/, '').replace(/;$/, ''))();
  check('FUNCIONAL · la feina de nit es reconeix com a sistema', _sysActor('Sense sessió (escriptura directa a la base)') === true);
  check('FUNCIONAL · una persona real NO és sistema', _sysActor('la tècnica') === false && _sysActor('Albert') === false);
}

console.log(ko === 0 ? ('\n== PANELL LLEGIBLE OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
