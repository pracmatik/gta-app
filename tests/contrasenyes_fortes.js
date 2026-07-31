#!/usr/bin/env node
'use strict';
/*
 * GUARDIÀ DE LA POLÍTICA DE CONTRASENYES (25/07/2026).
 * L'estàndard propi de Pracmatik demana contrasenyes de 10 caràcters o més. L'app ja ho exigia quan
 * l'usuari se la canvia ell mateix, però quan un ADMIN donava d'alta o reiniciava algú n'acceptava de 6.
 * Aquest guardià impedeix que torni a passar: comprova el mínim a les 3 portes (missatges, validació de
 * pantalla i el text que veu qui s'equivoca). El servidor ho valida a part (workflow d'Admin Usuaris).
 *
 * Ús: node tests/test_contrasenyes_fortes.js [ruta_html]
 */
const fs = require('fs');
const path = require('path');
const HTML_PATH = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML_PATH) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML_PATH, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

check('el canvi de contrasenya propi segueix demanant 10', /pwd_short/.test(h) && /length<10/.test(h));
// hi ha DOS blocs d'idioma (ca i es): tots dos han de dir 10
const reset = h.match(/um_reset_p:"[^"]*"/g) || [];
check('hi ha els 2 idiomes del missatge d\'alta/reinici', reset.length === 2);
check('l\'alta/reinici per part d\'un admin demana 10 als DOS idiomes',
  reset.length === 2 && reset.every(s => /m[íi]n\. 10/.test(s)));
check('el missatge d\'error diu 10, no 6 (català)', /um_err_pw:"La contrasenya ha de tenir 10/.test(h));
check('el missatge d\'error diu 10, no 6 (castellà)', /um_err_pw:"La contraseña debe tener 10/.test(h));
check('la pantalla ho comprova ABANS d\'enviar-ho al servidor', /String\(pw\)\.length<10/.test(h));
check('no queda cap rastre del mínim antic de 6', !/m[ií]n\. 6\)/.test(h) && !/tenir 6 car/.test(h) && !/tener 6 car/.test(h));

console.log(ko === 0 ? ('\n== CONTRASENYES FORTES OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
