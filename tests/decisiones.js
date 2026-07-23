// test_decisiones.js — guardià del detector de decisions (aprenentatge v2)
// Verifica detectaDecisions(): la funció que, en signar, detecta les decisions del tècnic
// (coeficient + diferències amb l'esborrany de la IA) per preguntar-ne el perquè.
// Dades 100% fictícies (alias): mai dades reals de client en aquest fitxer.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML_PATH = process.argv[2] || ["app_gta.html", "index.html"].map(f => path.join(__dirname, "..", f)).find(fs.existsSync);
if (!HTML_PATH) { console.error("✗ No trobo app_gta.html ni index.html"); process.exit(1); }
const html = fs.readFileSync(HTML_PATH, "utf8");

// extreu una funció per nom comptant claus (mateix patró que la resta de l'arnès)
function extractFn(name) {
  const start = html.indexOf("function " + name + "(");
  if (start < 0) throw new Error("funció no trobada: " + name);
  let i = html.indexOf("{", start), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") { depth--; if (depth === 0) return html.slice(start, j + 1); }
  }
  throw new Error("claus desquadrades a " + name);
}

const ctx = {};
vm.createContext(ctx);
vm.runInContext(extractFn("_dKey") + "\n" + extractFn("detectaDecisions"), ctx);
const detecta = ctx.detectaDecisions;

let ok = 0, ko = 0;
function check(nom, cond, extra) {
  if (cond) { ok++; console.log("  ✓ " + nom); }
  else { ko++; console.error("  ✗ " + nom + (extra ? " — " + extra : "")); }
}

const P = (num, desc, preu, amid) => ({ tipo: "part", num, desc, preu, amid, ut: "m2" });

// 1 · sense esborrany IA (pressupost manual): només la decisió del coeficient
{
  const d = detecta(null, [P("1.1", "Partida Alfa", 100, 2)], 1.15);
  check("manual → només coeficient", d.length === 1 && d[0].tipo === "coeficiente" && d[0].detalle.valor === 1.15, JSON.stringify(d));
}

// 2 · esborrany i final idèntics: només coeficient
{
  const rows = [P("1.1", "Partida Alfa", 100, 2), P("1.2", "Partida Beta", 50, 4)];
  const d = detecta(rows, JSON.parse(JSON.stringify(rows)), 1.05);
  check("sense canvis → només coeficient", d.length === 1 && d[0].tipo === "coeficiente");
}

// 3 · partida eliminada (clau única): es detecta amb el resum correcte
{
  const draft = [P("1.1", "Partida Alfa", 100, 2), P("1.2", "Bastida Obra-X", 800, 3)];
  const final = [P("1.1", "Partida Alfa", 100, 2)];
  const d = detecta(draft, final, 1);
  const e = d.find(x => x.tipo === "partida_eliminada");
  check("eliminada detectada", !!e && e.detalle.num === "1.2" && e.detalle.preu === 800 && e.detalle.amid === 3, JSON.stringify(d));
}

// 4 · partida afegida
{
  const draft = [P("1.1", "Partida Alfa", 100, 2)];
  const final = [P("1.1", "Partida Alfa", 100, 2), P("9.9", "Seguretat i salut", 300, 1)];
  const d = detecta(draft, final, 1);
  const a = d.find(x => x.tipo === "partida_agregada");
  check("afegida detectada", !!a && a.detalle.num === "9.9", JSON.stringify(d));
}

// 5 · preu modificat: abans/després exactes
{
  const draft = [P("2.1", "Impermeabilització", 72, 10)];
  const final = [P("2.1", "Impermeabilització", 88.5, 10)];
  const d = detecta(draft, final, 1);
  const m = d.find(x => x.tipo === "precio_modificado");
  check("preu modificat amb abans/després", !!m && m.detalle.abans === 72 && m.detalle.despres === 88.5, JSON.stringify(d));
}

// 6 · codis NO únics (àmbit = actuació): claus repetides s'EXCLOUEN del diff — mai una decisió falsa
{
  const draft = [P("3.1", "Coberta bloc A", 100, 1), P("3.1", "Coberta bloc B", 200, 1), P("4.1", "Partida única", 50, 1)];
  const final = [P("3.1", "Coberta bloc A", 100, 1), P("4.1", "Partida única", 50, 1)];
  const d = detecta(draft, final, 1);
  check("clau duplicada exclosa (cap falsa eliminada)", !d.some(x => x.tipo === "partida_eliminada"), JSON.stringify(d));
}

// 7 · exhaustiu (22/07, petició d'Albert): fins a 15 diffs + coef, prioritzats per € (el més gros primer).
//     Abans es capava a 3 i es perdia el gruix del criteri de Marina. Ara, amb ≤15, no se'n tira cap.
{
  const draft = [P("1.1", "A", 10, 1), P("1.2", "B", 5000, 2), P("1.3", "C", 20, 1), P("1.4", "D", 900, 1), P("1.5", "E", 30, 1)];
  const final = []; // el tècnic ho treu tot
  const d = detecta(draft, final, 1);
  const elim = d.filter(x => x.tipo === "partida_eliminada");
  check("5 diffs (≤15) → cap no en tira: 5 eliminades + coef", d.length === 6 && elim.length === 5, JSON.stringify(elim.map(x => x.detalle.num)));
  check("prioritzat per €: la de 10.000 € surt primer", !!elim[0] && elim[0].detalle.num === "1.2", JSON.stringify(elim.map(x => x.detalle.num)));
}

// 7b · el tope nou és 15: amb 20 diffs, se'n queden les 15 més cares (no infinit)
{
  const draft = [], final = [];
  for (let k = 0; k < 20; k++) draft.push(P("8." + k, "P" + k, (k + 1) * 100, 1));
  const d = detecta(draft, final, 1);
  const elim = d.filter(x => x.tipo === "partida_eliminada");
  check("20 diffs → tope de 15", elim.length === 15, "n=" + elim.length);
}

// 8 · files que no són partides (cap/sec/sub) s'ignoren
{
  const draft = [{ tipo: "cap", desc: "CAPÍTOL U" }, P("1.1", "Alfa", 100, 1), { tipo: "sub", desc: "sub", preu: 5, amid: 1 }];
  const final = [P("1.1", "Alfa", 100, 1)];
  const d = detecta(draft, final, 1);
  check("cap/sub ignorats", d.length === 1 && d[0].tipo === "coeficiente", JSON.stringify(d));
}

// 9 · tolerància de cèntims: 0,005 € no és un canvi de preu
{
  const draft = [P("5.1", "Partida cèntims", 100.001, 1)];
  const final = [P("5.1", "Partida cèntims", 100.004, 1)];
  const d = detecta(draft, final, 1);
  check("micro-diferència de preu ignorada", !d.some(x => x.tipo === "precio_modificado"), JSON.stringify(d));
}

// 10 · partida sense codi: s'aparella pel títol (1a línia de la descripció)
{
  const draft = [P("", "Partida sense codi\ndetall llarg", 100, 1)];
  const final = [P("", "Partida sense codi\naltre detall", 150, 1)];
  const d = detecta(draft, final, 1);
  const m = d.find(x => x.tipo === "precio_modificado");
  check("aparellament per títol sense codi", !!m && m.detalle.abans === 100 && m.detalle.despres === 150, JSON.stringify(d));
}

console.log(ko === 0 ? `\nDECISIONS OK — ${ok}/${ok + ko} verds` : `\nDECISIONS FALLA — ${ko} vermells`);
process.exit(ko === 0 ? 0 : 1);
