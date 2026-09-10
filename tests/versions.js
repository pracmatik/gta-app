#!/usr/bin/env node
'use strict';
/*
 * Guardià de VERSIONS del pressupost (#86, 20/07/2026): historial visible + restaurar 1 clic.
 * Comprova que la peça hi és i que la restauració és SEGURA (desa la versió actual abans, marca DIRTY,
 * no auto-desa) i que llegeix el historial filtrat pel pressupost actual.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

check('hi ha el botó Versions a la barra (#histBtn)', h.includes('id="histBtn"'));
check('hi ha el modal (#histModal / #histInner)', h.includes('id="histModal"') && h.includes('id="histInner"'));
check('etiqueta i18n hist_btn a ca i es', h.includes('hist_btn:"Versions"') && h.includes('hist_btn:"Versiones"'));
check('openHist llegeix el historial FILTRAT pel pressupost actual', h.includes('sb.from("presupuestos_historial").select("id,accion,usuario_nombre,ts,snapshot").eq("presupuesto_id",CURRENT.id)'));
check('mostra qui/quan (usuario_nombre + toLocaleString)', h.includes('esc(h.usuario_nombre') && h.includes('new Date(h.ts).toLocaleString'));
check('restaurar: DESA la versió actual ABANS (logHist "restaurat_previ")', h.includes('await logHist(CURRENT.id,"restaurat_previ")'));
check('restaurar: es pot desfer (pushUndo abans de carregar)', h.includes('if(typeof pushUndo==="function")pushUndo();'));
check('restaurar: carrega el snapshot (rows + header) i sanititza', h.includes('rows=sanitizeRows(JSON.parse(JSON.stringify(snap.rows)),false)||[];') && h.includes('HEADER=snap.header||HEADER'));
check('restaurar: NO auto-desa (marca DIRTY perquè el tècnic desi)', h.includes('DIRTY=true;render();'));
check('restaurar: gate de confirmació (confirm) i respecta bloqueig (locked)', h.includes('if(typeof locked==="function"&&locked())return;') && /if\(!confirm\(ES\?/.test(h));

console.log(ko === 0 ? ('\n== VERSIONS OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
