/**
 * CHI VA RICONTATTATA SULLE ALLERGIE — una regola sola, per la conta e per la campagna.
 *
 * §7.1 dell'handoff: «⚠️ Prima di lanciare qualsiasi cosa, conta.»
 *
 * Sta qui e non dentro lo script di conteggio per la ragione scritta in testa a
 * `prisma/assegna-senza-glutine.ts`: uno script che si riscrive il criterio conta una popolazione,
 * e poi la campagna ne contatta un'altra. Due numeri diversi per la stessa domanda, e quello su cui
 * si è deciso è il primo.
 *
 * ## Le tre popolazioni, in ordine di urgenza
 *
 * 1. **Intolleranza ignota** — `'other'` fra le intolleranze e nessun testo libero. Il dato c'è,
 *    dice «altro», e non esclude niente: quella cliente ha un'intolleranza che noi non sappiamo, e
 *    i suoi menu la ignorano. ⚠️ Fino al 13/8 il campo dove scriverlo **non esisteva**, quindi
 *    nessuna di loro ha potuto rispondere: non è distrazione loro.
 * 2. **Allergie da codificare** — voci fuori dai 14 codici UE, mai tradotte. Sono le stesse che
 *    `personal-base` segnala: la base personale sicura resta bloccata finché nessuno le guarda.
 * 3. **Non sappiamo** — questionario completato, tutto vuoto, nessuna data di dichiarazione:
 *    «non ne ho» e «ho saltato la pagina» sono indistinguibili.
 *
 * ## ⚠️ Una cliente sta in UNA categoria sola
 *
 * Le tre si sovrappongono nella realtà — si può avere sia un'intolleranza ignota sia un'allergia da
 * codificare. Se si contassero separatamente, la somma sarebbe più grande del numero di clienti che
 * esistono, ed è un numero da cui poi si decide se mandare centinaia di notifiche. Quindi ognuna
 * finisce nella categoria **più urgente** che la riguarda, e i tre numeri si possono sommare.
 */
import { INTOLLERANZA_IGNOTA, allergieDaCodificare } from './allergie';

export type MotivoRicontatto = 'intolleranza_ignota' | 'allergie_da_codificare' | 'mai_risposto' | null;

export interface ProfiloDaValutare {
  allergies?: string[] | null;
  allergiesOther?: string[] | null;
  allergieDichiarateIl?: Date | string | null;
  intolerances?: string[] | null;
  intolerancesOther?: string[] | null;
  onboardingCompletedAt?: Date | string | null;
}

/**
 * Perché questa cliente va ricontattata, o `null` se non va disturbata.
 *
 * ⚠️ `null` vuol dire «il dato che abbiamo è buono», non «non ha allergie»: chi ne ha dichiarate e
 * sono tutte codificate sta a posto esattamente come chi ha detto «non ne ho».
 */
export function motivoRicontatto(p: ProfiloDaValutare, codiciNoti: readonly string[]): MotivoRicontatto {
  const intolleranze = p.intolerances ?? [];
  const ignota =
    intolleranze.some((v) => (v ?? '').toLowerCase() === INTOLLERANZA_IGNOTA) &&
    (p.intolerancesOther ?? []).length === 0;
  if (ignota) return 'intolleranza_ignota';

  if (allergieDaCodificare(p.allergies, p.allergiesOther, codiciNoti).length) return 'allergie_da_codificare';

  /**
   * ⚠️ Solo chi il questionario l'ha FINITO.
   *
   * Chi non l'ha ancora completato non ha «saltato la pagina»: non è ancora arrivato lì. Mandargli
   * una notifica su una domanda che sta per vedere insegna solo a ignorare le notifiche — ed è la
   * ragione per cui questo elenco non è «tutte quelle che hanno le allergie vuote».
   */
  const maiRisposto =
    !!p.onboardingCompletedAt &&
    !p.allergieDichiarateIl &&
    (p.allergies ?? []).length === 0 &&
    intolleranze.length === 0;
  if (maiRisposto) return 'mai_risposto';

  return null;
}

export interface ContoRicontatti {
  intolleranza_ignota: number;
  allergie_da_codificare: number;
  mai_risposto: number;
  aPosto: number;
  totaleDaRicontattare: number;
  esaminate: number;
}

export function contaRicontatti(profili: ProfiloDaValutare[], codiciNoti: readonly string[]): ContoRicontatti {
  const c: ContoRicontatti = {
    intolleranza_ignota: 0,
    allergie_da_codificare: 0,
    mai_risposto: 0,
    aPosto: 0,
    totaleDaRicontattare: 0,
    esaminate: profili.length,
  };
  for (const p of profili) {
    const m = motivoRicontatto(p, codiciNoti);
    if (m === null) c.aPosto++;
    else {
      c[m]++;
      c.totaleDaRicontattare++;
    }
  }
  return c;
}
