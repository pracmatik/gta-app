#!/usr/bin/env node
'use strict';
/*
 * Guardià del BUCLE D'APRENENTATGE (25/07/2026 · auditoria del consell).
 * Tres forats que es tanquen aquí:
 *   1. Les decisions sense perquè morien en silenci -> rètol #whyPend recuperable des de la pantalla principal.
 *   2. Una regla NOVA bessona d'una que es va haver d'aturar no avisava -> aprRisc (similitud de vocabulari).
 *   3. Les lliçons del redactor nocturn naixien sense resum en pla -> es verifica al workflow (test propi de n8n).
 *
 * Part FUNCIONAL: extreu _apMots/_apSim del HTML REAL i els executa contra el corpus de regles.
 * Amb fixtures_apr/ (dades reals del client, MAI al repo public) fa la prova forta; sense elles, la sintetica.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- 1 · rètol de preguntes pendents ----
check('existeix el rètol #whyPend a la pantalla principal', /id="whyPend"/.test(h) && /id="whyPendBtn"/.test(h));
// 31/07 vespre · el bloc esta APAGAT mentre el criteri sigui nomes del client (CRITERI_DEL_TECNIC).
// La consulta segueix escrita, intacta, per al dia que ho tornin a demanar: el que es comprova es que
// segueix llegint NOMES decisions sense perque, no que s'executi.
check('loadWhyPend llegeix nomes decisions SENSE perque', /loadWhyPend\(\)\{[\s\S]{0,1200}from\("decisiones"\)[\s\S]{0,120}\.is\("motivo_opcion",null\)\.is\("motivo_texto",null\)/.test(h));
check('showHist crida loadWhyPend (es veu sense entrar a cap panell)', /renderHist\(\);\s*\n\s*if\(typeof loadWhyPend==="function"\)loadWhyPend\(\);/.test(h));
check('desar el perque refresca el rètol', /loadWhyPend\(\); \/\/ el rètol de pendents/.test(h));
check('el botó obre el modal de criteri ja existent, de 15 en 15', /whyPendBtn"\)\.addEventListener\("click",\(\)=>\{ if\(_whyPendAll\.length\)openWhyModal\(_whyPendAll\.slice\(0,15\)\)/.test(h));
check('si no en queda cap, el rètol s\'amaga (mai un avís buit)', /if\(!_whyPendAll\.length\)\{ box\.classList\.add\("hidden"\); return; \}/.test(h));
check('si la consulta falla, el rètol s\'amaga i no trenca la pantalla', /catch\(_\)\{ box\.classList\.add\("hidden"\); \}/.test(h));

// ---- 2 · avís de família (regla bessona d'una aturada) ----
check('existeix aprRisc i es pinta a cada fila del panell', h.includes('function aprRisc(l)') && h.includes('${aprAvis(l)}${aprRisc(l)}'));
check('aprRisc no s\'aplica a regles actives ni a les que ja tenen parada pròpia', /if\(HISTERR\|\|l\.activo\|\|_apPausada\(l\)\|\|!ATURADES\.length\) return ""/.test(h));
check('el llindar calibrat es 0,24', /if\(!best\|\|bs<0\.24\) return ""/.test(h));
check('l\'avís ENSENYA la regla aturada (no nomes diu "compte")', /esc\(String\(best\.leccion\|\|""\)\.slice\(0,140\)\)/.test(h));
check('si no es pot llegir l\'historial, no s\'inventa cap avís', /const ATURADES=HISTERR\?\[\]:data\.filter/.test(h));

// ---- FUNCIONAL: les funcions reals del HTML sobre el corpus ----
let _apMots, _apSim;
try {
  const m1 = h.match(/const _apMots=s=>[^\n]+/)[0], m2 = h.match(/const _apSim=\(a,b\)=>[^\n]+/)[0];
  const f = new Function(m1 + '\n' + m2 + '\nreturn {_apMots,_apSim};');
  ({ _apMots, _apSim } = f());
  check('_apMots i _apSim s\'extreuen i s\'executen', typeof _apMots === 'function' && typeof _apSim === 'function');
} catch (e) { check('_apMots i _apSim s\'extreuen i s\'executen', false); }

if (_apMots && _apSim) {
  const sim = (a, b) => _apSim(_apMots(a), _apMots(b));
  const TOX = 'Si el tècnic indica que una partida és composta, desglossa-la en subpartides reals en lloc de deixar-la en una sola línia';
  const BESSONA = 'Quan el tècnic desglossa una partida composta, cal separar-la en subpartides i no deixar-la com una sola línia';
  const LEGITIMA = 'Conserva SEMPRE el text descriptiu complet de cada partida i no deixis nomes el títol';
  check('FUNCIONAL · la bessona de la regla tòxica supera el llindar', sim(TOX, BESSONA) >= 0.24);
  check('FUNCIONAL · una regla legítima NO el supera', sim(TOX, LEGITIMA) < 0.24);
  check('FUNCIONAL · accents i majúscules no compten (mateixa frase = 1)', sim('Partida COMPOSTA amb àmbit', 'partida composta amb ambit') === 1);
  check('FUNCIONAL · text buit no peta i no dispara', sim('', TOX) === 0);

  const FIX = path.join(__dirname, 'fixtures_apr', 'aprenentatge_real.json');
  if (fs.existsSync(FIX)) {
    const d = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    const HIST = {};
    (d.historial || []).forEach(r => (HIST[r.leccion_id] = HIST[r.leccion_id] || []).push(r));
    const pausada = l => (HIST[l.id] || []).some(e => e.accion === 'pausada');
    const aturades = d.aprendizaje.filter(l => !l.activo && pausada(l));
    const millor = l => aturades.reduce((b, x) => Math.max(b, x.id === l.id ? 0 : sim(l.leccion, x.leccion)), 0);
    const cands = d.aprendizaje.filter(l => !l.activo && !pausada(l) && _apMots(l.leccion).size >= 5);
    const marcades = cands.filter(l => millor(l) >= 0.24);
    const falsos = d.aprendizaje.filter(l => l.activo && _apMots(l.leccion).size >= 5 && millor(l) >= 0.24);
    check('CORPUS REAL · hi ha regles aturades per comparar', aturades.length >= 3);
    check('CORPUS REAL · la bessona nascuda el 25/07 queda MARCADA', marcades.some(l => /desglossa una partida composta/i.test(l.leccion)));
    check('CORPUS REAL · no marca mes d\'un 15% de les candidates (soroll sota control)', marcades.length <= Math.ceil(cands.length * 0.15));
    check('CORPUS REAL · cap regla ACTIVA i legítima quedaria marcada', falsos.length === 0);
    console.log('     (corpus real: ' + d.aprendizaje.length + ' regles · ' + aturades.length + ' aturades · ' + marcades.length + '/' + cands.length + ' marcades)');
  } else {
    console.log('  -- fixtures_apr/ absent (dades reals del client, nomes en local): prova de corpus omesa');
  }
}

console.log(ko === 0 ? ('\n== BUCLE APRENENTATGE OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
