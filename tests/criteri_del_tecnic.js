#!/usr/bin/env node
'use strict';
/*
 * Guardià del CRITERI DEL TÈCNIC (31/07/2026 · correu de l'administració del client, 11:38).
 *
 * Van escriure: «El programa ha de facilitar la feina del tècnic, però no intentar substituir el seu
 * criteri professional» · «No necessitem, en aquest moment, noves regles, excepcions ni funcionalitats
 * addicionals» · «El sistema continua demanant revisions i validacions basades en regles o exemples que
 * ja hem explicat reiteradament que no són aplicables al nostre cas».
 *
 * I NO és nou. Ho venien dient des de fa setmanes:
 *   08/07 — «les notes sempre com a suggeriment, mai automàtiques» i «l'increment en planta baixa no és norma»
 *   21/07 — «la decisió del tècnic mana SEMPRE» + van demanar RETIRAR el botó de desglòs
 *   23/07 — van anul·lar elles mateixes les regles d'avís: «si tot porta avís, els avisos perden valor»
 *   31/07 — les 4 prioritats i prou regles
 * Contrastat el 31/07 contra els 124 correus i els 196 assumptes del Llibre: no hi ha cap correu seu
 * demanant que el sistema aprengui regles ni que decideixi criteri. Mai ho van demanar.
 *
 * Aquest guardià impedeix que això torni enrere sense adonar-nos-en.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); if (extra) console.error('     ' + extra); } };

// --- l'interruptor existeix i està encès -----------------------------------
check('existeix l\'interruptor del criteri del tècnic', /const CRITERI_DEL_TECNIC\s*=/.test(h));
check('està ENCÈS (el programa no els demana res del seu criteri)', /const CRITERI_DEL_TECNIC\s*=\s*true/.test(h),
  'si algú el posa a false, el client torna a rebre les peticions de validació que ha prohibit per escrit');

// --- les tres coses que els demanaven, callades ----------------------------
const fFb = (h.match(/function showFeedbackBar\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('la pregunta «l\'esborrany ha sortit bé?» no surt', /CRITERI_DEL_TECNIC/.test(fFb) && /display="none"/.test(fFb));
const fWhy = (h.match(/function openWhyModal\(decs\)\{[\s\S]{0,200}/) || [''])[0];
check('el qüestionari del «per què» en signar no s\'obre', /if\(CRITERI_DEL_TECNIC\)return/.test(fWhy));
const fBadge = (h.match(/async function refreshAprBadge\(\)\{[\s\S]{0,260}/) || [''])[0];
check('el comptador de lliçons pendents no es pinta', /CRITERI_DEL_TECNIC/.test(fBadge));
check('el botó d\'aprenentatge queda amagat', /\$\("#aprBtn"\)\.style\.display=CRITERI_DEL_TECNIC\?"none"/.test(h));

// --- 31/07 vespre · LA FUITA QUE SE'NS VA ESCAPAR --------------------------
// L'endemà de dir-los que estava tot callat, a la pantalla d'inici hi seguia el bloc groc
// «Queden N decisions sense explicar… cada resposta es converteix en una regla». Ho va veure Albert
// a la seva pantalla. Es va apagar amb el mateix interruptor. Aquest guardià el vigila i, sobretot,
// vigila que CAP text de l'aplicació torni a dir-los que el que facin es converteix en una regla.
const fWhyPend = (h.match(/async function loadWhyPend\(\)\{[\s\S]{0,1200}/) || [''])[0];
check('el bloc de la pantalla d\'inici que demana explicar decisions no surt',
  /if\(CRITERI_DEL_TECNIC\)\{\s*box\.classList\.add\("hidden"\);\s*return;\s*\}/.test(fWhyPend),
  'és el que van veure el 31/07 al vespre: demanava explicar 11 decisions i prometia convertir-les en regles');

// Cap text que els digui que el que toquen es converteix en regles pot arribar a la pantalla. No
// s'esborra —el dia que ho demanin es torna a encendre—, però ha d'estar SEMPRE darrere l'interruptor:
// cada aparició ha de tenir el guard a la mateixa funció, just abans. Si algú n'escriu una de nova en
// un lloc sense guard, això surt en vermell.
const senseComentaris = h.replace(/^\s*\/\/.*$/gm, '');
for (const [què, re] of [
  ['«es converteix en una regla»', /es converteix en una regla/g],
  ['«se convierte en una regla»', /se convierte en una regla/g],
  ['«decisions sense explicar»', /decisions sense explicar<\/b>/g],
  ['«decisiones sin explicar»', /decisiones sin explicar<\/b>/g],
]) {
  let m, totesProtegides = true, n = 0;
  re.lastIndex = 0;
  while ((m = re.exec(senseComentaris)) !== null) {
    n++;
    const abans = senseComentaris.slice(Math.max(0, m.index - 1600), m.index);
    if (!/if\(CRITERI_DEL_TECNIC\)/.test(abans)) totesProtegides = false;
  }
  check('el text ' + què + ' (' + n + ') no pot arribar a la pantalla', totesProtegides,
    'ha d\'estar darrere de l\'interruptor, com la resta. El 31/07 al vespre n\'hi havia un a la pantalla d\'inici que no ho estava');
}

// --- res del que van prohibir torna a entrar -------------------------------
check('no s\'ha tornat a posar la regla d\'esmalt de baranes (retirada el 31/07)',
  !/ESMALT DE BARANES|ESMALTE DE BARANDAS/.test(h),
  'la informació d\'ella viu al Llibre de Decisions; a la pantalla NO es pinta cap regla nova');

// --- el catàleg diu d'on surt el preu, no només «confirma» ------------------
// la branca bona és la que ESCRIU el preu del catàleg (marca l'origen), no la que només compara
const mSegur = (h.match(/if\(_p\.estado==="segur"[^\n]*/g) || []).map(s => s).find(s => /r\.origen="catalog"/.test(s));
check('existeix la branca del preu segur del catàleg', !!mSegur);
if (mSegur) {
  check('el preu del catàleg diu CONTRA QUINA partida ha casat', /_p\.font/.test(mSegur),
    'mesurat el 31/07: el cercador dóna per segures casades que no ho són; si no es veu l\'origen, el tècnic no ho pot caçar');
  check('i segueix demanant confirmació abans de fiar-se\'n', /confirmar|confirma/.test(mSegur));
}

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
