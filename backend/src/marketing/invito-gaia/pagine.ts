/**
 * Le pagine che si aprono dai link delle email dell'invito a Gaia.
 *
 * ⛔ Perché una pagina con un pulsante, e non un link che fa subito la cosa: i filtri antispam
 * (Outlook, Gmail, gli antivirus aziendali) APRONO i link delle email per controllarli. Un link che
 * al primo GET creasse l'account o disiscrivesse la persona lo farebbe al posto suo, senza che lei
 * abbia mai letto la mail. Il GET mostra, il POST (il pulsante) agisce.
 */
const VERDE = '#16432c';
const VIOLA = '#6c4fe0';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function pagina(titolo: string, corpo: string, appUrl: string): string {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${esc(titolo)} · MetaboleAI</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;
background:#f1efe9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1d2521}
.card{width:100%;max-width:440px;background:#fff;border-radius:24px;box-shadow:0 10px 30px rgba(22,67,44,.10);overflow:hidden}
.top{background:${VERDE};background-image:linear-gradient(145deg,#16432c 0%,#1f5a3b 55%,#4b3aa8 130%);padding:30px 26px;text-align:center;color:#fff}
.top h1{margin:0;font-size:25px;line-height:1.25}.top p{margin:10px 0 0;color:#d7e6dc;font-size:15px;line-height:1.5}
.body{padding:26px}.body p{font-size:15px;line-height:1.55;color:#4d5752;margin:0 0 16px}
.logo{display:block;margin:0 auto 18px;width:110px;height:auto}
button,.btn{display:block;width:100%;border:0;border-radius:999px;padding:16px;font:bold 17px 'Helvetica Neue',Helvetica,Arial,sans-serif;
color:#fff;background:${VIOLA};cursor:pointer;text-align:center;text-decoration:none;box-shadow:0 8px 20px rgba(108,79,224,.3)}
button.grigio,.btn.grigio{background:#eef0ef;color:#1d2521;box-shadow:none;margin-top:10px}
.piccolo{font-size:12.5px!important;color:#8d958f!important;text-align:center;margin-top:16px!important}
a{color:${VIOLA}}
</style></head><body><div style="width:100%;max-width:440px">
<img class="logo" src="${esc(appUrl)}/brand/logo.png" alt="MetaboleAI"/>
<div class="card">${corpo}</div></div></body></html>`;
}

export function paginaInizio(p: { nome: string; emailMascherata: string; azione: string; appUrl: string }): string {
  return pagina(
    'Prova Gaia',
    `<div class="top"><h1>${esc(p.nome)}, Gaia ti aspetta ✨</h1><p>Un ultimo passo: scegli la tua password e sei dentro.</p></div>
<div class="body"><p>Stai per creare l’accesso a MetaboleAI per <b>${esc(p.emailMascherata)}</b>. Dopo la password ti faremo qualche domanda sul tuo obiettivo, e Gaia preparerà il tuo primo menu.</p>
<form method="post" action="${esc(p.azione)}"><button type="submit">Scegli la mia password →</button></form>
<p class="piccolo">Non sei tu? Chiudi pure questa pagina: senza il tuo clic non succede niente.</p></div>`,
    p.appUrl,
  );
}

export function paginaLinkNonValido(appUrl: string): string {
  return pagina(
    'Link non valido',
    `<div class="top"><h1>Questo link non funziona</h1><p>Forse è stato copiato a metà.</p></div>
<div class="body"><p>Nessun problema: puoi entrare dall’app o chiedere un nuovo link per la password.</p>
<a class="btn" href="${esc(appUrl)}/reset-password">Ricevi un nuovo link</a></div>`,
    appUrl,
  );
}

export function paginaCancellami(p: { emailMascherata: string; azione: string; appUrl: string; preferenze: string }): string {
  return pagina(
    'Cancellati',
    `<div class="top"><h1>Vuoi smettere di ricevere le nostre email?</h1><p>Ci dispiace vederti andare, ma la scelta è tua.</p></div>
<div class="body"><p>Premi il pulsante e non manderemo più email promozionali a <b>${esc(p.emailMascherata)}</b>.</p>
<form method="post" action="${esc(p.azione)}"><button type="submit">Sì, cancellami</button></form>
<a class="btn grigio" href="${esc(p.preferenze)}">Preferisco scegliere cosa ricevere</a></div>`,
    p.appUrl,
  );
}

export function paginaCancellata(p: { appUrl: string; preferenze: string }): string {
  return pagina(
    'Fatto',
    `<div class="top"><h1>Fatto, sei fuori dalla lista 💚</h1><p>Non riceverai più email promozionali da noi.</p></div>
<div class="body"><p>Hai cambiato idea? Puoi tornare quando vuoi dalla pagina delle preferenze.</p>
<a class="btn grigio" href="${esc(p.preferenze)}">Gestisci le preferenze</a></div>`,
    p.appUrl,
  );
}
