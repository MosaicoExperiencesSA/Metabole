/**
 * ⛔ **UNA DATA SCRITTA A MANO, LETTA COME LA SCRIVONO LE PERSONE.**
 *
 * Nasce il 23/8 con la scadenza della visita: la nutrizionista sceglie «serve una visita» e scrive
 * **entro quando** va fatta. Da quel giorno in poi i menu della cliente si fermano da soli — quindi
 * è una data che ha una conseguenza, e rifiutarla per il formato vorrebbe dire far ripetere tre
 * volte un lavoro già fatto, su una schermata che si apre nel mezzo di una valutazione clinica.
 *
 * ⚠️ **Si accettano `30/09/2026` e `2026-09-30`, e nient'altro.** Non `30-9-26`, non `Sep 30`: un
 * parser generoso è un parser che un giorno legge `03/04` come il 3 aprile e un altro come il 4
 * marzo. Due forme, tutte e due non ambigue, e per il resto si dice di no con una frase che mostra
 * come scriverla.
 *
 * ⚠️ E **si controlla che il giorno esista davvero**: `new Date('2026-02-31')` non è un errore in
 * JavaScript, è il 3 marzo. Una scadenza spostata di due giorni senza dirlo è esattamente il tipo di
 * cosa che nessuno va a verificare.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ITALIANO = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Il giorno esiste? Blocca il 31 di febbraio, che JavaScript farebbe scivolare a marzo. */
function esiste(anno: number, mese: number, giorno: number): boolean {
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  return d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === giorno;
}

const dueCifre = (n: number): string => String(n).padStart(2, '0');

/**
 * `30/09/2026` o `2026-09-30` → `2026-09-30`. Qualunque altra cosa → `null`.
 *
 * ⚠️ Rende **la stringa**, non un `Date`: un `Date` porterebbe dentro un'ora e un fuso che qui non
 * c'entrano niente — è un giorno di calendario, e il momento in cui comincia lo decide il backend
 * (`common/date-only.ts`), che è l'unico posto in cui quel conto è scritto una volta sola.
 */
export function giornoIso(testo: string | null | undefined): string | null {
  const t = (testo ?? '').trim();

  const iso = ISO.exec(t);
  if (iso) {
    const [, a, m, g] = iso;
    return esiste(Number(a), Number(m), Number(g)) ? `${a}-${m}-${g}` : null;
  }

  const it = ITALIANO.exec(t);
  if (it) {
    const [, g, m, a] = it;
    return esiste(Number(a), Number(m), Number(g)) ? `${a}-${dueCifre(Number(m))}-${dueCifre(Number(g))}` : null;
  }

  return null;
}

/** `2026-09-30` → `30/09/2026`. Per riscrivere alla nutrizionista la data che ha appena inserito. */
export function giornoItaliano(iso: string): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const [, a, mm, g] = m;
  return `${g}/${mm}/${a}`;
}
