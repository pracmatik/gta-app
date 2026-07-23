#!/usr/bin/env node
'use strict';
/*
 * Guardià de la LLEGIBILITAT del panell «Què ha après el sistema» (23/07/2026 · la Marina, que NO és tècnica, no
 * entenia res del que sortia per aprovar).
 *
 * Per què: la targeta mostrava el `contexto` en cru ("[tipus:partida_agregada] [decisió:UUID] Obra «ARIBAU 257» ·
 * presa en signar · aprenentatge v2") i l'actor intern "Sense sessió (escriptura directa a la base)". Cura: `_ctxPla`
 * neteja etiquetes i jerga i deixa NOMÉS l'obra; la feina de nit s'anomena "el sistema" (no l'actor tècnic).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

const mCtx = h.match(/const _ctxPla=c=>[^\n]*?\.trim\(\);/);
const mSys = h.match(/const _sysActor=n=>[^\n]*?;/);
check('existeix _ctxPla (neteja el context per a la Marina)', !!mCtx);
check('existeix _sysActor', !!mSys);
check('la targeta fa servir _ctxPla i JA NO mostra el context cru', h.includes('_ctxPla(l.contexto)') && !h.includes('${esc(l.contexto)}'));
check('el trail NO diu "per <actor>" quan és creada o feina de nit', h.includes('e.accion==="creada"||_sysActor(e.actor_nom)'));

if (mCtx) {
  const _ctxPla = new Function('return ' + mCtx[0].replace(/^const _ctxPla=/, '').replace(/;$/, ''))();
  const real = '[tipus:partida_agregada] [decisió:01910718-45bb-4972-9cc3-9bc0dc668cd7] Obra «ARIBAU 257» · presa en signar · aprenentatge v2';
  check('FUNCIONAL · del context REAL de la captura deixa NOMÉS «Obra «ARIBAU 257»»', _ctxPla(real) === 'Obra «ARIBAU 257»');
  check('FUNCIONAL · coeficient igual de net', _ctxPla('[tipus:coeficient] [decisió:0fe6748b-1aaa-4815-83de-6a3320a2283d] Obra «ARIBAU 257» · presa en signar · aprenentatge v2') === 'Obra «ARIBAU 257»');
  check('FUNCIONAL · MAI deixa un claudàtor [ ] ni "aprenentatge v2" ni "decisió"', !/\[|aprenentatge v2|decisió|tipus:/i.test(_ctxPla(real)));
  check('FUNCIONAL · buit/null → buit (no trenca)', _ctxPla('') === '' && _ctxPla(null) === '');
}
if (mSys) {
  const _sysActor = new Function('return ' + mSys[0].replace(/^const _sysActor=/, '').replace(/;$/, ''))();
  check('FUNCIONAL · la feina de nit es reconeix com a sistema', _sysActor('Sense sessió (escriptura directa a la base)') === true);
  check('FUNCIONAL · una persona real NO és sistema', _sysActor('Marina') === false && _sysActor('Albert') === false);
}

console.log(ko === 0 ? ('\n== PANELL LLEGIBLE OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
