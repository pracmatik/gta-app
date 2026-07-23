#!/usr/bin/env node
'use strict';
/*
 * Guardià de la CAPTURA EXHAUSTIVA del criteri de Marina (22/07/2026 · petició d'Albert: extreure el màxim).
 *
 * Per què: el motor d'aprenentatge ja tenia la captura del "per què" (modal en signar → taula `decisiones`),
 * però estava CAPAT: només 3 decisions per firma i només 3 tipus (preu, partida treta, partida afegida).
 * Es perdia el gruix del criteri: per què una partida és OPCIONAL (39×) o ALTERNATIVA (28×), per què REESCRIU
 * un text, per què canvia una MESURA. Cura: detectar aquests tipus i pujar el tope de 3 a 15.
 *
 * Aquest guardià fa DUES coses: (1) comprova estàticament que el codi porta els tipus i els chips nous;
 * (2) executa de veritat detectaDecisions() amb un cas sintètic i verifica que dispara el que toca i respecta el tope.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- (1) comprovacions estàtiques ----
check('el CHECK ampliat: detecta gta_opcional', h.includes('"gta_opcional"'));
check('detecta gta_alternativa', h.includes('"gta_alternativa"'));
check('detecta opcio_variant', h.includes('"opcio_variant"'));
check('detecta reescriptura de text (text_modificat)', h.includes('"text_modificat"'));
check('detecta canvi de mesura (amidament_modificat)', h.includes('"amidament_modificat"'));
check('ja NO hi ha el tope de 3 (cand.slice(0,3))', !h.includes('cand.slice(0,3)'));
check('el tope nou és 15 (cand.slice(0,15))', h.includes('cand.slice(0,15)'));
check('chips de gta_opcional en català', h.includes("No sempre cal fer-ho"));
check('chips de gta_opcional en castellà', h.includes("No siempre hace falta"));
check('etiqueta del criteri opcional', h.includes('amb quin criteri decideixes que una cosa és opcional'));

// ---- (2) prova funcional real de detectaDecisions ----
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('no trobo ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); } }
  throw new Error('claus desbalancejades a ' + name);
}
let detecta;
try {
  const code = extractFn(h, '_dKey') + '\n' + extractFn(h, 'detectaDecisions') + '\nreturn detectaDecisions;';
  detecta = new Function(code)();
} catch (e) { check('extreu i compila detectaDecisions', false); console.error('   ' + e.message); }

if (detecta) {
  const P = (num, desc, amid, preu, extra) => Object.assign({ tipo: 'part', num, desc, amid, preu }, extra || {});
  const draft = [
    P('1.1', 'Enderroc de paviment', 10, 20),
    P('1.2', 'Bastida tubular', 100, 5),
    P('1.3', 'Partida que treuré', 1, 500),
    P('1.4', 'Aplacat de pedra', 30, 40),
    P('1.5', 'Reixa metàl·lica', 2, 80),
  ];
  const final = [
    P('1.1', 'Enderroc de paviment', 10, 25),                 // preu 20→25  => precio_modificado
    P('1.2', 'Bastida tubular', 120, 5),                       // amid 100→120 => amidament_modificat
    // 1.3 fora                                                 // => partida_eliminada
    P('1.4', 'Aplacat de pedra natural col·locat', 30, 40),    // text reescrit => text_modificat
    P('1.5', 'Reixa metàl·lica', 2, 80, { gta: 'opc' }),       // opcional
    P('1.6', 'Reixa segona', 2, 80, { gta: 'opc' }),           // opcional (2a)
    P('1.7', 'Solució A morter', 5, 30, { gta: 'alt', opcio: 'A' }), // alternativa + opció A
    P('1.8', 'Solució B resina', 5, 45, { opcio: 'B' }),       // opció B
    P('1.9', 'Partida nova afegida', 3, 100),                  // => partida_agregada
  ];
  const out = detecta(draft, final, 1.05);
  const tipos = out.map(d => d.tipo);
  const has = t => tipos.includes(t);
  check('FUNCIONAL · pregunta pel coeficient', has('coeficiente'));
  check('FUNCIONAL · detecta gta_opcional agrupat (n=2)', out.some(d => d.tipo === 'gta_opcional' && d.detalle && d.detalle.n === 2));
  check('FUNCIONAL · detecta gta_alternativa (n=1)', out.some(d => d.tipo === 'gta_alternativa' && d.detalle && d.detalle.n === 1));
  check('FUNCIONAL · detecta opcio_variant (A/B)', out.some(d => d.tipo === 'opcio_variant' && /A/.test(d.detalle.lletres) && /B/.test(d.detalle.lletres)));
  check('FUNCIONAL · detecta precio_modificado', has('precio_modificado'));
  check('FUNCIONAL · detecta amidament_modificat', has('amidament_modificat'));
  check('FUNCIONAL · detecta text_modificat', has('text_modificat'));
  check('FUNCIONAL · detecta partida_eliminada', has('partida_eliminada'));
  check('FUNCIONAL · detecta partida_agregada', has('partida_agregada'));

  // Tope: 30 canvis de preu -> mai més de 15 diferències per-fila (les de `cand`)
  const d2 = [], f2 = [];
  for (let k = 0; k < 30; k++) { d2.push(P('9.' + k, 'Part ' + k, 1, 100)); f2.push(P('9.' + k, 'Part ' + k, 1, 100 + k + 1)); }
  const out2 = detecta(d2, f2, 1);
  const perFila = out2.filter(d => ['precio_modificado', 'amidament_modificat', 'text_modificat', 'partida_eliminada', 'partida_agregada'].includes(d.tipo)).length;
  check('FUNCIONAL · el tope limita a 15 diferències per-fila (30 canvis → ' + perFila + ')', perFila === 15);
  check('FUNCIONAL · el més car surt primer (ordre per €)', out2.find(d => d.tipo === 'precio_modificado').detalle.num === '9.29');
}

console.log(ko === 0 ? ('\n== CAPTURA EXHAUSTIVA OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
