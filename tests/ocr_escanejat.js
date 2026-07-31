#!/usr/bin/env node
'use strict';
/*
 * GUARDIÀ DE L'OCR DE PDFs ESCANEJATS (25/07/2026, 2a iteració — la 1a es va retirar el mateix dia).
 *
 * El que va passar i el que aquest guardià impedeix que torni a passar:
 *  · 1a iteració: es passava el LLENÇ directament al motor → les taules sortien brossa («CA CD Cn»).
 *    Diagnòstic en local: el motor llegia la MATEIXA imatge perfecta com a fitxer. Causa = camí d'entrada.
 *  · La cura té dues potes, i aquest guardià vigila TOTES DUES amb el codi REAL de l'app:
 *      1) sempre s'encodifica el llenç a PNG (toBlob) abans de reconèixer — mai el llenç directament;
 *      2) _ocrNeteja esborra la graella de la taula i binaritza — amb això, el banc de proves llegeix
 *         6/6 quantitats i 8/8 paraules tant a l'escaneig NET com al TORÇAT amb soroll i JPEG.
 *
 * Part FUNCIONAL: executa el motor de veritat (tesseract.js, el mateix paquet que carrega el navegador)
 * sobre els 2 escanejos fixos de tests/fixtures_ocr/, aplicant primer la _ocrNeteja EXTRETA de l'app.
 * Llistó: totes les quantitats EXACTES i ≥7/8 paraules a cadascun. Si el motor no està instal·lat
 * (npm i), el test FALLA amb un avís clar — mai s'omet en silenci.
 *
 * Ús: node tests/test_ocr_escanejat.js [ruta_html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML_PATH) { console.error('X no trobo app_gta.html'); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---------- 1) CABLEJAT: les decisions de disseny no poden desaparèixer en un refactor ----------
console.log('— cablejat dins de l\'app —');
check('el motor es carrega amb empremta de seguretat (SRI) des del CDN', /OCR_SRC=/.test(html) && /OCR_SRI="sha384-/.test(html));
check('el llenç SEMPRE s\'encodifica a PNG abans de reconèixer (toBlob) — mai el llenç directament',
  /cv\.toBlob\(r,"image\/png"\)/.test(html) && /worker\.recognize\(blob,/.test(html) && !/worker\.recognize\(cv[,)]/.test(html));
check('_ocrNeteja s\'aplica als píxels abans de reconèixer (fora graelles + binaritzat)',
  /_ocrNeteja\(im\.data,cv\.width,cv\.height\)/.test(html) && /putImageData\(im,0,0\)/.test(html));
check('l\'OCR és OPT-IN: el tècnic ho ha de demanar amb un confirm que diu el que és',
  /window\._OCR_DEMANAT&&confirm\(/.test(html) && /Ho intentem\?/.test(html));
check('el permís es demana a CADA pujada (reset a doUpload)', /window\._OCR_DEMANAT=false;window\._OCR_FET=null;/.test(html));
check('el resultat va SEMPRE marcat: avís OCR al capdamunt amb les pàgines afectades',
  /TEXT RECONEGUT SOBRE IMATGE \(OCR\)/.test(html) && /allAvisos\.unshift/.test(html.slice(html.indexOf('TEXT RECONEGUT') - 400, html.indexOf('TEXT RECONEGUT'))));
check('només es reconeixen les pàgines SENSE text (les que en tenen es llegeixen del document)',
  /_lastTextPages\.indexOf\(p\)<0\)_sense\.push\(p\)/.test(html));
check('el worker es tanca sempre (finally + terminate) — un document llarg no deixa el motor penjat',
  /finally \{ try\{await worker\.terminate\(\);\}catch\(_\)\{\} \}/.test(html));
check('el mode de segmentació és el 3 (automàtic) — el 6 per defecte del motor destrossa les taules',
  /setParameters\(\{tessedit_pageseg_mode:"3"\}\)/.test(html));

// ---------- 2) FUNCIONAL: el motor de veritat sobre els 2 escanejos fixos ----------
function extractFunction(src, name) {
  const patterns = [new RegExp('(async\\s+)?function\\s+' + name + '\\s*\\('), new RegExp('const\\s+' + name + '\\s*=')];
  for (const pat of patterns) {
    const m = pat.exec(src); if (!m) continue;
    const b = src.indexOf('{', m.index); if (b === -1) continue;
    let d = 0, i = b;
    for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
    return src.slice(m.index, i);
  }
  return null;
}
let PNGlib = null, Tess = null;
try { PNGlib = require('pngjs').PNG; Tess = require('tesseract.js'); } catch (_) {}
if (!PNGlib || !Tess) {
  check('FUNCIONAL OMÈS: falten tesseract.js/pngjs (npm i) — el guardià NO pot verificar la lectura', false);
  console.log(ko === 0 ? ('\n== OCR OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
  process.exit(1);
}
const sb = { console, isFinite, Math, parseFloat, Number, String, Array, Object, JSON, Uint8Array };
vm.createContext(sb);
const srcNeteja = extractFunction(html, '_ocrNeteja');
const srcLinies = extractFunction(html, '_ocrLinies');
if (!srcNeteja || !srcLinies) { console.error('X no trobo _ocrNeteja/_ocrLinies al HTML'); process.exit(1); }
new vm.Script(srcNeteja + '\n' + srcLinies, { filename: 'ocr.js' }).runInContext(sb);

const QTY = [['240,00', 2], ['252,50', 1], ['96,40', 2], ['310,80', 1]];
const WORDS = ['bastida', 'Lloguer', 'Xarxa', 'Repicat', 'Arrebossat', 'Pintat', 'CAPITOL 1', 'CAPITOL 2'];
const FIX = path.join(__dirname, 'fixtures_ocr');

(async () => {
  console.log('\n— lectura real (motor tesseract.js, el mateix paquet que el navegador) —');
  const cache = path.join(__dirname, '..', 'node_modules', '.cache', 'tesseract');
  fs.mkdirSync(cache, { recursive: true });
  const worker = await Tess.createWorker(['spa', 'cat'], 1, { cachePath: cache });
  await worker.setParameters({ tessedit_pageseg_mode: '3' }); // el MATEIX mode que fixa l'app
  for (const f of ['escaneig_net.png', 'escaneig_advers.png']) {
    const png = PNGlib.sync.read(fs.readFileSync(path.join(FIX, f)));
    sb._d = png.data; sb._w = png.width; sb._h = png.height;
    new vm.Script('_ocrNeteja(_d,_w,_h)').runInContext(sb); // la MATEIXA neteja que fa l'app al llenç
    const buf = PNGlib.sync.write(png); // i el MATEIX camí: sempre com a fitxer PNG
    const t0 = Date.now();
    const r = await worker.recognize(buf, {}, { blocks: true, text: true });
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    const t = String(r.data.text || '');
    let qOk = 0, qTot = 0;
    for (const [num, cops] of QTY) { qTot += cops; qOk += Math.min((t.match(new RegExp(num, 'g')) || []).length, cops); }
    const w = WORDS.filter(x => t.indexOf(x) >= 0).length;
    console.log('  · ' + f + ' → ' + seg + 's · confiança ' + Math.round(r.data.confidence) + ' · quantitats ' + qOk + '/' + qTot + ' · paraules ' + w + '/' + WORDS.length);
    check(f + ' · TOTES les quantitats surten EXACTES (' + qTot + '/' + qTot + ')', qOk === qTot);
    check(f + ' · les descripcions es llegeixen (≥7/8 paraules)', w >= 7);
    // i les línies porten posició (la columna esquerra distingeix un capítol d'una partida)
    sb._data = r.data;
    const linies = new vm.Script('_ocrLinies(_data,3.5)').runInContext(sb);
    check(f + ' · _ocrLinies torna línies amb posició', Array.isArray(linies) && linies.length >= 8 && linies.every(l => typeof l.x === 'number' && l.t));
  }
  await worker.terminate();
  console.log(ko === 0 ? ('\n== OCR ESCANEJAT OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error('X ERROR: ' + e.message); process.exit(1); });
