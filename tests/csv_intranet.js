#!/usr/bin/env node
'use strict';
/*
 * Test del generador CSV de intranet (index.html) — datos 100% ficticios.
 *
 * Verifica las dos reglas confirmadas empíricamente (15-jul-2026):
 *  (A) Candado csvIntranetCheck: en toda fila de partida (ID2 = n.m o n.m.x)
 *      TODAS las celdas van llenas (UNIDAD, MEDIDA, PRECIOUNITARIO, TOTAL);
 *      0,00 se acepta; MEDIDA en formato numérico español.
 *  (B) Convención de partidas compuestas: el padre n.m NO se emite como fila;
 *      solo los hijos n.m.1, n.m.2... con todas sus celdas llenas, y el
 *      subtotal del capítulo queda idéntico (el padre aportaba exactamente
 *      la suma del desglose x coeficiente).
 *
 *  (D) PARTIDA SIN CODIGO (17-jul-2026, tarde): una fila de partida que sale con
 *      ID2 vacio -- y, si viene de una linea de calculo, con la FORMULA por titulo --
 *      NO puede colarse en silencio. El candado la ve y bloquea la exportacion.
 *      Es el patron REAL del Excel de Obra-C (madre "1 PA" sin precio
 *      + lineas de medicion sin codigo propio), reproducido aqui con datos ficticios.
 *      NOTA: la regla csvTitolFill (que reescribia el titulo de los 'sub' con forma
 *      "Concepto: formula") se RETIRO el 17/07: era codigo muerto -- los datos reales
 *      no llegan como 'sub' sino como 'part' sin codigo. Ver comentario en la app.
 *
 * Extrae las funciones reales del HTML igual que regres.js.
 *
 * Uso: node tests/csv_intranet.js [ruta_a_app_gta.html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
const html = fs.readFileSync(HTML_PATH, 'utf8');

function extract(name) {
  const pats = [new RegExp('function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of pats) {
    const m = pat.exec(html);
    if (!m) continue;
    const bs = html.indexOf('{', m.index);
    if (bs === -1) continue;
    let d = 0, i = bs;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (ch === '{') d++;
      else if (ch === '}') { d--; if (d === 0) { i++; break; } }
    }
    if (pat === pats[1] && html[i] === ';') i++;
    return html.slice(m.index, i);
  }
  throw new Error('funcion no encontrada en el HTML: ' + name);
}

const NAMES = ['num2', 'subsOf', 'unitPrice', 'isNoSuma', 'isSenseCoef', 'rowGross', 'pctBase', 'pctBaseAt',
  'comma', 'csvUnit', 'sanitizeRows', 'csvBuildLines', 'csvIntranetCheck'];
const sb = { console, isFinite, Math, parseFloat, Number, String, Array, Object };
vm.createContext(sb);
new vm.Script(NAMES.map(extract).join('\n'), { filename: 'csv_engine.js' }).runInContext(sb);

let fail = 0;
const ck = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL'), msg); if (!cond) fail++; };

// --- (B) generador: caso construido, datos ficticios ------------------------
const raw = [
  { tipo: 'cap', desc: '1 CAPITULO PRUEBA' },
  { tipo: 'part', num: '1.1', desc: 'Partida compuesta', ut: 'pa', amid: 1 },
  { tipo: 'sub', desc: 'Desglose A', ut: 'm2', amid: 10, preu: 25.5 },
  { tipo: 'sub', desc: 'Desglose B', ut: 'ud', amid: 2, preu: 100 },
  { tipo: 'part', num: '1.2', desc: 'Partida normal', ut: 'm2', amid: 5, preu: 10 },
  { tipo: 'part', num: '1.3', desc: 'Partida incluida en 1.2', ut: 'ud', amid: 1, preu: 0, estat: 'inclosa', estatRef: '1.2' },
  { tipo: 'part', num: '1.4', desc: 'Compuesta con sub sin amidamiento', ut: 'pa', amid: 1 },
  { tipo: 'sub', desc: 'Trabajos varios', ut: '', amid: 3, preu: 7 },
  { tipo: 'sub', desc: 'Nota de calculo vacia', ut: '', amid: '', preu: 0 },
];
const rows = sb.sanitizeRows(raw);
const c = 1.2;
const L = sb.csvBuildLines(rows, c, 'OBRA TEST', 'G00.000');
const lines = L.map(l => l.split(';'));
const find = id2 => lines.filter(f => f[1] === id2);

ck(find('1.1').length === 0, 'padre compuesto 1.1 NO se emite como fila');
ck(find('1.4').length === 0, 'padre compuesto 1.4 NO se emite como fila');
const h11 = find('1.1.1')[0], h12 = find('1.1.2')[0];
ck(!!h11 && !!h12, 'hijos 1.1.1 y 1.1.2 presentes');
ck(h11 && h11[3] === 'm²' && h11[4] === '10,00' && h11[5] === '30,60' && h11[6] === '306,00',
  '1.1.1 con todas las celdas llenas: ' + (h11 && h11.slice(3, 7).join('|')));
ck(h12 && h12[3] === 'ud' && h12[4] === '2,00' && h12[5] === '120,00' && h12[6] === '240,00',
  '1.1.2 con todas las celdas llenas: ' + (h12 && h12.slice(3, 7).join('|')));
const h41 = find('1.4.1')[0], h42 = find('1.4.2')[0];
ck(h41 && h41[3] === 'ud' && h41[4] === '3,00' && h41[5] === '8,40' && h41[6] === '25,20',
  '1.4.1: sub sin unidad hereda "ud": ' + (h41 && h41.slice(3, 7).join('|')));
ck(h42 && h42[3] === 'ud' && h42[4] === '1,00' && h42[5] === '0,00' && h42[6] === '0,00',
  '1.4.2: sub sin amidamiento -> 1,00 x 0,00 (el motor le atribuye 0): ' + (h42 && h42.slice(3, 7).join('|')));
const p12 = find('1.2')[0];
ck(p12 && p12[3] === 'm²' && p12[4] === '5,00' && p12[5] === '12,00' && p12[6] === '60,00',
  'partida normal 1.2 intacta: ' + (p12 && p12.slice(3, 7).join('|')));
const p13 = find('1.3')[0];
ck(p13 && p13[5] === '0,00' && p13[6] === '0,00',
  'partida inclosa 1.3 intacta a 0,00: ' + (p13 && p13.slice(3, 7).join('|')));
const sub = lines.find(f => f[2].startsWith('SUBTOTAL CAP'));
ck(sub && sub[6] === '631,20', 'subtotal de capitulo identico al motor: ' + (sub && sub[6]));
const tot = lines.find(f => f[2] === 'TOTAL PRESUPUESTO');
ck(tot && tot[6] === '631,20', 'total documento: ' + (tot && tot[6]));
const kidsSum = lines.filter(f => /^\d+\.\d+\.\d+$/.test(f[1]))
  .reduce((a, f) => a + parseFloat(f[6].replace(/\./g, '').replace(',', '.')), 0);
ck(Math.abs(kidsSum - (546 + 25.2)) < 0.005,
  'la suma impresa de los hijos cuadra exactamente con el importe de sus padres: ' + kidsSum.toFixed(2));

// --- (C) regla del guion en el titulo de partida ---------------------------
// Confirmada en vivo (17-jul-2026): el conversor de la intranet parte el titulo
// de la partida por el primer guion y manda el resto a la descripcion. El guion
// medio (U+2013) no lo parte. Solo se normaliza la 1a linea del titulo de las
// filas de partida: el cuerpo del texto es literal del cliente y no se toca.
const rawG = sb.sanitizeRows([
  { tipo: 'cap', desc: '2 CAPITULO GUION' },
  { tipo: 'part', num: '2.1', desc: 'DESMONTAJE-MONTAJE DE PRUEBA\n- vineta del cuerpo con guion\n- otra linea-mas', ut: 'ud', amid: 1, preu: 10 },
  { tipo: 'part', num: '2.2', desc: 'PINTADO - VELADURA\nsegunda linea', ut: 'm2', amid: 1, preu: 10 },
  { tipo: 'part', num: '2.3', desc: 'PLANTAS 1-2-3-4 PUERTA', ut: 'ud', amid: 1, preu: 10 },
  { tipo: 'part', num: '2.4', desc: 'TITULO SIN GUION', ut: 'ud', amid: 1, preu: 10 },
  { tipo: 'part', num: '2.5', desc: 'COMPUESTA GUION', ut: 'pa', amid: 1 },
  { tipo: 'sub', desc: 'HIJO-CON-GUION', ut: 'ud', amid: 1, preu: 10 },
]);
const LG = sb.csvBuildLines(rawG, 1, 'OBRA-TEST GUION', 'G00.000');
const fg = id2 => (LG.map(l => l.split(';')).filter(f => f[1] === id2)[0] || [])[2] || '';
ck(fg('2.1').startsWith('"DESMONTAJE–MONTAJE DE PRUEBA'), 'guion pegado del titulo -> guion medio: ' + fg('2.1').split('\n')[0]);
ck(fg('2.1').includes('\n- vineta del cuerpo con guion') && fg('2.1').includes('\n- otra linea-mas'),
  'el cuerpo del texto NO se toca (sigue con guion ASCII)');
ck(fg('2.2').startsWith('"PINTADO – VELADURA'), 'guion espaciado del titulo -> guion medio: ' + fg('2.2').split('\n')[0]);
ck(fg('2.3') === 'PLANTAS 1–2–3–4 PUERTA', 'varios guiones en el titulo: ' + fg('2.3'));
ck(fg('2.4') === 'TITULO SIN GUION', 'titulo sin guion: intacto');
ck(fg('2.5.1') === 'HIJO–CON–GUION', 'hijo del desglose tambien normalizado: ' + fg('2.5.1'));
const tpG = LG.map(l => l.split(';')).filter(f => f[0] === 'TP')[0];
ck(tpG && tpG[2] === 'OBRA-TEST GUION', 'el nombre de obra (TP) NO se toca: carga entero con guion ASCII');

// --- (D) PARTIDA SIN CODIGO: el patron REAL, y que NUNCA salga en silencio -----
// Patron real (Excel de Obra-C, 4 casos: 4.1, 4.6, 2.1, 2.5): una madre
// "1 PA" SIN precio seguida de sus lineas de medicion, que llegan al motor como
// 'part' SIN codigo propio (no como 'sub') y con la formula por titulo. Tal cual,
// saldrian al CSV con ID2 VACIO y "Pavimento: (3,57m2 + 4,55m2) x 4" por titulo.
// Antes del 17/07 el candado solo miraba filas con ID2 tipo n.m -> las saltaba y el
// fichero bajaba igual: fallo silencioso. Ahora las ve y bloquea.
// Datos 100% ficticios; reproducen la FORMA de los datos reales, no su contenido.
const rawD = sb.sanitizeRows([
  { tipo: 'cap', desc: '3 CAPITULO DESGLOSE' },
  { tipo: 'part', num: '3.1', desc: 'PARTIDA NORMAL DE PRUEBA', ut: 'm2', amid: 4, preu: 10 },
  // madre "1 PA" sin precio + sus lineas de medicion sin codigo (el patron real):
  { tipo: 'part', num: '', desc: 'Suelo: (2,00m2 + 3,00m2) x 2', ut: 'm2', amid: 10, preu: 50 },
  { tipo: 'part', num: '', desc: ' Rodapie: (1,50ml + 2,50ml) x 2 ', ut: 'ml', amid: 8, preu: 20 },
]);
const LD = sb.csvBuildLines(rawD, 1, 'OBRA TEST DESGLOSE', 'G00.000');
const ld = LD.map(l => l.split(';'));
const huerf = ld.filter(f => f[0] === '' && f[1] === '' && (f[3] || '').trim());

ck(huerf.length === 2, 'D · las 2 lineas sin codigo salen con ID2 VACIO (patron real reproducido): ' + huerf.length);
ck(huerf.some(f => f[2].includes('Suelo:')), 'D · hoy su titulo es la formula (documentado, no deseado)');

// D.1 el candado las VE y bloquea (antes: 0 problemas = silencio)
const fullD = [...LD];
while (fullD.length < 3997) fullD.push(';;;;;;;');
const PD = sb.csvIntranetCheck('﻿' + fullD.join('\r\n') + '\r\n');
const sinCodigo = PD.filter(x => x.tipus === 'sensecodi');
ck(sinCodigo.length === 2,
  'D · el candado CAZA las 2 partidas sin codigo (nunca en silencio): ' + sinCodigo.length + ' de 2');
ck(sinCodigo.every(x => x.fila > 0 && typeof x.desc === 'string'),
  'D · cada aviso lleva su fila y su texto, para que el tecnico la localice');

// D.2 NO grita donde no debe: cabeceras, subtotales, totales y relleno quedan exentos
const limpio = sb.sanitizeRows([
  { tipo: 'cap', desc: '4 CAPITULO LIMPIO' },
  { tipo: 'part', num: '4.1', desc: 'PARTIDA CON CODIGO', ut: 'm2', amid: 2, preu: 10 },
  { tipo: 'part', num: '4.2', desc: 'COMPUESTA CON HIJOS', ut: 'pa', amid: 1 },
  { tipo: 'sub', desc: 'LOCALIZACION PROPIA', ut: 'ud', amid: 1, preu: 30 },
  { tipo: 'sub', desc: '', ut: 'ud', amid: 2, preu: 10 },
]);
const LL = [...sb.csvBuildLines(limpio, 1, 'OBRA LIMPIA', 'G00.000')];
while (LL.length < 3997) LL.push(';;;;;;;');
const PL = sb.csvIntranetCheck('﻿' + LL.join('\r\n') + '\r\n');
ck(PL.length === 0,
  'D · CERO falsos positivos con datos sanos (subtotales, TOTAL, relleno y hijos n.m.x exentos): ' +
  PL.length + (PL.length ? ' [' + PL.map(x => x.tipus + '@f' + x.fila).join(', ') + ']' : ''));

// D.3 el hijo de una compuesta conserva SU titulo (lo que la intranet ya acepto en
// Obra-I: los 11 hijos n.m.x llevan su propia localizacion, no la del padre).
const fl = id2 => ((LL.map(l => l.split(';')).filter(f => f[1] === id2)[0] || [])[2] || '');
ck(fl('4.2.1') === 'LOCALIZACION PROPIA',
  'D · el hijo n.m.x conserva SU titulo, no hereda el del padre (Obra-I validado): ' + fl('4.2.1'));
ck(fl('4.2.2') === '', 'D · hijo con desc vacia: sigue vacio (Obra-I tiene uno asi, y lo aceptaron)');

// candado en verde sobre los bytes exactos que saldrian
const full = [...L];
while (full.length < 3997) full.push(';;;;;;;');
const txt = '﻿' + full.join('\r\n') + '\r\n';
ck(sb.csvIntranetCheck(txt).length === 0, 'csvIntranetCheck en verde sobre el CSV generado');

// --- (A) candado reforzado: unidad/medida obligatorias ----------------------
const H = 'ID1;ID2;TITULO;UNIDAD;MEDIDA;PRECIOUNITARIO;TOTAL;';
const mk = ls => '﻿' + [H, ...ls].join('\r\n') + '\r\n';
const cases = [
  ['fila completa', [';1.1;X;ud;1,00;100,00;100,00;'], 0],
  ['cero aceptado', [';1.2;X;m2;5,00;0,00;0,00;'], 0],
  ['sin UNIDAD', [';1.3;X;;1,00;100,00;100,00;'], 1],
  ['sin MEDIDA', [';1.4;X;ud;;100,00;100,00;'], 1],
  ['MEDIDA no numerica', [';1.5;X;ud;abc;100,00;100,00;'], 1],
  ['MEDIDA negativa', [';1.6;X;ud;-1,00;100,00;100,00;'], 1],
  ['sin precio', [';1.7;X;ud;1,00;;100,00;'], 1],
  ['sin total', [';1.8;X;ud;1,00;100,00;;'], 1],
  ['hija n.m.x sin unidad', [';2.1.1;X;;1,00;50,00;50,00;'], 1],
  ['fila T exenta', ['T;;OBRA;;;;;'], 0],
  ['capitulo exento', ['1;1;CAP;;;;;'], 0],
  ['padding exento', [';;;;;;;'], 0],
  ['partida toda vacia', [';3.1;X;;;;;'], 4],
  // partida sin codigo: ID1 e ID2 vacios pero con unidad/medida -> ya NO pasa en silencio
  ['partida SIN CODIGO', [';;Pavimento: (3,57m2 + 4,55m2) x 4;m²;32,48;23,10;750,29;'], 1],
  ['subtotal exento', [';;SUBTOTAL CAPÍTULO 1;;;;631,20;'], 0],
  ['total documento exento', [';;TOTAL PRESUPUESTO;;;;631,20;'], 0],
];
for (const [n, ls, exp] of cases) {
  const P = sb.csvIntranetCheck(mk(ls));
  ck(P.length === exp, 'candado: ' + n + ' -> ' + P.length + ' problema(s), esperados ' + exp
    + (P.length ? ' [' + P.map(x => x.tipus + ':' + (x.camp || '') + '@f' + x.fila).join(', ') + ']' : ''));
}

console.log('\n== RESULTADO:', fail ? 'HAY FALLOS (' + fail + ')' : 'VERDE', '==');
process.exit(fail ? 1 : 0);
