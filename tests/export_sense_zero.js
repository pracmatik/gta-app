#!/usr/bin/env node
'use strict';
/*
 * Guardià «MAI un 0,00 € inventat als exportadors» (25/07/2026 · la tècnica 24/07 amb captures: les línies informatives
 * «desglòs vist NO suma» sortien al PDF amb preu unitari 0 €/ut; i a l'Excel final directament DESAPAREIXIEN).
 *
 * Regla general: una sub-línia SENSE preu s'imprimeix SENSE preu (mateix criteri que l'editor, línia ~3010) — mai
 * es fabrica un 0 que sembla un preu real. I les subv surten a TOTS els exportadors (PDF-html, pdfmake i Excel).
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- el patró perillós ha desaparegut dels exportadors ----
const fabricats = (h.match(/eurF\(s\.preu\|\|0/g) || []).length;
check('cap exportador fabrica ja «eurF(s.preu||0)» (0,00 € inventat)', fabricats === 0);
check('PDF-html: preu condicionat a que existeixi', h.includes('const _pT=(s.preu!==""&&s.preu!=null&&isFinite(+s.preu))'));
check('pdfmake: preu condicionat a que existeixi', /\{text:\(s\.preu!==""&&s\.preu!=null&&isFinite\(\+s\.preu\)\)\?eurF\(\+s\.preu,idioma\):""/.test(h));
// ---- Excel: les subv ja no desapareixen i la cel·la de preu no inventa 0 ----
check('Excel: el bucle de sub-línies inclou també les subv', /while\(j<rows\.length&&\(rows\[j\]\.tipo==="sub"\|\|rows\[j\]\.tipo==="subv"\)\)\{const s=rows\[j\],SR=ws\.getRow\(r\)/.test(h));
check('Excel: la cel·la de preu només s\'escriu si hi ha preu real', /if\(s\.preu!==""&&s\.preu!=null&&isFinite\(\+s\.preu\)\)\{SR\.getCell\(5\)\.value=\+s\.preu;SR\.getCell\(5\)\.numFmt=EUR;\}/.test(h));

// ---- FUNCIONAL: la condició es comporta com l'editor ----
const pT = s => (s.preu !== "" && s.preu != null && isFinite(+s.preu)) ? ('€' + (+s.preu)) : '';
check('FUNCIONAL · preu buit "" → res (no 0,00)', pT({ preu: "" }) === '');
check('FUNCIONAL · preu null/undefined → res', pT({ preu: null }) === '' && pT({}) === '');
check('FUNCIONAL · preu 0 REAL (escrit pel tècnic) → SÍ s\'imprimeix 0', pT({ preu: 0 }) === '€0');
check('FUNCIONAL · preu normal → s\'imprimeix', pT({ preu: 22.5 }) === '€22.5');

console.log(ko === 0 ? ('\n== EXPORTADORS SENSE ZERO INVENTAT OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
