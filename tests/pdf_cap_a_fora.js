#!/usr/bin/env node
'use strict';
/*
 * Guardià «RES NO POT SORTIR-SE DEL FULL» (31/07/2026 · la tècnica, amb el PDF adjunt).
 *
 * Què va passar: al PDF del pressupost la columna d'IMPORTS quedava fora de la pàgina —
 * «11.005,5…», «30.006,2…», «94.078,9…» tallats pel marge dret, i la capçalera «Imp» a mitges.
 * Causa: les columnes d'amplada fixa sumaven EXACTAMENT l'amplada útil del full. Zero marge:
 * qualsevol arrodoniment de més i la taula se'n sortia. Es va veure al PDF real que va enviar ella.
 *
 * Ara les amplades es calculen a partir del full. Aquest guardià fa el compte i exigeix marge de
 * sobres per a la descripció. Si demà algú eixampla una columna, o canvia els marges del document,
 * o n'afegeix una de nova, això surt en vermell abans de publicar-se.
 *
 * I el segon guardià: CAP AVÍS NOSTRE pot anar a un document del client. Els avisos de la lectura
 * s'escrivien a les notes, i les notes s'imprimeixen: al PDF que elles envien a la comunitat sortia
 * «Lectura: 32 pàgines · 1 fragments · 14 capítols · 59 partides».
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); if (extra) console.error('     ' + extra); } };

// ── 1 · la taula del pressupost cap al full, amb marge ─────────────────────
const num = (re) => { const m = h.match(re); return m ? m[1] : null; };
const full = parseFloat(num(/_FULL_A4=([\d.]+)/) || '0');
const marge = parseFloat(num(/_MARGE_DOC=([\d.]+)/) || '0');
const pad = parseFloat(num(/_PAD_CEL=([\d.]+)/) || '0');
const ncol = parseFloat(num(/_N_COL=([\d.]+)/) || '0');
const mFix = h.match(/_FIXES=\[([\d.,\s]+)\]/);
check('les amplades es calculen a partir del full (no són números solts)', !!(full && marge && pad && ncol && mFix),
  'si tornen a ser números fixos escrits a mà, ningú sabrà si caben');
if (full && mFix) {
  const fixes = mFix[1].split(',').map(x => parseFloat(x.trim()));
  const util = full - 2 * marge - pad * ncol;
  const sobra = util - fixes.reduce((a, b) => a + b, 0);
  check('el full és A4 (595,28 punts)', Math.abs(full - 595.28) < 0.5);
  check('hi ha ' + (ncol - 1) + ' columnes fixes i una d\'elàstica', fixes.length === ncol - 1);
  check('queden ' + Math.round(sobra) + ' punts per a la descripció (calen 180 com a mínim)', sobra >= 180,
    'amb menys, la descripció es fa il·legible; amb un número negatiu, la taula se surt del full com el 31/07');
  check('i sobra marge de seguretat: no s\'apura el full al punt', sobra >= 180 && sobra <= util - 100,
    'el 31/07 el marge era ZERO i per això la columna d\'imports queia fora');
  const eur = fixes[fixes.length - 1];
  check('la columna d\'imports (' + eur + ' punts) hi cap un import de 6 xifres', eur >= 60,
    '«94.078,90 €» necessita uns 55 punts a cos 8,6');
}

// ── 2 · cap avís nostre al document del client ─────────────────────────────
check('els avisos nostres porten marca perquè no s\'imprimeixin', /const MARCA_INTERNA=/.test(h));
check('hi ha la porta que treu els avisos nostres dels documents', /const notesDelClient=/.test(h));
const nDoc = (h.match(/notes:notesDelClient\(\)/g) || []).length;
const nCru = (h.match(/notes:NOTES\b/g) || []).length;
check('els documents fan servir NOMÉS les notes del client (' + nDoc + ' llocs)', nDoc >= 2);
check('i el que es DESA segueix guardant-ho tot, avisos inclosos (' + nCru + ' llocs)', nCru >= 1,
  'si els avisos no es desen, en reobrir el pressupost es perden i el tècnic no els veu');
for (const [què, re] of [
  ['els avisos de la lectura', /NOTES=\[MARCA_INTERNA\+"⚠ "\+t\("ing_avisos"\)\]/],
  ['els avisos del context de la DF', /NOTES=\[MARCA_INTERNA\+"⚠ "\+\(IDIOMA==="es"\?"Contexto DF/],
]) check('van marcats: ' + què, re.test(h));
check('a la pantalla es diu clarament que aquests avisos NO surten al document',
  /no sale en el documento|no surt al document/.test(h));

// ── 3 · «amagar línies de càlcul» les amaga TOTES (31/07) ─────────────────
check('en amagar la composició, no en queda cap a mitges', !/isV\s*\|\|\s*ctx\.showSubs/.test(h) && !/SHOWSUBS\s*\|\|\s*isV/.test(h),
  'abans amagava només les que sumen i deixava les informatives, amb el preu unitari que van demanar treure el 23/07');
check('la pantalla i el document amaguen igual', /if\(SHOWSUBS\)html\+=/.test(h) && /if\(ctx\.showSubs!==false\)\{/.test(h));

// ── 4 · la població de l'obra (31/07) ─────────────────────────────────────
check('hi ha el camp de població de l\'obra', /id="h_ciutat"/.test(h));
check('es desa i es recupera com els altres camps del capçal', /"h_obra","h_ciutat"/.test(h) && /HEADER\.ciutat/.test(h));
check('surt al document, sota l\'adreça', /ctx\.ciutat\?\{text:String\(ctx\.ciutat\)/.test(h));
check('i té etiqueta en els dos idiomes', /h_ciutat:"Població de l/.test(h) && /h_ciutat:"Población de la obra"/.test(h));

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
