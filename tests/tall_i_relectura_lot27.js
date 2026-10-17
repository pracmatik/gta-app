#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 27 (14/10/2026) · EL TALL + LA RELECTURA, i tres errors que en sortien sense marca. Documents inventats, castellà i català, cap dada de
 * cap client (va també al repositori públic).
 *  1) La relectura que comença a mig capítol i porta a dalt el títol d'un capítol que la primera lectura JA TÉ: no surt cap capítol repetit; la partida
 *     va al capítol que diu l'ordre del document. La partida de la relectura sense forma reconeguda («Ud. (marco…)») entra, amb el seu capítol, i si la
 *     primera lectura ja la té no es duplica.
 *  2) El mateix text en més files que vegades l'escriu el document, comptant tots els capítols: totes les files del grup en vermell («PARTIDA REPETIDA PER
 *     LA LECTURA»), encara que ja portin la taronja «POSSIBLE PARTIDA REPETIDA». Si el document l'escriu tantes vegades com files, res.
 *  3) El mateix capítol dues vegades a la mateixa zona quan el document l'escriu una: avís vermell amb el nom. Si el document l'escriu dues vegades, res.
 *  4) La quantitat que és el número de la partida, amb la quantitat del document al FINAL DEL PARÀGRAF (no a la línia del títol): marcada a la fila.
 *  5) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const eines = H => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  const noms = ['formaDePartides', '_fusionaRelectura', 'rellegeixLesQueFalten', 'copiesPerText', 'capitolRepetitALaZona', 'quantitatQueEsElNumero'];
  return new Function('IDIOMA', 'function nomZonaDelDocument(){ return null; }\nfunction pctPerDefecte(){ return null; }\n' + b + '\nreturn {' + noms.map(n => n + ':(typeof ' + n + '==="function"?' + n + ':null)').join(',') + '};')('es'); } catch (e) { return null; } };
const D = {
  es: { c: ['Fachadas', 'Balcones', 'Cornisa'], z: 'FACHADA PRINCIPAL',
        t: ['M² Limpieza de la fachada principal mediante agua a presión controlada y cepillo suave.', 'M² Picado del revestimiento suelto de la fachada con medios manuales y retirada de escombros.',
            'M² de aplicación de pintura al silicato sobre una capa de fondo fijador.', 'M² Saneado de las losas de los balcones con repicado de las armaduras',
            'afectadas y posterior tratamiento pasivador de la corrosión. Retirada de escombros.', 'Ud. (marco de balconera): lijado y barnizado de la carpintería exterior con protector.',
            'Ml. Reparación de la cornisa superior con mortero de cal y armado de los tramos sueltos.'],
        tit: ['LIMPIEZA DE LA FACHADA', 'PICADO DEL REVESTIMIENTO', 'APLICACIÓN DE PINTURA', 'SANEADO DE LAS LOSAS', 'MARCO DE BALCONERA', 'REPARACIÓN DE LA CORNISA'] },
  ca: { c: ['Façanes', 'Balcons', 'Cornisa'], z: 'FAÇANA PRINCIPAL',
        t: ['M² Neteja de la façana principal mitjançant aigua a pressió controlada i raspall suau.', 'M² Picat del revestiment solt de la façana amb mitjans manuals i retirada de runa.',
            'M² d\'aplicació de pintura al silicat sobre una capa de fons fixador.', 'M² Sanejat de les lloses dels balcons amb repicat de les armadures',
            'afectades i posterior tractament passivador de la corrosió. Retirada de runa.', 'Ut. (marc de balconera): polit i envernissat de la fusteria exterior amb protector.',
            'Ml. Reparació de la cornisa superior amb morter de calç i armat dels trams solts.'],
        tit: ['NETEJA DE LA FAÇANA', 'PICAT DEL REVESTIMENT', 'APLICACIÓ DE PINTURA', 'SANEJAT DE LES LLOSES', 'MARC DE BALCONERA', 'REPARACIÓ DE LA CORNISA'] } };
const docDe = d => ['a.1.- ' + d.c[0] + '.', '1 ' + d.t[0] + ' 120,00', '2 ' + d.t[1] + ' 30,00', '3 ' + d.t[2] + ' 120,00', '', 'a.2.- ' + d.c[1] + '.', '4 ' + d.t[3], d.t[4] + ' 12,50',
  '5 ' + d.t[2] + ' 12,50', '6 ' + d.t[5] + ' 6,00', 'a.3.- ' + d.c[2] + '.', '7 ' + d.t[6] + ' 18,00', '8 ' + d.t[2] + ' 4,00'].join('\n');
const P_ = (d, k, q, ut) => { const txt = k === 3 ? d.t[3] + ' ' + d.t[4] : k === 4 ? d.t[5] : k === 5 ? d.t[6] : d.t[k]; const ti = d.tit[k]; return { tipo: 'part', desc: ti + '\n- ' + txt, ut: ut || 'm2', amid: q }; };
// les files de cada partida del document (1..8) per número
const F = (d, n, q) => ({ 1: () => P_(d, 0, q == null ? 120 : q), 2: () => P_(d, 1, q == null ? 30 : q), 3: () => P_(d, 2, q == null ? 120 : q), 4: () => P_(d, 3, q == null ? 12.5 : q),
  5: () => P_(d, 2, q == null ? 12.5 : q), 6: () => P_(d, 4, q == null ? 6 : q, 'u'), 7: () => P_(d, 5, q == null ? 18 : q, 'm'), 8: () => P_(d, 2, q == null ? 4 : q) })[n]();
const C = (d, k) => ({ tipo: 'cap', desc: 'a.' + (k + 1) + '.- ' + d.c[k] + '.' });
const rJ0x = d => [C(d, 0), F(d, 1), F(d, 2), F(d, 3), C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)];
const ZBm = id => id === 'es' ? 'ESCALERA D' : 'ESCALA D';
const AZm = (d, id) => { const doc = docDe(d) + '\n' + ZBm(id) + '\na.1.- ' + d.c[0] + '.\n9 ' + d.t[0] + ' 50,00\n10 ' + d.t[1] + ' 20,00'; return { doc, A: null }; };
const ZB0 = id => id === 'es' ? 'ESCALERA C' : 'ESCALA C';
const kc = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
function proves(H) { const out = []; const P = (n, c, x) => { out.push([n, !!c]); if (!c && x && process.env.DBG) console.error(n, x); }; const E = eines(H);
  if (!E || !E._fusionaRelectura || !E.formaDePartides || !E.copiesPerText || !E.capitolRepetitALaZona || !E.quantitatQueEsElNumero) { P('eines', false); return out; }
  for (const id of ['es', 'ca']) { const d = D[id], doc = docDe(d), A = E.formaDePartides(doc).ancores;
    P(id + ' 0 · el document de la prova té la forma de partida reconeguda (7 de 8: la del parèntesi no)', A.length === 7);
    // 1a) tall després de la 2; la relectura posa a dalt «Balcones» (que la primera ja té) sobre la 3, que és de Façanes
    const r0 = [C(d, 0), F(d, 1), F(d, 2), C(d, 1), F(d, 4)];
    const rR = [C(d, 1), F(d, 3), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)];
    const fu = E._fusionaRelectura(JSON.parse(JSON.stringify(r0)), JSON.parse(JSON.stringify(rR)), A), R = fu.rows;
    const caps = R.filter(r => r.tipo === 'cap').map(r => kc(r.desc));
    const capDe = x => { let c = null; for (const r of R) { if (r.tipo === 'cap') c = kc(r.desc); if (r === x) return c; } return null; };
    P(id + ' 1 · cap capítol repetit després de la relectura (el de dalt de la relectura ja hi era)', caps.length === 3 && new Set(caps).size === 3);
    const p3 = R.find(r => r.tipo === 'part' && r.amid === 120 && r.desc.indexOf(d.t[2].slice(0, 20)) >= 0);
    P(id + ' 1 · la partida 3 queda al capítol que diu l\'ordre del document (el primer)', p3 && capDe(p3) === kc(C(d, 0).desc));
    const p6 = R.filter(r => r.tipo === 'part' && r.desc.indexOf(d.t[5].slice(4, 24)) >= 0);
    P(id + ' 1 · la partida sense forma reconeguda (marc) entra, una vegada, al seu capítol', p6.length === 1 && capDe(p6[0]) === kc(C(d, 1).desc));
    P(id + ' 1 · totes les partides, cap de més (8)', R.filter(r => r.tipo === 'part').length === 8);
    // 1l) el document escriu el mateix capítol dues vegades (sense zones): el segon, que porta la relectura, sí que entra
    const docL = doc + '\na.1.- ' + d.c[0] + '.\n9 ' + d.t[0] + ' 50,00\n10 ' + d.t[1] + ' 20,00', AL = E.formaDePartides(docL).ancores;
    const SL = E._fusionaRelectura(JSON.parse(JSON.stringify(rJ0x(d))), JSON.parse(JSON.stringify([C(d, 0), F(d, 1, 50), F(d, 2, 20)])), AL, docL).rows;
    P(id + ' 1 · el capítol que el document escriu dues vegades entra la segona vegada', SL.filter(r => r.tipo === 'cap').length === 4, SL.map(r => r.tipo === 'part' ? 'p' + r.amid : 'C').join(' '));
    // 1m) el capítol del tros repetit (que la primera ja té i el document només escriu més amunt) no passa a la zona nova
    const SM = E._fusionaRelectura(JSON.parse(JSON.stringify(rJ0x(d))), JSON.parse(JSON.stringify([C(d, 2), F(d, 8), { tipo: 'sec', desc: ZBm(id) }, C(d, 0), F(d, 1, 50), F(d, 2, 20)])), E.formaDePartides(AZm(d, id).doc).ancores, AZm(d, id).doc).rows;
    const tipM = SM.map(r => r.tipo === 'part' ? 'p' + r.amid : r.tipo === 'sec' ? 'S' : 'C' + kc(r.desc).slice(2, 6)).join(' ');
    P(id + ' 1 · el capítol del tros repetit no passa a la zona nova', /p18 p4 S Cfac\w* p50 p20$/.test(tipM), tipM);
    // 1n) el tros repetit porta els capítols de la seva zona (que la primera ja té) i la zona C repeteix els noms: no baixen a la zona C
    const docN = doc + '\n' + ZB0(id) + '\na.1.- ' + d.c[0] + '.\n9 ' + d.t[0] + ' 50,00\na.2.- ' + d.c[1] + '.\n10 ' + d.t[1] + ' 20,00', AN = E.formaDePartides(docN).ancores;
    const SN = E._fusionaRelectura(JSON.parse(JSON.stringify(rJ0x(d))), JSON.parse(JSON.stringify([C(d, 1), F(d, 6), C(d, 2), F(d, 7), F(d, 8), { tipo: 'sec', desc: ZB0(id) }, C(d, 0), F(d, 1, 50), C(d, 1), F(d, 2, 20)])), AN, docN).rows;
    const tipN = SN.map(r => r.tipo === 'part' ? 'p' + r.amid : r.tipo === 'sec' ? 'S' : 'C' + kc(r.desc).slice(2, 6)).join(' ');
    P(id + ' 1 · els capítols del tros repetit no baixen a la zona nova (que repeteix els noms)', /Ccorn p18 p4 S Cfac\w* p50 Cbal\w* p20$/.test(tipN), tipN);
    // 1b) la primera ja té la partida sense forma reconeguda: la relectura la torna i no es duplica
    const s0 = [C(d, 0), F(d, 1), F(d, 2), F(d, 3), C(d, 1), F(d, 4), F(d, 6)];
    const sR = [F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)];
    const S = E._fusionaRelectura(JSON.parse(JSON.stringify(s0)), JSON.parse(JSON.stringify(sR)), A).rows;
    P(id + ' 1 · la que la primera lectura ja té (sense forma) no es duplica', S.filter(r => r.tipo === 'part' && r.desc.indexOf(d.t[5].slice(4, 24)) >= 0).length === 1 && S.filter(r => r.tipo === 'part').length === 8);
    const sR2 = [F(d, 5), F(d, 6, 9), C(d, 2), F(d, 7), F(d, 8)];
    const S2 = E._fusionaRelectura(JSON.parse(JSON.stringify(s0)), JSON.parse(JSON.stringify(sR2)), A).rows;
    P(id + ' 1 · el mateix text amb una altra quantitat (un annex) sí que entra', S2.filter(r => r.tipo === 'part' && r.desc.indexOf(d.t[5].slice(4, 24)) >= 0).length === 2);
    // 1c) la relectura posa a dalt un capítol que el document no escriu enlloc: no es crea
    const inv = { tipo: 'cap', desc: id === 'es' ? '01 ACTUACIONES EN TERRAZAS' : '01 ACTUACIONS EN TERRATS' };
    const S3 = E._fusionaRelectura(JSON.parse(JSON.stringify(r0)), JSON.parse(JSON.stringify([inv, F(d, 3), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)])), A, doc).rows;
    P(id + ' 1 · un capítol de la relectura que el document no escriu no es crea', !S3.some(r => r.tipo === 'cap' && /TERRA/.test(r.desc)) && S3.filter(r => r.tipo === 'part').length === 8);
    const S4 = E._fusionaRelectura(JSON.parse(JSON.stringify([C(d, 0), F(d, 1), F(d, 2), F(d, 3)])), JSON.parse(JSON.stringify([C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)])), A, doc).rows;
    P(id + ' 1 · el capítol que el document sí escriu i la primera no té, sí que es crea', S4.filter(r => r.tipo === 'cap').length === 3);
    // 1e) la primera no té «Balcones» i la relectura el posa a dalt de la 3 (que el document escriu abans): baixa fins a la 4
    const S5 = E._fusionaRelectura(JSON.parse(JSON.stringify([C(d, 0), F(d, 1), F(d, 2)])), JSON.parse(JSON.stringify([C(d, 1), F(d, 3), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)])), A, doc).rows;
    const cap5 = x => { let c = null; for (const r of S5) { if (r.tipo === 'cap') c = kc(r.desc); if (r === x) return c; } return null; };
    const p3b = S5.find(r => r.tipo === 'part' && r.amid === 120 && r.desc.indexOf(d.t[2].slice(0, 20)) >= 0), p4b = S5.find(r => r.tipo === 'part' && r.amid === 12.5 && r.desc.indexOf(d.t[3].slice(4, 20)) >= 0);
    P(id + ' 1 · el capítol que la relectura posa massa amunt baixa al seu lloc (la 3 es queda al primer, la 4 al segon)', p3b && p4b && cap5(p3b) === kc(C(d, 0).desc) && cap5(p4b) === kc(C(d, 1).desc) && S5.filter(r => r.tipo === 'cap').length === 3);
    // 1i) la relectura torna la del marc (sense forma reconeguda) amb el seu número com a quantitat («6 Ud. (marco…)» amb 6… i aquí 9): si la quantitat és el
    //     número que porta davant, només es mira el text, i la primera ja la té
    const m6 = { tipo: 'part', desc: d.t[5], ut: 'u', amid: 6 }, m9 = { tipo: 'part', desc: '9 ' + d.t[5], ut: 'u', amid: 9 };   // les files tal com surten del motor (sense títol nostre)
    const S9 = E._fusionaRelectura(JSON.parse(JSON.stringify([C(d, 0), F(d, 1), F(d, 2), F(d, 3), C(d, 1), F(d, 4), m6])), JSON.parse(JSON.stringify([F(d, 5), m9, C(d, 2), F(d, 7), F(d, 8)])), A, doc).rows;
    P(id + ' 1 · la quantitat que és el número de davant no fa entrar una partida que la primera ja té', S9.filter(r => r.tipo === 'part' && r.desc.indexOf(d.t[5].slice(4, 24)) >= 0).length === 1);
    // 1g) la relectura posa «Balcones» a dalt de la partida repetida (la 2, que la primera ja té): el títol no es perd amb ella
    const S7 = E._fusionaRelectura(JSON.parse(JSON.stringify([C(d, 0), F(d, 1), F(d, 2)])), JSON.parse(JSON.stringify([C(d, 1), C(d, 0), F(d, 2), F(d, 3), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)])), A, doc).rows;
    const tip7 = S7.map(r => r.tipo === 'part' ? 'p' + r.amid : 'C' + kc(r.desc).slice(2, 6)).join(' ');
    P(id + ' 1 · el títol de dalt d\'una partida repetida passa a la següent i baixa al seu lloc', /^C\w+ p120 p30 p120 C\w+ p12\.5 p12\.5 p6 C\w+ p18 p4$/.test(tip7), tip7);
    // 1h) el tros repetit de dalt de la relectura (la 2, que la primera ja té) no entra encara que el seu text sigui el d'una bessona de més avall que falta
    //     (el mateix text en un altre capítol, amb una altra quantitat): la bessona sí que entra, una vegada
    const docB = ['a.1.- ' + d.c[0] + '.', '1 ' + d.t[0] + ' 120,00', '2 ' + d.t[1] + ' 30,00', 'a.2.- ' + d.c[1] + '.', '3 ' + d.t[1] + ' 45,00', '4 ' + d.t[3], d.t[4] + ' 12,50', '5 ' + d.t[6] + ' 18,00'].join('\n'), AB = E.formaDePartides(docB).ancores;
    const S8 = E._fusionaRelectura(JSON.parse(JSON.stringify([C(d, 0), F(d, 1), F(d, 2)])), JSON.parse(JSON.stringify([F(d, 2), C(d, 1), F(d, 2, 45), F(d, 4), F(d, 7)])), AB, docB).rows;
    const tip8 = S8.map(r => r.tipo === 'part' ? 'p' + r.amid : 'C').join(' ');
    P(id + ' 1 · el tros repetit de dalt de la relectura no entra; la bessona d\'un altre capítol sí, una vegada', tip8 === 'C p120 p30 C p45 p12.5 p18', tip8);
    const ZB = id === 'es' ? 'ESCALERA B' : 'ESCALA B', docZ = doc + '\n' + ZB + '\na.1.- ' + d.c[0] + '.\n9 ' + d.t[0] + ' 50,00\n10 ' + d.t[1] + ' 20,00', AZ = E.formaDePartides(docZ).ancores;
    // 1j) la partida de tancament que es repeteix a cada zona (la mateixa de la zona A) és la primera de la relectura i porta a dalt el capítol de la zona B:
    //     no és el tros repetit (la primera la té molt més amunt), entra, i el capítol va sota el títol de la zona
    const docJ = doc + '\n9 ' + d.t[0] + ' 120,00\n' + ZB0(id) + '\na.1.- ' + d.c[0] + '.\n10 ' + d.t[0] + ' 50,00\n11 ' + d.t[1] + ' 20,00', AJn = E.formaDePartides(docJ).ancores;
    const rJ0 = [C(d, 0), F(d, 1), F(d, 2), F(d, 3), C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)];
    const SJ = E._fusionaRelectura(JSON.parse(JSON.stringify(rJ0)), JSON.parse(JSON.stringify([C(d, 0), F(d, 1), { tipo: 'sec', desc: ZB0(id) }, F(d, 1, 50), F(d, 2, 20)])), AJn, docJ).rows;
    const tipJ = SJ.map(r => r.tipo === 'part' ? 'p' + r.amid : r.tipo === 'sec' ? 'S' : 'C' + kc(r.desc).slice(2, 6)).join(' ');
    P(id + ' 1 · la de tancament repetida a cada zona entra; el capítol, sota la zona', /^Cfac\w* p120 p30 p120 Cbal\w* p12\.5 p12\.5 p6 Ccorn p18 p4 p120 S Cfac\w* p50 p20$/.test(tipJ), tipJ);
    // 1k) el capítol de la zona B posat a dalt del tros repetit (la 8, que la primera ja té): passa a la primera de la zona B, sota el títol de la zona
    const SK = E._fusionaRelectura(JSON.parse(JSON.stringify(rJ0)), JSON.parse(JSON.stringify([C(d, 0), F(d, 8), { tipo: 'sec', desc: ZB }, F(d, 1, 50), F(d, 2, 20)])), AZ, docZ).rows;
    const tipK = SK.map(r => r.tipo === 'part' ? 'p' + r.amid : r.tipo === 'sec' ? 'S' : 'C' + kc(r.desc).slice(2, 6)).join(' ');
    P(id + ' 1 · el capítol de dalt del tros repetit va sota la zona nova', /Ccorn p18 p4 S Cfac\w* p50 p20$/.test(tipK), tipK);
    // 1f) el mateix títol a dues zones: la relectura posa «Fachadas» (de la zona B) a dalt de la 8 (Cornisa, zona A): baixa a la zona B, sota el títol de la zona
    const S6 = E._fusionaRelectura(JSON.parse(JSON.stringify([C(d, 0), F(d, 1), F(d, 2), F(d, 3), C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7)])),
      JSON.parse(JSON.stringify([C(d, 0), F(d, 8), { tipo: 'sec', desc: ZB }, F(d, 1, 50), F(d, 2, 20)])), AZ, docZ).rows;
    const tip6 = S6.map(r => r.tipo === 'part' ? 'p' + r.amid : r.tipo === 'sec' ? 'S' : 'C' + kc(r.desc).slice(2, 6)).join(' ');
    P(id + ' 1 · el títol repetit a cada zona baixa a la seva zona, sota el títol de la zona', /C\w+ p18 p4 S C\w+ p50 p20$/.test(tip6) && S6.filter(r => r.tipo === 'cap').length === 4, tip6);
    // 2) còpies per text: la pintura, 4 files (2 amb la taronja de sempre) i el document l'escriu 3 vegades
    const T = [C(d, 0), F(d, 1), F(d, 2), F(d, 3), F(d, 3), C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)];
    T[3].flag = 'POSSIBLE PARTIDA REPETIDA: hi ha una altra fila igual'; T[4].flag = 'POSSIBLE PARTIDA REPETIDA: hi ha una altra fila igual';
    let av = []; E.copiesPerText(T, doc, av, id === 'es');
    const pint = T.filter(r => r.tipo === 'part' && r.desc.indexOf(d.t[2].slice(5, 30)) >= 0);
    const rep = r => /PARTIDA REPETIDA P[EO]R LA LECTURA/.test(r.flag || '');
    P(id + ' 2 · el text de més amb quantitats del document: les de la quantitat que sobra (120, dues) en vermell i avís; les altres no', pint.length === 4 && pint.filter(rep).length === 2 && pint.filter(rep).every(r => r.amid === 120) && av.some(a => /^⚠⚠/.test(a)));
    const T3 = [C(d, 0), F(d, 1), F(d, 2), F(d, 3), F(d, 3), C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8, 8)];
    av = []; E.copiesPerText(T3, doc, av, id === 'es');
    const pint3 = T3.filter(r => r.tipo === 'part' && r.desc.indexOf(d.t[2].slice(5, 30)) >= 0);
    P(id + ' 2 · si una porta una quantitat que el document no escriu per a aquest text (8), totes en vermell (no se sap quina sobra)', pint3.length === 4 && pint3.every(rep));
    const T2 = [C(d, 0), F(d, 1), F(d, 2), F(d, 3), C(d, 1), F(d, 4), F(d, 5), F(d, 6), C(d, 2), F(d, 7), F(d, 8)];
    av = []; E.copiesPerText(T2, doc, av, id === 'es');
    P(id + ' 2 · el mateix text tantes vegades com el document (3, quantitats diferents): res', !T2.some(r => /PARTIDA REPETIDA/.test(r.flag || '')) && !av.length);
    // 3) capítol repetit a la mateixa zona
    const K = [{ tipo: 'sec', desc: d.z }, C(d, 0), F(d, 1), C(d, 1), F(d, 3), C(d, 0), F(d, 2)];
    av = []; E.capitolRepetitALaZona(K, doc, av, id === 'es');
    P(id + ' 3 · el mateix capítol dues vegades i el document l\'escriu una: avís vermell amb el nom', av.length === 1 && /^⚠⚠/.test(av[0]) && kc(av[0]).indexOf(kc(d.c[0])) >= 0);
    av = []; E.capitolRepetitALaZona(K, doc + '\na.1.- ' + d.c[0] + '.\n9 ' + d.t[0] + ' 10,00', av, id === 'es');
    P(id + ' 3 · si el document l\'escriu dues vegades: res', !av.length);
    // 4) quantitat = número, amb la quantitat al final del paràgraf
    const Q = [C(d, 1), F(d, 4, 4), F(d, 5, 12.5)]; av = []; E.quantitatQueEsElNumero(Q, doc, av, id === 'es');
    P(id + ' 4 · 4 (el número) al saneig, el document hi escriu 12,50 al final del paràgraf: marcada', /NO (?:QUADRA AMB EL DOCUMENT|CUADRA CON EL DOCUMENTO)/.test(Q[1].flag || '') && /12,5/.test(Q[1].flag || ''));
    const docE = doc.replace(d.t[4] + ' 12,50', d.t[4] + ' 12');   // la quantitat entera darrere del punt («… corrosión. 12»)
    const QE = [C(d, 1), F(d, 4, 4)]; av = []; E.quantitatQueEsElNumero(QE, docE, av, id === 'es');
    P(id + ' 4 · també amb la quantitat entera al final del paràgraf (… 12)', /NO (?:QUADRA|CUADRA)/.test(QE[1].flag || ''));
    const QU = [C(d, 1), { tipo: 'part', desc: d.tit[3] + '\n- ' + (d.t[3] + ' ' + d.t[4]).replace(/^M² /, ''), ut: 'm2', amid: 4 }]; av = []; E.quantitatQueEsElNumero(QU, doc, av, id === 'es');
    P(id + ' 4 · també quan la fila no porta la unitat que el document escriu davant del text', /NO (?:QUADRA|CUADRA)/.test(QU[1].flag || ''));
    const Q2 = [C(d, 1), F(d, 4, 12.5)]; av = []; E.quantitatQueEsElNumero(Q2, doc, av, id === 'es');
    P(id + ' 4 · amb la quantitat bona: res', !Q2[1].flag);
    const Q3 = [C(d, 2), F(d, 8, 8)]; av = []; E.quantitatQueEsElNumero(Q3, doc, av, id === 'es');
    P(id + ' 4 · la de sempre (quantitat a la mateixa línia) continua marcada', /NO (?:QUADRA|CUADRA)/.test(Q3[1].flag || ''));
  }
  return out; }
// 1d) la relectura comença per la capçalera de capítol de just a sobre, encara que porti els títols de columna («CAP.2 BALCONES Med Precio Total»)
async function provaRel(H) { const E = eines(H); if (!E || !E.rellegeixLesQueFalten) return false; let tot = true;
  for (const id of ['es', 'ca']) { const d = D[id]; const doc = docDe(d).replace('a.2.- ' + d.c[1] + '.', 'CAP.2 ' + d.c[1].toUpperCase() + (id === 'es' ? ' Med Precio Total' : ' Amid Preu Total'));
    let vist = null; await E.rellegeixLesQueFalten(doc, [C(d, 0), F(d, 1), F(d, 2), F(d, 3)], async x => { vist = vist || x; return null; }, 1);
    tot = tot && !!vist && /^CAP\.2 /.test(vist); }
  return tot; }
(async () => {
const base = proves(H0); base.forEach(([n, c]) => check(n, c));
const rel0 = await provaRel(H0); check('es+ca 1 · la relectura comença per «CAP.2 …» (amb títols de columna)', rel0);
check('la fusió del tram crida el capítol repetit', H0.indexOf('try{ capitolRepetitALaZona(allRows,amidament,allAvisos,_es25); }') >= 0);
const PECES = [
  ['el capítol que la primera ja té', '(d===capAct||capJa(secAct,h))', '(d===capAct)'],
  ['el document escriu el capítol dues vegades', 'return !d||n>=d; };', 'return true; };'],
  ['les partides sense forma reconeguda', 'if(pos>=0&&!teJa(u.part,true)){ u.a=pos+0.5; posa(u); }', ''],
  ['els títols del tros repetit passen a la següent', '(i?u.pre:pend0.concat(u.pre))', '(u.pre)'],
  ['les files de la relectura es casen d\'allà endavant', '_casaAncores(ancores.slice(f0),rowsR)', '_casaAncores(ancores,rowsR).slice(f0)'],
  ['no duplicar la que la primera ja té', '&&!teJa(u.part,true)', ''],
  ['el mateix text amb una altra quantitat no és la mateixa', 'if(!nq&&!j0.endsWith(q)) continue;', ''],
  ['el capítol que el document no escriu', 'if(u.nou&&noEscrit(h)) continue;', ''],
  ['la capçalera CAP.n amb títols de columna puja a la relectura', '||/^\\s*(?:(?:SUB)?CAP[IÍ]T(?:ULO|OL)?|CAP)\\.?\\s*\\d/i.test(l)', ''],
  ['el capítol baixa fins a la partida que el document escriu després', 'u.pre=u.pre.filter(h=>mou.indexOf(h)<0); const nt', 'if(0)u.pre=u.pre.filter(h=>mou.indexOf(h)<0); const nt'],
  ['es mira on toca, no la primera vegada', 'return o.length&&!o.some(x=>x>lp&&x<=la)&&o.some(x=>x>la);', 'return o.length&&o[0]>la;'],
  ['els capítols, sota la zona', 'dest.pre=ks.concat(mou,nt.filter(h=>h.tipo!=="sec"));', 'dest.pre=mou.concat(nt);'],
  ['el text en totes les files', 'g.forEach(x=>{ if(marca.has(x.i)) return; marca.add(x.i); txt[x.i]=[d,g.length]; }); });', '});'],
  ['totes si alguna quantitat no és del document', 'totes=qd.some(x=>x==null)||g.some(x=>!cnt(x.q)); if(!totes) return;', 'totes=false; if(!totes) return;'],
  ['la quantitat de cada vegada que l\'escriu el document', 'if(z){ v=_l25num(z[1]); break; }', 'if(z){ break; }'],
  ['la taronja no treu la fila del compte', '/PARTIDA REPETIDA P[EO]R LA LECTURA/i.test(String(r.flag||""))) return;', '/PARTIDA REPETIDA/i.test(String(r.flag||""))) return;'],
  ['la quantitat entera al final del paràgraf', '||/[.)]\\s+(\\d{1,3}(?:\\.\\d{3})*)\\s*$/.exec(L[k])', ''],
  ['el tros repetit de dalt de la relectura', 'while(j0<UR0.length&&(!UR0[j0].part||teJa(UR0[j0].part,true,true))) j0++;', ''],
  ['el tros repetit, només contra el final de la primera', 'for(const j0 of (nomesFi?jaFi:ja)){', 'for(const j0 of ja){'],
  ['la zona primer', 'u.pre=u.pre.filter(h=>h.tipo==="sec").concat(u.pre.filter(h=>h.tipo!=="sec"));', ''],
  ['la quantitat que és el número de davant', 'nq=senseForma&&ld&&+ld[1]===+r.amid;', 'nq=false;'],
  ['sense la unitat del document al davant', 'ok=x=>ok1(x)||ok1(x.replace(/^\\S{1,4}\\s+/,""));', 'ok=x=>ok1(x);'],
  ['els títols del tros repetit que la primera ja té, fora', 'return !seu(h,la); }); }));', 'return true; }); }));'],
  ['el títol del tros repetit és el seu si és el darrer abans de la partida', 'return capsR0.every(c=>_fpN(c.desc)===_fpN(h.desc)||!(darrer(c,la)>d)); };', 'return false; };'],
  ['el capítol repetit', 'if(d>=1&&x.n>d) dup.push(x);', ''],
  ['la quantitat al final del paràgraf', 'if(z){ ls.push({codi:+p[1],tot:_l25num(z[1])}); break; }', 'if(z) break;'],
];
for (const [nom, de, a] of PECES) {
  const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
  let p2 = null; try { p2 = proves(H); } catch (e) { p2 = null; }
  let r2 = true; try { r2 = await provaRel(H); } catch (e) { r2 = false; }
  check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k] && base[k][1] && !x[1]) || (rel0 && !r2));
}
console.log('\n' + ok + ' OK · ' + ko + ' fallades');
process.exit(ko ? 1 : 0);
})();
