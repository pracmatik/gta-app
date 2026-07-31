#!/usr/bin/env node
'use strict';
/*
 * Guardià de les IMATGES DE L'APP (31/07/2026 · la causa REAL dels PDF en blanc).
 *
 * Què va passar. El 18/07 es va anonimitzar el fitxer que es publica: els noms d'obres del client es
 * van substituir per àlies («Obra-N»). Aquella substitució es va fer sobre TOT el fitxer, i el logo i
 * el segell de GTA hi viuen a dins com un text llarguíssim de lletres i números (base64). Per pura
 * casualitat, dins d'aquest text hi apareixia el nom d'una obra — i el canvi el va reemplaçar per
 * «Obra-N». Quatre vegades: tres al logo i una al segell.
 *
 * Conseqüència: des del 18/07, CAP PDF es generava. El programa muntava el document, li posava el logo,
 * el generador el rebutjava («Incomplete or corrupt PNG file») i l'error saltava per fora del camí que
 * el programa vigilava: la pestanya es quedava en blanc, muda, per sempre. Tretze dies. La tècnica ho
 * va reportar tres vegades i nosaltres li vam dir dos cops que estava arreglat.
 *
 * Verificat el 31/07: la versió del 16/07 (abans de l'anonimització) té les dues imatges perfectes;
 * la publicada les té trencades amb el mateix «Obra-N» a dins.
 *
 * Aquest guardià comprova TOTES les imatges incrustades, sigui quin sigui el seu nom:
 *   1. el text és base64 net (cap caràcter estrany com el guionet que ho va trencar)
 *   2. tornar a codificar el binari dóna EXACTAMENT el mateix text (anada i tornada)
 *   3. és un PNG de veritat (capçalera) i està SENCER (acaba amb el seu final)
 * Qualsevol procés que torni a tocar un byte d'una imatge —anonimitzador, cerca-i-reemplaça, el que
 * sigui— posa aquest guardià en vermell i el desplegament s'atura.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); if (extra) console.error('     ' + extra); } };

// Qualsevol constant que contingui una imatge incrustada, es digui com es digui.
const CAP = /([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*"(data:image\/[a-z]+;base64,)?([A-Za-z0-9+/=]{2000,})"/g;
const trobades = [];
let m; while ((m = CAP.exec(h))) trobades.push({ nom: m[1], prefix: m[2] || '', b64: m[3], pos: m.index });
// també les que porten algun caràcter estrany a dins: NO poden escapar-se del guardià pel fet d'estar trencades
const TRENCADA = /([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*"(data:image\/[a-z]+;base64,)([^"]{2000,})"/g;
while ((m = TRENCADA.exec(h))) if (!trobades.some(t => t.nom === m[1])) trobades.push({ nom: m[1], prefix: m[2], b64: m[3], pos: m.index, sospitosa: true });

check('hi ha imatges incrustades per vigilar (' + trobades.length + ')', trobades.length >= 3,
  'esperades com a mínim el logo del pressupost, el de la carta i el segell');

for (const t of trobades) {
  const linia = h.slice(0, t.pos).split('\n').length;
  const estranys = [...new Set((t.b64.match(/[^A-Za-z0-9+/=]/g) || []))];
  check(t.nom + ' · el text de la imatge no té cap caràcter estrany (línia ' + linia + ')', estranys.length === 0,
    'trobats ' + JSON.stringify(estranys) + ' — això és el que va trencar el logo el 18/07 (l\'àlies «Obra-N» dins del base64)');
  if (estranys.length) continue;
  let buf = null;
  try { buf = Buffer.from(t.b64, 'base64'); } catch (e) {}
  check(t.nom + ' · anada i tornada exacta (el text ÉS la imatge)', !!buf && buf.toString('base64') === t.b64,
    'si no coincideix, algú ha canviat bytes de la imatge');
  if (!buf) continue;
  check(t.nom + ' · és un PNG de veritat', buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a');
  check(t.nom + ' · està sencer (té el final del PNG)', buf.slice(-8).toString('hex').endsWith('ae426082'),
    'un PNG tallat fa que el generador de PDF peti i la pestanya es quedi en blanc');
}

console.log('\n' + (ko ? 'X ' + ko + ' FALLADES — NO es pot publicar: hi ha imatges trencades i els PDF no sortiran' : 'OK ' + ok + '/' + ok + ' en verd'));
process.exit(ko ? 1 : 0);
