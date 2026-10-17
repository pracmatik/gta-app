#!/usr/bin/env node
'use strict';
/*
 * Guardià · LOT 22 (13/10/2026) · EL QUE ES VA VEURE A LES 10 MEDICIONS DE GTA DEL 13/10 (app). Documents inventats, castellà i català.
 *  1) un capítol que el document anomena «OPCIÓN 2 …» / «OPCIÓ B …» (no només «OPCIONAL») és opcional: les seves partides no sumen al total (ni al CSV),
 *     amb avís. Abans sumaven sense cap avís. «RECEPCIÓN», «ADOPCIÓN» o «OPCIONAL» d'una frase no ho són;
 *  2) el peu de carta amb un mòbil o «Tlf.» / «Telèfon», la fila de títols de columna («Nº DESCRIPCIÓN DE LA PARTIDA») i els títols de la taula de
 *     mesura enganxats al final d'una línia («… lonas. Cant. Long./Sup Gruix Alçada») surten del text de la partida;
 *  3) el títol de la zona o del capítol de sota amb la numeració sense signe («2 CUBIERTA …», «1.2 DERRIBOS») no s'enganxa a l'última partida, i una
 *     «NOTA: …» lliure darrere de la línia que tanca una partida amb la seva quantitat va a sota com a nota visible (no dins del text). La frase final
 *     sense punt que la lectura també porta («… Vigas prefabricadas de 4,00m de longitud 5,00») es queda, i si la lectura és el literal amb la unitat
 *     al davant («m2 Limpieza …») el text és el del document (sense la unitat);
 *  4) el lector de PDF no llegeix dues vegades el text dibuixat dues vegades al mateix lloc («01.01 01.01 PA PA», «M2. 2 COLOCACIÓN PAVIMENTO CO OCAC Ó A O»);
 *  5) (LOT 22b) una partida amb el codi d'un altre capítol (la lectura s'ha saltat «02 …») i una partida que la lectura porta més vegades que les escriu el
 *     document es marquen a la fila i amb avís vermell; un capítol que hi és, o una bessona que el document escriu dues vegades, no;
 *  6) cada peça trencada es veu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const fnDe = (H, n) => { const s0 = H.indexOf('function ' + n + '('); if (s0 < 0) return null; let i = H.indexOf('{', s0), d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const blocDe = (H, ini) => { const s0 = H.indexOf(ini); if (s0 < 0) return null; let i = s0, d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const eines = H => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  return new Function('IDIOMA', fnDe(H, '_dehyphen') + '\nconst parseNum=' + /const parseNum=(.*?);\n/s.exec(H)[1] + ';function num2(v){return v}const eur=v=>v+" €";\n' + b +
    '\nreturn {repairDescsFromSource,senseMarquesInternes,_esPeuDePagina,_esCapcaleraColumnes,_senseCapcaleraMesuraAlFinal,_peusDelDocument,_RE_CAP_OPCIO,_marcaNotesDocument,marcaForaDeCapitolICopies};')('ca'); } catch (e) { return null; } };
// el bloc OPCIONALS del flux de lectura, tal qual (fa servir _RE_CAP_OPCIO de les eines)
const opcionals = (H, E) => { const b = blocDe(H, '{ // OPCIONALS (la tècnica 08/07'); if (!b || !E) return null;
  try { return (rows, es) => { const av = []; new Function('allRows', 'allAvisos', 'IDIOMA', '_RE_CAP_OPCIO', b)(rows, av, es ? 'es' : 'ca', E._RE_CAP_OPCIO); return av; }; } catch (e) { return null; } };
// la peça del lector de PDF, tal qual
const fantasmes = H => { const a = H.indexOf('const _senseFantasmes=its=>{'), fi = 'return fora.size?its.filter(i=>!fora.has(i)):its; };', b = H.indexOf(fi, a);
  if (a < 0 || b < 0 || H.indexOf('const its=_superindex(_senseFantasmes(its0));') < 0) return null; try { return new Function(H.slice(a, b + fi.length) + '\nreturn _senseFantasmes;')(); } catch (e) { return null; } };
const l1 = r => String(r.desc).split('\n')[0];

// ── 1) capítols «OPCIÓN n» ──
const OPC = { es: ['CAP.9 BARANDILLAS', 'CAP.9.1 OPCIÓN 2 BARANDILLAS DE ALUMINIO', 'CAP.9.2 OPCION 3 BARANDILLAS DE INOX', 'CAP.10 RECEPCIÓN DE LA OBRA', 'CAP.11 ADOPCIÓN DE MEDIDAS DE SEGURIDAD'],
  ca: ['CAP.9 BARANES', 'CAP.9.1 OPCIÓ B BARANES D\'ALUMINI', 'CAP.9.2 OPCIONS DE BARANES D\'INOX', 'CAP.10 RECEPCIÓ DE L\'OBRA', 'CAP.11 ADOPCIÓ DE MESURES DE SEGURETAT'] };
const casOpc = (H, id) => { const E = eines(H), f = opcionals(H, E); if (!f) return null; const rows = [];
  OPC[id].forEach((c, k) => { rows.push({ tipo: 'cap', desc: c }); rows.push({ tipo: 'part', num: '', desc: 'Partida ' + k + (k === 3 ? ' (incluye la recepción provisional)' : ''), ut: 'ml', amid: 10, preu: 5 }); });
  const av = f(rows, id === 'es'); return { gta: rows.filter(r => r.tipo === 'part').map(r => r.gta || ''), av: av.join(' ') }; };

// ── 2) peu, fila de títols i títols de la taula de mesura ──
const PEUS = { es: { peu: 'C/ Inventada, 12 08001 _ BARCELONA Tlf. 600 11 22 33 Estudio Ficticio _ Arquitectura', col: 'Nº DESCRIPCIÓN DE LA PARTIDA', mes: 'Nota: Se protegerá la planta baja con tablones y lonas. Cant. Long./Sup Gruix Alçada TOTAL', mesNet: 'Nota: Se protegerá la planta baja con tablones y lonas.', frase: 'Se abonará según medición total' },
  ca: { peu: 'C/ Inventat, 12 08001 _ BARCELONA Telèfon 699 12 34 56 Estudi Fictici _ Arquitectura', col: 'Nº DESCRIPCIÓ DE LA PARTIDA', mes: 'Nota: Es protegirà la planta baixa amb taulons i lones. Uds. Longitud Amplada Alçada Parcials Quantitat', mesNet: 'Nota: Es protegirà la planta baixa amb taulons i lones.', frase: 'S\'abonarà segons amidament total' } };
const casPeu = (H, id) => { const E = eines(H); if (!E) return null; const c = PEUS[id];
  const rows = [{ tipo: 'part', desc: 'TÍTOL / TÍTULO\n- Text de la partida, primera línia.\n' + c.mes + '\n' + c.frase + '\n' + c.col + '\n' + c.peu, ut: 'ud', amid: 1 }];
  E.senseMarquesInternes(rows, E._peusDelDocument('PORTADA\n' + c.peu + '\n' + c.col + '\n1.1 ...')); const d = rows[0].desc;
  return { peu: E._esPeuDePagina(c.peu), col: E._esCapcaleraColumnes(c.col), noCol: !E._esCapcaleraColumnes('TOTAL PARTIDA') && !E._esCapcaleraColumnes('DE LA PARTIDA') && !E._esCapcaleraColumnes('Precio total de la partida incluido el transporte'),
    netPeu: d.indexOf('BARCELONA') < 0, netCol: d.indexOf(c.col) < 0, netMes: d.indexOf(c.mesNet + '\n') >= 0 && !/Gruix|Alçada TOTAL|Amplada/.test(d), frase: d.indexOf(c.frase) >= 0, d }; };

// ── 3) títol de la zona de sota, nota lliure, frase final i unitat al davant (llista numerada «1.1.2 m2 text … 14,40») ──
const ZN = {
  es: { z: ['TRASTEROS DEL EDIFICIO', 'CUBIERTA Y MUROS DEL PATIO'], c: ['TRABAJOS PREVIOS', 'DERRIBOS', 'PINTURA'],
    nota: 'NOTA: Si fuera necesario vaciar los trasteros para ejecutar la obra, será a cargo de cada propietario',
    p: ['Ud Apuntalamiento provisional de las vigas adyacentes a las vigas en mal estado durante los trabajos', 'm2 Limpieza de eflorescencias de sales en bovedillas con agua a baja presión y cepillado|manual con jabón neutro',
      'm2 Derribo parcial por medios manuales de la zona superior de los tabiques para el paso de refuerzos', 'Pa Se contabiliza el diez por ciento del presupuesto para extras e imprevistos',
      'm2 Limpieza exterior de los muros del badalot a baja presión y cepillado manual con jabón de|PH neutro para retirar toda la suciedad y lavado de la superficie.',
      'Ud Colocación de refuerzos para sustitución funcional de vigas deterioradas preferentemente|con elementos telescópicos por las dificultades de montaje. Vigas prefabricadas de 4,00m de longitud',
      'm2 Pintura de paramento vertical con una mano de base y dos de acabado previo saneado de la|superficie. Color blanco. No se descuentan huecos',
      'm2 Pintura plástica en los techos de la escalera con dos manos de acabado mate', 'ml Pintura de esmalte en las barandillas de la escalera con dos manos'],
    fi: 'Vigas prefabricadas de 4,00m de longitud', fi2: 'No se descuentan huecos' },
  ca: { z: ['TRASTERS DE L\'EDIFICI', 'COBERTA I MURS DEL PATI'], c: ['TREBALLS PREVIS', 'ENDERROCS', 'PINTURA'],
    nota: 'NOTA: Si cal buidar els trasters per executar l\'obra, anirà a càrrec de cada propietari',
    p: ['Ut Apuntalament provisional de les bigues adjacents a les bigues en mal estat durant els treballs', 'm2 Neteja d\'eflorescències de sals a les revoltons amb aigua a baixa pressió i raspallat|manual amb sabó neutre',
      'm2 Enderroc parcial amb mitjans manuals de la zona superior dels envans per al pas de reforços', 'Pa Es compta el deu per cent del pressupost per a extres i imprevistos',
      'm2 Neteja exterior dels murs del terrat a baixa pressió i raspallat manual amb sabó de|PH neutre per retirar tota la brutícia i rentat de la superfície.',
      'Ut Col·locació de reforços per a substitució funcional de bigues deteriorades preferentment|amb elements telescòpics per les dificultats de muntatge. Bigues prefabricades de 4,00m de llargada',
      'm2 Pintura de parament vertical amb una mà de base i dues d\'acabat amb sanejat previ de la|superfície. Color blanc. No es descompten forats',
      'm2 Pintura plàstica als sostres de l\'escala amb dues mans d\'acabat mat', 'ml Pintura d\'esmalt a les baranes de l\'escala amb dues mans'],
    fi: 'Bigues prefabricades de 4,00m de llargada', fi2: 'No es descompten forats' } };
const QZ = ['5', '14,40', '3,00', '1,00', '30,60', '5,00', '22,00', '48,00', '16,50'], AM = [5, 14.4, 3, 1, 30.6, 5, 22, 48, 16.5], UTZ = ['ud', 'm²', 'm²', 'pa', 'm²', 'ud', 'm²', 'm²', 'ml'];
const COD = ['1.1.1', '1.1.2', '1.2.1', '1.2.2', '2.1.1', '2.1.2', '2.2.1', '2.2.2', '2.2.3'], CAPD = [[0, 0], [0, 0], [0, 1], [0, 1], [1, 0], [1, 0], [1, 2], [1, 2], [1, 2]];
const docZn = c => { const L = ['ESTADO DE MEDICIONES / ESTAT D\'AMIDAMENTS', 'Nº Ud DENOMINACIÓN CANT']; let z0 = -1, c0 = -1;
  c.p.forEach((p, i) => { const [z, k] = CAPD[i]; if (z !== z0) { z0 = z; c0 = -1; L.push((z + 1) + ' ' + c.z[z]); } if (k !== c0) { c0 = k; L.push((z + 1) + '.' + (z ? (k === 2 ? 2 : 1) : k + 1) + ' ' + c.c[k]); }
    const ls = p.split('|'); if (i === 4) { L.push(COD[i] + ' ' + ls[0], ls[1], QZ[i]); } else { ls[ls.length - 1] += ' ' + QZ[i]; L.push(COD[i] + ' ' + ls[0], ...ls.slice(1)); } if (i === 1) L.push(c.nota); });
  return L.join('\n'); };
const lectZn = c => { const R = []; let z0 = -1, c0 = -1;
  c.p.forEach((p, i) => { const [z, k] = CAPD[i]; if (z !== z0) { z0 = z; c0 = -1; R.push({ tipo: 'sec', desc: c.z[z] }); } if (k !== c0) { c0 = k; R.push({ tipo: 'cap', desc: c.c[k] }); }
    R.push({ tipo: 'part', num: '', desc: p.replace('|', i === 4 ? '\n' : ' '), ut: UTZ[i], amid: AM[i], preu: 0 }); }); return R; };
const casZn = (H, id) => { const E = eines(H); if (!E) return null; const c = ZN[id], rows = lectZn(c), av = []; E.repairDescsFromSource(rows, docZn(c), av);
  const ps = rows.filter(r => r.tipo === 'part'), D = i => String((ps[i] || {}).desc || ''), k1 = rows.indexOf(ps[1]);
  return { zona: D(3).indexOf(c.z[1]) < 0 && !/\s2\.?$/.test(D(3)), capPint: D(5).indexOf(c.c[2]) < 0, notaFora: D(1).indexOf('NOTA') < 0,
    notaSota: !!rows[k1 + 1] && rows[k1 + 1].tipo === 'subv' && String(rows[k1 + 1].desc).indexOf(c.nota.slice(0, 20)) === 0, fi: D(5).indexOf(c.fi) >= 0, fi2: D(6).indexOf(c.fi2) >= 0,
    senseUt: !/^m2\s/i.test(D(4)), senseUt5: !/^U[dt]\s/.test(D(5)), d: [D(1), D(3), D(4), D(5), D(6)].map(x => x.slice(-70)) }; };

// ── 4) lector de PDF: el text dibuixat dues vegades ──
const it = (str, x, w, y, h) => ({ str, width: w, transform: [h || 11, 0, 0, h || 11, x, y || 453] });
const casPdf = H => { const f = fantasmes(H); if (!f) return null; const s = its => f(its).map(i => i.str).join('|');
  return { titol: s([it('5.06', 55.3, 20.6), it('M2.', 81, 18.4), it('2', 90.3, 6.5), it('COLOCACIÓN PAVIMENTO', 101.8, 126.6), it('CO OCAC Ó', 101.8, 56.7), it('A', 174.6, 6.9), it('O', 221.2, 7.2)]),
    doble: s([it('01.01', 44.4, 15.7, 419, 6.4), it('PA', 89.3, 8.4, 419, 6.4), it('01.01', 44.4, 15.7, 419, 6.4), it('PA', 89.3, 8.4, 419, 6.4), it('Els', 104.4, 10.1, 400, 6.4), it('Els', 104.4, 10.1, 400, 6.4), it('treballs', 120, 22.6, 400, 6.4)]),
    respecta: s([it('Los', 104.4, 10.1), it('trabajos', 120, 22.6), it('.......................', 60, 200), it('12,50', 120, 20), it('m2', 300, 10), it('2', 305, 5, 459, 7), it('Ho han fet amb mètodes', 100, 110, 300), it('a', 205, 5, 300), it('COLOCACIÓN', 400, 60, 280), it('CZ', 400, 10, 280)]) }; };

// la nota lliure s'acaba a la capçalera de la partida de sota, també amb «.-» («6.6.- REIXA…») i amb número sol («66 Ud. de…»)
const NL = { es: ['6.5.- BARANDILLA DE ACERO GALVANIZADO', 'Barandilla de acero galvanizado de 1,10 m de altura.', 'TOTAL PARTIDA 109,38 Ml', 'NOTA: Se comprobará la solución de replanteo por parte de la empresa constructora,', 'para presupuestar la obra.', '6.6.- REJA DE PROTECCIÓN EN VENTANAS', 'Reja de protección de acero con pletinas verticales.', 'TOTAL PARTIDA 9,00 Ud'],
  ca: ['65 Ud. de col·locació d\'arqueta a peu de baixant, hermètica', 'i registrable. 2', 'Nota: Es disposaran registres de manera que els trams no superin els 15 m.', '66 Ud. de col·locació d\'arqueta general sifònica a l\'entrada de l\'edifici. 1'] };
const casNl = (H, id) => { const E = eines(H); if (!E) return null; const r = E._marcaNotesDocument(NL[id].join('\n')); return { b: r.blocs.join(' | '), seg: r.text.indexOf(id === 'es' ? '6.6.- REJA' : '66 Ud. de col') >= 0 }; };
// ── 5) partida al capítol que no toca i còpia de més (LOT 22b) ──
const FC = { es: { c: ['01 CERRAJERÍA', '02 SEGURIDAD Y SALUD'], p: [['1.1', 'REJA DE PROTECCIÓN EN VENTANAS DE PLANTA BAJA', '6'], ['1.2', 'BARANDILLA DE ACERO GALVANIZADO', '40,32'], ['1.3', 'ESCALERA DE MANTENIMIENTO DE CUBIERTA', '8'], ['2', 'SEGURIDAD Y SALUD EN OBRA', '1']] },
  ca: { c: ['CAPÍTOL 1 - SERRALLERIA', 'CAPÍTOL 2 - SEGURETAT I SALUT'], p: [['1.1', 'REIXA DE PROTECCIÓ A FINESTRES DE PLANTA BAIXA', '6'], ['1.2', 'BARANA D\'ACER GALVANITZAT', '40,32'], ['1.3', 'ESCALA DE MANTENIMENT DE COBERTA', '8'], ['2.1', 'SEGURETAT I SALUT A L\'OBRA', '1']] } };
// variant: 'falta' (la lectura no porta el capítol 2) · 'be' · 'dup' (la 1.2 dues vegades) · 'bessona' (el document té la 1.2 dues vegades i la lectura també)
const casFc = (H, id, v) => { const E = eines(H); if (!E || !E.marcaForaDeCapitolICopies) return null; const c = FC[id], L = [], R = [{ tipo: 'cap', desc: c.c[0] }]; L.push(c.c[0]);
  c.p.forEach((p, i) => { if (i === 3) { L.push(c.c[1]); if (v !== 'falta') R.push({ tipo: 'cap', desc: c.c[1] }); } const rep = (v === 'dup' || v === 'bessona') && i === 1 ? 2 : 1;
    for (let k = 0; k < (v === 'bessona' && i === 1 ? 2 : 1); k++) L.push(p[0] + '.- ' + p[1], 'Text de la partida / texto de la partida.', 'TOTAL PARTIDA ' + p[2]);
    for (let k = 0; k < rep; k++) R.push({ tipo: 'part', desc: p[0] + '.- ' + p[1] + '\n- Text de la partida.', ut: 'ud', amid: 1 }); });
  const av = []; E.marcaForaDeCapitolICopies(R, L.join('\n'), av); const ps = R.filter(r => r.tipo === 'part');
  return { fora: ps.filter(r => /FUERA DE SU CAPÍTULO|FORA DEL SEU CAPÍTOL/.test(String(r.flag))).length, rep: ps.filter(r => /PARTIDA REPETIDA/.test(String(r.flag))).length, roig: av.filter(a => /^⚠⚠/.test(a)).length }; };
const totes = H => { const o = {}; for (const id of ['es', 'ca']) { o['opc_' + id] = casOpc(H, id); o['peu_' + id] = casPeu(H, id); o['zn_' + id] = casZn(H, id); o['nl_' + id] = casNl(H, id); for (const v of ['falta', 'be', 'dup', 'bessona']) o['fc_' + v + '_' + id] = casFc(H, id, v); } o.pdf = casPdf(H); o._H = H; return o; };
const proves = o => { const R = [];
  for (const id of ['es', 'ca']) { const p = o['opc_' + id], q = o['peu_' + id], z = o['zn_' + id];
    R.push(['[' + id + '] 1 · «OPCIÓN 2» / «OPCIÓ B» / «OPCIONS»: les partides del capítol no sumen; el capítol de sobre, «RECEPCIÓN» i «ADOPCIÓN» sí', !!p && JSON.stringify(p.gta) === '["","opc","opc","",""]', p && JSON.stringify(p.gta)]);
    R.push(['[' + id + '] 1 · i ho diu un avís', !!p && /OPCIONAL/.test(p.av), p && p.av.slice(0, 80)]);
    R.push(['[' + id + '] 2 · peu amb mòbil / Tlf. / Telèfon i fila de títols reconeguts (i «TOTAL PARTIDA», «DE LA PARTIDA» o una frase no)', !!q && q.peu && q.col && q.noCol, q && JSON.stringify([q.peu, q.col, q.noCol])]);
    R.push(['[' + id + '] 2 · fora del text: el peu, la fila de títols i els títols de la taula de mesura; la frase «… total» es queda', !!q && q.netPeu && q.netCol && q.netMes && q.frase, q && JSON.stringify(q.d)]);
    R.push(['[' + id + '] 3 · el títol de la zona de sota no entra a l\'última partida (ni el número sol)', !!z && z.zona, z && JSON.stringify(z.d)]);
    R.push(['[' + id + '] 3 · el títol del capítol de sota tampoc i la frase final sense punt es queda (amb el text del document, sense «Ud» davant)', !!z && z.capPint && z.fi && z.fi2 && z.senseUt5, z && JSON.stringify(z.d)]);
    R.push(['[' + id + '] 3 · la NOTA lliure surt del text i va a sota com a nota visible', !!z && z.notaFora && z.notaSota, z && JSON.stringify(z.d)]);
    R.push(['[' + id + '] 3 · la lectura amb la unitat al davant («m2 …») queda amb el text del document', !!z && z.senseUt, z && JSON.stringify(z.d)]); }
  for (const id of ['es', 'ca']) { const n = o['nl_' + id]; R.push(['[' + id + '] 3 · la nota lliure s\'acaba a la capçalera de la partida de sota («6.6.- …», «66 Ud. …»)', !!n && n.seg && /^(?:NOTA|Nota):/.test(n.b) && !/REJA|sifònica/.test(n.b), n && JSON.stringify(n)]); }
  for (const id of ['es', 'ca']) { const f1 = o['fc_falta_' + id], f2 = o['fc_be_' + id], f3 = o['fc_dup_' + id], f4 = o['fc_bessona_' + id];
    R.push(['[' + id + '] 5 · la lectura se salta el capítol 2: la partida del capítol 2 queda marcada i avís vermell', !!f1 && f1.fora === 1 && f1.roig === 1, f1 && JSON.stringify(f1)]);
    R.push(['[' + id + '] 5 · amb el capítol 2 a la lectura, cap marca ni cap vermell', !!f2 && !f2.fora && !f2.rep && !f2.roig, f2 && JSON.stringify(f2)]);
    R.push(['[' + id + '] 5 · la lectura porta la 1.2 dues vegades i el document una: la de més marcada i avís vermell', !!f3 && f3.rep === 1 && f3.roig === 1, f3 && JSON.stringify(f3)]);
    R.push(['[' + id + '] 5 · el document escriu la 1.2 dues vegades i la lectura també: cap marca', !!f4 && !f4.rep && !f4.roig, f4 && JSON.stringify(f4)]); }
  R.push(['5 · es mira abans de treure el número dels capítols', /try\{ marcaForaDeCapitolICopies\(allRows,amidament,allAvisos\); \}catch\(_\)\{\}[^\n]*\n\s*\/\/ 24\/09 · el codi de capítol de l'arquitecte/.test(o._H || '')]);
  const d = o.pdf;
  R.push(['4 · lector: «5.06 M2. COLOCACIÓN PAVIMENTO» sense les lletres de la còpia', !!d && d.titol === '5.06|M2.|COLOCACIÓN PAVIMENTO', d && d.titol]);
  R.push(['4 · lector: «01.01 PA» i «Els treballs» una sola vegada', !!d && d.doble === '01.01|PA|Els|treballs', d && d.doble]);
  R.push(['4 · lector: el que no és còpia es queda (xifres sobre una línia de punts, un «2» més petit, una paraula que només cau dins de l\'amplada d\'una altra)', !!d && d.respecta === 'Los|trabajos|.......................|12,50|m2|2|Ho han fet amb mètodes|a|COLOCACIÓN|CZ', d && d.respecta]);
  return R; };
const PECES = [
  ['capítol «OPCIÓN n»', '||_RE_CAP_OPCIO.test(String(r.desc||"").split("\\n")[0]);continue;}', ';continue;}'],
  ['peu amb mòbil i «Tlf.»', '|\\b[6-9]\\d{2}(?:[\\s.]\\d{2}){3}\\b|\\bTel\\b|\\bT(?:e?lf|lfn|fno|el[eéè]fono?)\\b|www', '|\\bTel\\b|www'],
  ['fila de títols de columna', '.filter((l,k)=>!(k>0&&_esCapcaleraColumnes(l)))', ''],
  ['títols de la taula de mesura al final de la línia', '.map((l,k)=>k>0?_senseCapcaleraMesuraAlFinal(l):l)', ''],
  ['la numeració sense signe a la línia de títol', 'if(!(_es(sl)||(sl2!==t&&_es(sl2))))continue;', 'if(!(_es(sl)))continue;'],
  ['la NOTA lliure darrere la quantitat', '&&_notaLliure(i);', '&&false;'],
  ['la partida al capítol que no toca', 'if(ok.length>=2&&(P.length-ok.length)*2<=ok.length&&multi.length>=P.length*0.5) for(const x of P){', 'if(false) for(const x of P){'],
  ['la còpia de més que el document', 'if(!doc||g.rs.length<=doc)continue;', 'continue;'],
  ['les vegades que ho escriu el document', 'if(!doc||g.rs.length<=doc)continue;\n    for(const r of g.rs.slice(doc)){', 'if(g.rs.length<=1)continue;\n    for(const r of g.rs.slice(1)){'],
  ['la crida abans de treure el número dels capítols', 'try{ marcaForaDeCapitolICopies(allRows,amidament,allAvisos); }catch(_){}', ''],
  ['la nota lliure s\'acaba a «6.6.-»', '(?:\\.\\d{1,3})*\\.?[-–)]*\\s|[a-z]', '(?:\\.\\d{1,3})*\\.?\\s|[a-z]'],
  ['la frase final que porta la lectura', 'if(Math.abs(vq-(+amid))<0.005&&tt.length>=12&&/[a-zà-ÿ]{3}/.test(tt)&&_cleanLit(descIA).toLowerCase().indexOf(tt)>=0) return s.trim();', ''],
  ['la frase final arriba amb la quantitat', 'const _litBrut=_titolAmbSalt(S,ini,loc[i],end,r.desc,r.amid),', 'const _litBrut=_titolAmbSalt(S,ini,loc[i],end,r.desc),'],
  ['la unitat al davant de la lectura', 'if(_ambColUt&&!_etiq){ r.desc=String(r.desc).slice(_ambColUt); d=_cleanLit(r.desc); }', ''],
  ['el lector: el tros dins d\'un altre', 'const its=_superindex(_senseFantasmes(its0));', 'const its=_superindex(its0);'],
  ['el lector: la prova de les lletres en ordre', 'return j===a.length; };', 'return true; };'],
  ['el lector: la còpia comença on hi ha la seva lletra', 'if(Math.abs(b.x0+j*w-a.x0)<=tol&&sub(a.s,net(s.slice(j)))) return true;', 'return true;'],
];
const base = proves(totes(H0)); base.forEach(([n, c, x]) => check(n, c, x));
for (const [nom, de, a] of PECES) {
  const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
  let p2 = null; try { p2 = proves(totes(H)); } catch (e) { p2 = null; }
  check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k][1] && !x[1]));
}
console.log('\n' + ok + ' OK · ' + ko + ' fallades');
process.exit(ko ? 1 : 0);
