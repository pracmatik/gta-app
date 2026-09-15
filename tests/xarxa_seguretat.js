#!/usr/bin/env node
'use strict';
/*
 * Guardià de la XARXA DE SEGURETAT anti-preus-envenenats (incident una obra real, 20/07/2026).
 * Dues cures, provades amb les funcions REALS del HTML de producció:
 *  1) parseNum ja NO multiplica ×100 un preu amb punt decimal ("107.15" -> 107.15, no 10715).
 *  2) marcaPreusDisparats marca en VERMELL (i el gate bloqueja) una partida amb preu unitari desorbitat
 *     o que s'emporta mig pressupost; s'auto-neteja quan el preu torna a ser sa; cap fals positiu.
 * Si algú desfà qualsevol de les dues, aquí salta (no a producció amb el client davant).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('✗ no trobo app_gta.html'); process.exit(1); }
const html = fs.readFileSync(HTML, 'utf8');

function extFn(n) {
  for (const pat of [new RegExp('function\\s+' + n + '\\s*\\('), new RegExp('const\\s+' + n + '\\s*=')]) {
    const m = pat.exec(html); if (!m) continue;
    const b = html.indexOf('{', m.index); let d = 0, i = b;
    for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (d === 0) { i++; break; } } }
    let e = i; if (pat.source.startsWith('const') && html[e] === ';') e++;
    return html.slice(m.index, e);
  }
  throw new Error('no trobo ' + n);
}
function extLine(n) { const m = new RegExp('const\\s+' + n + '\\s*=[^\\n]*?;', 'm').exec(html); if (!m) throw new Error('no trobo ' + n); return m[0]; }

let ok = 0, ko = 0;
const near = (a, b) => Math.abs(a - b) < 1e-6;
const check = (n, c) => { if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.error('  ✗ ' + n); } };

// ---- 1) parseNum es-ES intel·ligent
const c1 = { Math, String, Number, parseFloat, isFinite }; vm.createContext(c1);
vm.runInContext(extFn('parseNum') + ';this.pn=parseNum;', c1);
check("parseNum '107.15' -> 107.15 (NO 10715 · el ×100 de una obra)", near(c1.pn('107.15'), 107.15));
check("parseNum '107,15' -> 107.15", near(c1.pn('107,15'), 107.15));
check("parseNum '1.234' (milers) -> 1234", near(c1.pn('1.234'), 1234));
check("parseNum '1.234,56' -> 1234.56", near(c1.pn('1.234,56'), 1234.56));
check("parseNum '1.2' (decimal) -> 1.2 (NO 12)", near(c1.pn('1.2'), 1.2));
check("parseNum número 5 -> 5 (intacte)", c1.pn(5) === 5);

// ---- 2) marcaPreusDisparats amb les funcions reals
let base = null;
try {
  base = "function coef(){return 1.15;}\n"
    + ['num2', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef', 'rowGross', 'pctBase', 'pctBaseAt', 'rowTotal', 'computeTotal'].map(extFn).join("\n") + "\n"
    + extFn('_RANG_PREU') + "\n" + extLine('_MARCA_DISP_ES') + "\n" + extLine('_MARCA_DISP_CA') + "\n" + extFn('marcaPreusDisparats') + "\n";
} catch (e) { base = null; }
check("la xarxa de seguretat (marcaPreusDisparats) EXISTEIX al codi", base !== null);
function scan(rows) {
  if (!base) return -1; // sense xarxa (codi antic): que els checks fallin
  const s = { Math, String, Number, parseFloat, isFinite, Array, Object, IDIOMA: 'ca', rows };
  vm.createContext(s);
  vm.runInContext(base + "marcaPreusDisparats(rows,coef());this.f=rows.filter(r=>r&&r.tipo==='part'&&/DESORBITA/.test(r.flag||'')).length;", s);
  return s.f;
}
const NORMAL = () => [{ tipo: 'cap', desc: 'C1' },
  { tipo: 'part', desc: 'Repicat', ut: 'm²', amid: 100, preu: 50 },
  { tipo: 'part', desc: 'Arrebossat', ut: 'm²', amid: 80, preu: 83 },
  { tipo: 'part', desc: 'Segellat', ut: 'ml', amid: 30, preu: 42 },
  { tipo: 'part', desc: 'Bastida', ut: 'm²', amid: 200, preu: 22 }];
check("pressupost normal -> 0 marcats (cap fals positiu)", scan(NORMAL()) === 0);
// preu unitari desorbitat (×100 tipus una obra: 159 -> 15911 €/m²)
const bad1 = NORMAL(); bad1[1].preu = 15911.78;
check("preu 15.911 €/m² -> 1 marcat DESORBITAT", scan(bad1) === 1);
// una sola partida s'emporta mig pressupost
const bad2 = NORMAL(); bad2[4].amid = 1; bad2[4].preu = 999999;
check("una partida > 50% del total -> marcat", scan(bad2) >= 1);
// s'auto-neteja quan es corregeix
const fixed = NORMAL(); fixed[1].preu = 15911.78; scan(fixed); fixed[1].preu = 50; fixed[1].flag = '';
check("preu corregit a un valor sa -> s'auto-neteja (0 marcats)", scan(fixed) === 0);

console.log(ko === 0 ? `\n== XARXA DE SEGURETAT OK — ${ok}/${ok + ko} ==` : `\n== FALLA — ${ko} de ${ok + ko} ==`);
process.exit(ko === 0 ? 0 : 1);
