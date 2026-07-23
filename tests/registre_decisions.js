#!/usr/bin/env node
'use strict';
/*
 * Guardià del LLIBRE DE DECISIONS de l'aprenentatge (21/07/2026).
 *
 * Per què existeix: el 21/07 la Marina va aprovar 8 regles al panell (10:48-11:02) i a la tarda
 * Pracmatik en va pausar 3 (14:31). De tot això no en va quedar cap rastre a la pantalla: la fila
 * només guarda UN segell i pausar no n'escrivia cap. El registre no mentia, DESAPAREIXIA.
 *
 * Aquest guardià vigila que la pantalla:
 *   - llegeixi el llibre de decisions i ensenyi qui va aprovar o aturar cada regla, i QUAN (amb hora),
 *   - ensenyi l'exemple concret de cada regla sense esperar,
 *   - no s'inventi mai un buit (si no consta qui, ho diu),
 *   - avisi de les regles que ja s'han hagut d'aturar abans,
 *   - i no deixi passar en silenci un canvi que el permís hagi bloquejat.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// --- El llibre es llegeix ---------------------------------------------------
check('llegeix la taula del llibre de decisions',
  h.includes('sb.from("aprendizaje_historial").select("leccion_id,accion,actor_nom,motiu,ts")'));
check('el llibre ve ordenat pel més recent primer',
  h.includes('.order("ts",{ascending:false})'));

// --- Qui i quan, amb hora ---------------------------------------------------
check('hi ha la funció que pinta el rastre (aprTrail)', h.includes('function aprTrail(l)'));
check('el rastre es pinta a la fila de la regla', /\$\{aprTrail\(l\)\}/.test(h));
check('la data porta HORA i minuts (no només el dia)',
  h.includes('String(d.getHours()).padStart(2,"0")') && h.includes('String(d.getMinutes()).padStart(2,"0")'));
check('diu si la regla s\'aplica ara mateix o no',
  h.includes("Ara mateix SÍ que s'aplica") && h.includes("Ara mateix NO s'aplica") &&
  h.includes('Ahora mismo SÍ se aplica') && h.includes('Ahora mismo NO se aplica'));
check('tradueix les accions a paraules normals (aprovada/aturada)',
  h.includes('_apVerb={aprovada:') && h.includes('pausada:IDIOMA==="es"?"Parada":"Aturada"'));
check('ensenya el motiu quan n\'hi ha', h.includes('e.motiu?`<br><i>${esc(e.motiu)}</i>`:""'));

// --- Mai un buit que sembli que no ha passat res ----------------------------
check('si no consta qui, HO DIU (no s\'ho inventa)',
  h.includes('no consta qui la va deixar així') && h.includes('no consta quién la dejó así'));
check('si el llibre no es pot llegir, HO DIU (no fa veure que està buit)',
  h.includes('HISTERR') && h.includes("No s'ha pogut llegir l'historial d'aquesta regla"));
check('si l\'actor no consta, no posa cap nom per defecte',
  h.includes('algú que no consta') && h.includes('alguien que no consta'));

// --- L'exemple concret, a la vista ------------------------------------------
check('ensenya la frase en llenguatge planer (resum_pla)', h.includes('l.resum_pla?`<span class="apr-pla">'));
check('ensenya l\'exemple real amb l\'etiqueta "Vist a:"',
  h.includes('"Visto en: ":"Vist a: "'));

// --- Avís de reincidència ---------------------------------------------------
check('hi ha l\'avís per a regles que ja s\'han hagut d\'aturar', h.includes('function aprAvis(l)'));
check('l\'avís es dispara si al llibre hi consta una pausa',
  h.includes('.some(e=>e.accion==="pausada")'));
check('l\'avís es pinta a la fila', /\$\{aprAvis\(l\)\}/.test(h));
check('l\'avís demana llegir el motiu abans d\'aprovar',
  h.includes("llegeix el motiu abans d'aprovar-la") && h.includes('lee el motivo antes de aprobarla'));

// --- Cap canvi silenciós ----------------------------------------------------
check('activar/aturar comprova que el canvi s\'ha desat de veritat',
  h.includes('.eq("id",tg.dataset.aprtoggle).select("id")'));
check('si el permís el bloqueja, avisa en lloc de callar',
  h.includes('if(error||!_tgUp||!_tgUp.length)') && h.includes("no tens permís per fer-ho"));

// --- Esborrar sempre demana confirmació -------------------------------------
check('esborrar demana confirmació SEMPRE, no només les regles d\'or',
  h.includes('d.dataset.gold!=="1"&&!confirm('));
check('la confirmació ensenya QUINA regla s\'esborra', h.includes('data-txt="${esc(String(l.leccion'));
check('la confirmació recorda que es pot aturar en lloc d\'esborrar',
  h.includes("fes servir «Activa» per aturar-la"));

// --- L'aspecte -------------------------------------------------------------
check('hi ha els estils nous (.apr-pla, .apr-warn, .apr-on)',
  h.includes('.apr-pla{') && h.includes('.apr-warn{') && h.includes('.apr-on{'));

console.log(ko === 0 ? ('\n== LLIBRE DE DECISIONS OK -- ' + ok + '/' + (ok + ko) + ' ==')
                     : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
