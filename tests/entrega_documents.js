#!/usr/bin/env node
'use strict';
/*
 * Guardià · ELS PDF ES DESCARREGUEN, COM L'EXCEL. Cap pestanya, cap pregunta amagada, cap espera muda. (09/09/2026)
 *
 * Administració GTA, 09/09 (Rambla Catalunya 47): «Respecte al PDF, no acaba de funcionar bé, triga molt i després dóna
 * error, al final obre una altra pantalla sense que quedi a la vista on et demana si el descarregues igualment i has de
 * validar-ho, un cop ho valides sí el fa, però no hauria de ser això.»
 *
 * Què passava (i per què a nosaltres no ens ho semblava): al clic s'obria una PESTANYA amb «Preparant el document…» que
 * es posava AL DAVANT, i just després la pregunta de les partides sense preu sortia a la pantalla de l'aplicació… que
 * havia quedat al darrere. Ella mirava la pestanya, que no deia res més («triga molt»). Si la tancava, en arribar el
 * document no hi havia on abocar-lo («dóna error»). En tornar a l'aplicació trobava la pregunta («una altra pantalla
 * sense que quedi a la vista»), la validava i llavors sí. I a sobre el clic esperava la baixada de 2,6 MB del motor de PDF.
 *
 * El contracte d'ara, per als TRES documents (pressupost, carta, full de fotos):
 *   1. La pregunta de les partides sense preu es fa ABANS de res, a la pantalla on ella és.
 *   2. No s'obre cap pestanya: el PDF es baixa per la MATEIXA porta que l'Excel (provada al seu navegador), amb nom d'obra.
 *   3. Si el document no arriba en 25 s, es diu a la pantalla (cap espera muda) i el termini es cancel·la quan arriba.
 *   4. El motor de PDF es carrega en segon pla en obrir l'editor: el clic no ha d'esperar.
 *   5. Si el motor de PDF falla, queda la reserva d'impressió del navegador i, si aquesta també, es diu.
 * Aquest guardià NO es limita a llegir el codi: executa el termini i la porta de baixada de veritat.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f)); // al repositori públic l'app es diu index.html
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (extra ? '  → ' + extra : '')); } };
const handler = (id) => { const i = h.indexOf('$("#' + id + '").addEventListener("click",async()=>{'); if (i < 0) return ''; let d = 0, k = h.indexOf('{', i); for (; k < h.length; k++) { if (h[k] === '{') d++; else if (h[k] === '}') { d--; if (d === 0) { k++; break; } } } return h.slice(i, k); };
const H = { pdf: handler('expPdf'), carta: handler('cartaGenCarta'), fotos: handler('cartaGenFotos') };
check('existeixen els tres botons de PDF (pressupost, carta, fotos)', !!(H.pdf && H.carta && H.fotos));

// --- 1 · la pregunta abans de res, i a la pantalla on és ella -------------------
check('1 · el pressupost pregunta per les partides sense preu ABANS de generar res', /askFlagsGate\("pdf"\)/.test(H.pdf) && H.pdf.indexOf('askFlagsGate("pdf")') < H.pdf.indexOf('ensurePdfMake()'));
check('1 · i cap dels tres obre una pestanya que pugui tapar la pregunta', !/window\.open\(/.test(H.pdf) && !/window\.open\(/.test(H.carta) && !/window\.open\(/.test(H.fotos));
check('1 · ja no queda la pantalla d\'espera de la pestanya ni el seu error', !/function finestraEspera\(/.test(h) && !/function finestraError\(/.test(h) && !/function lliuraFinestra\(/.test(h));

// --- 2 · el PDF surt per la porta de l'Excel, amb nom d'obra --------------------
for (const [k, quin] of [['pdf', 'pdf'], ['carta', 'carta'], ['fotos', 'fotos']]) {
  check('2 · «' + quin + '» es baixa per lliuraBaixada amb el seu nom .pdf', new RegExp('lliuraBaixada\\(blob,_nomPdf\\("' + quin + '"\\),"' + quin + '"\\)').test(H[k]));
}
const fNom = (h.match(/function _nomPdf\(quin\)\{[\s\S]*?\n\}/) || [''])[0];
check('2 · el nom del fitxer porta l\'obra, com l\'Excel («Obra_pressupost.pdf»)', /#h_obra/.test(fNom) && /\.pdf"/.test(fNom) && /pressupost/.test(fNom) && /presupuesto/.test(fNom));
check('2 · i es diu on és (descàrregues), en els dos idiomes', /PDF descargado — ábrelo desde las descargas/.test(H.pdf) && /PDF descarregat — obre'l des de les baixades/.test(H.pdf));

// --- 3 · termini: cap espera muda (executat) ------------------------------------
const fVigila = (h.match(/function vigilaEntrega\(quin\)\{[\s\S]*?\n\}/) || [''])[0];
check('3 · existeix el termini d\'entrega sense finestra', !!fVigila && /setTimeout/.test(fVigila) && /25000/.test(fVigila));
{
  const ctx = { IDIOMA: 'ca', avisos: [], toast: (m, e) => ctx.avisos.push({ m, e }) }; vm.createContext(ctx);
  const timers = []; ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms, viu: true }); return timers.length; }; ctx.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].viu = false; };
  vm.runInContext(fVigila + '\nthis.vigilaEntrega=vigilaEntrega;', ctx);
  const fi = ctx.vigilaEntrega('PDF'); fi();
  check('3 · quan el document arriba, el termini es cancel·la i no surt cap avís', timers.length === 1 && timers[0].viu === false && ctx.avisos.length === 0);
  const fi2 = ctx.vigilaEntrega('PDF'); timers[1].fn();
  check('3 · si no arriba, es diu a la pantalla, en vermell i amb el nom del document', ctx.avisos.length === 1 && ctx.avisos[0].e === true && /No s'ha pogut generar el document \(PDF\)/.test(ctx.avisos[0].m), JSON.stringify(ctx.avisos));
  void fi2;
}
const nVigila = (h.match(/(?<!function )vigilaEntrega\(expNom\(/g) || []).length;
check('3 · els tres documents tenen termini — n=' + nVigila, nVigila === 3);
check('3 · cada termini es cancel·la en arribar el document', (h.match(/getBlob\(blob=>\{ ?_fi\(\);/g) || []).length === 3);
check('3 · i també si peta abans d\'hora', (h.match(/if\(_fi\)_fi\(\);/g) || []).length >= 3);
check('3 · el candau de paritat del PDF cancel·la el termini quan bloqueja', /paritatBloqueja\("PDF",_parTotals\(_tx\),_parSubs\(_tx\)\)\)\{_fi\(\);return;\}/.test(H.pdf));

// --- 4 · el motor de PDF no es descarrega al clic -------------------------------
const fOpen = (h.match(/function openEditor\(p,starter,isDemo,draftIA\)\{[\s\S]*?\n\}/) || [''])[0];
check('4 · el motor de PDF es precarrega en obrir l\'editor (en segon pla, sense bloquejar)', /setTimeout\(\(\)=>\{ try\{ ensurePdfMake\(\)\.catch\(\(\)=>\{\}\); \}catch\(_\)\{\} \},1500\)/.test(fOpen));
check('4 · i ensurePdfMake no torna a baixar res si ja és carregat', /if\(window\.__pdfmakeOK&&window\.pdfMake\)return;/.test(h));

// --- 5 · reserva -------------------------------------------------------------------
check('5 · si el motor falla, queda la impressió del navegador i el candau de paritat també hi és', /lliuraImpressio\(html,"pdf"\)/.test(H.pdf) && (H.pdf.match(/paritatBloqueja\("PDF"/g) || []).length === 2);
check('5 · la carta i les fotos també tenen reserva i avisen si tot falla', /lliuraImpressio\(GTA_CARTA\.buildCartaHtml/.test(H.carta) && /lliuraImpressio\(GTA_CARTA\.buildFotosHtml/.test(H.fotos) && /toast\(t\("carta_popup"\),true\)/.test(H.carta));

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
