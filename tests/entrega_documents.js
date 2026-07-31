#!/usr/bin/env node
'use strict';
/*
 * Guardià de l'ENTREGA DELS DOCUMENTS (31/07/2026 · la tècnica: «Ara mateix continuen sense generar-se
 * els PDF ni donar cap tipus d'avís», amb captura de DUES pestanyes a «about:blank»).
 *
 * Què passava: s'obria una pestanya buida i, quan el document estava fet, se li canviava l'adreça a la
 * del document. Aquell salt només pinta res si el navegador ENSENYA els PDF dins d'una pestanya. Als
 * navegadors configurats per BAIXAR-los (normal a empreses, i sovint per política que l'usuari no pot
 * canviar) la pestanya es quedava en blanc per sempre i no sortia cap missatge. A nosaltres ens
 * funcionava; a ella no. Per això el 30/07 li vam dir que estava arreglat i no ho estava.
 *
 * Què ha de complir-se SEMPRE a partir d'ara (les tres coses són el guardià):
 *   1. La pestanya s'omple amb contingut NOSTRE des del primer instant («Preparant el document…»).
 *   2. El document s'entrega ESCRIVINT dins de la pestanya, amb botó de baixada visible al costat:
 *      encara que el visor de PDF estigui apagat, sempre hi ha una sortida.
 *   3. Hi ha TERMINI: si el document no arriba, es diu a la pestanya i a la pantalla. Cap espera muda.
 *
 * Comprovat en un navegador de veritat el 31/07: document dins de la pestanya amb botó «Descargar», i
 * el missatge vermell als 25 s quan el document no arriba.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- les tres peces existeixen --------------------------------------------
const fEspera = (h.match(/function finestraEspera\(_win\)\{[\s\S]*?\n\}/) || [''])[0];
const fError = (h.match(/function finestraError\(_win,txt\)\{[\s\S]*?\n\}/) || [''])[0];
const fVigila = (h.match(/function vigilaEntrega\(_win,quin\)\{[\s\S]*?\n\}/) || [''])[0];
const fLliura = (h.match(/function lliuraFinestra\(_win,blob,quin\)\{[\s\S]*?\n\}/) || [''])[0];
check('existeix la pantalla d\'espera de la pestanya', !!fEspera);
check('existeix el missatge d\'error dins la pestanya', !!fError);
check('existeix el termini d\'entrega', !!fVigila);
check('existeix l\'entrega del document', !!fLliura);

// --- 1 · la pestanya mai neix muda ----------------------------------------
check('1 · l\'espera escriu de veritat a la pestanya', /_win\.document\.open\(\)/.test(fEspera) && /_win\.document\.write/.test(fEspera));
check('1 · l\'espera diu què està passant', /Preparando el documento|Preparant el document/.test(fEspera));

// --- 2 · el document s'escriu dins, amb sortida de baixada -----------------
check('2 · el document s\'ESCRIU dins la pestanya (no només canviar-li l\'adreça)', /_win\.document\.write/.test(fLliura));
check('2 · hi ha botó de baixada sempre visible', /download="/.test(fLliura));
check('2 · s\'explica què fer si el visor no el pinta', /pulsa Descargar|prem Descarregar/.test(fLliura));
check('2 · el document segueix quedant anotat al llibre d\'activitat', /logExport\(/.test(fLliura));
check('2 · queda la reserva antiga per si escriure falla', /_win\.location\.href=_url/.test(fLliura));

// --- 3 · termini: cap espera muda -----------------------------------------
check('3 · el termini avisa DINS la pestanya', /finestraError\(/.test(fVigila));
check('3 · el termini avisa TAMBÉ a la pantalla', /toast\(/.test(fVigila));
check('3 · el termini es pot cancel·lar quan el document sí arriba', /clearTimeout/.test(fVigila));

// --- els TRES documents han d'estar coberts -------------------------------
// es compten les CRIDES, no la definició de la funció
const nEspera = (h.match(/(?<!function )finestraEspera\(_win\)/g) || []).length;
const nVigila = (h.match(/(?<!function )vigilaEntrega\(_win,/g) || []).length;
check('els 3 documents obren pestanya amb espera (pressupost, carta, fotos) — n=' + nEspera, nEspera >= 3);
check('els 3 documents tenen termini — n=' + nVigila, nVigila >= 3);
// cada vigilància s'ha de cancel·lar quan el document arriba
check('cada termini es cancel·la en arribar el document', (h.match(/getBlob\(blob=>\{ ?_fi\(\);/g) || []).length >= 3);
check('cap pestanya es queda oberta si peta abans d\'hora', (h.match(/if\(_fi\)_fi\(\);/g) || []).length >= 3);

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
