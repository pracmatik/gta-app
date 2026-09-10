#!/usr/bin/env node
'use strict';
/*
 * Guardià «l'equip tècnic pot esborrar els SEUS esborranys» (25/07/2026 · petició la tècnica 23/07: pugen amidaments
 * repetits i no podien netejar). Regla: esborrany + (admin O autor). MAI res validat/firmat.
 * La UI ensenya el botó; la POLÍTICA DE LA BASE (RLS p_presu_del: estado='borrador' AND (is_admin() OR autor))
 * és la garantia real encara que la UI falli — aplicada el 25/07 al projecte Supabase GTA.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

check('el botó d\'esborrar surt per a admin O per a l\'autor del SEU esborrany',
  h.includes('const del=(ME.rol==="admin"||(p.autor_id===ME.id&&p.estado==="borrador"))?'));
check('mai per a pressupostos no-esborrany (la condició exigeix estado==="borrador" per al no-admin)',
  /p\.estado==="borrador"\)\)\?/.test(h));
check('l\'esborrat segueix demanant confirmació', /confirm\(t\("confirm_del"\)\)/.test(h));

console.log(ko === 0 ? ('\n== ESBORRAR ESBORRANYS OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
