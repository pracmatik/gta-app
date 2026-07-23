#!/usr/bin/env node
'use strict';
/*
 * Guardià del LECTOR DE BC3 (22/07/2026 · bug Marina "no diferencia el text de les partides").
 *
 * Per què: parseBC3 classificava per posició (amb fills = capítol, fulla = partida). Presto/CYPE exporten
 * la descomposició completa (partida -> mà d'obra/materials), així que baixava un nivell de més: 31 partides
 * reals sortien com ~141 línies de recursos interns, i els conceptes-recepta de Presto es colaven com a arrels.
 * Cura: (a) el concepte que porta MEDICIÓ (~M) ÉS la partida i NO es baixa a la seva descomposició;
 * (b) l'obra arrel de FIEBDC es marca amb "##" i és l'únic root. Guardià CONDUCTUAL amb un BC3 sintètic.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- Extreu parseBC3 (i el seu ajudant parseMesuraDetall) i executa'l ------
const mPmd = h.match(/function parseMesuraDetall\(raw\)\{[\s\S]*?\n\}/); // dependència nova (22/07): parseBC3 la crida
const m = h.match(/function parseBC3\(rawText\)\{[\s\S]*?\n\}\nfunction renumberRows/);
check('existeix la funció parseBC3', !!m);
let parseBC3 = null;
if (m) { try { parseBC3 = new Function('IDIOMA', (mPmd ? mPmd[0] + '\n' : '') + m[0].replace(/\nfunction renumberRows$/, '') + '\nreturn parseBC3;')('es'); } catch (e) { console.error('  X  no s\'ha pogut evaluar parseBC3: ' + e.message); } }

// BC3 sintètic FIEBDC-3: obra## -> 1 capítol -> 2 partides, cadascuna amb descomposició (bàsics).
// El lector correcte ha de donar 1 capítol + 2 partides, MAI els bàsics com a partides.
const BC3 = [
  '~C|OBRA##||Obra de prova|0|',
  '~C|CAP1#||Capitol U|0|',
  '~C|PAR1|m2|Partida u de obra|0|',
  '~C|PAR2|ml|Partida dos de obra|0|',
  '~C|mo001|h|Peon ordinario|0|',
  '~C|mt001|kg|Cemento gris|0|',
  '~D|OBRA##|CAP1\\1\\1|',
  '~D|CAP1#|PAR1\\1\\1\\PAR2\\1\\1|',
  '~D|PAR1|mo001\\1\\0.5\\mt001\\1\\2|',
  '~D|PAR2|mo001\\1\\0.3|',
  '~M|CAP1\\PAR1||10|',
  '~M|CAP1\\PAR2||20|'
].join('\r\n');

if (parseBC3) {
  const out = parseBC3(BC3);
  const caps = out.rows.filter(r => r.tipo === 'cap' || r.tipo === 'sec');
  const parts = out.rows.filter(r => r.tipo === 'part');
  check('1 capítol (no compta els conceptes-recepta com a arrel)', caps.length === 1);
  check('2 partides (les mesurades ~M), NO els 3 bàsics de descomposició', parts.length === 2);
  check('el text és el de la PARTIDA, no el del recurs intern', parts.every(p => /Partida/.test(p.desc)) && !parts.some(p => /Peon|Cemento/.test(p.desc)));
  check('la quantitat surt de la medició ~M (10 i 20)', parts.map(p => p.amid).sort().join(',') === '10,20');
  check('la unitat és la de la partida (m2/ml), no la del recurs (h/kg)', parts.every(p => p.ut === 'm2' || p.ut === 'ml'));
}

// --- Guàrdies de codi (que el fix hi segueixi) -----------------------------
check('l\'obra "##" és el root prioritari', h.includes('Object.keys(concepts).filter(c=>/##$/.test(c))') && /roots=Object\.keys\(concepts\)\.filter\(c=>\/##\$\/\.test\(c\)\)/.test(h));
check('el concepte mesurat (~M) NO baixa a la seva descomposició', h.includes('if(kids&&kids.length&&!isFinite(measured)){'));

console.log(ko === 0 ? ('\n== LECTOR BC3 OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
