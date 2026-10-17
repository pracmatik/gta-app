#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 26 (14/10/2026) · DOS ERRORS D'ESTRUCTURA QUE ENCARA SORTIEN SENSE MARCA EN LECTURES NOVES. Documents inventats, castellà i català,
 * cap dada de cap client (va també al repositori públic).
 *  1) Document SENSE títols de partida (la partida és «19 Ml. Limpieza general…»: el títol el fem nosaltres i es repeteix a cada capítol): una partida que la
 *     lectura posa a l'inici del capítol de sota torna al seu capítol, buscant on l'escriu el document pel principi del seu TEXT (la primera llargada que el
 *     document escriu una sola vegada). Amb el text repetit a tots dos capítols, no es mou res. La que ja és al seu lloc, no es toca.
 *  2) Un capítol BUIT que repeteix el nom de la zona de just a sobre («FACHADA PRINCIPAL» sota la zona FACHADA PRINCIPAL) no és cap capítol: fora, i els de
 *     sota tornen un número. Un capítol buit amb un altre nom es queda (amb el seu avís, com fins ara).
 *  3) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const fnDe = (H, n) => { const s0 = H.indexOf('function ' + n + '('); if (s0 < 0) return ''; let i = H.indexOf('{', s0), d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const eines = H => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  const fora = ['_dehyphen', 'capNumOf', 'renumberRows', 'renumeraCapitol'].map(n => fnDe(H, n)).join('\n');
  return new Function('IDIOMA', 'function nomZonaDelDocument(){ return null; }\nfunction pctPerDefecte(){ return null; }\n' + fora + '\n' + b + '\nreturn {tornaAlSeuCapitol:(typeof tornaAlSeuCapitol==="function"?tornaAlSeuCapitol:null),convencionsGta13oct:(typeof convencionsGta13oct==="function"?convencionsGta13oct:null)};')('es'); } catch (e) { return null; } };
const D = {
  es: { z: 'FACHADA PRINCIPAL', c: ['MEDIO AUXILIAR', 'CORNISA PERIMETRAL SUPERIOR', 'PLANTA BAJA DE PIEDRA', 'BARANDILLAS'],
        t: ['M² Eliminación mediante decapado y/o medios mecánicos-manuales del revestimiento de acabado de la cornisa superior, para dejar el estuco visto.',
            'Ml. Saneado y repicado de las zonas disgregadas o en falso anclaje de la cornisa perimetral superior.',
            'M² de aplicación de pintura al silicato previa base de una capa de fondo fijador.',
            'Ml. Limpieza general de la superficie superior de la cornisa hasta dejarla seca y ligeramente rugosa.',
            'M² Eliminación mediante decapado y/o medios mecánicos-manuales del revestimiento de acabado de los elementos ornamentales de piedra.',
            'M² Aplicación de dos capas de concentrado especial consolidante mediante silicato de etilo.',
            'M² Saneado del soporte, dejándolo limpio y exento de partículas no adherentes para sellar fisuras.'] },
  ca: { z: 'FAÇANA PRINCIPAL', c: ['MITJANS AUXILIARS', 'CORNISA PERIMETRAL SUPERIOR', 'PLANTA BAIXA DE PEDRA', 'BARANES'],
        t: ['M² Eliminació mitjançant decapat i/o mitjans mecànics-manuals del revestiment d\'acabat de la cornisa superior, per deixar l\'estuc vist.',
            'Ml. Sanejat i repicat de les zones disgregades o en fals ancoratge de la cornisa perimetral superior.',
            'M² d\'aplicació de pintura al silicat prèvia base d\'una capa de fons fixador.',
            'Ml. Neteja general de la superfície superior de la cornisa fins deixar-la seca i lleugerament rugosa.',
            'M² Eliminació mitjançant decapat i/o mitjans mecànics-manuals del revestiment d\'acabat dels elements ornamentals de pedra.',
            'M² Aplicació de dues capes de concentrat especial consolidant mitjançant silicat d\'etil.',
            'M² Sanejat del suport, deixant-lo net i lliure de partícules no adherents per segellar fissures.'] } };
const TIT = ['ELIMINACIÓN', 'SANEADO', 'APLICACIÓN DE PINTURA', 'LIMPIEZA GENERAL', 'ELIMINACIÓN', 'APLICACIÓN', 'SANEADO'];   // títols curts que es repeteixen (els fem nosaltres)
const part = (d, k, q) => ({ tipo: 'part', desc: TIT[k] + '\n- ' + d.t[k], ut: 'm2', amid: q });
function proves(H) { const out = []; const P = (n, c) => out.push([n, !!c]); const E = eines(H);
  if (!E || !E.tornaAlSeuCapitol || !E.convencionsGta13oct) { P('eines', false); return out; }
  for (const id of ['es', 'ca']) { const d = D[id];
    // el document: la pintura del text 2 surt també a la planta baixa (text repetit), i la neteja (3) és l'última de la cornisa
    const doc = ['a.7.- ' + d.c[1].charAt(0) + d.c[1].slice(1).toLowerCase() + '.', '16 ' + d.t[0] + ' 2,90', '17 ' + d.t[1] + ' 9,60', '18 ' + d.t[2] + ' 2,90', '19 ' + d.t[3] + ' 1,95',
      'a.8.- ' + d.c[2].charAt(0) + d.c[2].slice(1).toLowerCase() + '.', '20 ' + d.t[4] + ' 54,00', '21 ' + d.t[5] + ' 54,00', '22 ' + d.t[6] + ' 2,70', '23 ' + d.t[2] + ' 54,00'].join('\n');
    const R = [{ tipo: 'cap', desc: d.c[1] }, part(d, 0, 2.9), part(d, 1, 9.6), part(d, 2, 2.9), { tipo: 'cap', desc: d.c[2] }, part(d, 3, 1.95), part(d, 4, 54), part(d, 5, 54), part(d, 6, 2.7), part(d, 2, 54)];
    let av = []; E.tornaAlSeuCapitol(R, doc, av);
    const cap = r => { let c = null; for (const x of R) { if (x.tipo === 'cap') c = x.desc; if (x === r) return c; } return null; };
    const net = R.find(r => r.desc.indexOf(d.t[3].slice(0, 20)) >= 0);
    P(id + ' 1 · la neteja (19) torna a la cornisa, buscada pel seu text (els títols es repeteixen), amb avís', cap(net) === d.c[1] && av.length >= 1);
    P(id + ' 1 · la resta no es mou (la pintura repetida es queda a cada capítol)', R.filter(r => r.tipo === 'part').length === 8 && cap(R[R.length - 1]) === d.c[2]);
    // text repetit a tots dos capítols: res no es pot provar → no es mou
    const doc2 = doc.replace('19 ' + d.t[3] + ' 1,95', '19 ' + d.t[2] + ' 1,95');
    const R2 = [{ tipo: 'cap', desc: d.c[1] }, part(d, 0, 2.9), part(d, 1, 9.6), part(d, 2, 2.9), { tipo: 'cap', desc: d.c[2] }, part(d, 2, 1.95), part(d, 4, 54), part(d, 5, 54), part(d, 6, 2.7)];
    av = []; E.tornaAlSeuCapitol(R2, doc2, av); P(id + ' 1 · amb el text repetit, no es mou res', R2[4].tipo === 'cap' && R2[5].amid === 1.95);
    // el mateix text en una ALTRA zona (bessona d'una altra escala, amb una frase de més): no diu res d'aquests dos capítols → no es mou res
    const Z2 = id === 'es' ? 'ESCALERA 2' : 'ESCALA 2';
    const doc3 = [Z2, 'a.7.- ' + d.c[1].charAt(0) + d.c[1].slice(1).toLowerCase() + '.', '34 ' + d.t[3].replace(/\.$/, ', con protección de los elementos inferiores.') + ' 1,95', d.z, doc].join('\n');
    const R3 = [{ tipo: 'sec', desc: d.z }, { tipo: 'cap', desc: d.c[1] }, part(d, 0, 2.9), part(d, 1, 9.6), part(d, 2, 2.9), part(d, 3, 1.95), { tipo: 'cap', desc: d.c[2] },
      { tipo: 'part', desc: TIT[3] + '\n- ' + d.t[3].replace(/\.$/, ', con protección de los elementos inferiores.'), ut: 'm2', amid: 1.95 }, part(d, 4, 54), part(d, 5, 54), part(d, 6, 2.7)];
    av = []; E.tornaAlSeuCapitol(R3, doc3, av);
    P(id + ' 1 · una bessona d\'una altra zona (el text de l\'altra escala) no fa moure res', R3[6].tipo === 'cap' && R3[7].amid === 1.95 && R3[5].amid === 1.95);
    // 2) capítol buit amb el nom de la zona
    const C = [{ tipo: 'sec', desc: d.z }, { tipo: 'cap', desc: d.z, num: '1' }, { tipo: 'cap', desc: d.c[0], num: '2' }, part(d, 0, 2), { tipo: 'cap', desc: d.c[1], num: '3' }, part(d, 1, 3)];
    E.convencionsGta13oct(C, '', false);
    P(id + ' 2 · el capítol buit que repeteix la zona, fora; els de sota tornen 1 i 2', C.filter(r => r.tipo === 'cap').length === 2 && C[1].desc === d.c[0] && C[1].num === '1' && C.filter(r => r.tipo === 'cap')[1].num === '2');
    const C2 = [{ tipo: 'sec', desc: d.z }, { tipo: 'cap', desc: d.c[3], num: '1' }, { tipo: 'cap', desc: d.c[0], num: '2' }, part(d, 0, 2)];
    E.convencionsGta13oct(C2, '', false);
    P(id + ' 2 · un capítol buit amb un altre nom es queda', C2.filter(r => r.tipo === 'cap').length === 2 && C2[1].desc === d.c[3]);
  }
  return out; }
const base = proves(H0); base.forEach(([n, c]) => check(n, c));
const PECES = [
  ['el text quan el títol es repeteix', 'for(const n of [40,80,160,c.length]){', 'for(const n of []){'],
  ['la llargada sencera del text', '[40,80,160,c.length]', '[40,80,160]'],
  ['només entre les capçaleres del tall', 'const f=x=>!x?null:(x.cos&&(hA==null||x.a<hA||(hN!=null&&x.a>hN)))?null:x.a;', 'const f=x=>!x?null:x.a;'],
  ['el capítol buit amb el nom de la zona', 'else if(primer&&k1(rows[z].desc)===k1(r.desc)&&k1(r.desc).length>=4){ fet=true; }', ''],
];
for (const [nom, de, a] of PECES) {
  const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
  let p2 = null; try { p2 = proves(H); } catch (e) { p2 = null; }
  check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k] && base[k][1] && !x[1]));
}
console.log('\n' + ok + ' OK · ' + ko + ' fallades');
process.exit(ko ? 1 : 0);
