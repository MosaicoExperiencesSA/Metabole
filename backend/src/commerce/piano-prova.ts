/**
 * IL PIANO DELLA PROVA («Conosciamoci» / Auto Apprendimento Gaia) e la DATA DI INIZIO scelta dalla
 * cliente. Regole pure, senza database: si possono provare per quello che sono.
 *
 * Dall'11/8 la prova **non si compra più**: si attiva da sola a fine questionario (§16.1). Il piano
 * resta nel database — serve il suo id per attivarlo — ma esce dalla vetrina e l'acquisto viene
 * rifiutato anche a chi arriva con l'id in mano. Nascondere non basta: l'elenco è un suggerimento,
 * l'acquisto è una POST con dentro un `planId`.
 */
import { aGiorno, toDateOnly } from '../common/date-only';

/** Il piano è la PROVA GRATUITA? (prezzo 0: senza carta per definizione). */
export function isTrialPlan(plan: { priceCents?: number | null } | null | undefined): boolean {
  return (plan?.priceCents ?? -1) === 0;
}

/**
 * Quanto lontano nel futuro può stare la data di inizio.
 *
 * Simone ha chiesto esplicitamente che **la data lontana sia permessa**: l'aiuto sotto al campo dice
 * «se non la sai inseriscine una molto lontana, potrai sempre cambiarla dalla tua dashboard». Quindi
 * il cap dei 60 giorni di `finalizeApproval` qui **non** si applica.
 *
 * Un limite però serve, e non contro la cliente: contro il refuso. Un anno battuto male (2027 al
 * posto del 2026, o un `31/12/2036` da tastierino) produrrebbe un abbonamento attivo che parte fra
 * dieci anni — nessun menu, nessun errore, nessuno che se ne accorge. Dodici mesi coprono qualunque
 * intenzione vera («ricomincio dopo l'estate», «dopo il parto») e fermano lo zero di troppo.
 */
export const MESI_MAX_DATA_INIZIO = 12;

export type EsitoData =
  | { ok: true; data: Date }
  | { ok: false; motivo: 'mancante' | 'illeggibile' | 'passato' | 'troppo_lontana' };

/**
 * ⛔ **IL GIORNO SI CHIEDE, NON SI CALCOLA** — 25/8, censimento.
 *
 * Qui c'era `soloGiorno(d) = new Date(d.getFullYear(), d.getMonth(), d.getDate())`: la mezzanotte
 * del **processo**, che è la stessa formula che `common/il-giorno-si-chiede.spec.ts` vieta come
 * `setHours(0, 0, 0, 0)`, solo scritta in un altro modo — e questo file non era nel perimetro di
 * quel guardiano. Adesso c'è.
 *
 * ⛔ **Cosa sbagliava davvero.** Su Render `TZ` non è impostata, quindi il processo sta a UTC: fra la
 * mezzanotte e le 02:00 italiane il «primo giorno accettabile» era **ieri**. Una cliente che finiva
 * «Conosciamoci» a quell'ora poteva scegliere una partenza **già passata** e il controllo «quel
 * giorno è già passato» non scattava. E la data d'inizio scritta era il giorno UTC, non quello di
 * Roma: giusta per com'era configurata la macchina, non per com'era scritto il codice.
 *
 * ⚠️ **Due funzioni, perché sono due domande** — la distinzione dichiarata in `date-only.ts`:
 *  · una **stringa di sola data** (`2026-09-01`, quello che manda il calendario) vale **alla
 *    lettera**: `toDateOnly` non la converte, e convertirla la sposterebbe di un giorno in ogni fuso
 *    a ovest di Greenwich;
 *  · un **istante** (`2026-09-01T22:45:00.000Z`, o un `Date` in mano) diventa il giorno di **Roma**,
 *    che è quello che intende chi lo ha scelto.
 */
function giornoScelto(raw: Date | string): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : aGiorno(raw);
  const testo = String(raw);
  if (Number.isNaN(new Date(testo).getTime())) return null;
  return toDateOnly(testo);
}

/**
 * Valida e normalizza la data scelta dalla cliente.
 *
 * `oggi` è un parametro e non `new Date()` per una ragione pratica: così il caso «la data è oggi»,
 * quello di mezzanotte e quello del limite a dodici mesi si possono provare senza aspettare il
 * calendario.
 */
export function validaDataInizio(raw: unknown, oggi: Date = new Date()): EsitoData {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: false, motivo: 'mancante' };
  }
  const giorno = giornoScelto(raw as Date | string);
  if (!giorno) return { ok: false, motivo: 'illeggibile' };

  const primo = aGiorno(oggi);
  if (giorno.getTime() < primo.getTime()) return { ok: false, motivo: 'passato' };

  /**
   * ⚠️ **`setUTCMonth`, non `setMonth`**: `primo` è una mezzanotte **UTC**, e `setMonth` la
   * sposterebbe leggendo i campi nel fuso del processo — su un portatile italiano il limite cadrebbe
   * un giorno prima. Il salto di mese resta aritmetica di calendario (31/8 + 12 mesi → 31/8), che è
   * quello che si intende con «entro dodici mesi».
   */
  const limite = new Date(primo);
  limite.setUTCMonth(limite.getUTCMonth() + MESI_MAX_DATA_INIZIO);
  if (giorno.getTime() > limite.getTime()) return { ok: false, motivo: 'troppo_lontana' };

  return { ok: true, data: giorno };
}

/** Il messaggio che legge la cliente. Uno per motivo: «data non valida» non aiuta nessuno. */
export function messaggioData(motivo: Exclude<EsitoData, { ok: true }>['motivo']): string {
  switch (motivo) {
    case 'mancante':
      return 'Scegli il giorno in cui vuoi iniziare: senza quello non posso preparare i tuoi menu.';
    case 'illeggibile':
      return 'Non riesco a leggere quella data. Scegli il giorno dal calendario.';
    case 'passato':
      return 'Quel giorno è già passato: scegli oggi o un giorno futuro.';
    case 'troppo_lontana':
      return `Scegli una data entro ${MESI_MAX_DATA_INIZIO} mesi. Se non sai ancora quando iniziare va bene una data lontana: la cambi quando vuoi dal tuo profilo.`;
  }
}
