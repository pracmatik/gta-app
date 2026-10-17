#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 23 (13/10/2026) · ELS DEFECTES CALLATS QUE ES VAN VEURE EN REJUGAR TOTES LES LECTURES GUARDADES DE LES MEDICIONS DE GTA DEL 09/10 (app).
 * Documents inventats, castellà i català.
 *  1) una partida que la lectura posa al començament del capítol següent (o al final de l'anterior) i que el document escriu a l'altre costat de la
 *     capçalera torna al capítol on l'escriu el document, amb marca a la fila i avís (un document del 13/10). Si no és a la vora, no es mou res i es marca
 *     en vermell. Si tot és al seu lloc, o el títol el document l'escriu dues vegades, no es toca res;
 *  2) el capítol que el document anomena «(NO SUMA)» i la partida que la lectura marca «(NO SUMA AL TOTAL)» (regla 13) són opcionals (no sumen); la marca
 *     nostra surt del text si el document no l'escriu (si l'escriu, es queda); «no suma» dins d'una frase, sense parèntesi, no fa res;
 *  3) el text que el reparador completa del document s'acaba a la quantitat de la partida quan la segueix la capçalera de la partida següent amb codi
 *     numèric i unitat («… 50,00 2.3.7 m reconstrucción …»); una xifra que no és la quantitat, o una cita normativa, no talla;
 *  4) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const fnDe = (H, n) => { const s0 = H.indexOf('function ' + n + '('); if (s0 < 0) return null; let i = H.indexOf('{', s0), d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const blocDe = (H, ini) => { const s0 = H.indexOf(ini); if (s0 < 0) return null; let i = s0, d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const eines = (H, id) => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  return new Function('IDIOMA', fnDe(H, '_dehyphen') + '\nconst parseNum=' + /const parseNum=(.*?);\n/s.exec(H)[1] + ';function num2(v){return v}const eur=v=>v+" €";\n' + b +
    '\nreturn {tornaAlSeuCapitol,_senseQuantitatPropia,_RE_CAP_OPCIO,_senseMarcaNoSumaNostra};')(id || 'ca'); } catch (e) { return null; } };
const l1 = r => String(r.desc).split('\n')[0];
const CRIDA = 'try{ tornaAlSeuCapitol(allRows,amidament,allAvisos); }catch(_){}';

// ── 1) capítol del document ──
const DOC = {
  es: { c: ['CAP.7 CUBIERTA GENERAL', 'CAP.8 PATINEJOS'], p7: ['IMPERMEABILIZACION CUBIERTA GENERAL', 'REPARACION DE BARANDILLAS METALICAS', 'SUSTITUCION ANCLAJES CLARABOYAS', 'PINTADO ESTRUCTURA CLARABOYA'],
        p8: ['SANEADO FISURAS EN VIGUETAS DE HORMIGON', 'RESTITUCION VOLUMEN DE VIGUETAS', 'SANEAR REVESTIMIENTO VERTICAL DEL PATIO'] },
  ca: { c: ['CAP.7 COBERTA GENERAL', 'CAP.8 PATINETS'], p7: ['IMPERMEABILITZACIO COBERTA GENERAL', 'REPARACIO DE BARANES METALLIQUES', 'SUBSTITUCIO ANCORATGES CLARABOIES', 'PINTAT ESTRUCTURA CLARABOIA'],
        p8: ['SANEJAMENT FISSURES EN BIGUETES DE FORMIGO', 'RESTITUCIO VOLUM DE BIGUETES', 'SANEJAR REVESTIMENT VERTICAL DEL PATI'] } };
const docText = (d, dupTitol, index, nivell) => { const L = ['REHABILITACION / REHABILITACIO', 'Ps. Inventat, 16', ''];
  if (index) L.push('  ' + d.c[0] + '   ....   3', '  ' + d.c[1] + '   ....   5', '');   // un índex al principi que escriu les capçaleres
  const bloc = (i, t, q) => { L.push('    ' + i + '       m2 ' + t + '                          ' + q + ',00'); L.push('         Trabajo número ' + i + ' con medios auxiliares, materiales y retirada de escombros a contenedor.'); L.push(''); };
  L.push('  ' + d.c[0] + '                 Med   Precio   Total'); d.p7.forEach((t, i) => bloc(i + 1, t, 10 + i)); L.push('   TOTAL', '');
  const nom = d.c[1].replace(/^CAP\.\d+ /, '');
  if (nivell) L.push('  8. Zona de ' + nom.toLowerCase());   // la capçalera escrita d'una altra manera (no es troba) …
  else L.push('  ' + (index ? d.c[1].replace(/^CAP\.(\d+) /, 'CAPITULO $1 - ') : d.c[1]) + '                 Med   Precio   Total');
  d.p8.forEach((t, i) => { bloc(i + 1, t, 20 + i); if (nivell && i === 0) L.push(nom.charAt(0) + nom.slice(1).toLowerCase() + ' y viguetas con mortero de reparación'); });   // … i una línia de text que comença pel nom
  if (dupTitol) { L.push('  ANEXO / ANNEX'); L.push('    1   m2 ' + d.p7[3] + '      8,00'); }
  return L.join('\n'); };
const files = (d, mode) => { const R = [{ tipo: 'sec', desc: 'XXXXXXXXXXX' }, { tipo: 'cap', desc: d.c[0], num: '7' }];
  const P7 = d.p7.map((t, i) => ({ tipo: 'part', desc: t + '\n- Texto', ut: 'm²', amid: 10 + i })), P8 = d.p8.map((t, i) => ({ tipo: 'part', desc: t + '\n- Texto', ut: 'm²', amid: 20 + i }));
  if (mode === 'b') { R.push(...P7.slice(0, 3), { tipo: 'cap', desc: d.c[1], num: '8' }, P7[3], { tipo: 'sub', desc: 'desglose', ut: 'm²', amid: 13 }, ...P8); }   // la darrera del 7 al començament del 8 (amb el seu desglossament)
  else if (mode === 'a') { R.push(...P7, P8[0], { tipo: 'cap', desc: d.c[1], num: '8' }, ...P8.slice(1)); }                                            // la primera del 8 al final del 7
  else if (mode === 'mig') { R.push(...P7.slice(0, 3), { tipo: 'cap', desc: d.c[1], num: '8' }, P8[0], P7[3], ...P8.slice(1)); }                       // al mig: no es mou, es marca
  else R.push(...P7, { tipo: 'cap', desc: d.c[1], num: '8' }, ...P8);
  return R; };
const estructura = R => { const o = []; let c = null; R.forEach(r => { if (r.tipo === 'cap') { c = { c: l1(r), p: [] }; o.push(c); } else if (r.tipo === 'part' && c) c.p.push(l1(r)); }); return o; };
const casCap = (H, id, mode, dup, index, nivell) => { const E = eines(H, id); if (!E) return null; const d = DOC[id], R = files(d, mode), av = []; const crida = H.indexOf(CRIDA) >= 0;
  if (nivell) R.forEach(r => { if (r.tipo === 'cap') r.desc = r.desc.replace(/^CAP\.\d+ /, ''); }); if (crida) E.tornaAlSeuCapitol(R, docText(d, dup, index, nivell), av); const s = estructura(R);
  return { s, av: av.join(' '), flags: R.filter(r => r.flag).map(r => l1(r) + ': ' + r.flag), subDarrere: R.findIndex(r => r.tipo === 'sub') === R.findIndex(r => l1(r) === d.p7[3]) + 1 }; };

// ── 2) «(NO SUMA)» ──
const OPC = { es: { cap: 'a.12.- Persianas (NO SUMA).', p: 'Ud. de suministro y colocación de persianas enrollables de cuerda en ventanas.', frase: 'Esta partida no suma los elementos privativos de cada vivienda.' },
              ca: { cap: 'a.12.- Persianes (NO SUMA).', p: 'Ut. de subministrament i col·locació de persianes enrotllables de corda a finestres.', frase: 'Aquesta partida no suma els elements privatius de cada habitatge.' } };
const opcionals = (H, E, id) => { const b = blocDe(H, '{ // OPCIONALS (la tècnica 08/07'); if (!b || !E) return null;
  try { return (rows, src) => { const av = []; new Function('allRows', 'allAvisos', 'IDIOMA', '_RE_CAP_OPCIO', '_senseMarcaNoSumaNostra', 'amidament', b)(rows, av, id, E._RE_CAP_OPCIO, E._senseMarcaNoSumaNostra, src); return av; }; } catch (e) { return null; } };
const casOpc = (H, id) => { const E = eines(H, id), f = opcionals(H, E, id); if (!f) return null; const o = OPC[id];
  const R = [{ tipo: 'cap', desc: 'a.11.- Carpintería' }, { tipo: 'part', desc: 'MARCOS\n- ' + o.frase, ut: 'ud', amid: 3 }, { tipo: 'cap', desc: o.cap }, { tipo: 'part', desc: 'PERSIANAS\n- ' + o.p, ut: 'ud', amid: 8 },
    { tipo: 'cap', desc: 'a.13.- Pintura' }, { tipo: 'part', desc: 'PINTURA OPCIONAL\n- Pintura (NO SUMA AL TOTAL)', ut: 'm2', amid: 5 }, { tipo: 'part', desc: 'PINTURA DE REJAS\n- Pintura de rejas (NO SUMA AL TOTAL)', ut: 'm2', amid: 6 },
    { tipo: 'part', desc: 'LIMPIEZA\n- Limpieza final (NO SUMA AL TOTAL)', ut: 'm2', amid: 7 }];
  const src = 'a.11.- Carpintería\n1 ' + o.frase + ' 3\n' + o.cap + '\n2 ' + o.p + ' 8\na.13.- Pintura\n3 Pintura 5\n4 Pintura de rejas 6\n5 Limpieza final (NO SUMA AL TOTAL) 7\n' + 'x'.repeat(200);
  f(R, src); const P = R.filter(r => r.tipo === 'part'); return { gta: P.map(r => r.gta || ''), desc: P.map(r => r.desc) }; };

// ── 3) el text s'acaba a la quantitat quan la segueix la capçalera de la partida següent ──
const casQ = H => { const E = eines(H, 'es'); if (!E) return null; const f = E._senseQuantitatPropia;
  return { talla: f('Pavimento de cerámica tipo Piera, de 28x14cm, de color rojo, y protección vertical de muros áticos 50,00 2.3.7 m reconstrucción de mimbel cerámico retirado 2,00', 50),
           ca: f("Paviment de ceràmica tipus Piera, de 28x14cm, de color vermell, i protecció vertical de murs àtics 50,00 2.3.7 ml reconstrucció de mimbell ceràmic retirat 2,00", 50),
           altra: f('Pavimento de cerámica tipo Piera, de 28x14cm, de color rojo, y protección vertical de muros áticos 12,00 2.3.7 m reconstrucción de mimbel cerámico retirado', 50),
           cita: f('Andamio homologado según la norma de seguridad europea vigente para trabajos 50,00 UNE 12810 m de altura máxima', 50) }; };

const proves = id => { const H = id; const out = [];
  for (const L of ['es', 'ca']) { const d = DOC[L];
    const b = casCap(H, L, 'b'), a = casCap(H, L, 'a'), m = casCap(H, L, 'mig'), okk = casCap(H, L, 'ok'), dup = casCap(H, L, 'b', true);
    out.push(['[' + L + '] 1a la darrera del 7 al començament del 8 torna al 7 (al final)', !!b && b.s[0].p.length === 4 && b.s[0].p[3] === d.p7[3] && b.s[1].p[0] === d.p8[0], b && JSON.stringify(b.s)]);
    out.push(['[' + L + '] 1a amb el seu desglossament darrere', !!b && b.subDarrere]);
    out.push(['[' + L + '] 1a marca a la fila i avís', !!b && b.flags.length === 1 && /CAP[IÍ]TOL|CAPÍTULO/.test(b.flags[0]) && /⚠/.test(b.av), b && b.av]);
    out.push(['[' + L + '] 1b la primera del 8 al final del 7 torna al 8 (al començament)', !!a && a.s[0].p.length === 4 && a.s[1].p[0] === d.p8[0] && a.s[1].p.length === 3, a && JSON.stringify(a.s)]);
    out.push(['[' + L + '] 1c al mig del capítol: no es mou, es marca en vermell', !!m && m.s[1].p.indexOf(d.p7[3]) === 1 && m.flags.length === 1 && /⚠⚠/.test(m.av), m && (m.av + ' | ' + JSON.stringify(m.s))]);
    out.push(['[' + L + '] 1d tot al seu lloc: res', !!okk && okk.flags.length === 0 && okk.av === '' && okk.s[0].p.length === 4]);
    const ix = casCap(H, L, 'ok', false, true);
    out.push(['[' + L + '] 1f la capçalera només surt a l\'índex (la de debò s\'escriu d\'una altra manera): no es mou res', !!ix && ix.flags.length === 0 && ix.s[0].p.length === 4 && ix.s[1].p.length === 3, ix && JSON.stringify(ix.s)]);
    const nv = casCap(H, L, 'ok', false, false, true);
    out.push(['[' + L + '] 1g la capçalera no es troba i una línia de text comença pel nom del capítol: res', !!nv && nv.flags.length === 0 && nv.s[0].p.length === 4 && nv.s[1].p.length === 3, nv && JSON.stringify(nv.s)]);
    out.push(['[' + L + '] 1e títol que el document escriu dues vegades: no es toca', !!dup && dup.s[1].p[0] === d.p7[3] && dup.flags.length === 0, dup && JSON.stringify(dup.s)]);
    const o = casOpc(H, L);
    out.push(['[' + L + '] 2a capítol «(NO SUMA)» → opcional', !!o && o.gta[1] === 'opc', o && JSON.stringify(o.gta)]);
    out.push(['[' + L + '] 2b «no suma» dins d\'una frase: no', !!o && o.gta[0] === '']);
    out.push(['[' + L + '] 2c partida amb «(NO SUMA AL TOTAL)» → opcional i sense la marca (el document no l\'escriu)', !!o && o.gta[3] === 'opc' && o.desc[3].indexOf('NO SUMA') < 0 && /Pintura de rejas$/.test(o.desc[3]), o && o.desc[3]]);
    out.push(['[' + L + '] 2d el document l\'escriu: es queda', !!o && o.gta[4] === 'opc' && o.desc[4].indexOf('(NO SUMA AL TOTAL)') >= 0, o && o.desc[4]]);
  }
  const q = casQ(H);
  out.push(['3a «… 50,00 2.3.7 m reconstrucción …» s\'acaba a «muros áticos»', !!q && /muros áticos$/.test(q.talla), q && q.talla]);
  out.push(['3b [ca] «… 50,00 2.3.7 ml reconstrucció …» s\'acaba a «murs àtics»', !!q && /murs àtics$/.test(q.ca), q && q.ca]);
  out.push(['3c una xifra que no és la quantitat no talla', !!q && /retirado$/.test(q.altra), q && q.altra]);
  out.push(['3d una cita normativa no talla', !!q && /altura máxima$/.test(q.cita), q && q.cita]);
  return out; };

const base = proves(H0); base.forEach(([n, c, x]) => check(n, c, x));
const PECES = [
  ['la crida de tornaAlSeuCapitol', CRIDA, ''],
  ['el moviment (només marca)', 'if(nb+na!==best.err||(nb&&na)){', 'if(true){'],
  ['la capçalera recolzada', 'if(okA>=2&&okB>=2&&(!best||err<best.err))best={h,err};', 'if(!best||err<best.err)best={h,err};'],
  ['la línia de capçalera (no un text que comença igual)', 'x.slice(k.length).replace(COL,"").length<=3', 'true'],
  ['el títol escrit una sola vegada', 'return (a>=0&&S.indexOf(k,a+1)<0)?a:null;', 'return a>=0?a:null;'],
  ['la marca a la fila', 'x.r.flag=x.r.flag?(String(x.r.flag)+" · "+fl):fl; }\n  for(const x of mar)', '}\n  for(const x of mar)'],
  ['«(NO SUMA)» al capítol', '_capOpc=/[(\\[]\\s*NO\\s+SUM(?:A|EN|AR)\\b/i.test(String(r.desc||"").split("\\n")[0])||', '_capOpc='],
  ['«(NO SUMA)» a la partida', '||/[(\\[]\\s*NO\\s+SUM(?:A|EN|AR)\\b/i.test(r.desc||"")){r.gta="opc";_nOpc++;}', '){r.gta="opc";_nOpc++;}'],
  ['la marca nostra fora del text', 'try{ _senseMarcaNoSumaNostra(allRows,amidament); }catch(_){}', ''],
  ['si el document l\'escriu, es queda', 'if(D.indexOf(ab+sq(m[0]))>=0)continue;', ''],
  ['el tall a la quantitat + capçalera', 'if(Math.abs(v-q)<0.005&&e.index>=20) return t.slice(0,e.index).trim(); } }', '} }'],
];
for (const [nom, de, a] of PECES) {
  const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
  let p2 = null; try { p2 = proves(H); } catch (e) { p2 = null; }
  check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k][1] && !x[1]));
}
console.log('\n' + ok + ' OK · ' + ko + ' fallades');
process.exit(ko ? 1 : 0);
