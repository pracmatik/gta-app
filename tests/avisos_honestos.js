#!/usr/bin/env node
'use strict';
/*
 * Guardià dels AVISOS HONESTOS (22/07/2026).
 *
 * Per què: quan el candau aturava un pressupost o es quedava cec, la pantalla deia «Pracmatik ha
 * estat avisat» i NO s'enviava res (el permís de la taula no s'havia donat, i el codi s'empassava el
 * rebuig amb un catch buit). Pitjor: el cas cec sortia en SILENCI absolut i el fitxer marxava cap al
 * client. Es va donar el permís (GRANT) i es va afegir un helper que comprova que l'avís entra de
 * veritat i, si no, l'envia pel canal de reserva; i cap missatge diu «avisat» si no ho ha estat.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- El helper amb confirmació + canal de reserva ---------------------------
check('existeix el helper avisaPracmatik', h.includes('async function avisaPracmatik(titulo,detalle)'));
check('el helper prova primer el canal principal i mira l\'error',
  /avisaPracmatik[\s\S]{0,200}alertas_sistema"\)\.insert\([\s\S]{0,80}if\(!error\)return true/.test(h));
check('el helper té canal de RESERVA (errores_cliente, que la Vigía llegeix)',
  h.includes('async function avisaPracmatik') && h.includes('/rest/v1/errores_cliente') && h.includes('return !!(r&&r.ok)'));
check('el helper retorna false si cap canal ha funcionat',
  /async function avisaPracmatik[\s\S]{0,700}return false;\s*\n\}/.test(h));

// --- El cas cec ja NO és mut ------------------------------------------------
check('el cas cec (sense total imprès) crida avisaPracmatik',
  /if\(!totals\.length\)\{[\s\S]{0,200}avisaPracmatik\("PARITAT NO VERIFICABLE/.test(h));
check('el cas cec AVISA el tècnic per pantalla (abans sortia en silenci)',
  h.includes('no se ha podido comprobar el total impreso') && h.includes("no s'ha pogut comprovar el total imprès"));
check('el cas cec diu que el revisi a mà abans d\'enviar-lo al client',
  h.includes('Revísalo a mano antes de enviarlo al cliente') && h.includes("Revisa'l a mà abans d'enviar-lo al client"));

// --- Cap missatge menteix: «avisat» només si _ok ----------------------------
check('el bloqueig per paritat trencada crida avisaPracmatik',
  /avisaPracmatik\("PARITAT TRENCADA/.test(h));
check('el missatge de bloqueig NOMÉS diu «avisat» si l\'avís va sortir (_ok)',
  /_ok\?\(IDIOMA==="es"\?" Pracmatik ha sido avisado\.":" Pracmatik n'ha estat avisat\."\)/.test(h));
check('si l\'avís no surt, el missatge demana que avisi el tècnic',
  h.includes('El aviso a Pracmatik NO ha salido: avísale tú') && h.includes("L'avís a Pracmatik NO ha sortit: avisa'l tu"));

// --- El rebuig de CSV també és honest ---------------------------------------
check('el rebuig de CSV crida avisaPracmatik (no un insert directe amb catch buit)',
  /avisaPracmatik\("CSV REBUTJAT/.test(h));
check('el rebuig de CSV només diu «avisat» si de veritat va sortir',
  /_okR\?\(IDIOMA==="es"\?"Rechazo registrado — Pracmatik ha sido avisado/.test(h));

// --- Cap insert directe silenciós als camins de paritat/CSV -----------------
check('ja no queda cap insert directe a alertas_sistema als camins de paritat/CSV',
  !/alertas_sistema"\)\.insert\(\{origen:"app",titulo:"PARITAT/.test(h) &&
  !/alertas_sistema"\)\.insert\(\{origen:"app",titulo:"CSV REBUTJAT/.test(h));

console.log(ko === 0 ? ('\n== AVISOS HONESTOS OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
