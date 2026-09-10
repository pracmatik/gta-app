#!/usr/bin/env node
'use strict';
/*
 * Guardià de les DESCRIPCIONS del BC3 (31/07/2026 · la tècnica: «hem tornat a intentar crear un nou
 * pressupost a partir d'un arxiu TCQ i en cap dels dos casos ha copiat cap descripció de partida,
 * només títols»).
 *
 * Per què: el FIEBDC-3 guarda el títol curt al concepte (~C, camp RESUMEN) i la descripció SENCERA al
 * registre de text (~T). El lector feia «resumen || text»: com que el títol hi és SEMPRE, la branca del
 * text no s'executava MAI. Mesurat amb els dos fitxers reals que va enviar el 31/07: 65 i 44
 * descripcions al document → 2 i 0 arribaven a la pantalla. Després de la cura: 66/68 i 86/87.
 *
 * Aquest guardià és CONDUCTUAL i amb un BC3 sintètic (res confidencial al repo públic). Cobreix els dos
 * casos reals que hi ha als seus fitxers:
 *   A) el ~T comença repetint EXACTAMENT el títol  → la repetició es treu, la descripció es conserva
 *   B) el ~T comença amb el títol i continua la frase → es conserva la continuació, no es perd cap paraula
 *   C) partida sense ~T → segueix funcionant amb el títol sol (no s'inventa res)
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

const mPmd = h.match(/function parseMesuraDetall\(raw\)\{[\s\S]*?\n\}/);
const m = h.match(/function parseBC3\(rawText\)\{[\s\S]*?\n\}\nfunction renumberRows/);
check('existeix la funció parseBC3', !!m);
let parseBC3 = null;
if (m) { try { parseBC3 = new Function('IDIOMA', (mPmd ? mPmd[0] + '\n' : '') + m[0].replace(/\nfunction renumberRows$/, '') + '\nreturn parseBC3;')('es'); } catch (e) { console.error('  X  no s\'ha pogut evaluar parseBC3: ' + e.message); } }

const TIT_A = 'Transporte y retirada de andamio tubular de fachada.';
const DESC_A = 'Transporte y retirada de andamio tubular normalizado, tipo multidireccional, hasta 25 m de altura.';
const TIT_B = 'Montaje y desmontaje de andamio tubular';
const CUA_B = 'metalico fijo formado por marcos de 70 cm con bases regulables y plataformas de trabajo.';

const BC3 = [
  '~C|OBRA##||Obra de prova|0|',
  '~C|CAP1#||Capitol U|0|',
  '~C|PARA|u|' + TIT_A + '|0|',
  '~C|PARB|m2|' + TIT_B + '|0|',
  '~C|PARC|ml|Partida sense text llarg|0|',
  '~T|PARA|' + TIT_A + ' ' + DESC_A + '|',   // cas A: el text repeteix el títol i continua
  '~T|PARB|' + TIT_B + ' ' + CUA_B + '|',    // cas B: el text amplia la mateixa frase
  '~D|OBRA##|CAP1\\1\\1|',
  '~D|CAP1#|PARA\\1\\1\\PARB\\1\\1\\PARC\\1\\1|',
  '~M|CAP1\\PARA||1|',
  '~M|CAP1\\PARB||2|',
  '~M|CAP1\\PARC||3|'
].join('\r\n');

if (parseBC3) {
  const r = parseBC3(BC3);
  const parts = (r.rows || []).filter(x => x.tipo === 'part');
  check('llegeix les 3 partides', parts.length === 3);
  const byTit = t => parts.find(p => String(p.desc || '').split('\n')[0] === t);

  const a = byTit(TIT_A);
  check('A · la partida amb títol repetit existeix', !!a);
  if (a) {
    const cos = String(a.desc).split('\n').slice(1).join(' ').trim();
    check('A · SÍ arriba la descripció (abans no arribava mai)', cos.length > 20);
    check('A · la descripció és la del document, sencera', cos === DESC_A);
    check('A · el títol no surt duplicat', cos.indexOf(TIT_A) === -1);
  }

  const b = byTit(TIT_B);
  check('B · la partida amb frase continuada existeix', !!b);
  if (b) {
    const cos = String(b.desc).split('\n').slice(1).join(' ').trim();
    check('B · SÍ arriba la continuació de la frase', cos === CUA_B);
    check('B · no es perd cap paraula del document', ('' + TIT_B + ' ' + cos) === (TIT_B + ' ' + CUA_B));
  }

  const c = byTit('Partida sense text llarg');
  check('C · sense descripció al document, el títol sol segueix bé', !!c && String(c.desc).indexOf('\n') === -1);
}

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
