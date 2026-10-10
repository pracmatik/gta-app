#!/usr/bin/env node
'use strict';
/*
 * Guardia de los 10 fixes del "consejo" (goal 19/07 tarde: ¿codigo creado y no funcional? + optimizacion).
 * No ejecuta las funciones (requeriria mockear DOM/Supabase completo, desproporcionado para el alcance
 * del cambio): confirma con PATRONES DE TEXTO que la proteccion sigue presente en el codigo REAL. Si
 * alguien deshace uno de estos fixes sin querer, aqui salta.
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML_PATH) { console.error('✗ No trobo app_gta.html ni index.html'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');

let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  ✓ ' + n); } else { ko++; console.error('  ✗ ' + n); } };

// #1a/#1b — wrapper de conflicto (window.saveCurrent): el toast "recargado" vive DENTRO de if(data){...}
check('#1a wrapper-silent: toast "recargado" dentro de if(data){...}',
  /if\(data\)\{\s*\n\s*window\.openEditor\(data\);\s*\n\s*toast\(IDIOMA==="es"\?"Otro técnico ha guardado cambios más recientes en este presupuesto\. Se ha recargado/.test(html));
check('#1a wrapper-silent: rama else con aviso honesto si falla la recarga',
  /No firmes hasta comprobarlo/.test(html));
check('#1b wrapper-reload-btn: toast "recargado" dentro de if(data){...}',
  /if\(data\)\{saveDraft\(\);(?:if\(CURRENT&&CURRENT\.id\)logHist\(CURRENT\.id,"conflicte_canvis_meus_a_esborrany"\);)?window\.openEditor\(data\);\s*\n\s*toast\(IDIOMA==="es"\?"Se ha recargado la última versión guardada/.test(html)); // 25/07 P3.4: entre saveDraft i openEditor ara hi ha el rastre d'activitat — la intenció del check (toast només dins if(data)) es manté
check('#1b wrapper-reload-btn: rama else con aviso honesto',
  /No se ha podido recargar \(revisa tu conexión\)\. Vuelve a intentarlo\./.test(html));

// #1c — 3a instancia del mismo patron, dentro de sigConfirm (hallada al releer, no estaba en el hallazgo original)
check('#1c sigConfirm-inline: toast "recargado" dentro de if(fresh){...}',
  /if\(fresh\)\{\s*\n\s*openEditor\(fresh\);\s*\n\s*toast\(IDIOMA==="es"\?"Otro técnico ha guardado cambios más recientes en este presupuesto\. Se ha recargado/.test(html));

// #2 — refreshAprBadge: no oculta el badge si la consulta fallo
// 30/07/2026 · el numero del boton contaba TODO lo apagado, incluidas las lecciones que el tecnico ya
// habia rechazado: marcaba 29 cuando esperaban decision 24. Un contador que no baja nunca deja de
// creerse, y entonces nadie aprueba nada — y lo aprendido no se usa. Debe contar solo lo NO decidido.
check('#2b refreshAprBadge: el numero es el de lecciones SIN decidir, no el de todo lo apagado',
  /\.eq\("activo",false\)\.is\("estado_at",null\)/.test(html));
check('#2 refreshAprBadge: captura error y sale sin tocar el badge si _aErr',
  /const \{count,error:_aErr\}=await sb\.from\("aprendizaje"\)[^;]*;\s*\n\s*const b=\$\("#aprBadge"\); if\(!b\)return;\s*\n\s*if\(_aErr\)return;/.test(html));

// #3 — openApr: "-" en vez de 0 falso si la consulta de decisiones falla
check('#3 openApr: _pq="—" cuando _sErr, en vez de (sq||0) directo',
  /const \{count:sq,error:_sErr\}=await sb\.from\("decisiones"\)[\s\S]{0,120}const _pq=_sErr\?"—":\(sq\|\|0\);/.test(html));

// #4 — addIndSubLine: guardia anti doble-clic (debounce 600ms)
check('#4 addIndSubLine: guardia de reentrada por pid con ventana de 600ms',
  /function addIndSubLine\(pid\)\{[\s\S]{0,200}addIndSubLine\._last&&addIndSubLine\._last\.pid===\+pid&&_now-addIndSubLine\._last\.t<600\)return;/.test(html));

// #5 — sigCancel respeta disabled + sigConfirm deshabilita/reactiva ambos botones
check('#5a sigCancel: comprueba .disabled antes de cerrar el modal',
  /\$\("#sigCancel"\)\.addEventListener\("click",\(\)=>\{if\(\$\("#sigCancel"\)\.disabled\)return;\$\("#sigModal"\)\.classList\.remove\("show"\);\}\);/.test(html));
check('#5b sigConfirm: deshabilita tambien el boton Cancelar al empezar a firmar',
  /sbtn\.disabled=true;const cbtn=\$\("#sigCancel"\);cbtn\.disabled=true;/.test(html));
check('#5c sigConfirm: reactiva Cancelar en el finally (exito o error)',
  /\}finally\{sbtn\.disabled=false;cbtn\.disabled=false;\}/.test(html));

// #6 — aviso de sesion caducada SIEMPRE visible (tambien en modo silent, ej. al firmar)
check('#6 ensureFreshSession-wrapper: el toast de sesion caducada ya NO depende de silent',
  /if\(!ok\)\{\s*\n\s*saveDraft\(\);\s*\n\s*toast\(IDIOMA==="es"\?"Tu sesión ha caducado\./.test(html) &&
  !/if\(!silent\) toast\(IDIOMA==="es"\?"Tu sesión ha caducado\./.test(html));

console.log(ko === 0 ? `\n== CONSEJO 19/07 FIXES OK — ${ok}/${ok + ko} ==` : `\n== CONSEJO 19/07 FIXES FALLA — ${ko} de ${ok + ko} ==`);
process.exit(ko === 0 ? 0 : 1);
