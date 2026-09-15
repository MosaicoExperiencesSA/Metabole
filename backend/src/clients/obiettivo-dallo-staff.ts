import { giornoLocale } from '../common/date-only';
import { validateObjective, type ObjectivePace } from '../onboarding/objective-validator';

/**
 * ⛔ **L'OBIETTIVO DI UNA CLIENTE CAMBIATO DALLO STAFF — il giudizio, in un posto solo** (Simone,
 * 15/9: *«admin deve poter modificare l'obiettivo di una cliente»*).
 *
 * Fino a oggi l'obiettivo lo cambiava **solo la cliente**, dall'app (`PATCH /me/objective`). In
 * scheda la card era in sola lettura: se una cliente si era data 10 kg in un mese, nessuno dello
 * staff poteva correggerlo — e quel numero non è un'etichetta, **decide le calorie**:
 * `kcal-need.service` ricava il deficit da `(peso attuale − peso obiettivo) / settimane rimaste`.
 *
 * Qui si decide **se** si scrive, e cosa si dice a chi ha premuto. Il service legge e scrive e
 * basta: *il giudizio sta nel modulo puro*.
 *
 * ⚠️ **Il ritmo si misura sul peso DI ADESSO, non su quello di partenza.** Il percorso della
 * cliente in app lo misura su `startWeightKg`, ma le calorie no: le calcola sulla tendenza
 * (`estimate().weightKg`). Uno staff che corregge l'obiettivo deve vedere il ritmo che **arriverà
 * nel piatto**, non un altro.
 *
 * ⚠️ **Un ritmo irreale non si blocca, si conferma.** Chi scrive qui è un professionista (lo stesso
 * criterio del «sotto soglia» delle calorie): lo può fare, ma non per sbaglio. Il primo invio senza
 * `conferma` torna indietro **con dentro il ritmo**, e il secondo passa.
 */

export interface RichiestaObiettivo {
  targetWeightKg: number;
  /** `AAAA-MM-GG` — una data e basta. */
  targetDate: string;
  conferma?: boolean;
}

export interface Ritmo {
  pace: ObjectivePace;
  kgDaPerdere: number;
  settimane: number;
  kgASettimana: number;
}

export type EsitoObiettivo =
  | { esito: 'rifiuta'; messaggio: string }
  | { esito: 'da_confermare'; messaggio: string; ritmo: Ritmo }
  | { esito: 'scrivi'; ritmo: Ritmo | null; avvisi: string[] };

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const GIORNO_MS = 86_400_000;

const kg = (n: number) => n.toFixed(1).replace('.', ',');
/** ⚠️ I ritmi con due decimali: con uno, 1,04 kg/settimana si leggeva «1,0, oltre la soglia di 1,0». */
const ritmoDetto = (n: number) => n.toFixed(2).replace('.', ',');
const gg = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Il giorno esiste davvero? `new Date('2026-02-30')` non è un errore in JavaScript: è il 2 marzo.
 * Una data obiettivo spostata di due giorni, con la nota che dice il 30 febbraio, non la controlla
 * nessuno.
 */
function esiste(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function valutaObiettivoDalloStaff(input: {
  richiesta: RichiestaObiettivo;
  /**
   * Il peso su cui si misura il ritmo: la **tendenza** da cui partono le calorie, e se quella non
   * c'è (pesate incoerenti, profilo incompleto) l'ultima pesata o il peso di partenza. `null` solo
   * se la cliente non ha **nessun** peso.
   *
   * ⛔ Non basta «nessuna tendenza → nessun ritmo»: vorrebbe dire che su una cliente con le pesate
   * da verificare passa qualunque obiettivo senza conferma, e appena la pesata è corretta quel
   * ritmo arriva nel piatto.
   */
  pesoPerIlRitmo: number | null;
  /** `true` se `pesoPerIlRitmo` non è la tendenza: lo si dice. */
  pesoDaUnaPesata?: boolean;
  /** Il giorno di oggi nel fuso dell'azienda, `AAAA-MM-GG` (`giornoLocale(new Date())`). */
  oggi: string;
  /** Il giorno (di Roma) dell'obiettivo che c'è già, o `null`. */
  dataDiPrima?: string | null;
  /** C'è un deficit scritto a mano dal nutrizionista: finché resta, l'obiettivo non muove le calorie. */
  deficitImposto?: boolean;
  /** Fase mantenimento: il motore non toglie calorie, qualunque sia l'obiettivo. */
  inMantenimento?: boolean;
  sogliaSostenibile: number;
  sogliaAmbiziosa: number;
}): EsitoObiettivo {
  const { richiesta, pesoPerIlRitmo, oggi } = input;
  const data = String(richiesta.targetDate ?? '').trim();
  if (!SOLO_DATA.test(data) || !esiste(data)) {
    return { esito: 'rifiuta', messaggio: 'Data non valida: scrivila come AAAA-MM-GG, con un giorno che esiste.' };
  }
  const peso = Number(richiesta.targetWeightKg);
  if (!Number.isFinite(peso) || peso <= 0) {
    return { esito: 'rifiuta', messaggio: 'Il peso obiettivo va scritto in kg.' };
  }

  const avvisi: string[] = [];
  /**
   * ⚠️ Perché si dicono PRIMA del ritmo: il ritmo resta vero (varrà il giorno che il deficit a mano
   * si toglie, o che la fase torna dimagrimento), ma oggi nel piatto non arriva. Chi preme deve
   * saperlo, e la conferma di un ritmo irreale si chiede lo stesso.
   */
  if (input.deficitImposto) {
    avvisi.push('Il deficit lo ha scritto a mano il nutrizionista: finché resta, questo obiettivo non cambia le calorie.');
  }
  if (input.inMantenimento) {
    avvisi.push('La cliente è in fase mantenimento: il motore non toglie calorie, qualunque sia l\'obiettivo.');
  }

  // ⚠️ Confronto fra stringhe `AAAA-MM-GG`: il giorno di oggi è quello di Roma, non quello UTC.
  if (data <= oggi) {
    /**
     * ⚠️ **Una data già passata che nessuno ha toccato non ferma il salvataggio**: su un obiettivo
     * scaduto si deve poter correggere la vita o i fianchi senza essere costretti a inventare una
     * data nuova. Si dice, e basta.
     */
    if (input.dataDiPrima && data === input.dataDiPrima) {
      avvisi.push(`La data dell'obiettivo (${gg(data)}) è già passata: il motore non ne ricava un ritmo e usa il deficit di default.`);
      return { esito: 'scrivi', ritmo: null, avvisi };
    }
    return {
      esito: 'rifiuta',
      messaggio: `La data dell'obiettivo deve essere dopo oggi (${gg(oggi)}): un obiettivo già scaduto non dà nessun ritmo.`,
    };
  }

  const giorni = Math.round(
    (new Date(`${data}T00:00:00.000Z`).getTime() - new Date(`${oggi}T00:00:00.000Z`).getTime()) / GIORNO_MS,
  );
  const settimane = Math.round((giorni / 7) * 10) / 10;

  /**
   * ⚠️ **A una settimana o meno il motore non ricava un ritmo dall'obiettivo**
   * (`deficitFromObjectiveRate`: `(targetDate − adesso) < 1 settimana → null`) e ripiega sul
   * **deficit di default** (`kcal_need_default_deficit_pct`). ⛔ **Sette giorni compresi**: la data è
   * la mezzanotte, e «adesso» è già oltre la mezzanotte di oggi — quindi a sette giorni di
   * calendario mancano meno di sette giorni veri. Si scrive lo stesso, ma va detto.
   */
  if (giorni <= 7) {
    avvisi.push("Con una settimana o meno alla data il motore non ricava un ritmo dall'obiettivo e usa il deficit di default.");
  }

  if (pesoPerIlRitmo == null) {
    avvisi.push('Il ritmo non si può calcolare: la cliente non ha nessun peso registrato.');
    return { esito: 'scrivi', ritmo: null, avvisi };
  }
  const pesoAttualeKg = pesoPerIlRitmo;
  if (input.pesoDaUnaPesata) {
    avvisi.push(
      `Ritmo misurato su ${kg(pesoAttualeKg)} kg (ultima pesata o peso di partenza): oggi le calorie non partono ` +
        'dalla tendenza — pesate da verificare o profilo incompleto.',
    );
  }

  const kgDaPerdere = Math.round((pesoAttualeKg - peso) * 10) / 10;
  if (kgDaPerdere <= 0) {
    avvisi.push(
      `Il peso obiettivo (${kg(peso)} kg) non è sotto il peso di adesso (${kg(pesoAttualeKg)} kg): ` +
        "il motore non ne ricava un ritmo e usa il deficit di default (per non togliere calorie serve la fase mantenimento).",
    );
    return { esito: 'scrivi', ritmo: null, avvisi };
  }

  const v = validateObjective({
    weightToLoseKg: kgDaPerdere,
    weeks: giorni / 7,
    sustainableRateMaxKgWeek: input.sogliaSostenibile,
    ambitiousRateMaxKgWeek: input.sogliaAmbiziosa,
    // ⚠️ Qui l'azione configurata per la cliente non vale: lo staff decide, con una conferma.
    unrealAction: 'warn',
  });
  const ritmo: Ritmo = { pace: v.pace, kgDaPerdere, settimane, kgASettimana: v.ratePerWeek };

  if (v.pace === 'unreal') {
    const frase =
      `${kg(kgDaPerdere)} kg in ${kg(settimane)} settimane sono ${ritmoDetto(v.ratePerWeek)} kg a settimana, ` +
      `oltre la soglia di ${ritmoDetto(input.sogliaAmbiziosa)}. A ritmo sano servono circa ${v.suggestedWeeks} settimane.`;
    if (richiesta.conferma !== true) {
      const contesto = avvisi.length ? ` ${avvisi.join(' ')}` : '';
      return { esito: 'da_confermare', messaggio: `Attenzione: ${frase}${contesto} Se è quello che vuoi, conferma.`, ritmo };
    }
    avvisi.push(`Ritmo oltre la soglia, confermato: ${frase}`);
  } else if (v.pace === 'ambitious') {
    avvisi.push(`Ritmo ambizioso: ${ritmoDetto(v.ratePerWeek)} kg a settimana.`);
  }
  return { esito: 'scrivi', ritmo, avvisi };
}

/** La riga che resta nelle note della scheda: chi, quando, da cosa a cosa, e perché. */
export function testoNotaObiettivo(d: {
  prima: { targetWeightKg: number | null; targetDate: Date | null } | null;
  dopo: { targetWeightKg: number; targetDate: string };
  targetPrima: number | null;
  targetDopo: number | null;
  chi: string;
  quando: Date;
  motivo: string;
}): string {
  const descrivi = (p: number | null, data: string | null) =>
    p == null && !data ? 'nessuno' : `${p == null ? '—' : `${kg(p)} kg`}${data ? ` entro il ${gg(data)}` : ''}`;
  // ⚠️ Il giorno di Roma, come lo mostra la scheda: la cliente dall'app salva un istante qualunque.
  const primaData = d.prima?.targetDate ? giornoLocale(d.prima.targetDate) : null;
  const kcal =
    d.targetPrima != null && d.targetDopo != null && d.targetPrima !== d.targetDopo
      ? ` Calorie: da ${d.targetPrima} a ${d.targetDopo} kcal/giorno.`
      : '';
  return (
    `Obiettivo cambiato da ${d.chi} il ${gg(giornoLocale(d.quando))}: ` +
    `da ${descrivi(d.prima?.targetWeightKg ?? null, primaData)} a ${descrivi(d.dopo.targetWeightKg, d.dopo.targetDate)}.` +
    `${kcal} Motivo: ${d.motivo}`
  );
}

/**
 * ⛔ **LA CLIENTE RISCRIVE DALL'APP UN OBIETTIVO DECISO DALLO STAFF** (Simone, 15/9: lo può fare, ma
 * chi l'aveva deciso lo deve sapere).
 *
 * Si guarda **l'ultima riga** dello storico prima della modifica: se è `updated_by_staff`, questa
 * modifica della cliente sta scrivendo sopra una decisione dello staff. Se l'ultima è già sua, la
 * decisione è stata riscritta prima — e allora l'avviso è già partito quella volta.
 */
export interface DecisioneDelloStaff {
  at: string | null;
  byUserId: string | null;
  motivo: string | null;
}

export function decisioneDelloStaffDaAvvisare(history: unknown): DecisioneDelloStaff | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const ultima = history[history.length - 1] as Record<string, unknown> | null;
  if (!ultima || typeof ultima !== 'object' || ultima.event !== 'updated_by_staff') return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  return { at: str(ultima.at), byUserId: str(ultima.byUserId), motivo: str(ultima.motivo) };
}

/** Il testo dell'avviso e della nota: chi, da cosa a cosa, e cosa aveva deciso lo staff. */
export function testoObiettivoRiscritto(d: {
  nome: string;
  prima: { targetWeightKg: number | null; targetDate: Date | null };
  dopo: { targetWeightKg: number | null; targetDate: Date | null };
  decisa: DecisioneDelloStaff;
}): string {
  const descrivi = (o: { targetWeightKg: number | null; targetDate: Date | null }) =>
    `${o.targetWeightKg == null ? '—' : `${kg(o.targetWeightKg)} kg`}` +
    (o.targetDate ? ` entro il ${gg(giornoLocale(o.targetDate))}` : '');
  const quando = d.decisa.at && !Number.isNaN(new Date(d.decisa.at).getTime())
    ? ` il ${gg(giornoLocale(new Date(d.decisa.at)))}`
    : '';
  return (
    `${d.nome} ha cambiato dall'app l'obiettivo deciso dallo staff${quando}: ` +
    `da ${descrivi(d.prima)} a ${descrivi(d.dopo)}.` +
    (d.decisa.motivo ? ` Il motivo dello staff era: ${d.decisa.motivo}` : '')
  );
}
