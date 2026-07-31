#!/usr/bin/env node
'use strict';
/*
 * Guardià CAP DOCUMENT SURT SENSE DEIXAR RASTRE (30/07/2026).
 *
 * Per què neix. El criteri 4 de l'Acta d'Acceptació diu que s'ha de poder treballar de principi a fi
 * DINS del sistema. El principi hi era —crear, desar, signar queden escrits al llibre d'activitat— però
 * el final no: mesurat el 30/07 sobre les 111 anotacions reals del llibre, **zero** eren d'una
 * exportació. Els quatre documents que el client rep de veritat (CSV per a la intranet, Excel final,
 * PDF i la carta amb el full de fotos) sortien i no en quedava constància enlloc. El cicle es completava
 * fora del sistema, i el que no queda escrit no es pot demostrar.
 *
 * La primera versió d'aquest guardià, escrita el mateix matí, PROMETIA caçar qualsevol exportació nova i
 * en realitat només coneixia tres maneres d'escriure-la. Es va provar amb vuit exportacions noves fetes
 * de maneres normals i corrents (posar l'atribut de descàrrega en comptes d'assignar-lo, obrir la
 * finestra amb el document directament, escriure-hi el document a mà, cridar la impressió des de dins
 * del mòdul, i fins i tot substituir la porta bona per una de falsa): les vuit passaven en verd amb un
 * fitxer sortint sense rastre. Això és exactament el que la llei de la casa prohibeix — arreglar l'avui
 * i quedar-se curt demà. Aquesta versió comprova la CAPACITAT d'entregar, no la sintaxi:
 *
 *   A) S'inventaria tot allò que un navegador pot fer servir per posar un document a mans d'algú
 *      (guardar al disc, crear l'enllaç al fitxer, obrir finestra, escriure-hi, imprimir, navegar-hi,
 *      enviar un correu). CADA aparició ha d'estar dins d'una de les tres portes que anoten, o
 *      declarada aquí baix amb el seu motiu escrit i el nombre de vegades que hi pot sortir. Una
 *      aparició nova, escrita com sigui, surt en vermell.
 *   B) Les tres portes s'executen DE VERITAT, una per una i amb cada tipus de document, i es comprova
 *      que el llibre anota el document que ha sortit i no un altre.
 *   C) El llibre no pot certificar el que no ha arribat: si la pestanya s'ha tancat, no s'anota.
 *   D) I el registre no pot bloquejar el client, ni tan sols en el cas que va originar tota la feina
 *      (exportar sense haver desat, amb la base de dades caiguda).
 *
 * Comprovat el 30/07 que mossega: 15 maneres diferents de trencar el rastre, totes en vermell.
 *
 * Límit honest, escrit perquè ningú el descobreixi de cop: si algú munta el nom de l'atribut de
 * descàrrega dins d'una variable (`const k="download"; a[k]=nom`), cap comprovació que llegeixi el codi
 * ho pot veure. Això no és una exportació escrita de bona fe: és ofuscació deliberada. El que aquest
 * guardià garanteix és que no s'escapi ningú que hi afegeixi una exportació treballant normal.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
const html = fs.readFileSync(HTML, 'utf8');

let ok = 0, ko = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); if (extra) console.error('     ' + extra); } };
function troba(decl) {
  const i = html.indexOf(decl);
  if (i < 0) return null;
  let d = 0, k = html.indexOf('{', i);
  for (; k < html.length; k++) { const c = html[k]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { k++; break; } } }
  return { ini: i, fi: k, cos: html.slice(i, k) };
}
const linia = i => html.slice(0, i).split('\n').length;

// ================= A) NO ES POT ENTREGAR RES PER FORA =================
const H = {
  baixada: troba('function lliuraBaixada('),
  finestra: troba('function lliuraFinestra('),
  impressio: troba('function lliuraImpressio('),
};
check('A1 · hi ha les tres úniques portes de sortida de documents', !!(H.baixada && H.finestra && H.impressio));
const cosExp = troba('async function logExport('), cosHist = troba('async function logHist(');
check('A2 · i el lloc que escriu al llibre', !!(cosExp && cosHist));
if (!H.baixada || !H.finestra || !H.impressio || !cosExp || !cosHist) { console.log('\n' + ok + '/' + (ok + ko) + '  ' + ko + ' MALAMENT'); process.exit(1); }

// Tot allò que serveix per posar un document a mans d'algú. Es busca la CAPACITAT, no la manera d'escriure-la.
const CAPACITATS = [
  ['guardar un fitxer al disc', /\.download\s*=|\[\s*["']download["']\s*\]\s*=|setAttribute\(\s*["']download["']/g],
  ['crear l\'enllaç al fitxer', /URL\.createObjectURL\s*\(/g],
  ['obrir una finestra', /window\.open\s*\(/g],
  ['escriure dins d\'una altra finestra', /\.document\.write\s*\(/g],
  ['imprimir', /\.print\s*\(\s*\)|printHtmlDoc\s*\(/g],
  ['navegar cap a un document o un correu', /location(?:\.href)?\s*=\s*(?:URL\.createObjectURL|["'](?:blob:|data:|mailto:))|location\.(?:assign|replace)\s*\(/g],
  ['enviar un correu', /mailto:/g],
];
// Les úniques aparicions permeses FORA de les portes. Cadascuna amb el seu motiu i les vegades que hi pot
// sortir: si demà n'apareix una més, encara que sigui escrita igual, aquest guardià surt en vermell.
const DECLARADES = [
  ['window.open("","_blank"); ', 4, 'obre la pestanya BUIDA en el moment del clic (si s\'obrís després, el navegador la bloquejaria). El document hi arriba per la porta que anota; una pestanya buida no entrega res.'],
  ['.document.write(html);w.do', 1, 'motor intern del camí de reserva d\'impressió, al qual només s\'hi arriba per la porta que anota.'],
  ['.document.write(\'<!doctype', 2, '31/07/2026 · la pantalla d\'espera i el missatge d\'error de la pestanya. Escriuen TEXT NOSTRE (un "Preparant el document…" i un avís en vermell), mai un document del client: no entreguen res i per això no anoten res. Neixen perquè la tècnica va rebre dues pestanyes en blanc i mudes; una pestanya buida ja no pot tornar a existir.'],
  ['printHtmlDoc(html){ const', 1, 'la declaració d\'aquest mateix motor.'],
  ['.print();},150);}); } /* ', 1, 'la impressió dins d\'aquest motor.'],
  ['.print(): capçalera i peu ', 1, 'apareix dins d\'un comentari explicatiu, no és codi.'],
  ['location.replace(location.', 1, 'recarrega l\'aplicació quan n\'hi ha una versió nova. No entrega cap document.'],
  ['location.href="mailto:"+en', 1, '🔴 FORAT CONEGUT (30/07/2026): «Obrir al correu» de les peticions de preu a industrials obre el correu del tècnic i NO deixa cap rastre ni desa la petició. Reportat a Albert el 30/07; el comportament correcte (donar-la per enviada o no) l\'ha de decidir el client. Mentre no es decideixi, queda escrit aquí perquè ningú ho doni per resolt.'],
  ['mailto:"+encodeURIComponen', 1, 'la mateixa línia del forat de dalt.'],
];
const vistes = Object.create(null), forat = [];
for (const [què, re] of CAPACITATS) {
  re.lastIndex = 0; let m;
  while ((m = re.exec(html))) {
    if ([H.baixada, H.finestra, H.impressio].some(h => m.index >= h.ini && m.index < h.fi)) continue;
    const clau = html.slice(m.index, m.index + 26).replace(/\s+/g, ' ');
    if (DECLARADES.some(d => d[0] === clau)) { vistes[clau] = (vistes[clau] || 0) + 1; continue; }
    forat.push(què + ' → línia ' + linia(m.index) + ': ' + JSON.stringify(clau));
  }
}
check('A3 · cap manera d\'entregar un document viu fora de les portes que anoten', forat.length === 0,
  forat.join('\n     ') + '\n     → o passa per una porta (i queda anotada), o s\'escriu a la llista de declarades amb el seu motiu');
const compte = DECLARADES.filter(d => (vistes[d[0]] || 0) !== d[1]);
check('A4 · les excepcions declarades segueixen sent exactament les que hi havia', compte.length === 0,
  compte.map(d => JSON.stringify(d[0]) + ': declarades ' + d[1] + ', trobades ' + (vistes[d[0]] || 0)).join(' · '));
check('A5 · les tres portes anoten l\'exportació',
  /logExport\(/.test(H.baixada.cos) && /logExport\(/.test(H.finestra.cos) && /logExport\(/.test(H.impressio.cos));
check('A6 · s\'anota DESPRÉS d\'entregar (si l\'anotació peta, el fitxer ja ha sortit)',
  H.baixada.cos.indexOf('.click()') < H.baixada.cos.indexOf('logExport(') &&
  H.finestra.cos.indexOf('location.href') < H.finestra.cos.indexOf('logExport(') &&
  H.impressio.cos.indexOf('printHtmlDoc') < H.impressio.cos.indexOf('logExport('));
// una porta reassignada més avall deixaria el guardià analitzant una funció que ja no s'executa
const reasg = ['lliuraBaixada', 'lliuraFinestra', 'lliuraImpressio', 'logExport', 'logHist']
  .filter(n => new RegExp('(?<!function\\s)\\b' + n + '\\s*=[^=]').test(html));
check('A7 · cap porta es pot substituir per una altra més avall', reasg.length === 0, 'reassignades: ' + reasg.join(', '));

// ================= B) ELS DOCUMENTS QUE REP EL CLIENT =================
let fosc = html; for (const h of [H.baixada, H.finestra, H.impressio]) fosc = fosc.slice(0, h.ini) + ' '.repeat(h.fi - h.ini) + fosc.slice(h.fi);
const tipus = [...fosc.matchAll(/lliura(?:Baixada|Finestra|Impressio)\([^;]*?"([a-z]+)"\s*\)/g)].map(m => m[1]);
const ESPERATS = ['csv', 'excel', 'pdf', 'carta', 'fotos'];
check('B1 · tots els documents que surten cap al client passen per una porta que anota',
  ESPERATS.every(x => tipus.includes(x)), 'trobats: ' + [...new Set(tipus)].join(', '));
check('B2 · i cap entrega es queda sense dir QUÈ ha sortit', tipus.length >= 8 && tipus.every(Boolean),
  tipus.length + ' entregues etiquetades (n\'hi ha d\'haver 8: els 5 documents + els 3 camins de reserva)');
const cosNom = troba('function expNom(');
check('B3 · cada document té nom llegible als dos panells (un tipus nou no pot sortir en clau tècnica)',
  !!cosNom && [...new Set(tipus)].every(x => new RegExp('[{,]' + x + ':').test(cosNom.cos)),
  cosNom ? 'sense nom: ' + [...new Set(tipus)].filter(x => !new RegExp('[{,]' + x + ':').test(cosNom.cos)).join(', ') : 'no hi ha expNom');
check('B4 · el llibre no rebutjarà cap anotació per llarga (la BD talla a 60)',
  [...new Set(tipus)].every(x => ('export_' + x).length <= 60));

// ================= C) EXECUTAT DE VERITAT =================
const cosTot = troba('function totLlibre(');
function banc(opts) {
  opts = opts || {};
  const escrit = [], avisos = [], entregat = [];
  const finestra = { closed: !!opts.finestraTancada, location: {} };
  Object.defineProperty(finestra.location, 'href', {
    set(v) { if (finestra.closed) return; entregat.push('finestra:' + v); if (opts.tancaEnAssignar) finestra.closed = true; }, get() { return ''; }
  });
  const sb = {
    Object, String, Array, console, Promise, JSON, URL: { createObjectURL: () => 'blob:x' },
    IDIOMA: 'ca', // l'app sempre en té un; la porta el fa servir per posar el nom del document a la pestanya
    rows: [{ desc: 'PARET', preu: 10 }], HEADER: { obra: 'OBRA DE PROVA' },
    ME: { id: 'usr-1', nombre: 'Tècnica' },
    CURRENT: opts.desat ? { id: 'pres-1' } : null,
    coef: () => 1.05, computeTotal: () => 220,
    opcioLletres: opts.senseOpcions ? () => { throw new Error('no n\'hi ha'); } : () => (opts.opcions || []),
    totalPerOpcio: (r, X) => ({ A: 150, B: 170 })[X],
    eur: v => (typeof v === 'number' ? v.toFixed(2) + ' €' : ''),
    toast: (m, err) => avisos.push({ m, err: !!err }),
    t: k => k,
    document: { createElement: () => ({ click: () => entregat.push('baixada') }) },
    GTA_CARTA: { printHtmlDoc: () => { if (opts.popupBlocked) throw new Error('popup_blocked'); entregat.push('impressio'); } },
    sb: {
      from: taula => ({
        insert: async r => {
          if (opts.dbPeta) throw new Error('network down');
          if (opts.dbNega) return { error: { message: 'new row violates row-level security policy' } };
          escrit.push({ taula, r }); return { error: null };
        }
      })
    },
  };
  vm.createContext(sb);
  // expNom entra al banc perquè des del 31/07 la porta de la finestra el fa servir per posar-li nom
  // llegible al document dins la pestanya i al botó de baixada.
  new vm.Script([cosHist.cos, cosExp.cos, cosNom ? cosNom.cos : '', H.baixada.cos, H.finestra.cos, H.impressio.cos, cosTot ? cosTot.cos : ''].join('\n')).runInContext(sb);
  return { sb, escrit, avisos, entregat, finestra };
}

(async () => {
  // --- C1: cada porta anota EL document que ha sortit, no un altre ---
  const PORTES = [
    ['csv', b => b.sb.lliuraBaixada({}, 'OBRA_intranet.csv', 'csv'), 'OBRA_intranet.csv'],
    ['excel', b => b.sb.lliuraBaixada({}, 'OBRA_final.xlsx', 'excel'), 'OBRA_final.xlsx'],
    ['pdf', b => b.sb.lliuraFinestra(b.finestra, {}, 'pdf'), ''],
    ['carta', b => b.sb.lliuraFinestra(b.finestra, {}, 'carta'), ''],
    ['fotos', b => b.sb.lliuraFinestra(b.finestra, {}, 'fotos'), ''],
    ['pdf', b => b.sb.lliuraImpressio('<html></html>', 'pdf'), ''],
    ['carta', b => b.sb.lliuraImpressio('<html></html>', 'carta'), ''],
    ['fotos', b => b.sb.lliuraImpressio('<html></html>', 'fotos'), ''],
  ];
  let malament = [];
  for (const [t, fer, fitxer] of PORTES) {
    const b = banc({ desat: true });
    fer(b); await new Promise(r => setTimeout(r, 0));
    const f = b.escrit[0] && b.escrit[0].r;
    if (!f || f.accion !== 'export_' + t || !f.snapshot.export || f.snapshot.export.tipus !== t || f.snapshot.export.fitxer !== fitxer || b.entregat.length !== 1)
      malament.push(t + ' → ' + JSON.stringify({ anotat: f && f.accion, tipus: f && f.snapshot.export && f.snapshot.export.tipus, fitxer: f && f.snapshot.export && f.snapshot.export.fitxer, entregues: b.entregat.length }));
  }
  check('C1 · les 8 entregues executades: cadascuna anota el SEU document i el seu fitxer', malament.length === 0, malament.join('\n     '));

  // --- C2: qui, quina obra, quants diners ---
  let b = banc({ desat: true });
  await b.sb.logExport('excel', 'OBRA_final.xlsx');
  let f = b.escrit[0] && b.escrit[0].r;
  check('C2 · diu QUI, de QUINA obra i per QUANTS diners (l\'evidència del cicle complet)',
    !!f && f.usuario_id === 'usr-1' && f.usuario_nombre === 'Tècnica' && f.presupuesto_id === 'pres-1' &&
    f.snapshot.header.obra === 'OBRA DE PROVA' && f.snapshot.total === 220,
    JSON.stringify(f && { u: f.usuario_nombre, p: f.presupuesto_id, tot: f.snapshot.total }));
  check('C3 · i no molesta el tècnic quan tot va bé', b.avisos.length === 0);

  // --- C4: amb opcions A/B, el € anotat ha de ser un dels IMPRESOS ---
  b = banc({ desat: true, opcions: ['A', 'B'] });
  await b.sb.logExport('pdf', '');
  const ex = b.escrit[0].r.snapshot.export;
  check('C4 · amb opcions A/B s\'anota el total de CADA opció (el document no imprimeix mai la suma)',
    Array.isArray(ex.opcions) && ex.opcions.length === 2 && ex.opcions[0].total === 150 && ex.opcions[1].total === 170,
    JSON.stringify(ex.opcions));
  check('C5 · i el panell ensenya aquests i no la suma, que no surt a cap document',
    !!cosTot && b.sb.totLlibre(b.escrit[0].r) === 'A 150.00 € · B 170.00 €' &&
    b.sb.totLlibre({ snapshot: { total: 220 } }) === '220.00 €',
    cosTot ? b.sb.totLlibre(b.escrit[0].r) : 'no hi ha el pas del llibre al panell');

  // --- C6: pressupost ENCARA NO DESAT: el forat que hi havia ---
  b = banc({ desat: false });
  await b.sb.logExport('pdf', '');
  check('C6 · exportar SENSE haver desat també queda escrit (abans es perdia)',
    b.escrit.length === 1 && b.escrit[0].r.accion === 'export_pdf' && b.escrit[0].r.presupuesto_id === null,
    JSON.stringify(b.escrit[0] && b.escrit[0].r.presupuesto_id));
  check('C7 · i el llibre distingeix que encara no estava desat', b.escrit[0].r.snapshot.export.desat === false);

  // --- C8: les altres anotacions de sempre no s'han tocat ---
  b = banc({ desat: true });
  await b.sb.logHist('pres-1', 'desat');
  check('C8 · desar, signar i reobrir segueixen anotant-se igual que abans',
    b.escrit.length === 1 && b.escrit[0].r.accion === 'desat' && Array.isArray(b.escrit[0].r.snapshot.rows));

  // ================= D) EL LLIBRE NO POT CERTIFICAR EL QUE NO HA ARRIBAT =================
  for (const [nom, opts] of [['la pestanya ja era tancada', { finestraTancada: true }], ['el tècnic la tanca pel camí', { tancaEnAssignar: true }]]) {
    b = banc(Object.assign({ desat: true }, opts));
    const r = b.sb.lliuraFinestra(b.finestra, {}, 'pdf');
    await new Promise(r2 => setTimeout(r2, 0));
    check('D · «' + nom + '»: NO s\'anota cap entrega', r === false && b.escrit.length === 0, 'anotacions: ' + b.escrit.length);
    check('D · «' + nom + '»: i es diu que no s\'ha entregat res',
      b.avisos.length === 1 && b.avisos[0].err === true && b.avisos[0].m === 'exp_finestra_tancada', JSON.stringify(b.avisos));
  }
  // si el navegador no ha deixat obrir la pestanya, no hi ha finestra on abocar res
  b = banc({ desat: true });
  let petada = false, res = null;
  try { res = b.sb.lliuraFinestra(null, {}, 'pdf'); } catch (_) { petada = true; }
  await new Promise(r => setTimeout(r, 0));
  check('D3 · sense pestanya (el navegador l\'ha bloquejat): ni peta ni anota, i es diu',
    !petada && res === false && b.escrit.length === 0 && b.avisos.length === 1 && b.avisos[0].m === 'exp_finestra_tancada',
    JSON.stringify({ petada, res, anotacions: b.escrit.length, avisos: b.avisos }));

  b = banc({ desat: true, popupBlocked: true });
  let llancat = false;
  try { b.sb.lliuraImpressio('<html></html>', 'carta'); } catch (_) { llancat = true; }
  await new Promise(r => setTimeout(r, 0));
  check('D5 · si el navegador bloqueja la finestra, el llibre NO diu que s\'ha exportat', llancat && b.escrit.length === 0, 'anotacions: ' + b.escrit.length);

  // ================= E) EL REGISTRE NO POT BLOQUEJAR EL CLIENT =================
  // inclòs el cas que va originar la feina: encara no desat I la base de dades el rebutja
  for (const [nom, opts] of [
    ['la base de dades diu que no', { desat: true, dbNega: true }],
    ['no hi ha connexió', { desat: true, dbPeta: true }],
    ['encara no desat i la base de dades diu que no', { desat: false, dbNega: true }],
    ['encara no desat i sense connexió', { desat: false, dbPeta: true }],
  ]) {
    b = banc(opts);
    let petat = false;
    try { b.sb.lliuraBaixada({}, 'OBRA_intranet.csv', 'csv'); } catch (_) { petat = true; }
    await new Promise(r => setTimeout(r, 0));
    check('E · «' + nom + '»: el fitxer surt IGUALMENT', !petat && b.entregat.length === 1, JSON.stringify(b.entregat));
    check('E · «' + nom + '»: i el tècnic s\'assabenta que no ha quedat registrat',
      b.avisos.length === 1 && b.avisos[0].err === true && b.avisos[0].m === 'exp_no_registrat', JSON.stringify(b.avisos));
  }

  console.log('\n' + ok + '/' + (ok + ko) + (ko ? '  ' + ko + ' MALAMENT' : '  tot en verd'));
  process.exit(ko ? 1 : 0);
})();
