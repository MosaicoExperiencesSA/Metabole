import { createHmac, timingSafeEqual } from 'crypto';
import { oraLocaleInMinuti } from '../../common/date-only';

/**
 * INVITO A GAIA — le regole senza database (16/9, richiesta di Simone).
 *
 * «Un piano marketing che invii a 100 lead al giorno pescati da quelli in nuovo contatto, con una
 * mail che li invita a provare Gaia, con il link per scegliere la password e quello per cancellarsi,
 * e dopo 15 giorni un promemoria.»
 *
 * Qui stanno le decisioni che si possono provare senza database: come si chiama la persona
 * nell'oggetto, il link firmato, la finestra oraria, quanti ne mancano oggi, chi si scarta.
 */

/**
 * Il nome come si scrive in un oggetto: «MARIA GRAZIA» → «Maria», « lucia » → «Lucia».
 * Le liste storiche hanno nomi tutti maiuscoli o tutti minuscoli, e un oggetto che urla il nome
 * sembra spam. Si usa la prima parola: «Maria Grazia Cerchiara» diventerebbe un appello.
 * ⚠️ Mai vuoto: senza nome è «Ciao», così «{{nome}}, ti presento Gaia» resta una frase.
 */
export function nomeCortese(firstName: string | null | undefined, nomeIntero: string | null | undefined): string {
  const grezzo = (firstName?.trim() || nomeIntero?.trim() || '').split(/\s+/)[0] ?? '';
  const pulito = grezzo.replace(/[^\p{L}'’-]/gu, '');
  if (pulito.length < 2) return 'Ciao';
  return pulito
    .toLocaleLowerCase('it-IT')
    .replace(/(^|['’-])(\p{L})/gu, (_m, prima: string, lettera: string) => prima + lettera.toLocaleUpperCase('it-IT'));
}

// ---------- Il link personale dell'invito ----------
// Formato: <recordId>.<hmac-sha256("gaia-invito:"+recordId) primi 32 hex>. Scopo diverso da quello
// delle preferenze (`prefs:`): un link di disiscrizione non apre un account, e viceversa.
// Nessuna scadenza nel link: vale anche per il promemoria di 15 giorni dopo. Il limite vero è a valle:
// il link apre la scelta della password SOLO per un account che non ne ha ancora scelta una.

function firma(recordId: string, segreto: string): string {
  return createHmac('sha256', segreto).update(`gaia-invito:${recordId}`).digest('hex').slice(0, 32);
}

export function tokenInvito(recordId: string, segreto: string): string {
  return `${recordId}.${firma(recordId, segreto)}`;
}

export function verificaTokenInvito(token: string | null | undefined, segreto: string): string | null {
  const t = token ?? '';
  const punto = t.lastIndexOf('.');
  if (punto <= 0) return null;
  const recordId = t.slice(0, punto);
  const mac = t.slice(punto + 1);
  const atteso = firma(recordId, segreto);
  if (mac.length !== atteso.length) return null;
  try {
    return timingSafeEqual(Buffer.from(mac), Buffer.from(atteso)) ? recordId : null;
  } catch {
    return null;
  }
}

/**
 * Si scrive solo nelle ore in cui una persona legge la posta (ora di Roma): `da` compresa, `a`
 * esclusa. Numeri fuori scala o capovolti → la finestra di sempre, 9–20: un parametro scritto male
 * non deve far partire email alle tre di notte.
 */
export function nellaFinestra(adesso: Date, da: number, a: number): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 24;
  const [inizio, fine] = ok(da) && ok(a) && da < a ? [da, a] : [9, 20];
  const ora = Math.floor(oraLocaleInMinuti(adesso) / 60);
  return ora >= inizio && ora < fine;
}

/** Il tetto di inviti al giorno, ripulito: intero fra 0 e 1000, numeri strani = 0 (fermo). */
export function tettoGiornaliero(alGiorno: number): number {
  return Number.isFinite(alGiorno) ? Math.max(0, Math.min(1000, Math.floor(alGiorno))) : 0;
}

/** Un indirizzo che vale la pena provare: una chiocciola con qualcosa prima e un dominio col punto dopo. */
export function emailPlausibile(email: string | null | undefined): boolean {
  return /^[^\s@<>"',;()\[\]\\]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test((email ?? '').trim());
}

export type MotivoScarto = 'saltato:email' | 'saltato:doppione' | 'saltato:account' | 'saltato:consenso' | 'saltato:canale';

/**
 * Perché una scheda NON riceve l'invito, o `null` se lo riceve. L'ordine conta: prima l'indirizzo
 * che non si può usare, poi chi l'ha già (un'altra scheda, un account), poi le scelte della persona.
 * - `giaVisti`: indirizzi già presi in questo giro o già invitati;
 * - `conAccount`: indirizzi che hanno un account (anche su una scheda non collegata);
 * - `consentita`: false se i filtri di consenso delle campagne l'hanno tolta;
 * - `canali`: i canali che ha scelto; se ne ha scelti e l'email non c'è, non si scrive.
 */
export function motivoScarto(
  email: string | null | undefined,
  giaVisti: Set<string>,
  conAccount: Set<string>,
  consentita: boolean,
  canali: string[] | null | undefined,
): MotivoScarto | null {
  if (!emailPlausibile(email)) return 'saltato:email';
  const e = (email as string).trim().toLowerCase();
  if (giaVisti.has(e)) return 'saltato:doppione';
  if (conAccount.has(e)) return 'saltato:account';
  if (!consentita) return 'saltato:consenso';
  if (canali && canali.length > 0 && !canali.includes('email')) return 'saltato:canale';
  return null;
}

/** Testo che finisce dentro l'HTML di un'email: niente tag da un dato importato. */
export function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** L'email mostrata sulla pagina dell'invito: «ma•••@gmail.com». Chi apre un link inoltrato non legge l'indirizzo intero. */
export function emailMascherata(email: string): string {
  const [utente, dominio] = email.split('@');
  if (!dominio) return '•••';
  return `${utente.slice(0, 2)}•••@${dominio}`;
}
