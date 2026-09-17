#!/usr/bin/env node
'use strict';
/*
 * PARITAT DELS FITXERS REALS (via exp. 1) — el compromís 2 diu "els números quadren
 * al cèntim entre pantalla, Excel, CSV i PDF". El CSV ja té el seu candau; aquest
 * test genera l'EXCEL FINAL i el PDF REALS (mòduls GTA_EXCEL / GTA_PDF / GTA_PDFM
 * extrets de producció) per a TOT el corpus d'obres reals i comprova que el TOTAL
 * imprès a cada fitxer coincideix amb el total de pantalla (computeTotal).
 *
 * Requereix exceljs instal·lat en local (npm i exceljs) — si no hi és, la part
 * d'Excel s'omet AMB AVÍS VISIBLE (mai en silenci) i el test falla en CI privat.
 *
 * Ús: node tests/test_paritat_fitxers.js [ruta_html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
const FIXTURES_DIR = [path.join(__dirname, '..', 'regres_fixtures'), path.join(__dirname, 'fixtures')].find(fs.existsSync);
// PARITAT_SELFTEST=1 desplaça l'esperat +7 € a propòsit: el test HA de sortir vermell
// (prova que la comparació i l'extracció del total imprès són reals, no decoratives).
const SELFTEST = process.env.PARITAT_SELFTEST === '1';
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ---- extracció de funcions del motor (mateix patró que regres.js) ----
function extractScriptBlocks(h) {
  const out = []; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(h))) { if (!/\bsrc\s*=/.test(m[1])) out.push(m[2]); }
  return out;
}
function extractFunction(src, name) {
  const patterns = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of patterns) {
    const m = pat.exec(src); if (!m) continue;
    const braceStart = src.indexOf('{', m.index);
    if (braceStart === -1) continue;
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    let end = i;
    if (pat === patterns[1] && src[end] === ';') end++;
    return src.slice(m.index, end);
  }
  return null;
}
const blocks = extractScriptBlocks(html);
const FUNCS = ['num2', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef', 'priceMissing', 'priceBlocking', 'rowGross', 'pctBase', 'pctBaseAt', 'rowTotal', 'computeTotal', 'sanitizeRows'];
const engine = { console, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, _COEF: 1 };
vm.createContext(engine);
{
  const parts = ['function coef(){const c=parseFloat(_COEF);return isFinite(c)&&c>0?c:1;}'];
  for (const name of FUNCS) {
    let src = null;
    for (const b of blocks) { src = extractFunction(b, name); if (src) break; }
    if (!src) { console.error('✗ funció del motor no trobada: ' + name); process.exit(1); }
    parts.push(src);
  }
  new vm.Script(parts.join('\n'), { filename: 'engine.js' }).runInContext(engine);
}

// ---- extracció dels mòduls UMD (GTA_EXCEL / GTA_PDF / GTA_PDFM) ----
function extractModules(h) {
  const mods = {}; const START = '(function(root){'; const END = '})(typeof window!=="undefined"?window:globalThis);';
  let i = 0;
  while ((i = h.indexOf(START, i)) !== -1) {
    const j = h.indexOf(END, i);
    if (j === -1) break;
    const src = h.slice(i, j + END.length);
    const m = src.match(/root\.(GTA_[A-Z]+)\s*=\s*api/);
    if (m) mods[m[1]] = src;
    i = j + END.length;
  }
  return mods;
}
const MODS = extractModules(html);
for (const need of ['GTA_EXCEL', 'GTA_PDF', 'GTA_PDFM']) {
  if (!MODS[need]) { console.error('✗ mòdul no trobat al HTML: ' + need); process.exit(1); }
}
function loadModule(src, extraGlobals) {
  const sb = Object.assign({ console, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, Date, RegExp, self: {}, setTimeout, Promise, Blob: typeof Blob !== 'undefined' ? Blob : undefined, module: { exports: {} } }, extraGlobals || {});
  vm.createContext(sb);
  new vm.Script(src, { filename: 'mod.js' }).runInContext(sb);
  return sb.module.exports;
}

let ExcelJS = null, JSZip = null;
try { ExcelJS = require('exceljs'); JSZip = require('jszip'); } catch (_) {}

const EXCEL = (ExcelJS && JSZip) ? loadModule(MODS.GTA_EXCEL, { ExcelJS, JSZip }) : null;
const PDF = loadModule(MODS.GTA_PDF, {});
const PDFM = loadModule(MODS.GTA_PDFM, {});

// ---- utilitats de lectura del TOTAL imprès ----
const LABEL = /TOTAL\s+(PRESSUPOST|PRESUPUESTO)/i;
function parseMoney(s) {
  const m = String(s).replace(/ /g, ' ').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2})/);
  if (!m) return null;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
}
function flattenTexts(node, out) {
  if (node == null) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { for (const x of node) flattenTexts(x, out); return out; }
  if (typeof node === 'object') {
    if (typeof node.text !== 'undefined') flattenTexts(node.text, out);
    for (const k of ['content', 'table', 'body', 'stack', 'columns', 'ul', 'ol']) if (node[k]) flattenTexts(node[k], out);
    return out;
  }
  return out;
}
// retorna tots els imports que apareixen just després d'una etiqueta TOTAL PRESSUPOST
function totalsNearLabel(texts) {
  const found = [];
  for (let i = 0; i < texts.length; i++) {
    if (!LABEL.test(texts[i])) continue;
    const same = parseMoney(texts[i]);
    if (same != null) { found.push(same); continue; }
    for (let j = i + 1; j < Math.min(i + 6, texts.length); j++) {
      const v = parseMoney(texts[j]);
      if (v != null) { found.push(v); break; }
    }
  }
  return found;
}

// ---- corpus ----
const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
let ok = 0, ko = 0;
const TOL = 0.02; // el total imprès va arrodonit a 2 decimals

(async () => {
  for (const f of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8'));
    engine._COEF = fx.coef;
    const rows = engine.sanitizeRows(JSON.parse(JSON.stringify(fx.rows)));
    const expected = engine.computeTotal(rows) + (SELFTEST ? 7 : 0);
    const ctx = { rows, coef: fx.coef, idioma: 'ca', obra: fx.obra || f, gref: 'G26.TEST', tec: '', coac: '', titu: '', notes: [], showSubs: true, logo: 'data:image/png;base64,iVBORw0KGgo=' };
    const nom = f.replace('.json', '');
    const informe = [];
    // PDF (HTML d'impressió)
    try {
      const htmlDoc = PDF.buildPressupostHtml(ctx);
      const texts = htmlDoc.replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
      const tots = totalsNearLabel(texts);
      if (!tots.length) informe.push('PDF: cap TOTAL PRESSUPOST trobat');
      else if (!tots.some(v => Math.abs(v - expected) <= TOL)) informe.push('PDF: total imprès ' + tots.join('/') + ' ≠ pantalla ' + expected.toFixed(2));
    } catch (e) { informe.push('PDF ERROR: ' + e.message); }
    // PDFM (docDefinition de pdfmake)
    try {
      const dd = PDFM.buildPressupostDoc(ctx);
      const texts = flattenTexts(dd.content || dd, []);
      const tots = totalsNearLabel(texts);
      if (!tots.length) informe.push('PDFM: cap TOTAL PRESSUPOST trobat');
      else if (!tots.some(v => Math.abs(v - expected) <= TOL)) informe.push('PDFM: total ' + tots.join('/') + ' ≠ pantalla ' + expected.toFixed(2));
    } catch (e) { informe.push('PDFM ERROR: ' + e.message); }
    // EXCEL final (fitxer real regenerat i rellegit)
    if (EXCEL) {
      try {
        const blob = await EXCEL.buildExcelFinal(ctx);
        const buf = Buffer.from(await blob.arrayBuffer());
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const tots = [];
        wb.eachSheet(ws => {
          ws.eachRow(row => {
            let hasLabel = false;
            row.eachCell(c => { if (typeof c.value === 'string' && LABEL.test(c.value)) hasLabel = true; });
            if (!hasLabel) return;
            row.eachCell(c => {
              const v = (typeof c.value === 'number') ? c.value : (c.value && typeof c.value === 'object' && typeof c.value.result === 'number' ? c.value.result : parseMoney(c.value));
              if (v != null && isFinite(v) && Math.abs(v) > 0.001) tots.push(Math.round(v * 100) / 100);
            });
          });
        });
        if (!tots.length) informe.push('EXCEL: cap fila TOTAL PRESSUPOST amb import');
        else if (!tots.some(v => Math.abs(v - expected) <= TOL)) informe.push('EXCEL: totals ' + tots.join('/') + ' ≠ pantalla ' + expected.toFixed(2));
      } catch (e) { informe.push('EXCEL ERROR: ' + e.message); }
    } else {
      informe.push('EXCEL OMÈS: falta exceljs (npm i exceljs) — la paritat Excel NO s\'ha comprovat');
    }
    if (informe.length) { ko++; console.error('✗ ' + nom + ' → ' + informe.join(' · ')); }
    else { ok++; console.log('✓ ' + nom + ' (pantalla=' + expected.toFixed(2) + ' € als 3 fitxers)'); }
  }
  console.log(ko === 0 ? '\n== PARITAT: VERDA — ' + ok + '/' + (ok + ko) + ' obres ==' : '\n== PARITAT: VERMELLA — ' + ko + ' obres amb divergència ==');
  process.exit(ko === 0 ? 0 : 1);
})();
