#!/usr/bin/env node
'use strict';
/*
 * Guardià de la RECUPERACIÓ DE CONTRASENYA (21/07/2026).
 *
 * Per què existeix: fins avui l'aplicació NO tenia cap manera de recuperar la contrasenya. Qui la
 * perdia depenia que un administrador li'n posés una de nova a mà — i si l'administrador també la
 * perdia, no hi havia sortida. El 21/07 això va passar de veritat (una persona de GTA va demanar per
 * correu la contrasenya d'una altra persona, que va acabar circulant en text pla entre bústies).
 *
 * Tres coses que aquest guardià protegeix, per aquest ordre:
 *  1. NO DIR MAI si un correu existeix o no al sistema (seria una manera de descobrir qui hi té accés).
 *  2. NO deixar passar a l'aplicació qui ve de l'enllaç del correu fins que POSA una contrasenya nova
 *     — si no, entraria amb la VELLA encara posada pensant-se que ja l'ha canviada.
 *  3. NO cantar mai un «enviat» fals: si l'enviament falla, es diu.
 */
const fs = require('fs'), path = require('path');
const HTML = process.argv[2] || ['app_gta.html', 'index.html'].map(f => path.join(__dirname, '..', f)).find(fs.existsSync);
if (!HTML) { console.error('X no trobo app_gta.html'); process.exit(1); }
const h = fs.readFileSync(HTML, 'utf8');
let ok = 0, ko = 0;
const check = (n, c) => { if (c) { ok++; console.log('  OK ' + n); } else { ko++; console.error('  X  ' + n); } };

// ---- 1. la porta d'entrada ----
check('hi ha l\'enllaç «he oblidat la contrasenya» a la pantalla d\'accés', h.includes('id="forgotBtn"') && h.includes('data-i18n="forgot"'));
check('hi ha on ensenyar el missatge informatiu', h.includes('id="loginInfo"'));
check('demana l\'enllaç a Supabase', h.includes('sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname})'));
check('torna a la MATEIXA adreça de l\'aplicació (no a una de fixa)', h.includes('redirectTo:location.origin+location.pathname'));
check('valida que el correu tingui forma de correu abans d\'enviar', /\/\^\[\^@\\s\]\+@\[\^@\\s\]\+\\\.\[\^@\\s\]\+\$\/\.test\(email\)/.test(h));

// ---- 2. no revelar qui té accés ----
const ca = /forgot_sent:"Si aquest correu té accés/.test(h);
const es = /forgot_sent:"Si ese correo tiene acceso/.test(h);
check('el missatge és neutre en català («si aquest correu té accés»)', ca);
check('el missatge és neutre en castellà («si ese correo tiene acceso»)', es);
check('no diu enlloc que el correu «no existeix» o «no està registrat»',
  !/no (existeix|està registrat|existe|está registrado)/i.test(h));
check('avisa de mirar la carpeta de correu brossa', /correu brossa/.test(h) && /correo no deseado/.test(h));

// ---- 3. mai un «enviat» fals ----
check('si Supabase retorna error, NO ensenya el missatge d\'enviat', h.includes('err.textContent=rate?t("forgot_rate"):t("forgot_err");err.style.display="block"'));
check('distingeix el cas «massa intents seguits» (429)', h.includes('error.status===429'));
check('captura també els errors de xarxa (try/catch)', h.includes('catch(e){ error={message:String((e&&e.message)||e),status:0}; }'));
check('deixa rastre a la consola quan falla', h.includes('console.warn("[recuperacio] no s\'ha pogut enviar:"'));
check('el botó es bloqueja mentre envia i es desbloqueja després', h.includes('b.disabled=true;b.textContent=t("forgot_sending");') && h.includes('b.disabled=false;b.textContent=t("forgot");'));

// ---- 4. la tornada des de l'enllaç del correu ----
check('llegeix l\'adreça ABANS de crear el client (Supabase la neteja)',
  h.indexOf('const _VE_DE_RECUPERACIO=') < h.indexOf('window.supabase.createClient') && h.includes('/type=recovery/.test(location.hash||"")'));
check('escolta l\'avís de recuperació de Supabase', h.includes('onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY")obreRecuperacio();})'));
check('l\'arrencada NO deixa entrar a l\'aplicació si ve de l\'enllaç', h.includes('if(session&&_RECUP_PENDENT){obreRecuperacio();return;}'));
check('el modal no es pot tancar mentre s\'ha de posar la nova', h.includes('if(RECOVERY)return;$("#pwdModal").classList.remove("show");'));
check('s\'amaga el botó «Cancel·lar» durant la recuperació', h.includes('const c=$("#pwdCancel");if(c)c.style.display="none";'));
check('el títol del modal canvia («posa una contrasenya nova»)', h.includes('ttl.textContent=t("pwd_recovery")'));
check('en acabar, esborra l\'enllaç de la barra d\'adreces', h.includes('history.replaceState(null,"",location.pathname)'));
check('en acabar, restaura el modal normal i entra a l\'aplicació',
  h.includes('RECOVERY=false;_RECUP_PENDENT=false;') && h.includes('ttl.textContent=t("pwd_title");') && /\n\s*boot\(\); \} \}\);/.test(h));

// ---- 5. contrasenya forta (norma de la casa: 10 o més) ----
check('el mínim és 10 caràcters, no 6', h.includes('if(a.length<10){toast(t("pwd_short"),true);return;}') && !h.includes('if(a.length<6){toast(t("pwd_short")'));
check('els textos diuen 10 en tots dos idiomes',
  /pwd_short:"La contrasenya ha de tenir 10 caràcters/.test(h) && /pwd_short:"La contraseña debe tener 10 caracteres/.test(h)
  && /pwd_sub:"Mínim 10 caràcters/.test(h) && /pwd_sub:"Mínimo 10 caracteres/.test(h));

// ---- 6. tots els textos existeixen en els dos idiomes ----
for (const k of ['forgot', 'forgot_need_email', 'forgot_sending', 'forgot_sent', 'forgot_rate', 'forgot_err', 'pwd_recovery']) {
  const n = (h.match(new RegExp('\\b' + k + ':"', 'g')) || []).length;
  check('el text «' + k + '» hi és en català i castellà (' + n + '/2)', n === 2);
}

console.log(ko === 0 ? ('\n== RECUPERAR CONTRASENYA OK -- ' + ok + '/' + (ok + ko) + ' ==') : ('\n== FALLA -- ' + ko + ' de ' + (ok + ko) + ' =='));
process.exit(ko ? 1 : 0);
