/**
 * INVITO A GAIA — IL REPORT DEL MATTINO (19/10/2026), la parte senza database.
 *
 * Simone, 19/10, sulle due caselle del pannello «Hanno cliccato» e «Sono entrate»: *«questi due
 * report vanno mandati giornalmente via mail a giusy@metabole.eu»*.
 *
 * ⚠️ **Gli elenchi sono GLI STESSI delle caselle**, non una loro variante «più utile»: chi ha
 * cliccato comprende anche chi poi è entrata, esattamente come il 39 del pannello comprende il 22.
 * Una mail che dice 30 dove il pannello dice 39 è una mail di cui ci si smette di fidare. Chi è
 * anche entrata lo dice una colonna, e chi è nuova dalle ultime 24 ore porta «NUOVA».
 *
 * ⚠️ **I destinatari sono un parametro** (`gaia_invito_report_destinatari`, uno per riga), non un
 * indirizzo scritto qui: la persona che segue i lead cambia, e cambiarla non deve chiedere un rilascio.
 * Vuoto = report spento.
 */

export interface RigaReport {
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  /** La data che quell'elenco conta: il clic, o l'entrata. */
  quando: Date | null;
  /** Solo nell'elenco dei clic: se poi è anche entrata. */
  entrata?: boolean;
  /** Link alla scheda lead nel backoffice. */
  scheda: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gli indirizzi del parametro: uno per riga (o separati da virgola), validi, senza doppioni. */
export function destinatariDaTesto(testo: string | null | undefined): string[] {
  const voci = (testo ?? '')
    .split(/[\n,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => EMAIL.test(v));
  return [...new Set(voci)];
}

const UN_GIORNO_MS = 24 * 3600 * 1000;

/** Nuova = il suo clic (o la sua entrata) è delle ultime 24 ore. */
export function eNuova(quando: Date | null, adesso: Date): boolean {
  return !!quando && adesso.getTime() - quando.getTime() < UN_GIORNO_MS && quando.getTime() <= adesso.getTime();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function quandoRoma(d: Date | null, fuso: string): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('it-IT', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

function tabella(titolo: string, totale: number, righe: RigaReport[], adesso: Date, fuso: string, conColonnaEntrata: boolean): string {
  const nuove = righe.filter((r) => eNuova(r.quando, adesso)).length;
  const th = 'style="text-align:left;padding:6px 8px;border-bottom:2px solid #d9cfc0;font-size:12px;color:#6b5d4d;text-transform:uppercase"';
  const td = 'style="padding:6px 8px;border-bottom:1px solid #eee5d8;font-size:13px;vertical-align:top"';
  const corpo = righe.length === 0
    ? `<tr><td ${td} colspan="${conColonnaEntrata ? 6 : 5}"><i>Nessuna, per ora.</i></td></tr>`
    : righe
        .map((r) => {
          const nuova = eNuova(r.quando, adesso) ? ' <b style="color:#fff;background:#7a5af8;border-radius:4px;padding:1px 5px;font-size:10px">NUOVA</b>' : '';
          const nome = `${esc(r.nome)} ${esc(r.cognome)}`.trim() || '—';
          return `<tr>`
            + `<td ${td}><a href="${esc(r.scheda)}" style="color:#3b2f22">${nome}</a>${nuova}</td>`
            + `<td ${td}><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>`
            + `<td ${td}>${r.telefono ? `<a href="tel:${esc(r.telefono)}">${esc(r.telefono)}</a>` : '—'}</td>`
            + `<td ${td}>${quandoRoma(r.quando, fuso)}</td>`
            + (conColonnaEntrata ? `<td ${td}>${r.entrata ? 'sì' : 'no'}</td>` : '')
            + `<td ${td}><a href="${esc(r.scheda)}">Scheda</a></td>`
            + `</tr>`;
        })
        .join('');
  const tagliato = totale > righe.length
    ? `<p style="font-size:12px;color:#6b5d4d">Qui sopra le ${righe.length} più recenti su ${totale}: l'elenco intero è nel pannello Invito a Gaia del backoffice.</p>`
    : '';
  return `<h3 style="margin:24px 0 6px">${esc(titolo)}: ${totale}${nuove ? ` <span style="font-weight:normal;font-size:14px">(${nuove} nelle ultime 24 ore)</span>` : ''}</h3>`
    + `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%"><thead><tr>`
    + `<th ${th}>Nome</th><th ${th}>Email</th><th ${th}>Telefono</th><th ${th}>${conColonnaEntrata ? 'Cliccato il' : 'Entrata il'}</th>`
    + (conColonnaEntrata ? `<th ${th}>Entrata</th>` : '')
    + `<th ${th}></th></tr></thead><tbody>${corpo}</tbody></table>${tagliato}`;
}

/** Oggetto e corpo della mail. Puro: le date di riferimento e il fuso arrivano da fuori. */
export function componiReport(input: {
  cliccati: RigaReport[];
  totaleCliccati: number;
  entrate: RigaReport[];
  totaleEntrate: number;
  adesso: Date;
  fuso: string;
  pannello: string;
}): { subject: string; html: string } {
  const { cliccati, entrate, adesso, fuso } = input;
  const giorno = new Intl.DateTimeFormat('it-IT', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric' }).format(adesso);
  const nuoviClic = cliccati.filter((r) => eNuova(r.quando, adesso)).length;
  const nuoveEntrate = entrate.filter((r) => eNuova(r.quando, adesso)).length;
  const subject = `Invito a Gaia — ${giorno}: ${nuoviClic} nuovi clic, ${nuoveEntrate} nuove entrate`;
  const html = `<p>Buongiorno,</p>`
    + `<p>ecco come va l'invito a provare Gaia. <b>NUOVA</b> = dalle ultime 24 ore. Il nome porta alla scheda lead.</p>`
    + tabella('Hanno cliccato', input.totaleCliccati, cliccati, adesso, fuso, true)
    + tabella('Sono entrate', input.totaleEntrate, entrate, adesso, fuso, false)
    + `<p style="margin-top:24px"><a href="${esc(input.pannello)}">Apri il pannello Invito a Gaia</a></p>`
    + `<p style="font-size:12px;color:#6b5d4d">Questa mail parte ogni mattina. I destinatari si cambiano in Parametri → Marketing → «Report Invito a Gaia: a chi».</p>`;
  return { subject, html };
}
