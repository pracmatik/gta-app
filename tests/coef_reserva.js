#!/usr/bin/env node
'use strict';
/*
 * Guardià del COEFICIENT DE RESERVA (22/07/2026).
 *
 * Per què: si la lectura del coeficient d'industrials fallava (xarxa, sessió, permisos), la pantalla
 * pintava «×1,485» EN NEGRETA com si fos el valor bo. Avui coincideix per casualitat; el dia que GTA
 * el canviï, els pressupostos sortirien amb el marge vell i ningú se n'adonaria (~7% de marge perdut).
 * Cura: 3 estats (no llegit / llegit bé / no s'ha pogut llegir). El valor de reserva es fa servir
 * IGUAL (no bloqueja la feina) però deixa de disfressar-se de valor bo: avís groc + reintentar +
 * confirmació abans de desar.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- El codi SAP si ha pogut llegir ----------------------------------------
check('hi ha l\'estat IND_COEF_OK (3 estats: null/true/false)', h.includes('IND_COEF_OK=null'));
check('loadCoefs marca si la lectura ha anat bé o no', h.includes('IND_COEF_OK=_ok;IND_COEF_ERR=_err;'));
check('la lectura fallida deixa rastre (console.warn, no silenci)',
  h.includes('coeficient NO llegit'));

// --- La pantalla NO pinta la reserva com si fos bo -------------------------
check('renderCoefBox té branca "encara no llegit" (no diu res)', h.includes('if(IND_COEF_OK===null){'));
check('renderCoefBox té branca "no s\'ha pogut llegir" amb avís groc',
  h.includes('if(IND_COEF_OK===false){') && h.includes('coef_ko_t'));
check('la branca d\'avís ofereix reintentar (botó indCoefRetry)', h.includes('id="indCoefRetry"'));

// --- El modal de resposta avisa i no bloqueja ------------------------------
check('existeix el requadre d\'avís al modal (#irCoefWarn)', h.includes('id="irCoefWarn"'));
check('hi ha la funció paintCoefWarn', h.includes('function paintCoefWarn(){'));
check('paintCoefWarn NO bloqueja: desapareix si el tècnic toca el marge',
  /paintCoefWarn[\s\S]{0,260}!el\.dataset\.touched/.test(h));

// --- Desar amb reserva és una decisió conscient, no silenci ----------------
check('saveResp demana confirmació si es desa amb valor de reserva sense tocar',
  h.includes('IND_COEF_OK===false&&!$I("#irMarge").dataset.touched&&!confirm(ti("coef_ko_conf")'));

// --- Textos en els dos idiomes ---------------------------------------------
check('textos d\'avís en català i castellà (coef_ko_t x2)',
  (h.match(/coef_ko_t:/g) || []).length === 2);
check('el missatge d\'avís diu que confirmi el coeficient amb GTA',
  h.includes('confirma\'l amb GTA') && h.includes('confírmalo con GTA'));

// --- No bloqueja: el valor de reserva segueix disponible -------------------
check('el valor de reserva 1.485 segueix declarat (no s\'ha eliminat, no bloqueja)',
  h.includes('IND_COEF=1.485'));

console.log(ko === 0 ? ('\n== COEFICIENT DE RESERVA OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
