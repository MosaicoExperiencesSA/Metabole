/**
 * NIENTE EMAIL DI CLIENTI NEI FILE DEL REPOSITORY.
 *
 * Il 18/8 il repository conteneva le email di otto clienti reali — nei registri, negli handoff, nei
 * commenti del codice e in tre file di test — scritte lì un po' per volta, ogni volta con la buona
 * ragione di «così si capisce di chi si parla». Accanto c'erano finestre di digiuno, fabbisogni
 * calorici e cibi non graditi: email + nome + dato sulla salute, cioè la categoria che il GDPR
 * protegge di più (art. 9). Il repository era pubblico.
 *
 * ⚠️ LA REGOLA, da qui in avanti: nei documenti e nei commenti si scrive il **nome di battesimo**
 * (o l'id interno), mai l'indirizzo. Negli esempi di comando ci va un segnaposto
 * (`cliente@esempio.it`), nelle fixture dei test un dominio finto.
 *
 * Questo modulo esiste perché la regola non dipenda dalla memoria di nessuno: la spec che lo usa
 * passa in rassegna i file versionati e fallisce se un indirizzo di un dominio di posta vero
 * ricompare. È il motivo per cui la bonifica del 18/8 non si ripete fra tre mesi.
 */

/** I domini di posta su cui una persona vera legge davvero le sue email. Un indirizzo su uno di
 *  questi non è mai una fixture: o è un cliente, o è qualcuno dello staff. */
export const DOMINI_DI_POSTA_VERA = [
  'gmail.com', 'googlemail.com', 'libero.it', 'hotmail.it', 'hotmail.com', 'hotmail.fr',
  'yahoo.it', 'yahoo.com', 'tiscali.it', 'icloud.com', 'me.com', 'outlook.it', 'outlook.com',
  'live.it', 'live.com', 'msn.com', 'alice.it', 'virgilio.it', 'fastwebnet.it', 'tin.it',
  'inwind.it', 'aruba.it', 'pec.it', 'bluewin.ch', 'gmx.com', 'gmx.net', 'protonmail.com',
  'proton.me', 'teletu.it', 'email.it', 'poste.it', 'tim.it', 'vodafone.it', 'wind.it',
];

/**
 * Gli indirizzi che possono restare: sono di Simone, servono a far girare il seed, le prove e i
 * flussi di pubblicazione. Il confronto è sulla **parte prima della chiocciola** perché gli alias
 * con il `+` (`+playreview`, `+delete-test`, …) sono lo stesso indirizzo.
 */
export const PARTI_LOCALI_DI_SIMONE = ['simone.salogni', 'sim1one.salogni'];

/**
 * I segnaposto: `tua@email.it` non è l'indirizzo di nessuno, vuol dire «il tuo indirizzo». Stanno
 * su domini di posta veri per sembrare veri, ed è proprio quello il loro mestiere.
 */
export const PARTI_LOCALI_SEGNAPOSTO = ['tua', 'tuo', 'nuova', 'nuovo', 'vecchia', 'vecchio', 'cliente', 'esempio', 'email', 'indirizzo'];

export const PARTI_LOCALI_AMMESSE = [...PARTI_LOCALI_DI_SIMONE, ...PARTI_LOCALI_SEGNAPOSTO];

const REGOLA_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export type EmailTrovata = { indirizzo: string; riga: number };

const parteLocale = (indirizzo: string) => indirizzo.split('@')[0].split('+')[0].toLowerCase();
const dominio = (indirizzo: string) => indirizzo.split('@')[1]?.toLowerCase() ?? '';

/**
 * Le email di persone vere dentro un testo, con il numero di riga (1-based) per poterle andare a
 * cercare. Torna `[]` quando non ce ne sono: è il caso normale, e deve restare tale.
 */
export function emailDiPersoneVere(
  testo: string,
  ammesse: string[] = PARTI_LOCALI_AMMESSE,
  domini: string[] = DOMINI_DI_POSTA_VERA,
): EmailTrovata[] {
  const insiemeDomini = new Set(domini.map((d) => d.toLowerCase()));
  const insiemeAmmesse = new Set(ammesse.map((a) => a.toLowerCase()));
  const trovate: EmailTrovata[] = [];
  testo.split('\n').forEach((riga, i) => {
    for (const indirizzo of riga.match(REGOLA_EMAIL) ?? []) {
      if (!insiemeDomini.has(dominio(indirizzo))) continue;
      if (insiemeAmmesse.has(parteLocale(indirizzo))) continue;
      trovate.push({ indirizzo, riga: i + 1 });
    }
  });
  return trovate;
}
