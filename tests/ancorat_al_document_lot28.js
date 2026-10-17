#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 28 (14/10/2026) · CADA FILA ANCORADA AL TEXT DEL DOCUMENT. Documents inventats, castellà i català, cap dada de cap client (va també al
 * repositori públic). Les quatre formes de la IA que la prova de pagament del LOT 27 va treure, i el seu contrari (el que no s'ha de tocar):
 *  1) el títol i la quantitat de la capçalera enganxats a l'inici del text → fora (també quan el document no té línia de títol i la lectura repeteix
 *     el principi del text en majúscules amb la quantitat); un text que de debò acaba en una quantitat, o un «3-4 mm» dins la frase, no es toca;
 *  2) una paraula canviada → el text del document, amb marca; una paraula AFEGIDA (que l'app hi pot haver posat) no es toca;
 *  3) la línia de codi + unitat d'una partida presa per capítol → no és capítol (els de sota tornen un número, i els avisos que en citaven els números també);
 *     un capítol de debò es queda;
 *  4) el text de la partida de sota posat en una altra → la de dalt es queda amb el seu (el que el document escriu entre el seu títol i el de l'altra);
 *     si el document escriu aquest text dues vegades, no es toca res.
 *  5) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const eines = H => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  return new Function('IDIOMA', 'function nomZonaDelDocument(){ return null; }\nfunction pctPerDefecte(){ return null; }\n' + b + '\nreturn {ancoraAlDocument:(typeof ancoraAlDocument==="function"?ancoraAlDocument:null)};')('es'); } catch (e) { return null; } };
const D = {
  es: { c: ['CAP.1 FACHADA NORTE', 'CAP.2 PATIO'], ret: ['RETIRADA DE VEGETACION EXISTENTE', 'Retirada de vegetación existente en la zona de implantación del ascensor, con carga manual de escombros a contenedor.'],
        pin: ['PINTADO REBOCO DE MORTERO', 'Pintado sobre reboco de mortero de cemento de muro perimetral con pintura plástica de exteriores en color a definir.'],
        gri: ['REPARACIÓN DE GRIETAS', 'Saneado de grietas mediante el relleno con mortero de cal hidráulico y posterior acabado para igualar superficies con mortero de cal aérea.', 'igualar', 'equilibrar'],
        baj: 'Retirada y sustitución completa del bajante de fibrocemento existente en la fachada posterior.',
        pat: ['PINTURA EN INTERIOR DE PATIO', 'Se valorará según el coste la opción de pintar la totalidad de los patios interiormente, total ambos', 'patios m2 sin descontar huecos'],
        val: 'SE VALORARÁ SEGÚN EL COSTE', gr34: 'Tratamiento de las posibles grietas mayores de 3-4mm mediante la colocación de grapas de acero galvanizado.' },
  ca: { c: ['CAP.1 FAÇANA NORD', 'CAP.2 PATI'], ret: ['RETIRADA DE VEGETACIÓ EXISTENT', 'Retirada de la vegetació existent a la zona on s\'instal·larà l\'ascensor, amb càrrega manual de runa a contenidor.'],
        pin: ['PINTAT ARREBOSSAT DE MORTER', 'Pintat sobre arrebossat de morter de ciment del mur perimetral amb pintura plàstica d\'exteriors de color a definir.'],
        gri: ['REPARACIÓ D\'ESQUERDES', 'Sanejat d\'esquerdes mitjançant el reompliment amb morter de calç hidràulica i posterior acabat per igualar superfícies amb morter de calç aèria.', 'igualar', 'equilibrar'],
        baj: 'Retirada i substitució completa del baixant de fibrociment existent a la façana posterior.',
        pat: ['PINTURA A L\'INTERIOR DEL PATI', 'Es valorarà segons el cost l\'opció de pintar la totalitat dels patis per dins, total tots dos', 'patis m2 sense descomptar forats'],
        val: 'ES VALORARÀ SEGONS EL COST', gr34: 'Tractament de les possibles esquerdes més grans de 3-4mm mitjançant la col·locació de grapes d\'acer galvanitzat.' } };
const cap = t => t.charAt(0) + t.slice(1).toLowerCase();
const docDe = d => [d.c[0], '1 ut ' + d.ret[0] + ' 1,00', d.ret[1], '2 m2 ' + d.pin[0] + ' 14,00', d.pin[1], '3 m2 ' + d.gri[0] + ' 6,50', d.gri[1], '01.02 Ml', d.baj, '7,00', d.c[1],
  '4 m2 ' + d.pat[0] + ' 18,90', d.pat[1] + ' 396,00', d.pat[2], '5 ml ' + cap(d.gri[0]) + ' 8,00', d.gr34, '6 m2 Aplicación de pintura al silicato previa base de una capa de fondo fijador sobre los paramentos de la fachada. 41,00'].join('\n') + '\n' + 'Texto del documento para que tenga longitud suficiente. '.repeat(4);
const P = (t, body, q, ut) => ({ tipo: 'part', desc: t + '\n- ' + body, ut: ut || 'm2', amid: q });
const body = r => String(r.desc).split('\n').slice(1).join('\n').replace(/^-\s*/, '');
function proves(H) { const out = []; const T = (n, c, x) => { out.push([n, !!c]); if (!c && x && process.env.DBG) console.error(n, x); }; const E = eines(H);
  if (!E || !E.ancoraAlDocument) { T('eines', false); return out; }
  for (const id of ['es', 'ca']) { const d = D[id], doc = docDe(d), es = id === 'es';
    // 1) cola
    const R1 = [{ tipo: 'cap', desc: d.c[0] }, P(d.ret[0], d.ret[0] + ' 1,00 ' + d.ret[1], 1, 'ud'), P(d.pin[0], d.pin[0] + ' 14,00 ' + d.pin[1], 14)];
    E.ancoraAlDocument(R1, doc, [], es);
    T(id + ' 1 · el títol i la quantitat enganxats al principi del text, fora', body(R1[1]) === d.ret[1] && body(R1[2]) === d.pin[1], body(R1[1]));
    const R1e = [P(d.ret[0].split(' ').slice(0, 2).join(' '), d.ret[0] + ' 1,00 ' + d.ret[1], 1, 'ud')]; E.ancoraAlDocument(R1e, doc, [], es);
    T(id + ' 1 · i si el nostre títol era només el principi del de la capçalera, el del document', String(R1e[0].desc).split('\n')[0] === d.ret[0].toUpperCase() && body(R1e[0]) === d.ret[1], R1e[0].desc);
    const R1b = [P(d.val, d.pat[1] + ' ' + d.pat[2], 396)]; E.ancoraAlDocument(R1b, doc, [], es);
    T(id + ' 1 · un text de debò que acaba amb la seva quantitat i continua a sota, no es toca', body(R1b[0]) === d.pat[1] + ' ' + d.pat[2], body(R1b[0]));
    const R1c = [P('APLICACIÓN DE PINTURA', 'APLICACIÓN DE PINTURA AL SILICATO PREVIA BASE DE UNA CAPA DE FONDO FIJADOR SOBRE LOS PARAMENTOS DE LA FACHADA. 41,00 6 m2 Aplicación de pintura al silicato previa base de una capa de fondo fijador sobre los paramentos de la fachada.', 41)];
    E.ancoraAlDocument(R1c, doc, [], es);
    T(id + ' 1 · sense línia de títol: el principi repetit en majúscules i la quantitat, fora (i el número de la partida)', /^m2 Aplicación de pintura al silicato/.test(body(R1c[0])), body(R1c[0]));
    const R1d = [P(cap(d.gri[0]), d.gr34, 4, 'ml')]; E.ancoraAlDocument(R1d, doc, [], es);
    T(id + ' 1 · un «3-4mm» dins la frase no es pren per quantitat', body(R1d[0]) === d.gr34, body(R1d[0]));
    // 2) paraula
    const R2 = [P(d.gri[0], d.gri[1].replace(d.gri[2], d.gri[3]), 6.5)]; E.ancoraAlDocument(R2, doc, [], es);
    T(id + ' 2 · la paraula canviada torna a ser la del document, amb marca', body(R2[0]) === d.gri[1] && /DOCUMENT/.test(R2[0].flag || ''), body(R2[0]));
    const R2d = [P(d.gri[0], 'X3 - ' + d.gri[1].replace(d.gri[2], d.gri[3]).replace(/\.$/, '') + ' (P - 12)', 6.5)]; E.ancoraAlDocument(R2d, doc, [], es);
    T(id + ' 2 · el codi de davant i l\'etiqueta del final es queden; només canvia la paraula', body(R2d[0]) === 'X3 - ' + d.gri[1].replace(/\.$/, '') + ' (P - 12)', body(R2d[0]));
    const w0 = d.gri[1].split(' ')[0], R2c = [P(d.gri[0], d.gri[1].replace(w0, es ? 'Arreglo' : 'Arranjament'), 6.5)]; E.ancoraAlDocument(R2c, doc, [], es);
    T(id + ' 2 · també la primera paraula canviada', body(R2c[0]) === d.gri[1], body(R2c[0]));
    const ins = d.gri[1].replace(d.gri[2], d.gri[2] + ' ' + (es ? 'completamente' : 'completament')); const R2b = [P(d.gri[0], ins, 6.5)]; E.ancoraAlDocument(R2b, doc, [], es);
    T(id + ' 2 · una paraula afegida no es treu (pot ser de l\'app)', body(R2b[0]) === ins && !R2b[0].flag, body(R2b[0]));
    // 3) capítol que és codi + unitat
    const R3 = [{ tipo: 'cap', desc: d.c[0], num: '1' }, P(d.gri[0], d.gri[1], 6.5), { tipo: 'cap', desc: '01.02 ML', num: '2' }, Object.assign(P('RETIRADA', d.baj, 7, 'ml'), { num: '2.1' }), { tipo: 'cap', desc: d.c[1], num: '3' }, Object.assign(P(d.pat[0], '', 18.9), { num: '3.1' })];
    const av3 = ['⚠ 1 cantidad: 3.1 (0 / documento 18,90)']; E.ancoraAlDocument(R3, doc, av3, es);
    T(id + ' 3 · la línia de codi i unitat no és capítol; el de sota torna un número, i l\'avís que en citava la partida també', R3.filter(r => r.tipo === 'cap').length === 2 && R3[3].num === '2' && av3[0].indexOf('2.1') >= 0 && av3[0].indexOf('3.1') < 0, JSON.stringify(R3.map(r => r.num)) + av3[0]);
    const R3b = [{ tipo: 'cap', desc: d.c[0], num: '1' }, P(d.gri[0], d.gri[1], 6.5), { tipo: 'cap', desc: d.c[1], num: '2' }, P(d.pat[0], '', 18.9)]; E.ancoraAlDocument(R3b, doc, [], es);
    T(id + ' 3 · un capítol de debò es queda', R3b.filter(r => r.tipo === 'cap').length === 2);
    // 4) el text de la de sota
    const R4 = [P(d.pat[0], d.pat[1] + ' 396,00 ' + d.pat[2], 18.9), P(d.val, d.pat[1] + ' ' + d.pat[2], 396)]; E.ancoraAlDocument(R4, doc, [], es);
    T(id + ' 4 · la de dalt es queda amb el seu text (aquí cap), la de sota amb el seu', !body(R4[0]).trim() && body(R4[1]).indexOf(d.pat[1].slice(0, 20)) === 0, body(R4[0]));
    const fi = es ? 'Limpieza final de obra con retirada de todos los restos y embalajes a contenedor autorizado.' : 'Neteja final d\'obra amb retirada de totes les restes i embalatges a contenidor autoritzat.';
    const doc2 = doc + '\n7 m2 ' + d.pat[0] + ' 20,00\n' + d.pat[1] + ' 396,00\n' + d.pat[2] + '\n8 pa NETEJA 1,00\n' + fi;
    const R4b = [P('NETEJA', fi, 1, 'pa'), P(d.pat[0], d.pat[1] + ' ' + d.pat[2], 18.9), P(d.val, d.pat[1] + ' ' + d.pat[2], 396)]; E.ancoraAlDocument(R4b, doc2, [], es);
    T(id + ' 4 · si el document escriu el text dues vegades (tantes com files), res', body(R4b[1]) === d.pat[1] + ' ' + d.pat[2] && !R4b[1].flag && !R4b[2].flag, body(R4b[1]));
  }
  return out; }
const base = proves(H0); base.forEach(([n, c]) => check(n, c));
check('el tram crida l\'ancoratge al document', H0.indexOf('try{ ancoraAlDocument(allRows,amidament,allAvisos,_es25); }') >= 0);
const PECES = [
  ['el títol i la quantitat enganxats', 'if(p>=0&&_a28Cola(D,r,p)){', 'if(false){'],
  ['el tros de davant que el document no hi escriu', '&&_a28Davant(D,r)){', '&&false){'],
  ['només si acaba amb una quantitat com la del document', 'if(!mq) continue;   // el tros de davant', 'if(false) continue;   // el tros de davant'],
  ['el títol de la capçalera', 'if(h.length<=90&&', 'if(false&&'],
  ['la paraula canviada', '&&_a28Paraules(D,r,es)){', '&&false){'],
  ['la primera paraula canviada', 'if(P[0][0]>0){ const x=', 'if(0){ const x='],
  ['el que hi ha abans i després de les paraules es queda', 'r.desc=c.tit+"\\n"+c.pre+c.body.slice(0,TK[0].a)+t+c.body.slice(TK[TK.length-1].b);', 'r.desc=c.tit+"\\n"+c.pre+t;'],
  ['una paraula afegida no es treu', 'if(gb>0&&gd===0) return false;', ''],
  ['la línia de codi i unitat', 'if(!_FP_SOLA.test(t)) continue;', 'continue;'],
  ['els avisos amb els números nous', 'avisos[k]=avisos[k].replace(', 'avisos[k]=avisos[k]+"".replace('],
  ['el text de la de sota', 'r.desc=c.tit+"\\n-"; out.roba++;', 'out.roba++;'],
];
for (const [nom, de, a] of PECES) {
  const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
  let p2 = null; try { p2 = proves(H); } catch (e) { p2 = null; }
  check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k] && base[k][1] && !x[1]));
}
console.log('\n' + ok + ' OK · ' + ko + ' fallades');
process.exit(ko ? 1 : 0);
