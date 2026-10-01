#!/usr/bin/env node
'use strict';
/*
 * Guardià del P3 (25/07/2026 · «BORRAT DE LINIES» la tècnica 22 i 24/07 — pèrdua de feina, gravetat màxima).
 *
 * Les 4 peces: (1) el XAT passa ingest=false (cobert a test_persist_edicio_manual); (2) SORTIDA GUARDADA de
 * l'editor: amb canvis sense desar es protegeix l'esborrany immediatament (local+núvol) + confirmació + rastre;
 * (3) ANTI-ZOMBIE: una pestanya amb codi vell es marca (_STALE) i es recarrega amb cache-bust just després d'un
 * desat correcte (mai a mitja feina); (4) INSTRUMENTACIÓ: tot event que pot menjar-se un esborrany queda al llibre.
 * + presència PER PESTANYA: dues pestanyes del mateix usuari ara s'avisen («una altra pestanya TEVA»).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// (2) sortida guardada
check('existeix sortirEditor amb guarda DIRTY', /function sortirEditor\(\)\{\s*if\(DIRTY&&!locked\(\)\)\{/.test(h));
check('en sortir amb canvis: esborrany immediat local + núvol', /sortirEditor\(\)\{[\s\S]{0,200}saveDraft\(\); saveDraftCloud\(\);/.test(h));
check('en sortir amb canvis: es demana confirmació', /sortirEditor\(\)\{[\s\S]{0,700}confirm\(/.test(h));
check('el botó enrere de l\'editor usa la sortida guardada', h.includes('$("#backBtn").addEventListener("click",sortirEditor)'));
check('el botó FÍSIC enrere (popstate) també', /popstate[\s\S]{0,400}sortirEditor\(\)/.test(h));
check('la sortida amb canvis queda al llibre d\'activitat', h.includes('"sortida_canvis_sense_desar"'));

// (3) anti-zombie
check('_verCheck marca la pestanya com a VELLA (_STALE)', h.includes('window._STALE=true'));
check('existeix _reloadIfStale i només actua si _STALE', /function _reloadIfStale\(\)\{\s*if\(!window\._STALE\)return;/.test(h));
check('la recàrrega porta CACHE-BUST (?v=) — location.reload podia servir la còpia cacheada', h.includes('location.replace(location.pathname+"?v="+Date.now())'));
check('es recarrega just després d\'un desat correcte (les 2 vies: normal i força)', (h.match(/_reloadIfStale\(\)/g) || []).length >= 3);

// (4) instrumentació — tot el que pot menjar-se un esborrany queda escrit
['conflicte_recarregat', 'conflicte_canvis_meus_a_esborrany', 'esborrany_recuperat', 'esborrany_descartat', 'desat_amb_esborrany_pendent']
  .forEach(a => check('event al llibre: ' + a, h.includes('"' + a + '"')));

// presència per pestanya
check('la clau de presència és PER PESTANYA (usuari + sufix aleatori)', /const myKey=String\(ME\.id\)\+"·"\+Math\.random/.test(h));
check('una segona pestanya pròpia s\'anomena pel que és', h.includes('una altra pestanya TEVA'));

// FUNCIONAL · el cas real de la tècnica: sub manual sota partida amb preu explícit sobreviu a una passada d'edició (ingest=false)
function extractFn(name) {
  const s = h.indexOf('function ' + name + '(');
  let i = h.indexOf('{', s), d = 0;
  for (; i < h.length; i++) { if (h[i] === '{') d++; else if (h[i] === '}') { d--; if (d === 0) return h.slice(s, i + 1); } }
}
try {
  const san = new Function('IDIOMA', extractFn('sanitizeRows') + '\nreturn sanitizeRows;')('ca');
  const rows = [
    { tipo: 'part', num: '3.2', desc: 'REPICADO Y SANEADO DE ENFOSCADO', ut: 'm2', amid: 65.32, preu: 73.33 },
    { tipo: 'sub', desc: 'repicat parcial 30%', ut: 'm2', amid: 19.6, preu: 22 },
  ];
  const out = san(JSON.parse(JSON.stringify(rows)), false);
  check('FUNCIONAL · amb ingest=false la línia de càlcul manual SOBREVIU com a sub', out && out[1] && out[1].tipo === 'sub' && +out[1].preu === 22);
  const out2 = san(JSON.parse(JSON.stringify(rows)));
  check('FUNCIONAL · (context) amb ingest=true el candau la convertia — el forat del xat era real', out2 && out2[1] && out2[1].tipo === 'subv');
} catch (e) { check('FUNCIONAL sanitizeRows executable', false); console.error('   ' + e.message); }

console.log(ko === 0 ? ('\n== SORTIDA GUARDADA + ANTI-ZOMBIE OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
