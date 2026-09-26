#!/usr/bin/env node
'use strict';
/*
 * GUARDIÀ DEL MÒDUL «CARTA I FOTOS» (25/07/2026).
 * És el mòdul contractat a part (OS §2.1, +1.080 €) i era l'ÚNIC de l'app SENSE cap prova pròpia:
 * es podia trencar en un desplegament i ningú se n'assabentaria fins que el client obrís el PDF.
 * Aquest guardià construeix els DOS documents de veritat (carta i full de fotos, en pdfmake i en
 * HTML d'impressió) amb les funcions REALS de producció i comprova el que ha de sortir sí o sí:
 * destinatari, adreça de l'actuació, data en lletra, codi d'obra, logotip, i la maquetació de fotos
 * que fa servir GTA (portada a pàgina sencera + graella de 4). I que MAI hi surti un «undefined».
 *
 * Ús: node tests/test_carta_fotos.js [ruta_html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML_PATH) { console.error('X no trobo app_gta.html'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

function extractModules(h) {
  const mods = {}; const START = '(function(root){'; const END = '})(typeof window!=="undefined"?window:globalThis);';
  let i = 0;
  while ((i = h.indexOf(START, i)) !== -1) {
    const j = h.indexOf(END, i); if (j === -1) break;
    const src = h.slice(i, j + END.length);
    const m = src.match(/root\.(GTA_[A-Z]+)\s*=\s*api/); if (m) mods[m[1]] = src;
    i = j + END.length;
  }
  return mods;
}
const MODS = extractModules(html);
if (!MODS.GTA_CARTA) { console.error('X mòdul GTA_CARTA no trobat al HTML'); process.exit(1); }
const sb = { console, isFinite, Math, parseFloat, parseInt, Number, String, Array, Object, JSON, Date, RegExp, self: {}, setTimeout, Promise, module: { exports: {} } };
vm.createContext(sb);
new vm.Script(MODS.GTA_CARTA, { filename: 'carta.js' }).runInContext(sb);
const CARTA = sb.module.exports;
for (const fn of ['buildCartaHtml', 'buildFotosHtml', 'buildCartaDoc', 'buildFotosDoc']) {
  check('el mòdul exporta ' + fn, typeof CARTA[fn] === 'function');
}
check('el mòdul porta el logotip de GTA incrustat', typeof CARTA.logo === 'string' && CARTA.logo.indexOf('data:image') === 0);

// ---- context de prova: dades FICTÍCIES amb la forma real que fa servir GTA ----
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const foto = (n, general) => ({ data: FOTO, nom: 'foto' + n + '.jpg', general: !!general });
const ctx = (extra) => Object.assign({
  idioma: 'ca', codiG: 'G26.999', codisTec: 'Xa/XaMr/Mo',
  empresa: 'COMUNITAT DE PROPIETARIS DE PROVA', persona: 'Sr. Exemple Exemple',
  adreca: 'Carrer de Prova 12', poblacio: 'Barcelona', data: '2026-07-27',
  titol: 'ACTUACIÓ A FAÇANA I PATI', fotos: [],
}, extra || {});

// --- textos plans d'un docDefinition de pdfmake (per poder-hi buscar) ---
function textos(node, out) {
  out = out || [];
  if (node == null) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { for (const x of node) textos(x, out); return out; }
  if (typeof node === 'object') {
    if (typeof node.text !== 'undefined') textos(node.text, out);
    for (const k of ['content', 'table', 'body', 'stack', 'columns', 'ul', 'ol']) if (node[k]) textos(node[k], out);
  }
  return out;
}
function imatges(node, out) {
  out = out || [];
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) { for (const x of node) imatges(x, out); return out; }
  if (typeof node.image === 'string') out.push(node.image);
  for (const k of ['content', 'table', 'body', 'stack', 'columns']) if (node[k]) imatges(node[k], out);
  return out;
}
const SOSPITOSOS = /undefined|\[object Object\]|NaN|null,|Infinity/;

// ================== CARTA ==================
console.log('\n— carta —');
for (const idioma of ['ca', 'es']) {
  const c = ctx({ idioma });
  const doc = CARTA.buildCartaDoc(c);
  const tx = textos(doc.content).join(' | ');
  check(idioma + ' · la carta va dirigida a la persona («ATT. …»)', tx.indexOf('ATT. SR. EXEMPLE EXEMPLE') >= 0);
  check(idioma + ' · surt l\'empresa destinatària en majúscules', tx.indexOf('COMUNITAT DE PROPIETARIS DE PROVA') >= 0);
  check(idioma + ' · surt el codi d\'obra i els codis del tècnic', tx.indexOf('G26.999') >= 0 && tx.indexOf('Xa/XaMr/Mo') >= 0);
  check(idioma + ' · surt l\'adreça de l\'actuació', tx.indexOf('Carrer de Prova 12') >= 0);
  check(idioma + ' · la data va en lletra i amb població («Barcelona, a 27 de juliol de 2026»)', /Barcelona,\s+a?\s*\d{1,2}\s+de?\s+\w+\s+de\s+\d{4}/i.test(tx));
  check(idioma + ' · porta el logotip', imatges(doc.content).some(s => s.indexOf('data:image') === 0));
  check(idioma + ' · cap «undefined» ni text tècnic escapat al document', !SOSPITOSOS.test(tx));
  const h = CARTA.buildCartaHtml(c);
  check(idioma + ' · la versió de reserva (impressió del navegador) també surt sencera',
    h.indexOf('G26.999') >= 0 && h.indexOf('Carrer de Prova 12') >= 0 && !SOSPITOSOS.test(h.replace(/<[^>]+>/g, ' ')));
}
// sense persona la pantalla ja ho bloqueja; el constructor no ha de petar mai
try { CARTA.buildCartaDoc(ctx({ persona: '', empresa: '' })); check('la carta no peta si falten dades opcionals', true); }
catch (e) { check('la carta no peta si falten dades opcionals', false); }

// ================== FULL DE FOTOS ==================
console.log('\n— full de fotos —');
// maquetació real de GTA: la marcada amb ★ va sola a la primera pàgina; la resta, de 4 en 4
const casos = [
  { n: 'només portada', fotos: [foto(1, true)], pagines: 1 },
  { n: 'portada + 4', fotos: [foto(1, true), foto(2), foto(3), foto(4), foto(5)], pagines: 2 },
  { n: 'portada + 5 (2 pàgines de graella)', fotos: [foto(1, true), foto(2), foto(3), foto(4), foto(5), foto(6)], pagines: 3 },
  { n: 'sense portada, 3 fotos (maquetació especial)', fotos: [foto(1), foto(2), foto(3)], pagines: 1 },
  { n: '9 fotos (el volum típic de GTA)', fotos: [foto(1, true)].concat([2, 3, 4, 5, 6, 7, 8, 9].map(i => foto(i))), pagines: 3 },
];
for (const cas of casos) {
  const doc = CARTA.buildFotosDoc(ctx({ fotos: cas.fotos }));
  const tx = textos(doc.content).join(' | ');
  const imgs = imatges(doc.content);
  const salts = JSON.stringify(doc.content).split('"pageBreak"').length - 1;
  check('fotos · ' + cas.n + ': hi surten totes les fotos', imgs.filter(s => s === FOTO).length === cas.fotos.length);
  check('fotos · ' + cas.n + ': ' + cas.pagines + ' pàgina/es (' + (cas.pagines - 1) + ' salts)', salts === cas.pagines - 1);
  check('fotos · ' + cas.n + ': cada pàgina repeteix títol i adreça', tx.indexOf('ACTUACIÓ A FAÇANA I PATI') >= 0 && tx.toUpperCase().indexOf('CARRER DE PROVA 12') >= 0);
  check('fotos · ' + cas.n + ': cap «undefined»', !SOSPITOSOS.test(tx));
}
const h = CARTA.buildFotosHtml(ctx({ fotos: [foto(1, true), foto(2), foto(3)] }));
check('fotos · la versió de reserva també inclou les 3 fotos', (h.split(FOTO).length - 1) >= 3);

// El títol de la capçalera NO pot trepitjar el logotip (defecte real trobat el 25/07 amb una mostra en PDF:
// amb marges 70/70 el text arribava a x=480 i el logotip comença a x=455 → s'hi ficava a sota).
console.log('\n— la capçalera no pot trepitjar el logotip —');
{
  const doc = CARTA.buildFotosDoc(ctx({ titol: 'ACTUACIÓ A FAÇANES, PATIS INTERIORS I COBERTA COMUNITÀRIA DE L\'EDIFICI', fotos: [foto(1, true), foto(2)] }));
  const logo = imatges(doc.content).length && JSON.stringify(doc.content).match(/"absolutePosition":\{"x":(\d+)/);
  const marges = JSON.stringify(doc.content).match(/"decoration":"underline","margin":\[(\d+),0,(\d+),/g) || [];
  const xLogo = logo ? +logo[1] : 455;
  const AMPLE = 595, MARGE_DRET_PAGINA = 45; // A4 i pageMargins del full de fotos
  const dretText = marges.map(m => AMPLE - MARGE_DRET_PAGINA - (+/,0,(\d+),/.exec(m)[1]));
  check('el títol i l\'adreça s\'aturen abans del logotip (x=' + xLogo + ')', dretText.length > 0 && dretText.every(x => x <= xLogo));
  check('la capçalera segueix centrada a la pàgina (marges esquerre i dret iguals)',
    marges.every(m => /\[(\d+),0,\1,/.test(m)));
  check('un títol llarg no es perd: hi segueix sencer', textos(doc.content).join(' ').indexOf('COBERTA COMUNITÀRIA') >= 0);
  const hf = CARTA.buildFotosHtml(ctx({ titol: 'TÍTOL MOLT LLARG DE PROVA PER VEURE SI TREPITJA EL LOGOTIP', fotos: [foto(1, true)] }));
  check('la versió de reserva també reserva espai per al logotip', /\.hd\s+\.titols\{[^}]*padding[^}]*\}/.test(hf));
}

console.log(ko === 0 ? ('\n== CARTA I FOTOS OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
