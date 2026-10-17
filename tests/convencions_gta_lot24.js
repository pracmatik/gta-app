#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 24 (13/10/2026) · LES CONVENCIONS DELS SEUS PRESSUPOSTOS A MÀ (els 10 «passats al nostre format» del 13/10). Documents inventats,
 * castellà i català, cap dada de cap client (va també al repositori públic).
 *  1) l'amortització que afegeix el programa no gasta número: bastida 1.1, amortització 1.1.2, la següent continua 1.2 (lectura i canvi de número);
 *  2) el capítol porta el número i el nom del document, sense el codi: «CAP.10 ASCENSOR» → 10 ASCENSOR, «CAP.9.1 OPCION 2 …» → 9.1 i partides 9.1.n,
 *     «A).- FACHADA PRINCIPAL» / «A.1.- MEDIO AUXILIAR» → sense la lletra (número intacte); «REPARACIÓ 1: …», «A L'INTERIOR …», «B.I.E. …» no es toquen;
 *  3) el títol que el PDF parteix en dues línies és un sol títol (només amb la primera llarga, les dues en majúscules, text en minúscules a sota i
 *     les dues seguides al document); el text escrit tot en majúscules es llegeix seguit, una llista numerada no;
 *  4) la unitat dins la frase no es toca en aquest lot (pendent: un sol exemple seu i la mateixa forma als documents de prova es llegeix sense unitat);
 *  5) la zona de dalt no surt d'una NOTA, i el títol que continua «DE …» a la línia de sota hi és sencer;
 *  6) zones amb un sol capítol (Excel d'un full per obra) → capítols seguits sense zones; amb una zona de dos capítols, res;
 *  7) una nota del document que no surt a l'esborrany es diu en un avís; si hi és, o és un peu repetit, no;
 *  8) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const fnDe = (H, n) => { const s0 = H.indexOf('function ' + n + '('); if (s0 < 0) return ''; let i = H.indexOf('{', s0), d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const eines = (H, id) => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  const fora = ['_dehyphen', 'capNumOf', 'renumberRows', 'renumeraCapitol'].map(n => fnDe(H, n)).join('\n');
  return new Function('IDIOMA', fora + '\n' + b + '\nreturn {renumberRows,renumeraCapitol,convencionsGta13oct:(typeof convencionsGta13oct==="function"?convencionsGta13oct:null),nomZonaDelDocument,unirSaltsDelPdf,notesDelDocumentQueNoSurten:(typeof notesDelDocumentQueNoSurten==="function"?notesDelDocumentQueNoSurten:null)};')(id || 'ca'); } catch (e) { return null; } };
const CRIDA = 'convencionsGta13oct(allRows,amidament,isBC3)';
const T = {
  es: { bas: 'ANDAMIO TUBULAR METALICO', am: 'AMORTIZACIÓN DE ANDAMIO TUBULAR', p: ['PICADO DE CANTOS DE FORJADO', 'PINTURA DE FACHADA'], z: 'FACHADA PRINCIPAL', c: 'MEDIO AUXILIAR',
        t1: 'VALLADO DE LA ZONA DE TRABAJOS EN PLATAFORMA ELEVADORA DE BRAZO', t2: 'EN LA FACHADA DE LA CALLE INVENTADA.', tx: 'Suministro y montaje de vallado perimetral de obra con malla de ocultación.',
        u: 'de limpieza de toda la fachada mediante agua nebulizada a baja presión', U: 'M2', nota: 'NOTA: Las partidas marcadas con asterisco se medirán en obra antes de empezar', proj: 'REHABILITACIÓN PUNTUAL DE CANTOS', proj2: 'DE LOSAS DE HORMIGÓN DE LOS BALCONES',
        mj: ['MONTAJE Y DESMONTAJE DE ANDAMIO TUBULAR HASTA UNA', 'ALTURA DE CUATRO METROS CON MARCO HOMOLOGADO'] },
  ca: { bas: 'BASTIDA TUBULAR METALLICA', am: 'AMORTITZACIÓ DE BASTIDA TUBULAR', p: ['REPICAT DE CANTELLS DE FORJAT', 'PINTURA DE FAÇANA'], z: 'FAÇANA PRINCIPAL', c: 'MITJANS AUXILIARS',
        t1: 'TANCA DE LA ZONA DE TREBALLS EN PLATAFORMA ELEVADORA DE BRAÇ', t2: 'A LA FAÇANA DEL CARRER INVENTAT.', tx: 'Subministrament i muntatge de tanca perimetral d\'obra amb malla d\'ocultació.',
        u: 'de neteja de tota la façana amb aigua nebulitzada a baixa pressió', U: 'M2', nota: 'NOTA: Les partides marcades amb asterisc es mesuraran a l\'obra abans de començar', proj: 'REHABILITACIÓ PUNTUAL DE CANTELLS', proj2: 'DE LLOSES DE FORMIGÓ DELS BALCONS',
        mj: ['MUNTATGE I DESMUNTATGE DE BASTIDA TUBULAR FINS A UNA', 'ALÇADA DE QUATRE METRES AMB MARC HOMOLOGAT'] } };
function proves(H) { const out = []; const P = (n, c) => out.push([n, !!c]);
  for (const id of ['es', 'ca']) { const E = eines(H, id), d = T[id]; if (!E) { P(id + ' · eines', false); continue; }
    // 1) amortització
    const R = [{ tipo: 'sec', desc: d.z }, { tipo: 'cap', desc: d.c, num: '1' }, { tipo: 'part', desc: d.bas }, { tipo: 'subv', desc: 'desglose' }, { tipo: 'part', desc: d.am, origen: 'auto' }, { tipo: 'part', desc: d.p[0] }, { tipo: 'part', desc: d.p[1] }];
    E.renumberRows(R); P(id + ' 1 · bastida 1.1, amortització 1.1.2, següents 1.2 i 1.3', R[2].num === '1.1' && R[4].num === '1.1.2' && R[5].num === '1.2' && R[6].num === '1.3');
    R[1].num = '4'; E.renumeraCapitol(R, 1); P(id + ' 1 · canviar el número del capítol: 4.1, 4.1.2, 4.2, 4.3', R[2].num === '4.1' && R[4].num === '4.1.2' && R[5].num === '4.2' && R[6].num === '4.3');
    const R2 = [{ tipo: 'cap', desc: d.c, num: '1' }, { tipo: 'part', desc: d.am + ' DEL DOCUMENT' }, { tipo: 'part', desc: d.p[0] }]; E.renumberRows(R2);
    P(id + ' 1 · una amortització del document (no afegida) gasta el seu número', R2[1].num === '1.1' && R2[2].num === '1.2');
    // 2) codis de capítol
    const C = [{ tipo: 'sec', desc: 'A).- ' + d.z }, { tipo: 'cap', desc: 'A.1.- ' + d.c, num: '1' }, { tipo: 'cap', desc: 'CAP.9.1 OPCION 2 ' + d.p[0], num: '9' }, { tipo: 'cap', desc: 'CAP.10 ' + d.p[1], num: '12' },
      { tipo: 'cap', desc: 'REPARACIÓ 1: NETEJA DE FAÇANA', num: '13' }, { tipo: 'cap', desc: "A L'INTERIOR DE L'HABITATGE", num: '14' }, { tipo: 'cap', desc: 'B.I.E. EXTINTORS', num: '15' }, { tipo: 'part', desc: d.p[0] + '\n- Texto de la partida.' }];
    if (E.convencionsGta13oct && H.indexOf(CRIDA) >= 0) E.convencionsGta13oct(C, '', false);
    P(id + ' 2 · «A).- …» i «A.1.- …» sense la lletra; el número no es toca', C[0].desc === d.z && C[1].desc === d.c && C[1].num === '1');
    P(id + ' 2 · «CAP.9.1 OPCION 2 …» → 9.1 i «CAP.10 …» → 10, pel nom', C[2].num === '9.1' && C[2].desc === 'OPCION 2 ' + d.p[0] && C[3].num === '10' && C[3].desc === d.p[1]);
    P(id + ' 2 · «REPARACIÓ 1: …», «A L\'INTERIOR …» i «B.I.E. …» no es toquen', C[4].desc === 'REPARACIÓ 1: NETEJA DE FAÇANA' && C[4].num === '13' && C[5].desc === "A L'INTERIOR DE L'HABITATGE" && C[6].desc === 'B.I.E. EXTINTORS');
    const RN = [{ tipo: 'sec', desc: 'X' }, ...C.slice(2, 4), { tipo: 'part', desc: 'a' }]; RN.splice(2, 0, { tipo: 'part', desc: 'b' }); E.renumberRows(RN);
    P(id + ' 2 · les partides del 9.1 són 9.1.1', RN[2].num === '9.1.1' && RN[4].num === '10.1');
    // 3) títol en dues línies
    const doc = ['  04.3.  ' + d.t1, '         ' + d.t2, '', d.tx, '', '  TOTAL PARTIDA   10,00 ud'].join('\n');
    const mk = () => [{ tipo: 'cap', desc: d.c, num: '4' }, { tipo: 'part', desc: d.t1 + '\n- ' + d.t2 + '\n' + d.tx, ut: 'ud', amid: 10 }];
    let Q = mk(); if (E.convencionsGta13oct && H.indexOf(CRIDA) >= 0) E.convencionsGta13oct(Q, doc, false);
    P(id + ' 3 · el títol de dues línies és un de sol i el text a sota', Q[1].desc === d.t1 + ' ' + d.t2.replace(/\.$/, '') + '\n- ' + d.tx);
    Q = mk(); if (E.convencionsGta13oct) E.convencionsGta13oct(Q, doc.replace('\n         ' + d.t2, '\n\nALTRA COSA\n         ' + d.t2), false);
    P(id + ' 3 · si el document no les escriu seguides, no s\'uneixen', Q[1].desc === mk()[1].desc);
    Q = [{ tipo: 'part', desc: 'PINTURA DE FAÇANA\n- ' + d.t2 + '\n' + d.tx }]; if (E.convencionsGta13oct) E.convencionsGta13oct(Q, 'PINTURA DE FAÇANA\n' + d.t2 + '\n' + d.tx, false);
    P(id + ' 3 · un títol curt no s\'allarga', Q[0].desc === 'PINTURA DE FAÇANA\n- ' + d.t2 + '\n' + d.tx);
    Q = [{ tipo: 'part', desc: d.t1 + '\n- ' + d.t2 + '\n' + d.tx.toUpperCase() }]; if (E.convencionsGta13oct) E.convencionsGta13oct(Q, d.t1 + '\n' + d.t2 + '\n' + d.tx.toUpperCase(), false);
    P(id + ' 3 · tot en majúscules (sense text en minúscules a sota): no s\'uneix', Q[0].desc.split('\n')[0] === d.t1);
    const MJ = [{ tipo: 'part', desc: d.bas + '\n' + d.mj[0] + '\n' + d.mj[1] + '\n1. RETIRADA DE LA XARXA EXISTENT DE LA CORNISA I DELS BALCONS\n2. REPICAT I NETEJA DE LES ESQUERDES' }];
    E.unirSaltsDelPdf(MJ); const ml = MJ[0].desc.split('\n');
    P(id + ' 3 · el text en majúscules es llegeix seguit; la llista numerada no', ml[1] === d.mj[0] + ' ' + d.mj[1] && /^1\. /.test(ml[2]) && /^2\. /.test(ml[3]));
    // 4) [LOT 24 no ho fa: pendent, C-116] la unitat dins la frase no es toca
    Q = [{ tipo: 'part', desc: 'LIMPIEZA DE TODA LA FACHADA\n- ' + d.u + '.' }]; if (E.convencionsGta13oct) E.convencionsGta13oct(Q, '   2.1    ' + d.U + ' ' + d.u + '.\n   115,00', false);
    P(id + ' 4 · el text de la partida no canvia (cap unitat afegida)', Q[0].desc === 'LIMPIEZA DE TODA LA FACHADA\n- ' + d.u + '.');
    // 5) zona
    P(id + ' 5 · una NOTA no és la zona (ni en majúscules ni a mitja frase)', E.nomZonaDelDocument('NOTA: ' + d.proj + ' SEGONS LA PROPIETAT\n\n  1.1  m2  ' + d.p[0]) === null && E.nomZonaDelDocument('El proyecto es la ' + d.proj.toLowerCase() + ' que se ha pedido\n\n  1.1  m2  ' + d.p[0]) === null);
    P(id + ' 5 · el títol que continua «DE …» a sota hi és sencer', E.nomZonaDelDocument('PROYECTO EJECUTIVO DE ' + d.proj + '\n' + d.proj2 + '\n\n  1.1  m2  ' + d.p[0]) === d.proj + ' ' + d.proj2);
    // 6) zones d'un sol capítol
    const Z = () => [{ tipo: 'sec', desc: d.z + ' I SEGONA' }, { tipo: 'cap', desc: d.z }, { tipo: 'part', desc: d.p[0] }, { tipo: 'sec', desc: 'COBERTA' }, { tipo: 'cap', desc: 'COBERTA' }, { tipo: 'part', desc: d.p[1] },
      { tipo: 'cap', desc: 'OPCIONAL X' }, { tipo: 'part', desc: 'OPC', gta: 'opc' }];
    let RZ = Z(); if (E.convencionsGta13oct && H.indexOf(CRIDA) >= 0) E.convencionsGta13oct(RZ, '', true);
    const caps = RZ.filter(r => r.tipo === 'cap'), secs = RZ.filter(r => r.tipo === 'sec');
    P(id + ' 6 · zones d\'un sol capítol: fora, capítols 1-2-3 seguits (l\'opcional al seu lloc), el títol escrit si el del full n\'és l\'abreujat', secs.length === 1 && secs[0].desc === 'XXXXXXXXXXX' && caps.map(c => c.num).join() === '1,2,3' && caps[0].desc === d.z + ' I SEGONA' && caps[1].desc === 'COBERTA');
    RZ = Z(); if (E.convencionsGta13oct) E.convencionsGta13oct(RZ, '', false);
    P(id + ' 6 · en un PDF (no Excel) les zones es queden', RZ.filter(r => r.tipo === 'sec').length === 2);
    RZ = Z(); RZ.splice(3, 0, { tipo: 'cap', desc: 'ALTRE' }, { tipo: 'part', desc: 'Y' }); if (E.convencionsGta13oct) E.convencionsGta13oct(RZ, '', true);
    P(id + ' 6 · una zona amb dos capítols: no es toca res', RZ.filter(r => r.tipo === 'sec').length === 2);
    // 6b) capítol buit
    const CB = () => [{ tipo: 'sec', desc: 'C/ INVENTAT, Nº 26' }, { tipo: 'cap', desc: 'A).- ' + d.z, num: '1' }, { tipo: 'cap', desc: 'A.1.- ' + d.c, num: '2' }, { tipo: 'part', desc: d.p[0] }, { tipo: 'cap', desc: 'A.2.- ' + d.p[1], num: '3' }, { tipo: 'part', desc: d.p[1] }];
    let RB = CB(); if (E.convencionsGta13oct && H.indexOf(CRIDA) >= 0) E.convencionsGta13oct(RB, '', false);
    P(id + ' 6b · el títol de dalt llegit com a capítol buit és la zona (la zona era una adreça) i els capítols tornen a 1-2', RB[0].tipo === 'sec' && RB[0].desc === d.z && RB.filter(r => r.tipo === 'cap').map(r => r.num + ' ' + r.desc).join('|') === '1 ' + d.c + '|2 ' + d.p[1]);
    RB = [{ tipo: 'sec', desc: 'XXXXXXXXXXX' }, { tipo: 'cap', desc: d.c, num: '1' }, { tipo: 'part', desc: d.p[0] }, { tipo: 'cap', desc: d.z, num: '2' }, { tipo: 'cap', desc: d.z, num: '3' }, { tipo: 'part', desc: d.p[1] }, { tipo: 'cap', desc: 'ALTRES', num: '4' }, { tipo: 'part', desc: 'x' }];
    if (E.convencionsGta13oct) E.convencionsGta13oct(RB, '', false);
    P(id + ' 6b · el mateix capítol dues vegades, el primer buit: fora, i els de sota tornen un número', RB.filter(r => r.tipo === 'cap').map(r => r.num).join() === '1,2,3' && RB.filter(r => r.tipo === 'cap').length === 3);
    RB = [{ tipo: 'sec', desc: d.z }, { tipo: 'cap', desc: 'BUIT', num: '1' }, { tipo: 'cap', desc: d.c, num: '2' }, { tipo: 'part', desc: d.p[0] }];
    if (E.convencionsGta13oct) E.convencionsGta13oct(RB, '', false);
    P(id + ' 6b · amb una zona de debò, un capítol buit diferent no es toca (ja surt l\'avís de capítol sense partides)', RB.length === 4 && RB[0].desc === d.z && RB[1].desc === 'BUIT');
    RB = [{ tipo: 'sec', desc: 'XXXXXXXXXXX' }, { tipo: 'cap', desc: '01.- ' + d.c, num: '1' }, { tipo: 'cap', desc: '02.- ' + d.p[1], num: '2' }, { tipo: 'part', desc: d.p[1] }];
    if (E.convencionsGta13oct) E.convencionsGta13oct(RB, '', false);
    P(id + ' 6b · un capítol de debò que la lectura deixa buit al principi es queda (no es fa zona)', RB[0].desc === 'XXXXXXXXXXX' && RB.filter(r => r.tipo === 'cap').length === 2);
    RB = [{ tipo: 'sec', desc: 'XXXXXXXXXXX' }, { tipo: 'cap', desc: (id === 'es' ? 'MEDICIONES ACTUACIONES ITE' : 'AMIDAMENTS ACTUACIONS ITE'), num: '1' }, { tipo: 'cap', desc: d.c, num: '2' }, { tipo: 'part', desc: d.p[0] }];
    if (E.convencionsGta13oct) E.convencionsGta13oct(RB, '', false);
    P(id + ' 6b · el títol del document llegit com a capítol buit és la zona i el capítol de sota és l\'1', RB[0].desc === (id === 'es' ? 'MEDICIONES ACTUACIONES ITE' : 'AMIDAMENTS ACTUACIONS ITE') && RB.filter(r => r.tipo === 'cap').map(r => r.num).join() === '1');
    RB = [{ tipo: 'sec', desc: 'XXXXXXXXXXX' }, { tipo: 'cap', desc: (id === 'es' ? 'PRESUPUESTO PARCIAL Nº 1 ALBAÑILERÍA' : 'PRESSUPOST PARCIAL Nº 1 PALETERIA'), num: '1' }, { tipo: 'cap', desc: d.c, num: '2' }, { tipo: 'part', desc: d.p[0] }];
    if (E.convencionsGta13oct) E.convencionsGta13oct(RB, '', false);
    P(id + ' 6b · un «PRESUPUESTO PARCIAL Nº 1» buit és un capítol de debò: es queda', RB[0].desc === 'XXXXXXXXXXX' && RB.filter(r => r.tipo === 'cap').length === 2);
    // 7) notes
    if (E.notesDelDocumentQueNoSurten) { let av = []; E.notesDelDocumentQueNoSurten([{ tipo: 'part', desc: d.p[0] }], d.c + '\n' + d.nota + '\n  1.1 m2 ' + d.p[0], av, id === 'es');
      P(id + ' 7 · la nota que no surt es diu', av.length === 1 && av[0].indexOf(d.nota.slice(0, 30)) >= 0);
      av = []; E.notesDelDocumentQueNoSurten([{ tipo: 'part', desc: d.p[0] }, { tipo: 'subv', desc: d.nota }], d.c + '\n' + d.nota + '\n  1.1 m2 ' + d.p[0], av, id === 'es');
      P(id + ' 7 · si hi és, cap avís', av.length === 0);
      av = []; E.notesDelDocumentQueNoSurten([{ tipo: 'part', desc: d.p[0] }], (d.nota + '\nPàgina\n').repeat(3), av, id === 'es');
      P(id + ' 7 · un peu repetit a cada pàgina no és cap nota', av.length === 0); }
    else P(id + ' 7 · eina de notes', false);
  }
  return out; }
const base = proves(H0); base.forEach(([n, c]) => check(n, c));
// 8) peces trencades: cadascuna, si es treu, fa caure alguna prova que avui és verda
const PECES = [
  ['l\'amortització no gasta número (lectura)', 'if(_amA(r)&&pAnt){ r.num=pAnt+".2"; continue; } ', ''],
  ['l\'amortització no gasta número (canvi de capítol)', 'if(_amA(rs[j])&&_ant){ rs[j].num=_ant+".2"; continue; } ', ''],
  ['la crida a la lectura', CRIDA, 'Math.abs(0)'],
  ['el número del CAP.n', 'if(String(r.num||"")!==nn){ r.num=nn; n.num++; }', ''],
  ['la lletra del document fora', 'l1=l1.slice(m[0].length); n.codi++; }\n      r.desc=l1+resta;', 'n.codi++; }\n      r.desc=l1+resta;'],
  ['el títol de dues línies', 'ls.splice(0,3,(l1+" "+l2).replace(/\\s*\\.$/,""),"- "+l3.replace(/^[-–]\\s*/,"")); n.titol++;', 'n.titol++;'],
  ['les dues línies seguides al document', '&&seguides(l1,l2)', ''],
  ['la NOTA no és zona', 'if(/^\\s*(?:NOTAS?|NOTES?|OBSERVACI)/i.test(L[j])||', 'if('],
  ['el títol que continua «DE …»', 'else if(/^(?:DE|DEL|DELS|D[\'’]|AL|A\\s+LA|EN)\\s+[A-ZÀ-Ý]/.test(seg)', 'else if(false'],
  ['zones d\'un sol capítol fora', 'let ok=!!estructurat&&iz.length>=2;', 'let ok=false;'],
  ['només als Excel', 'let ok=!!estructurat&&iz.length>=2;', 'let ok=iz.length>=2;'],
  ['el text en majúscules seguit', '||(!/[.:;!?]$/.test(at)&&at.length>=35&&_M(at)&&_M(bt)', '||(false&&_M(at)&&_M(bt)'],
  ['el capítol buit que és la zona', 'rows[z].desc=String(r.desc).split("\\n")[0].trim(); fet=true; }', 'fet=false; }'],
  ['només el títol de dalt de debò', '&&(pare(r.desc,seg.desc)||(TITDOC.test(k1(r.desc))', '&&((true'],
  ['mai un PRESUPUESTO PARCIAL', '&&!/PARCIAL|N[º°O]\\.?\\s*\\d|\\b(?:CAP[IÍ]TULO|CAP[IÍ]TOL)\\b/.test(k1(r.desc))', '&&true'],
  ['el capítol buit repetit', 'if(k1(seg.desc)===k1(r.desc)){ fet=true; }', 'if(false){ fet=true; }'],
  ['els de sota tornen un número', 'if(String(rows[q].num||"").trim()===String(esp)){ rows[q].num=String(esp-1); esp++; }', 'if(false){}'],
  ['l\'avís de la nota', 'if(falten.length&&Array.isArray(avisos)) avisos.push(', 'if(false) avisos.push('],
];
for (const [nom, de, a] of PECES) {
  const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
  let p2 = null; try { p2 = proves(H); } catch (e) { p2 = null; }
  check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k] && base[k][1] && !x[1]));
}
console.log('\n' + ok + ' OK · ' + ko + ' fallades');
process.exit(ko ? 1 : 0);
