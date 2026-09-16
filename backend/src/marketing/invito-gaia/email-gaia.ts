/**
 * Le due email dell'invito a Gaia (16/9, richiesta di Simone): l'invito e il promemoria dopo 15 giorni.
 *
 * Sono i DEFAULT: il seed le scrive in `email_template` (chiavi `gaia_invito` e `gaia_promemoria`) solo
 * se non ci sono, e da lì in poi si ritoccano dal backoffice (Modelli email) senza un rilascio.
 *
 * ## Come sono fatte, e perché
 *
 * HTML a tabelle con gli stili scritti sull'elemento: è l'unica forma che Gmail, Outlook e la Mail di
 * iPhone mostrano allo stesso modo. Le sfumature hanno sempre un colore pieno sotto (`bgcolor`), perché
 * Outlook le ignora. I colori sono quelli del logo: verde bosco e viola della stella.
 *
 * ⛔ Il logo è dentro il modello con `id="metabole-logo"`: senza, `MailService.withLogo` ne aggiungerebbe
 * un secondo sopra la testata.
 *
 * Variabili: {{nome}} (mai vuoto: «Ciao» se il nome manca), {{email}}, {{link_prova}},
 * {{link_disiscrizione}}, {{link_preferenze}}, {{app_url}}.
 */

const VERDE = '#16432c';
const VERDE_CHIARO = '#e8f1eb';
const VIOLA = '#6c4fe0';
const VIOLA_CHIARO = '#efeafd';
const INCHIOSTRO = '#1d2521';
const GRIGIO = '#6f7a74';
const SFONDO = '#f1efe9';
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function pulsante(testo: string, colore: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
<tr><td align="center" bgcolor="${colore}" style="border-radius:999px;background-color:${colore};box-shadow:0 8px 20px rgba(108,79,224,0.35);">
<a href="{{link_prova}}" target="_blank" style="display:inline-block;padding:17px 38px;font-family:${FONT};font-size:17px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${testo}</a>
</td></tr></table>`;
}

function bolla(testo: string, diGaia: boolean): string {
  const allinea = diGaia ? 'left' : 'right';
  const sfondo = diGaia ? '#ffffff' : VIOLA;
  const colore = diGaia ? INCHIOSTRO : '#ffffff';
  const angoli = diGaia ? '18px 18px 18px 4px' : '18px 18px 4px 18px';
  const firma = diGaia
    ? `<div style="font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:.5px;color:#b9a8ff;margin:0 0 4px 4px;">GAIA ✨</div>`
    : '';
  return `<tr><td align="${allinea}" style="padding:5px 0;">${firma}
<table role="presentation" cellpadding="0" cellspacing="0" align="${allinea}" style="max-width:82%;"><tr>
<td bgcolor="${sfondo}" style="background-color:${sfondo};border-radius:${angoli};padding:11px 15px;font-family:${FONT};font-size:14px;line-height:1.45;color:${colore};text-align:left;">${testo}</td>
</tr></table></td></tr>`;
}

function riga(icona: string, titolo: string, testo: string): string {
  return `<tr><td style="padding:0 0 16px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="52" valign="top"><div style="width:44px;height:44px;line-height:44px;border-radius:14px;background-color:${VIOLA_CHIARO};text-align:center;font-size:22px;">${icona}</div></td>
<td valign="top" style="padding-left:12px;font-family:${FONT};">
<div style="font-size:16px;font-weight:bold;color:${INCHIOSTRO};margin:2px 0 3px 0;">${titolo}</div>
<div style="font-size:14px;line-height:1.5;color:${GRIGIO};">${testo}</div>
</td></tr></table></td></tr>`;
}

function passo(numero: string, titolo: string, testo: string): string {
  return `<tr><td style="padding:0 0 14px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="44" valign="top"><div style="width:34px;height:34px;line-height:34px;border-radius:50%;background-color:${VERDE};color:#ffffff;text-align:center;font-family:${FONT};font-size:15px;font-weight:bold;">${numero}</div></td>
<td valign="top" style="padding-left:10px;font-family:${FONT};">
<div style="font-size:15px;font-weight:bold;color:${INCHIOSTRO};margin:6px 0 2px 0;">${titolo}</div>
<div style="font-size:14px;line-height:1.5;color:${GRIGIO};">${testo}</div>
</td></tr></table></td></tr>`;
}

function cornice(anteprima: string, testata: string, corpo: string, notaPiede: string): string {
  return `<div style="margin:0;padding:0;background-color:${SFONDO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${SFONDO};font-size:1px;line-height:1px;">${anteprima}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${SFONDO}" style="background-color:${SFONDO};">
<tr><td align="center" style="padding:28px 12px 36px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding:0 0 18px 0;">
<img id="metabole-logo" src="{{app_url}}/brand/logo.png" alt="MetaboleAI" width="120" style="display:block;width:120px;max-width:120px;height:auto;border:0;" />
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(22,67,44,0.08);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${testata}
${corpo}
</table>
</td></tr>
<tr><td style="padding:22px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:#8d958f;text-align:center;">
${notaPiede}<br/>
Non vuoi più ricevere le nostre email? <a href="{{link_disiscrizione}}" target="_blank" style="color:${VIOLA};font-weight:bold;text-decoration:underline;">Cancellati con un clic</a>
&nbsp;·&nbsp; <a href="{{link_preferenze}}" target="_blank" style="color:#8d958f;text-decoration:underline;">Gestisci le preferenze</a><br/><br/>
Se il pulsante non si apre, copia questo indirizzo nel browser:<br/>
<a href="{{link_prova}}" target="_blank" style="color:#8d958f;word-break:break-all;">{{link_prova}}</a><br/><br/>
© MetaboleAI
</td></tr>
</table>
</td></tr></table></div>`;
}

const INVITO_TESTATA = `<tr><td bgcolor="${VERDE}" style="background-color:${VERDE};background-image:linear-gradient(145deg,#16432c 0%,#1f5a3b 55%,#4b3aa8 130%);padding:38px 32px 30px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:0 0 14px 0;">
<span style="display:inline-block;background-color:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.25);border-radius:999px;padding:6px 14px;font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#d9d0ff;">NOVITÀ · INTELLIGENZA ARTIFICIALE</span>
</td></tr>
<tr><td align="center" style="font-family:${FONT};font-size:31px;line-height:1.2;font-weight:bold;color:#ffffff;padding:0 0 12px 0;">
{{nome}}, ti presento <span style="color:#c4b5ff;">Gaia</span> ✨
</td></tr>
<tr><td align="center" style="font-family:${FONT};font-size:16px;line-height:1.55;color:#d7e6dc;padding:0 10px 24px 10px;">
La nuova AI di Metabole che ti aiuta a <b style="color:#ffffff;">dimagrire</b> e a <b style="color:#ffffff;">stare bene con te stessa</b>, un giorno alla volta. Senza diete uguali per tutte.
</td></tr>
<tr><td bgcolor="#0f3321" style="background-color:rgba(0,0,0,0.22);border-radius:20px;padding:16px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${bolla('Ciao! Sono Gaia 💜 Dimmi cosa ti piace mangiare e che obiettivo hai: al menu di ogni giorno ci penso io.', true)}
${bolla('Stasera ho una cena fuori… 😅', false)}
${bolla('Nessun problema! Sistemo il resto della giornata così te la godi senza sensi di colpa 🍝', true)}
</table>
</td></tr>
</table>
</td></tr>`;

const INVITO_CORPO = `<tr><td style="padding:32px 32px 8px 32px;font-family:${FONT};">
<div style="font-size:20px;font-weight:bold;color:${INCHIOSTRO};margin:0 0 18px 0;">Cosa fa Gaia per te</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${riga('🍽️', 'Il tuo menu, ogni giorno', 'Costruito sui tuoi gusti, sui tuoi orari e sul tuo obiettivo. E si adatta a te man mano che vai avanti.')}
${riga('💬', 'Ti risponde quando ti serve', 'Vuoi cambiare un piatto, hai una cena o un imprevisto? Scrivile: trova la soluzione con te.')}
${riga('🤝', 'Persone vere al tuo fianco', 'Una coach e un nutrizionista seguono il tuo percorso. Gaia li aiuta, non li sostituisce.')}
</table>
</td></tr>
<tr><td style="padding:10px 32px 6px 32px;">${pulsante('Prova Gaia adesso →', VIOLA)}</td></tr>
<tr><td align="center" style="padding:12px 40px 28px 40px;font-family:${FONT};font-size:13px;line-height:1.5;color:${GRIGIO};">
Un clic, scegli la tua password e sei dentro. Ci vogliono due minuti.<br/>Il tuo accesso: <b style="color:${INCHIOSTRO};">{{email}}</b>
</td></tr>
<tr><td style="padding:0 32px 32px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${VERDE_CHIARO}" style="background-color:${VERDE_CHIARO};border-radius:18px;padding:20px 22px;font-family:${FONT};">
<div style="font-size:16px;line-height:1.55;color:${VERDE};font-style:italic;">«Stare bene con sé stesse non è una gara. È un percorso, e da oggi non lo fai da sola.»</div>
<div style="font-size:13px;color:${GRIGIO};margin-top:10px;">Con affetto, il team Metabole 💚</div>
</td></tr></table>
</td></tr>`;

const PROMEMORIA_TESTATA = `<tr><td bgcolor="${VIOLA}" style="background-color:${VIOLA};background-image:linear-gradient(145deg,#5a3fd0 0%,#6c4fe0 50%,#1f5a3b 140%);padding:40px 32px 34px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:0 0 14px 0;">
<div style="width:74px;height:74px;line-height:74px;border-radius:50%;background-color:rgba(255,255,255,0.16);border:2px solid rgba(255,255,255,0.35);font-size:36px;text-align:center;margin:0 auto;">💜</div>
</td></tr>
<tr><td align="center" style="font-family:${FONT};font-size:29px;line-height:1.22;font-weight:bold;color:#ffffff;padding:0 0 12px 0;">
{{nome}}, Gaia ti sta ancora aspettando
</td></tr>
<tr><td align="center" style="font-family:${FONT};font-size:16px;line-height:1.55;color:#ece7ff;padding:0 12px;">
Qualche giorno fa ti abbiamo presentato la nostra nuova AI. Forse non era il momento giusto: capita.<br/><b style="color:#ffffff;">Il tuo posto è ancora qui.</b>
</td></tr>
</table>
</td></tr>`;

const PROMEMORIA_CORPO = `<tr><td style="padding:32px 32px 6px 32px;font-family:${FONT};">
<div style="font-size:20px;font-weight:bold;color:${INCHIOSTRO};margin:0 0 18px 0;">Ti bastano tre passi</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${passo('1', 'Scegli la tua password', 'Il pulsante qui sotto ti porta dritta alla pagina giusta.')}
${passo('2', 'Racconta a Gaia di te', 'Poche domande sul tuo obiettivo, sui tuoi gusti e sulle tue giornate.')}
${passo('3', 'Ricevi il tuo primo menu', 'Pensato per te, e da lì Gaia ti accompagna ogni giorno.')}
</table>
</td></tr>
<tr><td style="padding:12px 32px 6px 32px;">${pulsante('Entra e conosci Gaia →', VERDE)}</td></tr>
<tr><td align="center" style="padding:12px 40px 26px 40px;font-family:${FONT};font-size:13px;line-height:1.5;color:${GRIGIO};">
Il tuo accesso: <b style="color:${INCHIOSTRO};">{{email}}</b>
</td></tr>
<tr><td style="padding:0 32px 32px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${VIOLA_CHIARO}" style="background-color:${VIOLA_CHIARO};border-radius:18px;padding:18px 22px;font-family:${FONT};">
<div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${VIOLA};margin-bottom:6px;">💡 LO SAPEVI?</div>
<div style="font-size:15px;line-height:1.55;color:${INCHIOSTRO};">I piccoli cambiamenti fatti ogni giorno funzionano meglio delle diete drastiche. Gaia ti aiuta a trasformarli in abitudini, con i piatti che ti piacciono.</div>
</td></tr></table>
</td></tr>`;

export const GAIA_INVITO = {
  key: 'gaia_invito',
  name: 'Invito a provare Gaia (ai lead in «Nuovo contatto»)',
  subject: '{{nome}}, ti presento Gaia: la nuova AI per stare bene ✨',
  bodyHtml: cornice(
    'La tua nuova alleata per dimagrire e stare bene: provala adesso, ti bastano due minuti.',
    INVITO_TESTATA,
    INVITO_CORPO,
    'Ricevi questa email perché in passato ci hai lasciato il tuo contatto per avere informazioni su Metabole.',
  ),
};

export const GAIA_PROMEMORIA = {
  key: 'gaia_promemoria',
  name: 'Promemoria invito a Gaia (dopo 15 giorni)',
  subject: '{{nome}}, Gaia ti sta ancora aspettando 💜',
  bodyHtml: cornice(
    'Il tuo accesso è pronto: scegli la password e ricevi il tuo primo menu.',
    PROMEMORIA_TESTATA,
    PROMEMORIA_CORPO,
    'Questo è l’unico promemoria sull’invito a Gaia: non te ne manderemo altri.',
  ),
};

export const EMAIL_INVITO_GAIA = [GAIA_INVITO, GAIA_PROMEMORIA];
