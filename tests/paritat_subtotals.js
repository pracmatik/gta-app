#!/usr/bin/env node
'use strict';
/*
 * PARITAT DELS SUBTOTALS DE CAPÍTOL (25/07/2026).
 * El candau de paritat només mirava el TOTAL general: un descuadre en un capítol compensat per un
 * altre arribava al client sense que ningú se n'assabentés. Aquest guardià agafa les funcions REALS
 * de l'app (_parSubsEsperats, _parSubs, _PARITAT_SUB) i, per a CADA obra real del corpus, genera els
 * 3 fitxers de veritat (HTML d'impressió, docDefinition de pdfmake i Excel final rellegit) i exigeix
 * que cada «SUBTOTAL CAPÍTOL» imprès es correspongui amb un subtotal que l'app sap justificar.
 *
 * SUBTOTALS_SELFTEST=1 → desplaça un esperat: el test HA de sortir vermell (prova que compara de veritat).
 * Ús: node tests/test_paritat_subtotals.js [ruta_html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
const FIXTURES_DIR = process.env.SUBTOTALS_DIR || [path.join(__dirname, '..', 'regres_fixtures'), path.join(__dirname, 'fixtures')].find(fs.existsSync);
const SELFTEST = process.env.SUBTOTALS_SELFTEST === '1';
if (!HTML_PATH) { console.error('X no trobo app_gta.html'); process.exit(1); }
if (!FIXTURES_DIR) { console.error('X no trobo el corpus d\'obres reals'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');

function extractScriptBlocks(h) {
  const out = []; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(h))) { if (!/\bsrc\s*=/.test(m[1])) out.push(m[2]); }
  return out;
}
function extractFunction(src, name) {
  const patterns = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of patterns) {
    const m = pat.exec(src); if (!m) continue;
    const braceStart = src.indexOf('{', m.index); if (braceStart === -1) continue;
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
    let end = i; if (pat === patterns[1] && src[end] === ';') end++;
    return src.slice(m.index, end);
  }
  return null;
}
const blocks = extractScriptBlocks(html);
// les MATEIXES funcions que corren a producció — mai una còpia
const FUNCS = ['num2', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef', 'rowGross', 'pctBase', 'pctBaseAt', 'rowTotal', 'computeTotal', 'sanitizeRows', '_parMoney', '_parTexts', '_parTotals', '_parSubs', '_parGrups', '_parSubsEsperats'];
const engine = { console, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, _COEF: 1 };
vm.createContext(engine);
{
  const parts = ['function coef(){const c=parseFloat(_COEF);return isFinite(c)&&c>0?c:1;}'];
  const subRe = /const\s+_PARITAT_SUB\s*=\s*\/[^\n]*?\/[a-z]*\s*;/.exec(html);
  const labRe = /const\s+_PARITAT_LABEL\s*=\s*\/[^\n]*?\/[a-z]*\s*;/.exec(html);
  if (!subRe || !labRe) { console.error('X no trobo _PARITAT_SUB / _PARITAT_LABEL al HTML'); process.exit(1); }
  parts.push(labRe[0], subRe[0]);
  for (const name of FUNCS) {
    let src = null;
    for (const b of blocks) { src = extractFunction(b, name); if (src) break; }
    if (!src) { console.error('X funció no trobada al HTML: ' + name); process.exit(1); }
    parts.push(src);
  }
  new vm.Script(parts.join('\n'), { filename: 'engine.js' }).runInContext(engine);
}

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
for (const need of ['GTA_EXCEL', 'GTA_PDF', 'GTA_PDFM']) if (!MODS[need]) { console.error('X mòdul no trobat: ' + need); process.exit(1); }
function loadModule(src, extra) {
  const sb = Object.assign({ console, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, Date, RegExp, self: {}, setTimeout, Promise, module: { exports: {} } }, extra || {});
  vm.createContext(sb);
  new vm.Script(src, { filename: 'mod.js' }).runInContext(sb);
  return sb.module.exports;
}
let ExcelJS = null, JSZip = null;
try { ExcelJS = require('exceljs'); JSZip = require('jszip'); } catch (_) {}
const EXCEL = (ExcelJS && JSZip) ? loadModule(MODS.GTA_EXCEL, { ExcelJS, JSZip }) : null;
const PDF = loadModule(MODS.GTA_PDF, {});
const PDFM = loadModule(MODS.GTA_PDFM, {});

const TOL = 0.02;
// mateixa regla que _paritatSubs a l'app: un import imprès sense esperat que el justifiqui = ERROR;
// un esperat que no s'imprimeix = avís (l'app tampoc bloqueja per això).
function compara(impresos, esperats) {
  const rest = esperats.slice(), sobren = [];
  for (const p of impresos) {
    const k = rest.findIndex(e => Math.abs(e - p) <= TOL);
    if (k >= 0) rest.splice(k, 1); else sobren.push(p);
  }
  return { sobren, falten: rest };
}
// Casos SINTÈTICS (sense cap dada de client) perquè aquest guardià també tingui dents a la vigilància
// automàtica pública, on el corpus real no hi és mai. Cobreixen els escenaris que trenquen models ingenus.
const CASOS = [
  { obra: 'SINTETIC · dos capítols simples', coef: 1.05, rows: [
    { tipo: 'cap', desc: '01 FAÇANA' }, { tipo: 'part', num: '1.1', desc: 'Repicat', ut: 'm2', amid: 40, preu: 18.6 },
    { tipo: 'cap', desc: '02 COBERTA' }, { tipo: 'part', num: '2.1', desc: 'Impermeabilització', ut: 'm2', amid: 25, preu: 32.1 } ] },
  { obra: 'SINTETIC · capítol amb opcions A/B', coef: 1.1, rows: [
    { tipo: 'cap', desc: '01 PATI' }, { tipo: 'part', num: '1.1', desc: 'Bastida (comuna)', ut: 'm2', amid: 100, preu: 13 },
    { tipo: 'part', num: '1.2', desc: 'Estuc opció A', ut: 'm2', amid: 50, preu: 22, opcio: 'A' },
    { tipo: 'part', num: '1.3', desc: 'Monocapa opció B', ut: 'm2', amid: 50, preu: 31, opcio: 'B' } ] },
  { obra: 'SINTETIC · opcionals que no sumen', coef: 1.05, rows: [
    { tipo: 'cap', desc: '01 VARIS' }, { tipo: 'part', num: '1.1', desc: 'Neteja', ut: 'pa', amid: 1, preu: 900 },
    { tipo: 'part', num: '1.2', desc: 'Extra opcional', ut: 'ut', amid: 3, preu: 120, gta: 'opc' } ] },
  { obra: 'SINTETIC · partida per percentatge', coef: 1.05, rows: [
    { tipo: 'cap', desc: '01 OBRA' }, { tipo: 'part', num: '1.1', desc: 'Paleta', ut: 'm2', amid: 80, preu: 45 },
    { tipo: 'cap', desc: '02 VARIS' }, { tipo: 'part', num: '2.1', desc: 'SEGURETAT I SALUT', ut: 'pa', amid: 1, preu: 0, pct: 3 } ] },
  { obra: 'SINTETIC · seccions que agrupen capítols', coef: 1, rows: [
    { tipo: 'sec', desc: 'a) Pati interior' },
    { tipo: 'cap', desc: '01 MITJANS AUXILIARS' }, { tipo: 'part', num: '1.1', desc: 'Bastida', ut: 'm2', amid: 60, preu: 14 },
    { tipo: 'cap', desc: '02 PARAMENTS' }, { tipo: 'part', num: '2.1', desc: 'Arrebossat', ut: 'm2', amid: 90, preu: 26 },
    { tipo: 'sec', desc: 'b) Coberta' },
    { tipo: 'part', num: '3.1', desc: 'Tela asfàltica', ut: 'm2', amid: 30, preu: 41 } ] },
  { obra: 'SINTETIC · capítol que suma zero', coef: 1.05, rows: [
    { tipo: 'cap', desc: '01 PENDENT DE VALORAR' }, { tipo: 'part', num: '1.1', desc: 'A justificar', ut: 'pa', amid: 1, preu: 0 },
    { tipo: 'cap', desc: '02 REAL' }, { tipo: 'part', num: '2.1', desc: 'Pintura', ut: 'm2', amid: 20, preu: 12.5 } ] },
];
const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
let ok = 0, ko = 0, avisos = 0;

(async () => {
  const corpus = CASOS.map(c => ({ nom: c.obra, fx: c }))
    .concat(files.map(f => ({ nom: f.replace('.json', ''), fx: JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8')) })));
  for (const item of corpus) {
    const f = item.nom + '.json';
    const fx = item.fx;
    engine._COEF = fx.coef;
    const rows = engine.sanitizeRows(JSON.parse(JSON.stringify(fx.rows)));
    let esperats = engine._parSubsEsperats(rows);
    if (SELFTEST && esperats.length) esperats = esperats.map((v, i) => i === 0 ? v + 7 : v);
    const nom = f.replace('.json', '');
    const ctx = { rows, coef: fx.coef, idioma: 'ca', obra: fx.obra || f, gref: 'G26.TEST', tec: '', coac: '', titu: '', notes: [], showSubs: true, logo: 'data:image/png;base64,iVBORw0KGgo=' };
    const errors = [], notes = [];
    if (!esperats.length) { console.log('· ' + nom + ' (sense capítols: res a comparar)'); ok++; continue; }

    const revisa = (etiqueta, impresos) => {
      if (!impresos.length) { notes.push(etiqueta + ': cap SUBTOTAL imprès (esperats ' + esperats.length + ')'); return; }
      const r = compara(impresos, esperats);
      // Que la llista d'esperats sigui més llarga NO és error: cobreix les dues agrupacions possibles
      // (per capítol i per secció) i cap sortida imprimeix les dues alhora. Només compta el que sobra.
      if (r.sobren.length) errors.push(etiqueta + ': import sense justificació [' + r.sobren.map(v => v.toFixed(2)).join('/') + '] · esperats [' + esperats.map(v => v.toFixed(2)).join('/') + ']');
    };
    try {
      const h = PDF.buildPressupostHtml(ctx);
      revisa('HTML', engine._parSubs(h.replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)));
    } catch (e) { errors.push('HTML ERROR: ' + e.message); }
    try {
      const dd = PDFM.buildPressupostDoc(ctx);
      revisa('PDF', engine._parSubs(engine._parTexts(dd.content || dd, [])));
    } catch (e) { errors.push('PDF ERROR: ' + e.message); }
    if (EXCEL) {
      try {
        const blob = await EXCEL.buildExcelFinal(ctx);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
        const subs = [];
        wb.eachSheet(ws => ws.eachRow(row => {
          let sub = false, tot = false;
          row.eachCell(c => { if (typeof c.value === 'string') { if (/TOTAL\s+(PRESSUPOST|PRESUPUESTO)/i.test(c.value)) tot = true; else if (/SUBTOTAL\s+CAP[ÍI]T(OL|ULO)/i.test(c.value)) sub = true; } });
          if (!sub || tot) return;
          row.eachCell(c => {
            const v = (typeof c.value === 'number') ? c.value : (c.value && typeof c.value === 'object' && typeof c.value.result === 'number' ? c.value.result : engine._parMoney(c.value));
            if (v != null && isFinite(v) && Math.abs(v) > 0.001) subs.push(Math.round(v * 100) / 100);
          });
        }));
        revisa('EXCEL', subs);
      } catch (e) { errors.push('EXCEL ERROR: ' + e.message); }
    } else notes.push('EXCEL OMÈS: falta exceljs (npm i exceljs) — no s\'ha comprovat');

    if (errors.length) { ko++; console.error('X ' + nom + ' → ' + errors.join(' · ')); }
    else { ok++; avisos += notes.length; console.log('OK ' + nom + ' (' + esperats.length + ' subtotals) ' + (notes.length ? '· avisos: ' + notes.join(' · ') : '')); }
  }
  console.log(ko === 0 ? ('\n== SUBTOTALS: VERDS -- ' + ok + '/' + (ok + ko) + ' obres' + (avisos ? ' (' + avisos + ' avisos, no bloquegen) ' : '') + ' ==')
                       : ('\n== SUBTOTALS: VERMELLS -- ' + ko + ' obres amb un import que ningú pot justificar =='));
  process.exit(ko === 0 ? 0 : 1);
})();
