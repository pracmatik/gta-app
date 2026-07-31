#!/usr/bin/env node
'use strict';
/*
 * Guardià de les FUNCIONALS de la tècnica (25/07/2026 · correus 23-24/07): números de capítol del tècnic ·
 * vincular línies de preu (forats reals) · industrials (aplicar preu + alta admin) · exemples amb ut/soroll.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// F1 · número de capítol del tècnic
check('existeix capNumOf (font única del nº de capítol)', h.includes('function capNumOf('));
check('renumberRows fa servir el nº del tècnic (capNumOf)', /function renumberRows\(rs\)\{ let cap=0,pn=0,capNum="1";/.test(h) && h.includes('capNum=capNumOf(r.desc,cap||1)'));
// 25/07: el «1.1» es va construir darrere d'un interruptor, APAGAT fins que GTA confirmés la intranet.
// 27/07: l'administració ho va confirmar per escrit («tot dos es carreguen be a la nostra intranet») i el
// mateix dia se li va dir per correu que el deixàvem amb el format 1.1 → interruptor ENCÈS.
// Les dues peces han de seguir existint: l'interruptor i la doble expressió que el llegeix.
check('el CSV respecta el número del tècnic («1.1»), tal com se li va confirmar a l\'administració el 27/07',
  /_dec\?\/\^\\s\*\(\\d\+\(\?:\\\.\\d\+\)\*\)\/:\/\^\\s\*\(\\d\+\)\//.test(h) && /window\.CSV_CAP_DECIMAL\s*=\s*true/.test(h));
try {
  const m = h.match(/function capNumOf\(desc,fallback\)\{[\s\S]*?\n\}/);
  const capNumOf = new Function('return ' + m[0])();
  check('FUNCIONAL · «3. FUSTERIA» → 3', capNumOf('3. FUSTERIA', 1) === '3');
  check('FUNCIONAL · «1.1 SUBCAPÍTOL» → 1.1', capNumOf('1.1 SUBCAPÍTOL', 2) === '1.1');
  check('FUNCIONAL · sense número → fallback', capNumOf('FUSTERIA', 4) === '4');
} catch (e) { check('capNumOf executable', false); }

// F2 · vincular línies
check('duplicar partida CONSERVA el vincle (lnk) i les marques', /act==="duppart"\)\{const _d=\{tipo:"part"[\s\S]{0,120}if\(r\.lnk\)_d\.lnk=r\.lnk;/.test(h));
check('mode marcar-i-lligar per a textos diferents (_lnkPend)', h.includes('window._lnkPend') && h.includes('per lligar-ne els preus'));
check('editar una línia de càlcul propaga el preu derivat a les lligades', /rows\[i\]\.tipo==="sub"[\s\S]{0,160}propagaPreuLligat\(p,"preu"\)/.test(h));
check('el botó 🔗 mostra el comptador del grup', /🔗\$\{r\.lnk\?"·"\+\(rows\.filter/.test(h));

// F3 · industrials
check('canviar un preu de catàleg ofereix aplicar-lo a les partides lligades (cid) amb confirm+undo', /x\.cid===pid\);[\s\S]{0,400}pushUndo\(\); _af\.forEach/.test(h));
// 27/07 · LLIÇÓ CARA: aquest guardià comprovava que el codi inseria `{nombre:nom,email}` i sortia VERD…
// mentre l'alta NO havia funcionat MAI. La taula té la columna «emails» (una llista), no «email», i a més
// «nombre_norm» és obligatòria i no tenia valor per defecte ni trigger. O sigui: un guardià que només llegeix
// el codi pot beneir una funció trencada. Ara es comprova la forma REAL que accepta la base de dades.
check('botó «Afegir industrial» el veu tot l\'equip amb sessió (la tècnica el demanava des del 23/07)',
  h.includes('id="indAlta"') && /_ab\.style\.display=\(typeof ME!=="undefined"&&ME\)\?"":"none"/.test(h));
check('l\'alta fa servir la columna real de la base: «emails» (llista), no «email»',
  /from\("industriales"\)\.insert\(\{nombre:nom,emails:email\?\[email\]:\[\]\}\)\.select\(\)\.single\(\)/.test(h));
check('…i ja no queda enlloc la forma antiga que fallava sempre', !/insert\(\{nombre:nom,email\}\)/.test(h));
check('l\'alta vincula el gremi amb errors VISIBLES', /from\("industrial_gremio"\)\.insert\(\{industrial_id:ind\.id,gremio_id:grem\.id\}\)/.test(h));
check('l\'alta recarrega la cache del llistat', /CACHE=null; await loadBase\(\);/.test(h));

// F4 · exemples honestos
check('_exLine pinta el canvi d\'unitat (ut_sense→ut_amb)', h.includes('x.ut_sense&&x.ut_amb&&x.ut_sense!==x.ut_amb'));
check('_exLine mai deixa una línia sense cap detall si hi ha camps', h.includes('Array.isArray(x.camps)'));
check('el comptador de soroll es mostra quan el backend el reporta, vingui com a número o com a objecte',
  /const _sor=\(d\.soroll&&typeof d\.soroll==="object"\)\?\(\+d\.soroll\.canvis\|\|0\):\(\+c\.soroll\|\|0\);/.test(h) && /if\(_sor>0\)/.test(h));
check('mode baseline sense canvis → missatge honest', h.includes('no produeix canvis mesurables'));

console.log(ko === 0 ? ('\n== FUNCIONALS LA TÈCNICA OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
