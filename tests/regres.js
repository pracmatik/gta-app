#!/usr/bin/env node
'use strict';
/*
 * Arnés de regresión del motor de cálculo de index.html (CI).
 * Extrae las funciones reales de cálculo del HTML (sin tocarlo), las carga
 * en un sandbox de Node y las ejecuta contra un corpus de fixtures SINTÉTICOS
 * (datos inventados, ver tests/fixtures/) comparando el total obtenido contra
 * un total esperado congelado. También valida que cada bloque <script> del
 * HTML compila sin SyntaxError.
 *
 * Uso:
 *   node tests/regres.js [ruta_a_index.html]
 * Por defecto usa index.html en la raíz del repo.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'index.html');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const FUNCS = [
  'num2', 'coef', 'sanitizeRows', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef',
  'priceMissing', 'priceBlocking', 'rowGross', 'pctBase', 'rowTotal', 'computeTotal',
];

// --- 1. extraer bloques <script> y las funciones reales -------------------

function extractScriptBlocks(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue; // script externo, sin cuerpo propio
    out.push(m[2]);
  }
  return out;
}

// Localiza "function NAME(" o "const NAME=" y extrae el bloque completo
// balanceando llaves desde el primer "{" tras la cabecera.
function extractFunction(src, name) {
  const patterns = [
    new RegExp('function\\s+' + name + '\\s*\\('),
    new RegExp('const\\s+' + name + '\\s*='),
  ];
  for (const pat of patterns) {
    const m = pat.exec(src);
    if (!m) continue;
    const start = m.index;
    const braceStart = src.indexOf('{', m.index);
    if (braceStart === -1) continue;
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    let end = i;
    if (pat === patterns[1] && src[end] === ';') end++;
    return src.slice(start, end);
  }
  return null;
}

function extractRealFunctions(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const blocks = extractScriptBlocks(html);
  const found = {};
  const missing = [];
  for (const name of FUNCS) {
    let src = null;
    for (const block of blocks) {
      src = extractFunction(block, name);
      if (src) break;
    }
    if (src) found[name] = src;
    else missing.push(name);
  }
  return { found, missing, blocks };
}

// --- 2. sandbox de ejecución -----------------------------------------------

function buildSandbox(found) {
  const sandbox = {
    console,
    isFinite, Math, parseFloat, Number, String, Array, Object,
    _COEF: 1,
  };
  vm.createContext(sandbox);
  const coefStub = 'function coef(){const c=parseFloat(_COEF);return isFinite(c)&&c>0?c:1;}';
  const order = ['num2', 'coef', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef', 'priceMissing',
    'priceBlocking', 'rowGross', 'pctBase', 'rowTotal', 'computeTotal', 'sanitizeRows'];
  const parts = [];
  for (const name of order) {
    if (name === 'coef') { parts.push(coefStub); continue; }
    if (found[name]) parts.push(found[name]);
  }
  const code = parts.join('\n');
  new vm.Script(code, { filename: 'engine.js' }).runInContext(sandbox);
  return sandbox;
}

// --- 3. corpus sintético (fixtures inventados, ver tests/fixtures/) -------

function tolerance(expected) {
  return Math.max(0.5, 0.005 * Math.abs(expected));
}

function runCorpus(sandbox) {
  const results = [];
  if (!fs.existsSync(FIXTURES_DIR)) return results;
  const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
  for (const f of files) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8'));
    sandbox._COEF = fixture.coef;
    const rows = sandbox.sanitizeRows(fixture.rows);
    let got = null, error = null;
    try {
      got = sandbox.computeTotal(rows);
    } catch (e) {
      error = e.message;
    }
    const expected = fixture.expectedTotal;
    const diff = got == null ? null : +(got - expected).toFixed(2);
    const tol = tolerance(expected);
    const pass = error == null && Math.abs(diff) <= tol;
    results.push({ obra: fixture.obra, expected, got, diff, tol: +tol.toFixed(2), pass, error });
  }
  results.sort((a, b) => a.obra.localeCompare(b.obra));
  return results;
}

// --- 4. check de sintaxis de cada bloque <script> --------------------------

function checkSyntax(blocks) {
  const out = [];
  blocks.forEach((code, idx) => {
    try {
      new vm.Script(code, { filename: `script_block_${idx}.js` });
      out.push({ block: idx, ok: true });
    } catch (e) {
      out.push({ block: idx, ok: false, error: e.message });
    }
  });
  return out;
}

// --- main -------------------------------------------------------------------

function main() {
  console.log('== CI: regresión motor de cálculo (index.html) ==');
  console.log('HTML analizado:', HTML_PATH);

  const { found, missing, blocks } = extractRealFunctions(HTML_PATH);
  console.log(`\nFunciones extraídas: ${Object.keys(found).length}/${FUNCS.length}`);
  if (missing.length) console.log('  FALTAN:', missing.join(', '));

  if (missing.some(m => m !== 'coef' && m !== 'priceBlocking')) {
    console.error('\nERROR: faltan funciones críticas del motor. Abortando.');
    process.exit(1);
  }

  const sandbox = buildSandbox(found);

  const syntaxResults = checkSyntax(blocks);
  const syntaxFail = syntaxResults.filter(r => !r.ok);
  console.log(`\n-- Check de sintaxis (${blocks.length} bloques <script>) --`);
  if (syntaxFail.length) {
    syntaxFail.forEach(r => console.log(`  FALLO bloque ${r.block}: ${r.error}`));
  } else {
    console.log('  OK: todos los bloques compilan sin SyntaxError.');
  }

  console.log('\n-- Corpus sintético (tests/fixtures/, datos inventados) --');
  const results = runCorpus(sandbox);
  if (results.length === 0) {
    console.error('ERROR: no se encontraron fixtures en tests/fixtures/.');
    process.exit(1);
  }
  for (const r of results) {
    const status = r.pass ? 'OK  ' : 'FALLO';
    console.log(`  ${status} ${r.obra.padEnd(24)} esperado=${r.expected.toFixed(2).padStart(10)} `
      + `obtenido=${(r.got == null ? 'ERROR' : r.got.toFixed(2)).padStart(10)} `
      + `diff=${r.diff == null ? '-' : r.diff} tol=${r.tol}`
      + (r.error ? ` ERROR:${r.error}` : ''));
  }
  const failed = results.filter(r => !r.pass);
  console.log(`\nFixtures: ${results.length - failed.length}/${results.length} OK`);

  const ok = syntaxFail.length === 0 && failed.length === 0;
  console.log('\n== RESULTADO:', ok ? 'VERDE' : 'HAY FALLOS', '==');
  process.exit(ok ? 0 : 1);
}

main();
