#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 25 (14/10/2026) · EL QUE ENCARA PODIA SORTIR MALAMENT SENSE CAP MARCA, I QUATRE COSTUMS MÉS DELS SEUS PRESSUPOSTOS A MÀ.
 * Documents inventats, castellà i català, cap dada de cap client (va també al repositori públic).
 *  1) la quantitat de la partida enganxada al final del text, darrere del punt, fora; un número diferent, o al títol, es queda;
 *  2) una còpia de més amb el mateix text (o que comença igual i el document no escriu tal qual) es marca, totes les del grup, amb avís vermell;
 *     dues partides que el document escriu cadascuna, no;
 *  3) un capítol del document que no surt a l'esborrany (amb partides a sota) es diu en vermell amb el seu nom i on deuen ser les seves partides;
 *     si hi és, o si no porta cap partida, res;
 *  4) una quantitat que és el número de la partida al document es marca; si el document escriu aquesta quantitat, no;
 *  5) un títol de capítol escrit dues vegades seguides, una vegada;
 *  6) document SENSE columna d'unitat: la unitat del principi del text hi és («M2 de limpieza…»); amb columna d'unitat, no;
 *  7) la nota sota la capçalera del capítol va sota el capítol; la NOTA repetida a cada pàgina, una vegada al final; el text d'una partida no és nota;
 *  8) la línia sense codi amb la seva pròpia quantitat sota una partida és partida a part (taronja); una línia de mesura no;
 *  9) Excel transcrit: la partida sense text porta a sota les seves línies de mesura (etiqueta i xifres que no són 0); amb text, res;
 * 10) Excel del pressupost i els dos PDF: el capítol OPCIÓ n (o OPCIONAL: OPCIÓN 1, 2… en ordre) de partides opcionals es tanca amb «TOTAL OPCIÓN n …»
 *     i no suma al total; la nota sota el capítol surt; la nota de després del total del capítol surt DESPRÉS del seu subtotal;
 * 14) Excel transcrit: la NOTA escrita després del TOTAL d'un capítol va al seu lloc (amb les línies que la segueixen); un text qualsevol, no;
 * 12) document amb els decimals amb punt: una quantitat que el document escriu «10.000» i surt 10000 es marca; amb la coma decimal, mai;
 * 13) una fila sense unitat, quantitat 1, amb el nom d'un capítol es marca com a resum; una partida de debò amb unitat, no;
 * 11) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const eines = H => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  const noms = ['senseQuantitatAlFinalDelText', 'copiesPerText', 'capitolsDelDocumentQueFalten', 'quantitatQueEsElNumero', 'titolNoRepetit', 'unitatDinsLaFrase', 'notesAlSeuLloc', 'liniaAmbQuantitatSenseCodi', 'transcriuExcel', 'quantitatFormatAngles', 'filaDeResumCapitol'];
  return new Function('IDIOMA', 'function nomZonaDelDocument(){ return null; }\nfunction pctPerDefecte(){ return null; }\n' + b + '\nreturn {' + noms.map(n => n + ':(typeof ' + n + '==="function"?' + n + ':null)').join(',') + '};')('es'); } catch (e) { return null; } };
let ExcelJS = null, JSZip = null; for (const p of [path.join(__dirname, '..', 'node_modules', 'exceljs'), 'exceljs']) { try { ExcelJS = require(p); break; } catch (_) {} }
for (const p of [path.join(__dirname, '..', 'node_modules', 'jszip'), 'jszip']) { try { JSZip = require(p); break; } catch (_) {} }
const D = {
  es: { cap: ['FACHADA NORTE', 'FACHADA SUR', 'FACHADA ESTE'], p: 'Limpieza general de la fachada mediante agua a baja presión y cepillado manual de las zonas sucias.',
        p2: 'Pintura de la fachada con dos manos de pintura al silicato sobre la superficie preparada previamente.', tit: 'LIMPIEZA GENERAL DE LA FACHADA', tit2: 'PINTURA DE LA FACHADA',
        nota: 'En la valoración de estas partidas se tendrá en cuenta la dificultad de acceso a los puntos de trabajo.', peu: 'NOTA: Las partidas marcadas con asterisco se medirán en obra antes de empezar.',
        opc: 'Se valorará según el coste la opción de pintar la totalidad de los patios interiores sin descontar', u: 'de limpieza de toda la fachada mediante agua nebulizada a baja presión', head: 'PARTIDA DESCRIPCIÓN CANTIDAD', headU: 'Nº Ud DENOMINACIÓN CANT' },
  ca: { cap: ['FAÇANA NORD', 'FAÇANA SUD', 'FAÇANA EST'], p: 'Neteja general de la façana amb aigua a baixa pressió i raspallat manual de les zones brutes.',
        p2: 'Pintura de la façana amb dues mans de pintura al silicat sobre la superfície preparada prèviament.', tit: 'NETEJA GENERAL DE LA FAÇANA', tit2: 'PINTURA DE LA FAÇANA',
        nota: 'En la valoració d\'aquestes partides es tindrà en compte la dificultat d\'accés als punts de treball.', peu: 'NOTA: Les partides marcades amb asterisc es mesuraran a l\'obra abans de començar.',
        opc: 'Es valorarà segons el cost l\'opció de pintar la totalitat dels patis interiors sense descomptar', u: 'de neteja de tota la façana amb aigua nebulitzada a baixa pressió', head: 'PARTIDA DESCRIPCIÓ QUANTITAT', headU: 'Nº Ut DENOMINACIÓ QUANT' } };
const part = (t, x, ut, q, num) => ({ tipo: 'part', num: num || '', desc: t + '\n- ' + x, ut: ut || 'm2', amid: q, preu: 0 });
function proves(H) { const out = []; const P = (n, c) => out.push([n, !!c]); const E = eines(H);
  if (!E || !E.senseQuantitatAlFinalDelText) { P('eines del LOT 25', false); return out; }
  P('la marca de la nota de després del total (notaFinal) es conserva en desar (sanitizeRows)', /if\(r\.tipo==="subv"&&r\.notaFinal\)o\.notaFinal=true;/.test(H));
  for (const id of ['es', 'ca']) { const d = D[id], es = id === 'es';
    // 1) quantitat al final del text
    const r1 = [part(d.tit, d.p + ' 8', 'ud', 8), part(d.tit2, d.p2 + ' 5', 'ud', 8), { tipo: 'part', desc: d.tit + ' 8\n- ' + d.p, ut: 'ud', amid: 8 }];
    E.senseQuantitatAlFinalDelText(r1);
    P(id + ' 1 · «… frase. 8» amb quantitat 8 → fora', r1[0].desc.endsWith(d.p) && !/\s8$/.test(r1[0].desc));
    P(id + ' 1 · un número que no és la quantitat es queda', /\s5$/.test(r1[1].desc));
    P(id + ' 1 · al títol no es toca', r1[2].desc.split('\n')[0] === d.tit + ' 8');
    // 2) còpies per text
    const src2 = [d.cap[0], '1.1 m2 ' + d.p + ' 33,00', '1.2 m2 ' + d.p2 + ' 12,00', d.cap[1], '2.1 m2 ' + d.p + ' 20,00', 'x'.repeat(5)].join('\n') + '\n' + 'Texto de relleno del documento para que tenga longitud suficiente.'.repeat(3);
    const r2 = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33, '1.1'), part(d.tit2, d.p2, 'm2', 12, '1.2'), part(d.tit, d.p, 'm2', 33, '1.3'), { tipo: 'cap', desc: d.cap[1] }, part(d.tit, d.p, 'm2', 20, '2.1')];
    let av = []; E.copiesPerText(r2, src2, av, es);
    P(id + ' 2 · el mateix text dues vegades (el document una) → les dues marcades i avís vermell', /PARTIDA REPETIDA/.test(r2[1].flag || '') && /PARTIDA REPETIDA/.test(r2[3].flag || '') && av.some(a => /^⚠⚠/.test(a)));
    P(id + ' 2 · la del capítol 2 (altra quantitat) i la diferent, no', !r2[2].flag && !r2[5].flag);
    const r2b = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33, '1.1'), part(d.tit, d.p.replace(/\.$/, ' de toda la planta baja del edificio.'), 'm2', 33, '1.2')];
    const s2b = [d.cap[0], '1.1 m2 ' + d.p.replace(/\.$/, ' de toda la planta baja del edificio.') + ' 33,00'].join('\n') + '\n' + 'Relleno del documento suficiente. '.repeat(8);
    av = []; E.copiesPerText(r2b, s2b, av, es); P(id + ' 2 · una que comença igual i el document no escriu tal qual → marcada amb la seva parella', /PARTIDA REPETIDA/.test(r2b[1].flag || '') && /PARTIDA REPETIDA/.test(r2b[2].flag || ''));
    const s2c = [d.cap[0], '1.1 m2 ' + d.p + ' 33,00', '1.2 m2 ' + d.p + ' 33,00'].join('\n') + '\n' + 'Relleno del documento suficiente. '.repeat(8);
    const r2c = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33, '1.1'), part(d.tit, d.p, 'm2', 33, '1.2')];
    av = []; E.copiesPerText(r2c, s2c, av, es); P(id + ' 2 · bessones que el document escriu dues vegades: res', !r2c[1].flag && !r2c[2].flag && !av.length);
    const s2d = [d.cap[0], '1.1 m2 ' + d.p + ' 33,00', d.cap[1], '2.1 m2 ' + d.p2 + ' 12,00'].join('\n') + '\n' + 'Relleno del documento suficiente. '.repeat(8);
    const r2d = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33, '1.1'), { tipo: 'cap', desc: d.cap[1] }, part(d.tit2, d.p2, 'm2', 12, '2.1'), part(d.tit, d.p, 'm2', 33, '2.2')];
    av = []; E.copiesPerText(r2d, s2d, av, es); P(id + ' 2 · la mateixa partida a dos capítols i el document l\'escriu una vegada → marcades', /PARTIDA REPETIDA/.test(r2d[1].flag || '') && /PARTIDA REPETIDA/.test(r2d[4].flag || ''));
    // 3) capítol del document que falta
    const src3 = ['CAP.1 ' + d.cap[0] + ' Med Precio Total', '1 m2 ' + d.tit + ' 33,00', d.p, 'CAP.2 ' + d.cap[1] + ' Med Precio Total', '1 m2 ' + d.tit2 + ' 12,00', d.p2, 'CAP.3 ' + d.cap[2] + ' Med Precio Total', '1 m2 ' + d.tit + ' 20,00', d.p].join('\n');
    const r3 = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33), { tipo: 'cap', desc: d.cap[2] }, part(d.tit2, d.p2, 'm2', 12), part(d.tit, d.p, 'm2', 20)];
    av = []; const n3 = E.capitolsDelDocumentQueFalten(r3, src3, av, es);
    P(id + ' 3 · el capítol que no surt es diu en vermell, amb el seu nom i on deuen ser les seves partides', n3 === 1 && av.length === 1 && /^⚠⚠/.test(av[0]) && av[0].indexOf(d.cap[1]) >= 0 && av[0].indexOf(d.cap[0]) >= 0);
    const r3b = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33), { tipo: 'cap', desc: d.cap[1] }, part(d.tit2, d.p2, 'm2', 12), { tipo: 'cap', desc: d.cap[2] }, part(d.tit, d.p, 'm2', 20)];
    av = []; P(id + ' 3 · tots hi són: res', E.capitolsDelDocumentQueFalten(r3b, src3, av, es) === 0 && !av.length);
    av = []; P(id + ' 3 · un capítol del document sense cap partida a sota: res', E.capitolsDelDocumentQueFalten(r3, src3.replace('1 m2 ' + d.tit2 + ' 12,00', d.tit2), av, es) === 0);
    // 4) la quantitat que és el número de la partida
    const src4 = ['6 m2 ' + d.tit + ' 8,10', d.p, '8 m2 ' + d.tit + ' 226,16', d.p].join('\n');
    const r4 = [part(d.tit, d.p, 'm2', 8, '2.16'), part(d.tit, d.p, 'm2', 226.16, '3.8')]; av = []; E.quantitatQueEsElNumero(r4, src4, av, es);
    P(id + ' 4 · 8 és el número de la partida i el document hi escriu 226,16 → marcada', /(?:QUANTITAT|CANTIDAD) QUE NO (?:QUADRA|CUADRA)/.test(r4[0].flag || '') && !r4[1].flag && av.length === 1);
    const r4b = [part(d.tit, d.p, 'm2', 8, '2.16')]; av = []; E.quantitatQueEsElNumero(r4b, src4 + '\n7 m2 ' + d.tit + ' 8,00', av, es); P(id + ' 4 · si el document escriu aquesta quantitat, res', !r4b[0].flag);
    // 5) títol repetit
    const r5 = [{ tipo: 'cap', desc: d.cap[0] + ' ' + d.cap[0] }, { tipo: 'cap', desc: d.cap[1] }]; E.titolNoRepetit(r5);
    P(id + ' 5 · «X X» → «X»; «X» no es toca', r5[0].desc === d.cap[0] && r5[1].desc === d.cap[1]);
    // 6) unitat dins la frase
    const src6 = d.head + '\n' + d.cap[0] + '\n2 M2 ' + d.u + ', con las protecciones necesarias.\n115,00';
    const r6 = [part(d.tit, d.u + ', con las protecciones necesarias.', 'm2', 115)]; E.unitatDinsLaFrase(r6, src6);
    P(id + ' 6 · sense columna d\'unitat: «- M2 ' + d.u.slice(0, 12) + '…»', r6[0].desc.split('\n')[1].indexOf('- M2 ' + d.u) === 0);
    const r6b = [part(d.tit, d.u + ', con las protecciones necesarias.', 'm2', 115)]; E.unitatDinsLaFrase(r6b, src6.replace(d.head, d.headU));
    P(id + ' 6 · amb columna d\'unitat, res', r6b[0].desc.split('\n')[1].indexOf('- ' + d.u) === 0);
    // 7) notes al seu lloc
    const src7 = ['CAP.8 ' + d.cap[0] + ' Med Precio Total', d.nota, '1 ml ' + d.tit + ' 48,00', d.p, d.peu, 'CAP.9 ' + d.cap[1] + ' Med Precio Total', '1 m2 ' + d.tit2 + ' 12,00', d.p2, d.peu].join('\n');
    const r7 = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48), { tipo: 'cap', desc: d.cap[1] }, part(d.tit2, d.p2, 'm2', 12)];
    av = []; E.notesAlSeuLloc(r7, src7, av, es);
    P(id + ' 7 · la nota del capítol va just sota el capítol', r7[1].tipo === 'subv' && r7[1].desc === d.nota);
    P(id + ' 7 · la NOTA repetida a cada pàgina, una vegada al final', r7[r7.length - 1].tipo === 'subv' && r7[r7.length - 1].desc.indexOf(d.peu.slice(0, 30)) === 0 && r7.filter(r => r.tipo === 'subv').length === 2);
    const r7b = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48)]; av = []; E.notesAlSeuLloc(r7b, ['CAP.8 ' + d.cap[0] + ' Med Precio Total', '1 ml ' + d.tit + ' 48,00', d.p].join('\n'), av, es);
    P(id + ' 7 · sense nota, res (el text de la partida no és nota)', r7b.length === 2);
    const r7c = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48)]; av = []; E.notesAlSeuLloc(r7c, ['CAP.8 ' + d.cap[0] + ' Med Precio Total', 'Fachada principal planta baja y primera planta 2 4,50 3,00 27,00', '1 ml ' + d.tit + ' 48,00', d.p].join('\n'), av, es);
    P(id + ' 7 · una línia de mesura sota el capítol no és nota', r7c.length === 2);
    const r7g = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48)]; av = []; E.notesAlSeuLloc(r7g, ['CAP.8 ' + d.cap[0] + ' Med Precio Total', 'CAPITULO 10 ' + d.cap[1] + ' y otros trabajos de la fachada', '1 ml ' + d.tit + ' 48,00', d.p].join('\n'), av, es);
    P(id + ' 7 · una línia de resum de capítols sota el capítol no és nota', r7g.length === 2);
    const src7h = ['CAP.1 ' + d.cap[0] + ' Med Precio Total', d.nota, '1 ml ' + d.tit + ' 48,00', d.p, 'CAP.2 ' + d.cap[1] + ' Med Precio Total', d.nota, '1 m2 ' + d.tit2 + ' 12,00', d.p2].join('\n');
    const r7h = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48), { tipo: 'cap', desc: d.cap[1] }, part(d.tit2, d.p2, 'm2', 12)]; av = []; E.notesAlSeuLloc(r7h, src7h, av, es);
    P(id + ' 7 · la mateixa nota sota dos capítols: a tots dos', r7h.filter(r => r.tipo === 'subv').length === 2 && r7h[1].tipo === 'subv' && r7h[4].tipo === 'subv');
    const r7d = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48)]; const net7 = ['CAP.8 ' + d.cap[0] + ' Med Precio Total', '1 ml ' + d.tit + ' 48,00', d.p].join('\n');
    av = []; E.notesAlSeuLloc(r7d, net7, av, es, (net7 + '\n' + d.peu + '\nPágina 1\n').repeat(2));
    P(id + ' 7 · la NOTA que el lector ha tret com a peu (és al text sencer), una vegada al final', r7d.length === 3 && r7d[2].tipo === 'subv' && r7d[2].desc.indexOf(d.peu.slice(0, 30)) === 0);
    const r7e = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48)]; const tanca = (es ? 'El PRESUPUESTO TOTAL de la obra asciende a la cantidad de:' : 'El PRESSUPOST TOTAL de l\'obra puja a la quantitat de:');
    av = []; E.notesAlSeuLloc(r7e, net7, av, es, net7 + '\n' + tanca + '\n' + d.peu.replace(/\.$/, '') + '\nen el momento de la medición final.\nBarcelona, noviembre\n' + 'Memoria descriptiva del proyecto.\n'.repeat(5));
    P(id + ' 7 · la NOTA que tanca el document just després de l\'última partida, una vegada al final', r7e.length === 3 && r7e[2].tipo === 'subv' && r7e[2].desc.indexOf(d.peu.slice(0, 30)) === 0 && /medición final/.test(r7e[2].desc));
    const r7f = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'ml', 48)]; av = []; E.notesAlSeuLloc(r7f, net7, av, es, net7 + '\n' + 'Memoria. '.repeat(3) + '\n'.repeat(20) + d.peu);
    P(id + ' 7 · una NOTA lluny del final de l\'amidament (a la memòria), no', r7f.length === 2);
    // 8) línia sense codi amb quantitat pròpia
    const src8 = ['2.5.2 m2 ' + d.p2 + ' 18,90', d.opc + ' 396,00', 'huecos de ventanas', '2.6 VARIOS'].join('\n');
    const r8 = [part(d.tit2, d.p2 + '\n' + d.opc + ' huecos de ventanas', 'm2', 18.9, '5.2'), { tipo: 'cap', desc: 'VARIOS' }]; av = []; E.liniaAmbQuantitatSenseCodi(r8, src8, av, es);
    P(id + ' 8 · és partida a part: m2, 396, marca taronja, i ja no és dins la de dalt', r8[1] && r8[1].tipo === 'part' && r8[1].amid === 396 && r8[1].ut === 'm2' && /SIN CÓDIGO|SENSE CODI/.test(r8[1].flag || '') && r8[0].desc.indexOf(d.opc.slice(0, 20)) < 0 && av.length === 1);
    const r8b = [part(d.tit2, d.p2, 'm2', 18.9, '5.2')]; av = []; E.liniaAmbQuantitatSenseCodi(r8b, ['2.5.2 m2 ' + d.p2 + ' 18,90', 'Fachada principal planta baja y primera planta del edificio 4,50 3,00 13,50', '2.6 VARIOS'].join('\n'), av, es);
    P(id + ' 8 · una línia de mesura no és partida', r8b.length === 1);
    // 9) Excel transcrit: partida sense text amb les seves línies de mesura
    const F = [{ r: 1, c: ['Código', 'Nat.', 'Un.', 'Resumen', 'Un.', 'Largo', 'Ancho', 'Alto', 'Cantidad'] },
      { r: 2, c: ['C1', 'Capítulo', '', d.cap[0], null, null, null, null, 1] },
      { r: 3, c: ['P1', 'Partida', 'M2', d.tit, null, null, null, null, 148] }, { r: 4, c: ['', '', '', 'PARAMENTOS', 1, 0, 9, 14, 126] }, { r: 5, c: ['', '', '', '', 2, 0, 7, 1, 14] }, { r: 6, c: ['', '', '', 'BAJOS', 4, 2, 1, 0, 8] },
      { r: 7, c: ['P2', 'Partida', 'M2', d.tit2, null, null, null, null, 90] }, { r: 8, c: ['', '', '', d.p2, null, null, null, null, null] }, { r: 9, c: ['', '', '', 'PARAMENTOS', 1, 0, 9, 10, 90] }];
    const cel = v => v == null || v === '' ? null : { v, w: String(v), t: typeof v === 'number' ? 'n' : 's' };
    let fx = null; try { fx = E.transcriuExcel([{ nom: 'F', files: F.map(x => ({ r: x.r, c: x.c.map(cel) })) }], es); } catch (e) { fx = null; }
    const P9 = fx ? fx.rows.filter(r => r.tipo === 'part') : [];
    P(id + ' 9 · partida sense text: «PARAMENTOS 1,00 9,00 14,00 126,00 ⏎ 2,00 7,00 1,00 14,00 ⏎ BAJOS 4,00 2,00 1,00 8,00»', P9[0] && P9[0].desc === d.tit + '\nPARAMENTOS 1,00 9,00 14,00 126,00\n2,00 7,00 1,00 14,00\nBAJOS 4,00 2,00 1,00 8,00');
    P(id + ' 9 · partida amb text: només el seu text', P9[1] && P9[1].desc === d.tit2 + '\n' + d.p2);
    const nt = es ? 'Nota: En estas partidas no se incluye:' : 'Nota: En aquestes partides no s\'inclou:', nl = es ? 'DESMONTAJE DE REJAS PARTICULARES' : 'DESMUNTATGE DE REIXES PARTICULARS';
    const F14 = [{ r: 1, c: ['Cod.', 'Ud', 'Resumen', 'Ud', 'Largo', 'Parcial', 'Cant.', 'Precio'] }, { r: 2, c: ['C1', '', d.cap[0], null, null, null, null, null] },
      { r: 3, c: ['P1', 'm2', d.tit, null, null, null, null, null] }, { r: 4, c: ['', '', d.p, null, null, null, null, null] }, { r: 5, c: ['', '', '', 2, 5, 10, null, null] }, { r: 6, c: ['', '', '', null, null, 'P1', 10, null] },
      { r: 7, c: ['', '', '', null, null, null, null, 'TOTAL CAPÍTULO ' + d.cap[0]] }, { r: 8, c: ['', '', nt, null, null, null, null, null] }, { r: 9, c: ['', '', nl, null, null, null, null, null] },
      { r: 10, c: ['C2', '', d.cap[1], null, null, null, null, null] }, { r: 11, c: ['P2', 'm2', d.tit2, null, null, null, null, null] }, { r: 12, c: ['', '', d.p2, null, null, null, null, null] }, { r: 13, c: ['', '', '', 3, 4, 12, null, null] },
      { r: 14, c: ['', '', '', null, null, 'P2', 12, null] }, { r: 15, c: ['', '', '', null, null, null, null, 'TOTAL CAPÍTULO ' + d.cap[1]] }, { r: 16, c: ['', '', 'Texto suelto que no es ninguna nota del capítulo', null, null, null, null, null] }];
    let fx14 = null; try { fx14 = E.transcriuExcel([{ nom: 'F', files: F14.map(x => ({ r: x.r, c: x.c.map(cel) })) }], es); } catch (e) { fx14 = null; }
    const N14 = fx14 ? fx14.rows.filter(r => r.tipo === 'subv' && r.notaFinal) : [];
    P(id + ' 14 · la NOTA de després del total del capítol, al seu lloc i amb les seves línies', N14.length === 1 && N14[0].desc === nt + '\n' + nl && fx14.rows.indexOf(N14[0]) < fx14.rows.findIndex(r => r.tipo === 'cap' && r.desc === d.cap[1]));
    P(id + ' 14 · un text qualsevol després del total no és nota', fx14 && !fx14.rows.some(r => /Texto suelto/.test(r.desc || '')));
    // 12) format anglès
    const en = Array.from({ length: 12 }, (_, k) => (k + 1) + ' ' + d.tit + ' 1.20 3.50 ' + (k + 2) + '.40').join('\n') + '\n1.1 ' + d.tit2 + ' 10.000';
    const r12 = [part(d.tit2, d.p2, 'ud', 10000, '1.1'), part(d.tit, d.p, 'ud', 5000, '1.2')]; av = []; E.quantitatFormatAngles(r12, en, av, es);
    P(id + ' 12 · decimals amb punt: «10.000» i 10000 → marcada; 5000 sense «5.000» al document, no', /QUADRA|CUADRA/.test(r12[0].flag || '') && !r12[1].flag && av.length === 1);
    const r12b = [part(d.tit2, d.p2, 'ud', 10000, '1.1')]; av = []; E.quantitatFormatAngles(r12b, en.replace(/(\d)\.(\d\d)\b/g, '$1,$2'), av, es);
    P(id + ' 12 · decimals amb coma: mai', !r12b[0].flag);
    // 13) fila de resum
    const r13 = [{ tipo: 'cap', desc: d.cap[0] }, part(d.tit, d.p, 'm2', 33), { tipo: 'part', desc: d.cap[0], ut: '', amid: 1 }, { tipo: 'part', desc: d.tit + '\n- ' + d.p, ut: '', amid: 1 }];
    av = []; E.filaDeResumCapitol(r13, av, es); P(id + ' 13 · «' + d.cap[0] + '» sense unitat ni quantitat → resum; la partida de debò, no', /RESUM/.test(r13[2].flag || '') && !r13[1].flag && !r13[3].flag && av.length === 1);
  }
  return out; }
// 10) Excel del pressupost (mòdul real): «TOTAL OPCIÓN n …» i el total del pressupost sense les opcions
async function excel(H) { const out = []; if (!ExcelJS || !JSZip) return null;
  const S = '(function(root){', E = '})(typeof window!=="undefined"?window:globalThis);'; let i = 0, src = null;
  while ((i = H.indexOf(S, i)) !== -1) { const j = H.indexOf(E, i); if (j < 0) break; const s = H.slice(i, j + E.length); if (/root\.GTA_EXCEL\s*=\s*api/.test(s)) { src = s; break; } i = j + E.length; }
  if (!src) return [['mòdul de l\'Excel', false]];
  const sb = { console, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, Date, RegExp, self: {}, setTimeout, Promise, module: { exports: {} }, ExcelJS, JSZip }; vm.createContext(sb); new vm.Script(src).runInContext(sb); const X = sb.module.exports;
  for (const id of ['es', 'ca']) { const d = D[id];
    const rows = [{ tipo: 'cap', num: '1', desc: d.cap[0] }, { tipo: 'part', num: '1.1', desc: d.tit + '\n- ' + d.p, ut: 'm2', amid: 10, preu: 10 },
      { tipo: 'cap', num: '2', desc: (id === 'es' ? 'OPCIÓN 2 BARANDILLAS DE ALUMINIO' : 'OPCIÓ 2 BARANES D\'ALUMINI') }, { tipo: 'part', num: '2.1', desc: d.tit2 + '\n- ' + d.p2, ut: 'm2', amid: 5, preu: 20, gta: 'opc' },
      { tipo: 'cap', num: '3', desc: d.cap[1] + ' (NO SUMA)' }, { tipo: 'part', num: '3.1', desc: d.tit2 + '\n- ' + d.p2, ut: 'm2', amid: 3, preu: 20, gta: 'opc' }];
    rows.splice(1, 0, { tipo: 'subv', num: '', desc: D[id].nota, ut: '', amid: '', preu: '' });
    rows.push({ tipo: 'cap', num: '4', desc: (id === 'es' ? 'PARTIDAS OPCIONALES DE CUBIERTA' : 'PARTIDES OPCIONALS DE COBERTA') }, { tipo: 'part', num: '4.1', desc: D[id].tit + '\n- ' + D[id].p, ut: 'm2', amid: 2, preu: 10, gta: 'opc' },
      { tipo: 'subv', num: '', desc: D[id].peu, ut: '', amid: '', preu: '', notaFinal: true });
    const blob = await X.buildExcelFinal({ rows, coef: 1, idioma: id, obra: 'OBRA DE PROVA', gref: 'G', tec: '', titu: '', notes: [], showSubs: true });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await blob.arrayBuffer())); const ws = wb.worksheets[0]; const L = [];
    ws.eachRow((row, n) => { const b = row.getCell(2).value; if (typeof b === 'string') L.push({ n, b, g: row.getCell(7).value }); });
    const to = L.find(x => /^TOTAL OPCI[ÓO]N? 2 BARAN/.test(x.b)); const tp = L.find(x => /^TOTAL PRES/.test(x.b));
    out.push([id + ' 10 · «TOTAL OPCIÓN 2 …» amb la suma de les seves partides', !!to && to.g && /SUM\(G/.test(to.g.formula || '')]);
    out.push([id + ' 10 · el capítol «(NO SUMA)» sense OPCIÓ n continua amb el seu SUBTOTAL', L.some(x => /^SUBTOTAL CAP[IÍ]TU?O?L?O? 3/.test(x.b))]);
    out.push([id + ' 10 · el TOTAL del pressupost no porta la fila de l\'opció', !!tp && !!to && (tp.g.formula || '').indexOf('G' + to.n) < 0]);
    const t4 = L.find(x => new RegExp('^TOTAL ' + (id === 'es' ? 'OPCIÓN' : 'OPCIÓ') + ' 2$').test(x.b));
    out.push([id + ' 10 · un capítol OPCIONAL sense número és la segona opció del document: «TOTAL ' + (id === 'es' ? 'OPCIÓN' : 'OPCIÓ') + ' 2» amb la seva suma', !!t4 && /SUM\(G/.test((t4.g || {}).formula || '') && (tp.g.formula || '').indexOf('G' + t4.n) < 0]);
    const nC = L.find(x => x.b === D[id].nota), c1 = L.find(x => x.b === D[id].cap[0]), sF = L.filter(x => /^TOTAL OPCI/.test(x.b)).pop(), nF = L.find(x => x.b === D[id].peu);
    out.push([id + ' 10 · Excel: la nota sota el títol del capítol surt', !!nC && !!c1 && nC.n > c1.n]);
    out.push([id + ' 10 · Excel: la nota de després del total surt DESPRÉS del total del seu capítol', !!nF && !!sF && nF.n > sF.n]);
    // els dos PDF (el principal i el de reserva)
    const MOD = nm => { const S0 = '(function(root){', E0 = '})(typeof window!=="undefined"?window:globalThis);'; let i = 0; while ((i = H.indexOf(S0, i)) !== -1) { const j = H.indexOf(E0, i); if (j < 0) break; const s = H.slice(i, j + E0.length); if (new RegExp('root\\.' + nm + '\\s*=\\s*api').test(s)) return s; i = j + E0.length; } return null; };
    const carr = src => { const sb = { console: { log() {}, warn() {}, error() {} }, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, Date, RegExp, self: {}, setTimeout, Promise, Buffer, module: { exports: {} } }; vm.createContext(sb); new vm.Script(src).runInContext(sb); return sb.module.exports; };
    const txt = n => { if (n == null) return ''; if (typeof n === 'string') return n; if (Array.isArray(n)) return n.map(txt).join('|'); if (typeof n === 'object') return txt(n.text) + (n.table ? txt(n.table.body) : '') + (n.stack ? txt(n.stack) : '') + (n.columns ? txt(n.columns) : ''); return String(n); };
    let pm = '', ph = ''; try { pm = txt(carr(MOD('GTA_PDFM')).buildPressupostDoc({ rows, coef: 1, idioma: id, obra: 'OBRA', gref: 'G', showSubs: true }).content); } catch (e) { pm = ''; }
    try { ph = String(carr(MOD('GTA_PDF')).buildPressupostHtml({ rows, coef: 1, idioma: id, obra: 'OBRA', gref: 'G', showSubs: true })).replace(/<[^>]+>/g, '|').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); } catch (e) { ph = ''; }
    const op = id === 'es' ? 'OPCIÓN' : 'OPCIÓ', okPdf = s => !!s && s.indexOf('TOTAL ' + op.replace('Ó', 'Ó') + ' 2') >= 0 && /TOTAL OPCI[ÓO]N? 2 BARAN/.test(s) && s.indexOf(D[id].nota.slice(0, 30)) >= 0 && s.lastIndexOf(D[id].peu.slice(0, 30)) > s.lastIndexOf('TOTAL ' + op + ' 2');
    out.push([id + ' 10 · PDF (principal): TOTAL ' + op + ' n, la nota del capítol i la nota de després del total', okPdf(pm)]);
    out.push([id + ' 10 · PDF (reserva): el mateix', okPdf(ph)]); }
  return out; }
(async () => {
  const base = proves(H0); base.forEach(([n, c]) => check(n, c));
  const bx = await excel(H0); if (bx) bx.forEach(([n, c]) => check(n, c)); else console.log('  -- sense exceljs: la part de l\'Excel del pressupost (10) no es comprova aquí (es comprova al repositori privat)');
  // 11) peces trencades: cadascuna, si es treu, fa caure alguna prova que avui és verda
  const PECES = [
    ['la quantitat del final fora', 'L[k]=m[1]; r.desc=L.join("\\n"); n++; }', 'n++; }'],
    ['les còpies amb el mateix text', 'g.forEach(x=>{ marca.add(x.i); txt[x.i]=[d,g.length]; }); });', '});'],
    ['les còpies que comencen igual', 'marca.add(x.i); txt[x.i]=[d,amb.length]; if(!marca.has(par.i))', 'if(false)'],
    ['l\'avís de les còpies', 'if(marca.size&&avisos) avisos.unshift(', 'if(false) avisos.unshift('],
    ['el capítol que falta', "vist.add(h.k); falten.push(", "vist.add(h.k); if(0)falten.push("],
    ['només amb partides a sota', 'if(!amb) return;', ''],
    ['la quantitat = número', 'if(String(r.flag||"").indexOf(fl)<0){ r.flag=r.flag?(String(r.flag)+" · "+fl):fl;', 'if(false){'],
    ['si el document la porta, res', 'if(!ls.length||ls.some(x=>Math.abs(x.tot-q)<=0.005)) continue;', 'if(!ls.length) continue;'],
    ['el títol repetit', 'L[0]=m[1]; r.desc=L.join("\\n"); n++;', 'n++;'],
    ['la unitat dins la frase', 'L[1]=L[1].replace(/^(\\s*[-–]?\\s*)/,"$1"+m[1]+" ");', ''],
    ['només sense columna d\'unitat', 'function unitatDinsLaFrase(rows,src){ if(!_docSenseColumnaUnitat(src)) return 0;', 'function unitatDinsLaFrase(rows,src){'],
    ['la nota sota el capítol', 'rows.splice(i+1,0,_notaVisible(nota)); n++;', 'n++;'],
    ['la NOTA repetida al final', 'rows.push(Object.assign(_notaVisible(b.join("\\n")),{notaFinal:true})); n++;', 'n++;'],
    ['la NOTA que tanca el document', 'rows.push(Object.assign(_notaVisible(b.join("\\n").replace(', 'if(0)rows.push(Object.assign(_notaVisible(b.join("\\n").replace('],
    ['només a prop del final', '&&j<=fi+15;j++){', '&&j<=fi+999;j++){'],
    ['la nota no és text de partida', 'if(esMesura(l)||/^(?:', 'if(false&&esMesura(l)||/^(?:'],
    ['una capçalera o un total no és nota', 'if(esMesura(l)||/^(?:', 'if(esMesura(l)||false&&/^(?:'],
    ['la mateixa nota a dos capítols', 'TC.indexOf(kn.slice(0,30))>=0) break;', 'T.indexOf(kn.slice(0,30))>=0) break;'],
    ['la línia amb quantitat és partida', 'rows.splice(j,0,{tipo:"part"', 'rows.splice(j,0,{tipo:"subv"'],
    ['una línia de mesura no', '||/\\d+[.,]\\d+\\s+\\d+[.,]\\d+/.test(frase)) continue;', ') continue;'],
    ['les línies de mesura a l\'Excel', 'if(_lm.length) row.desc=it.titol+"\\n"+_lm.join("\\n"); }', '}'],
    ['el TOTAL OPCIÓN', '}else if(_l25TotOpc(capTitolX)&&capPartsX>0&&capOpcX===capPartsX){', '}else if(false){'],
    ['les opcions OPCIONAL sense número (OPCIÓN 1, 2… en ordre)', '} else if(/\\bOPCIONA(?:L|LES|LS)\\b/i.test(t)){ k++;', '} else if(false){ k++;'],
    ['la nota sola a l\'Excel', '  else if(x.tipo==="subv"){   // 14/10/2026 (LOT 25)', '  else if(false){   // 14/10/2026 (LOT 25)'],
    ['la nota de després del total a l\'Excel', '    if(x.notaFinal){ closeCap(); }', '    if(false){ closeCap(); }'],
    ['el TOTAL OPCIÓN al PDF', '    else if(_totOpcX(capTitX)&&capPX>0&&capOX===capPX){strongAbove.add(body.length);', '    else if(false){strongAbove.add(body.length);'],
    ['el TOTAL OPCIÓN al PDF de reserva', '   else if(_totOpcX(capTitX)&&capPX>0&&capOX===capPX) body+=', '   else if(false) body+='],
    ['la nota sola al PDF', '    if(x.tipo==="subv"){ if(x.notaFinal) closeCap();   // 14/10/2026 (LOT 25)', '    if(false){ if(x.notaFinal) closeCap();   // 14/10/2026 (LOT 25)'],
    ['la nota sola al PDF de reserva', '  if(x.tipo==="subv"){ if(x.notaFinal) closeCap(); body+=', '  if(false){ if(x.notaFinal) closeCap(); body+='],
    ['la nota de després del total a l\'Excel transcrit', 'if(it.notaFi&&it.notaFi.length) fil.push(', 'if(false) fil.push('],
    ['només una NOTA després del total', '||/^(?:notas?|notes|observaci(?:ons|ones|ó|o)|important)\\b\\s*:?/i.test(desc||t)) cur.notaFi=', '||true) cur.notaFi='],
    ['la nota final sobreviu al desar', 'if(r.tipo==="subv"&&r.notaFinal)o.notaFinal=true;', ''],
    ['el format anglès', 'if(en<10||en<ca*3) return 0; let n=0; const ll=[];', 'return 0; let n=0; const ll=[];'],
    ['amb la coma decimal, mai', 'if(en<10||en<ca*3) return 0; let n=0; const ll=[];', 'let n=0; const ll=[];'],
    ['la fila de resum', 'if(String(r.flag||"").indexOf(fl)<0){ r.flag=r.flag?(String(r.flag)+" · "+fl):fl; n++; ll.push(r.num||String(r.desc).split("\\n")[0].slice(0,30)); } }', '}'],
  ];
  for (const [nom, de, a] of PECES) {
    const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
    let p2 = null; try { p2 = proves(H); } catch (e) { p2 = null; }
    let x2 = null; try { x2 = await excel(H); } catch (e) { x2 = null; }
    const caiguda = !p2 || p2.some((x, k) => base[k] && base[k][1] && !x[1]) || (bx && (!x2 || x2.some((x, k) => bx[k] && bx[k][1] && !x[1])));
    if (nom === 'el TOTAL OPCIÓN' && !bx) { console.log('  -- «' + nom + '»: sense exceljs no es pot comprovar aquí'); continue; }
    check('sense «' + nom + '» → es veu', caiguda);
  }
  console.log('\n' + ok + ' OK · ' + ko + ' fallades');
  process.exit(ko ? 1 : 0);
})();
