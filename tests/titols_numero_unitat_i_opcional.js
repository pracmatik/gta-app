#!/usr/bin/env node
'use strict';
/*
 * Guardià · TÍTOLS SENSE EL NÚMERO NI LA UNITAT, L'OPCIONAL A PART, ELS COMPONENTS AMB LA PARTIDA I L'AVÍS DE FORMAT UNA SOLA VEGADA (LOT 21, 11/10/2026).
 * Mesurat amb les lectures de pagament de l'11/10 (10 documents seus):
 *  1) des del LOT 18m el text arriba «1 M² de montaje…» (el lector junta «M»+«2»): el títol sortia «1 M² DE MONTAJE…» o una paraula d'un parèntesi
 *     («(piedra)» › «PIEDRA») en 21 de 32 partides d'un document. Ara el número i la unitat es treuen del títol i del principi del text (com fins al 18l),
 *     també «28 Ud. (marco…)», i una línia seguida de «(pintura) en los…» no és un títol del document;
 *  2) el text d'una partida que el reparador completa del document s'acaba on comença l'OPCIONAL sense codi que el motor ha posat a part;
 *  3) en canviar a mà la quantitat d'una partida composta, els components que anaven a la quantitat d'abans la segueixen (l'import es mou i es diu);
 *  4) l'app diu al motor «excel_transcrit» (l'Excel es copia cel·la a cel·la) i «format_ja_avisat» (un tros d'abans ja ha tornat el format com a no
 *     reconegut): així l'avís intern de format no reconegut no surt fals ni un per tros;
 *  5) cada peça trencada es veu. Català i castellà, documents inventats.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(f => fs.existsSync(f));
const H0 = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n + (x ? '  → ' + x : '')); } };
const trenca = (src, de, a) => { const s = src.replace(de, a); return s === src ? null : s; };
const fnDe = (H, n) => { const s0 = H.indexOf('function ' + n + '('); if (s0 < 0) return null; let i = H.indexOf('{', s0), d = 0; for (; i < H.length; i++) { if (H[i] === '{') d++; else if (H[i] === '}') { d--; if (d === 0) break; } } return H.slice(s0, i + 1); };
const eines = H => { try { const b = H.match(/\/\/ ==== INICI EINES DE LECTURA ====([\s\S]*?)\/\/ ==== FI EINES DE LECTURA ====/)[1];
  return new Function('IDIOMA', fnDe(H, '_dehyphen') + '\nconst parseNum=' + /const parseNum=(.*?);\n/s.exec(H)[1] + ';function num2(v){return v}const eur=v=>v+" €";\n' + b +
    '\nreturn {_titolCurt,_esTitolDelDocument,titolsSenseCodi,titolCurtSiFalta,titolPartitPelSalt,guioDavantDelText,repairDescsFromSource};')('ca'); } catch (e) { return null; } };
const compost = H => { try { const f = fnDe(H, 'componentsSegueixenLaPartida'); return f ? new Function(f + '\nreturn componentsSegueixenLaPartida;')() : null; } catch (e) { return null; } };
const marques = H => { try { const mi = fnDe(H, 'marquesIngesta'), tf = fnDe(H, 'tfetch'); if (!mi || !tf || !/_MARQUES_INGESTA=marquesIngesta\(file\.name,typeof _excelFix!=="undefined"&&!!_excelFix\);/.test(H)) return null;
  return fetch => new Function('fetch', 'INGESTA_URL', 'let _MARQUES_INGESTA=null;\n' + mi + '\nasync ' + tf + '\nreturn {set:(f,x)=>{_MARQUES_INGESTA=marquesIngesta(f,x);}, tfetch};')(fetch, 'U'); } catch (e) { return null; } };
const l1 = r => String(r.desc).split('\n')[0];

// ── documents inventats (llista numerada «N unitat text … quantitat», com el de 32 partides) ──
const LL = {
  es: [['M²', 'de montaje, amortización y desmontaje de andamio metálico tubular, incluyendo todas las piezas', 'especiales para el correcto montaje y los medios auxiliares correspondientes.', '192,00'],
    ['M²', 'de limpieza en superficies delicadas (piedra), mediante abrasivos especiales para proyección tipo', 'silicato de aluminio o vidrio granulado, consistente en la proyección de dichas partículas.', '57,00'],
    ['M²', 'Eliminación mediante decapado y/o medios mecánicos-manuales, del revestimiento de acabado', '(pintura) en los paramentos verticales, para dejar el estuco de cal visto.', '74,00'],
    ['M²', 'Se rehará el revestimiento anteriormente saneado mediante la aplicación de un mortero tradicional', 'de cal, aplicando el cromatismo mediante pigmentos minerales. Igualando formas y texturas originales.', '15,00'],
    ['Ud.', '(marco en hueco balconera): Lijado superficial por la cara exterior y aplicación de lasur.', '', '8,00'],
    ['M²', 'de aplicación de pintura al silicato previa base de una capa de fondo fijador.', '', '74,00'], ['Ml.', 'En la barandilla de coronación de obra, regularización de la base y colocación de rasillas', 'cerámicas con vierteaguas con doble goterón en el perímetro exterior.', '9,60'],
    ['M²', 'de saneado mediante el repicado de las grietas de las losas de los balcones (frentes y bajos).', '', '24,30']],
  ca: [['M²', 'de muntatge, amortització i desmuntatge de bastida metàl·lica tubular, incloent-hi totes les peces', 'especials per al correcte muntatge i els mitjans auxiliars corresponents.', '192,00'],
    ['M²', 'de neteja de superfícies delicades (pedra), amb abrasius especials per a projecció tipus', 'silicat d\'alumini o vidre granulat, que consisteix en la projecció d\'aquestes partícules.', '57,00'],
    ['M²', 'Eliminació amb decapat i/o mitjans mecànics-manuals, del revestiment d\'acabat', '(pintura) dels paraments verticals, per deixar l\'estuc de calç vist.', '74,00'],
    ['Ml.', 'Reparació de cantells de balcons amb morter de reparació estructural i armadures passivades,', 'incloent-hi la neteja i la retirada de runa a l\'abocador autoritzat.', '12,50'],
    ['Ud.', '(marc en forat de balconera): Polit superficial per la cara exterior i aplicació de lasur.', '', '8,00'],
    ['M²', 'd\'aplicació de pintura al silicat amb una capa prèvia de fons fixador.', '', '74,00'], ['Ml.', 'A la barana de coronament d\'obra, regularització de la base i col·locació de rajoles', 'ceràmiques amb goteró doble al perímetre exterior.', '9,60'],
    ['M²', 'de sanejat amb el repicat de les esquerdes de les llosanes dels balcons (fronts i sotabalcons).', '', '24,30']] };
const docLL = c => ['PARTIDA DESCRIPCIÓ QUANTITAT', 'a.1.- Façana'].concat(...c.map((p, i) => [(i + 1) + ' ' + p[0] + ' ' + p[1]].concat(p[2] ? [p[2] + ' ' + p[3]] : []).map((x, k, A) => (!p[2] && k === 0) ? x + ' ' + p[3] : x))).join('\n');
const lectLL = c => [{ tipo: 'cap', desc: 'a.1.- Façana' }].concat(c.map((p, i) => ({ tipo: 'part', num: '1.' + (i + 1), desc: (i + 1) + ' ' + p[0] + ' ' + p[1] + (p[2] ? '\n' + p[2] : ''), ut: /^M²/.test(p[0]) ? 'm²' : /^Ml/.test(p[0]) ? 'ml' : 'ud', amid: +p[3].replace(',', '.'), preu: 0 })));
function titols(E, id) {
  const rows = lectLL(LL[id]); E.titolsSenseCodi(rows, docLL(LL[id])); E.titolCurtSiFalta(rows); E.titolPartitPelSalt(rows); E.guioDavantDelText(rows);
  return rows.filter(r => r.tipo === 'part');
}
// ── l'OPCIONAL a part: el text de la de dalt no se l'empassa ──
const OP = {
  es: { et: 'OPCIONAL', txt: ['ESTADO DE MEDICIONES', '2.3 ALBAÑILERÍA', '2.3.1 m2 Picado de revestimiento existente en muros perimetrales de patios con medios manuales. 40,00', '2.3.2 m Colocación de piezas cerámicas cubremuros con goterón en remates de muros perimetrales. 27,00',
    '2.3.3 m2 Sellado y grapado de grietas mediante junta flexible de mortero sintético de resinas epoxi.', 'Acabado superficial con mortero de características y granulado similar al existente. 12,00',
    'OPCIONAL Según se determine el estado del muro y su solidez se procederá a la reconstrucción de la', 'm2 parte dañada con ladrillo cerámico macizo con acabado a buena vista con mortero de cal en', 'ambas caras, en lugar del grapado 12,80',
    '2.3.4 m2 Saneado y revoco a buena vista de cara exterior de muretes laterales de patios centrales 18,90', '2.3.5 m2 Impermeabilización de cubierta sobre áticos con mortero especial armado con malla. 50,00'] },
  ca: { et: 'OPCIÓ', txt: ['ESTAT D\'AMIDAMENTS', '1.4 PALETERIA', '1.4.1 m2 Repicat del revestiment existent dels murs perimetrals dels patis amb mitjans manuals. 40,00', '1.4.2 m Col·locació de peces ceràmiques de coronament amb goteró als remats dels murs perimetrals. 27,00',
    '1.4.3 m2 Segellat i grapat d\'esquerdes amb junta flexible de morter sintètic de resines epoxi.', 'Acabat superficial amb morter de característiques i granulat semblant a l\'existent. 12,00',
    'OPCIÓ Segons es determini l\'estat del mur i la seva solidesa es procedirà a la reconstrucció de la', 'm2 part malmesa amb maó ceràmic massís amb acabat a bona vista amb morter de calç a les', 'dues cares, en lloc del grapat 12,80',
    '1.4.4 m2 Sanejat i arrebossat a bona vista de la cara exterior dels murets laterals dels patis 18,90', '1.4.5 m2 Impermeabilització de la coberta dels àtics amb morter especial armat amb malla. 50,00'] } };
function opcional(E, id) {
  const c = OP[id], T = c.txt, rows = [{ tipo: 'cap', desc: T[1] }];
  const p = (k, a) => ({ tipo: 'part', num: '', desc: a, ut: 'm²', amid: 0, preu: 0 });
  rows.push(p(2, T[2].replace(/ 40,00$/, '')), p(3, T[3].replace(/ 27,00$/, '')), Object.assign(p(4, T[4]), { amid: 12 }), { tipo: 'sub', desc: 'MORTER', ut: 'm²', amid: 12, preu: 20 },
    Object.assign(p(6, T[6] + ' ' + T[7].replace(/^m2 /, '') + ' ' + T[8].replace(/ 12,80$/, '') + ' (NO SUMA AL TOTAL)'), { amid: 12.8 }), p(9, T[9].replace(/ 18,90$/, '')), p(10, T[10].replace(/ 50,00$/, '')));
  E.repairDescsFromSource(rows, T.join('\n'), []); return rows.filter(r => r.tipo === 'part')[2];
}
// ── components d'una compost en canviar la quantitat a mà ──
function components(F) { const rs = [{ tipo: 'part', amid: 12.8 }, { tipo: 'sub', amid: 13, preu: 22 }, { tipo: 'sub', amid: 13, preu: 105 }, { tipo: 'sub', amid: 0.25, preu: 10 }, { tipo: 'part', amid: 13 }, { tipo: 'sub', amid: 13 }];
  const n = F(rs, 0, 13); return { n, q: rs.map(r => r.amid) }; }
// ── les marques que l'app envia al motor ──
async function enviades(M) {
  const cossos = [], resp = [{ amidaments: { format_reconegut: false } }, { amidaments: { format_reconegut: true } }, {}, {}];
  const fetchM = async (u, o) => { cossos.push(JSON.parse(o.body)); const d = resp[cossos.length - 1] || {}; return { status: 200, json: async () => d }; };
  const A = M(fetchM); A.set('obra.pdf', false);
  for (let i = 0; i < 3; i++) await (await A.tfetch('U', { token: 't', amidament: 'x' + i, filename: 'obra.pdf' }, 1000, null)).json();
  await (await A.tfetch('U', { token: 't', amidament: 'z', filename: 'altre.pdf' }, 1000, null)).json();   // una altra lectura (un altre fitxer): sense marques
  const pdf = cossos.splice(0); const B = M(fetchM); B.set('obra.xlsx', true); await (await B.tfetch('U', { token: 't', amidament: 'y', filename: 'obra.xlsx' }, 1000, null)).json();
  return { pdf, xl: cossos };
}
async function totes(H) {
  const E = eines(H), F = compost(H), M = marques(H), o = { E: !!E, F: !!F, M: !!M };
  if (E) { o.es = titols(E, 'es'); o.ca = titols(E, 'ca'); o.tc = { es: E._titolCurt('3 M² de limpieza en superficies delicadas (piedra), mediante abrasivos especiales'), ca: E._titolCurt('12 Ml. Reparació de cantells de balcons amb morter de reparació'), pa: E._titolCurt('1 P.A. de montaje y desmontaje de protecciones en planta baja'), par: [E._titolCurt('3 M² (piedra) 40 x 40 cm, de 3 cm'), E._titolCurt('12 M² (pedra) 40 x 40 cm, de 3 cm')] };
    o.etd = E._esTitolDelDocument('4 M² Eliminación mediante decapado y/o medios mecánicos-manuales, del revestimiento de acabado', '(pintura) en los paramentos verticales, para dejar el estuco visto.');
    o.op = { es: opcional(E, 'es'), ca: opcional(E, 'ca') }; }
  if (F) o.comp = components(F);
  if (M) o.env = await enviades(M);
  return o;
}
const proves = o => {
  const R = [['trobo les eines de lectura, la funció dels components i les marques de la crida al motor', o.E && o.F && o.M]];
  for (const id of ['es', 'ca']) { const P = o[id] || [];
    R.push(['[' + id + '] 1 · cap títol comença pel número o la unitat del document', P.length === 8 && P.every(r => !/^\s*\d/.test(l1(r)) && !/^(M²|M2|ML|UD)\b/i.test(l1(r))), P.map(l1).join(' | ')]);
    R.push(['[' + id + '] 1 · cap títol és una paraula sola d\'un parèntesi («' + (id === 'es' ? 'PIEDRA' : 'PEDRA') + '»)', P.length === 8 && !/^(piedra|pedra)$/i.test(l1(P[1]).trim()) && /neteja|limpieza/i.test(l1(P[1]))]);
    R.push(['[' + id + '] 1 · el text de sota tampoc no comença pel número i la unitat (com el document sense la seva numeració)', P.length === 8 && P.every(r => !/\n-?\s*\d+\s+(M²|Ml\.?|Ud\.?)\s/.test(String(r.desc)))]);
    R.push(['[' + id + '] 1 · una línia seguida de «(pintura) …» no és el títol del document: el títol és curt', P.length === 8 && l1(P[2]).split(/\s+/).length <= 6 && /^(eliminación|eliminació)/i.test(l1(P[2]))]);
    R.push(['[' + id + '] 2 · el text de la partida s\'acaba on comença l\'' + OP[id].et + ' que va a part', o.op && o.op[id] && String(o.op[id].desc).indexOf(OP[id].et) < 0 && !/12,00\s*$/.test(String(o.op[id].desc)) && /(existente|existent)\.?$/.test(String(o.op[id].desc).trim())]); }
  R.push(['1 · _titolCurt: «3 M² de limpieza … (piedra)» › «limpieza en superficies delicadas»', o.tc && /^limpieza/i.test(o.tc.es), o.tc && o.tc.es]);
  R.push(['1 · _titolCurt: «12 Ml. Reparació de cantells…» › «Reparació de cantells…»', o.tc && /^Reparació de cantells/.test(o.tc.ca), o.tc && o.tc.ca]);
  R.push(['1 · _titolCurt: «1 P.A. de montaje…» › «montaje…»', o.tc && /^montaje/i.test(o.tc.pa), o.tc && o.tc.pa]);
  R.push(['1 · una paraula sola d\'un parèntesi no és títol («3 M² (piedra) 40 x 40 cm…», «12 M² (pedra)…»)', o.tc && o.tc.par.every(x => !/^(piedra|pedra)$/i.test(String(x).trim())), o.tc && JSON.stringify(o.tc.par)]);
  R.push(['1 · «… del revestimiento de acabado ⏎ (pintura) en los …» no és un títol del document', o.etd === false]);
  R.push(['3 · components a la quantitat d\'abans de la partida (13) passen a la nova (12,80); el de per unitat i les altres partides no es toquen', o.comp && o.comp.n === 2 && JSON.stringify(o.comp.q) === '[12.8,12.8,12.8,0.25,13,13]', o.comp && JSON.stringify(o.comp)]);
  R.push(['4 · PDF: el primer tros va sense marques; després d\'un format no reconegut, «format_ja_avisat» als següents', o.env && !o.env.pdf[0].format_ja_avisat && !o.env.pdf[0].excel_transcrit && o.env.pdf[1].format_ja_avisat === true && o.env.pdf[2].format_ja_avisat === true && !o.env.pdf[3].format_ja_avisat, o.env && JSON.stringify(o.env.pdf)]);
  R.push(['4 · Excel transcrit: «excel_transcrit» a la crida', o.env && o.env.xl[0] && o.env.xl[0].excel_transcrit === true]);
  return R;
};
const PECES = [
  ['el número i la unitat fora del títol curt', '.replace(/^\\d{1,4}\\s+(?=', '.replace(/^\\d{9999}\\s+(?='],
  ['«M²» a la capçalera del títol', 'l1=String(l1==null?"":l1).replace(/^(\\s*\\d{1,4}(?:\\.\\d{1,3})*\\.?\\s+)M([²³])(?=[\\s.]|$)/,"$1m$2");', ''],
  ['«(» darrere el número i la unitat', '/^(?:[A-Za-zÀ-ÿ]|\\(\\s*[A-Za-zÀ-ÿ])/.test(cua)', '/^[A-Za-zÀ-ÿ]/.test(cua)'],
  ['«(pintura)» continua la línia', 'if(/^\\(?\\s*[a-zà-ÿ]/.test(String(seg).trim())) return false;', 'if(/^[a-zà-ÿ]/.test(String(seg).trim())) return false;'],
  ['paraula sola d\'un parèntesi', 'if(bons(p)<2&&_dinsParentesi.has(frase.trim().toLowerCase())) continue;', ''],
  ['el text s\'acaba a l\'OPCIONAL', 'if(p>=0&&p<fi) fi=p; } }', '} }'],
  ['components amb la partida', 'if(Math.abs((+rs[j].amid)-vell)<1e-9){ rs[j].amid=nou; n++; }', ''],
  ['marca excel_transcrit', 'if(excel) o.excel_transcrit=true;', ''],
  ['marca format_ja_avisat', 'if(d&&d.amidaments&&d.amidaments.format_reconegut===false) ja=true;', ''],
  ['les marques només per al fitxer que es llegeix', '&&b.filename===fitxer', ''],
  ['la càrrega posa les marques del document', '_MARQUES_INGESTA=marquesIngesta(file.name,', '_MARQUES_INGESTA=null&&marquesIngesta(file.name,'],
];
(async () => {
  const o = await totes(H0); const base = proves(o); base.forEach(([n, c, x]) => check(n, c, x));
  for (const [nom, de, a] of PECES) {
    const H = trenca(H0, de, a); check('(la prova és vàlida: «' + nom + '» es pot treure)', !!H); if (!H) continue;
    let p2 = null; try { p2 = proves(await totes(H)); } catch (e) { p2 = null; }
    check('sense «' + nom + '» → es veu', !p2 || p2.some((x, k) => base[k][1] && !x[1]));
  }
  console.log('\n' + ok + ' OK · ' + ko + ' fallades');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e.stack); process.exit(1); });
