import { FUSO } from '../common/date-only';
import { eFestivo } from './festivi';

/**
 * DALLA SETTIMANA TIPO AGLI ORARI PRENOTABILI — logica pura, niente Nest e niente Prisma.
 *
 * Come l'ha descritta Simone (12/8): «il nutrizionista inserisce gli slot in una settimana tipo,
 * esempio lunedì dalle 9 alle 10 poi dalle 10,05 alle 11.10, col flag "si ripete" — e se c'è il
 * flag è ripetuto per tutte le settimane. Poi può inserire i giorni di vacanza e lì gli slot si
 * chiudono in automatico (nei festivi li chiudiamo noi)».
 *
 * Tre cose che questo file decide, e che sono tutte e tre modi di sbagliare un appuntamento.
 *
 * ## 1. Gli orari sono MINUTI, non date
 *
 * Uno slot ricorrente è «lunedì, dal minuto 540 al minuto 600»: 9:00–10:00. Non è pignoleria — è
 * l'unico modo di scrivere «tutti i lunedì alle 9» senza legarlo a un istante. Se lo salvassimo
 * come `DateTime`, il lunedì dopo il cambio dell'ora quel «9:00» diventerebbe le 8 o le 10 per
 * metà anno, e nessuno se ne accorgerebbe fino alla prima cliente che si presenta all'ora
 * sbagliata.
 *
 * L'istante vero si calcola **al momento**, con `istanteRomano`, che sa dov'è il cambio d'ora.
 *
 * ## 2. Le sovrapposizioni si fermano alla CREAZIONE
 *
 * «Collisioni impossibili: lo slot è unico, non consentiamo sovrapposizioni alla creazione»
 * (Simone). È la scelta giusta e va detta: sorvegliare le collisioni al momento della prenotazione
 * significa scoprirle quando due clienti hanno già premuto il pulsante. Qui invece uno slot che si
 * accavalla a un altro **non nasce**, e da lì in poi il problema non esiste più.
 *
 * ## 3. Un giorno chiuso non è un giorno senza slot
 *
 * Ferie e festività non cancellano niente: tolgono le occorrenze di quel giorno. La settimana tipo
 * resta scritta, e quando le ferie finiscono torna da sé.
 */

/** Uno slot come lo scrive il nutrizionista. Gli orari sono minuti dalla mezzanotte, ora romana. */
export interface SlotDefinito {
  id: string;
  /** 0 = domenica … 6 = sabato. Valorizzato SOLO sugli slot che si ripetono. */
  weekday: number | null;
  /** `YYYY-MM-DD`. Valorizzata SOLO sugli slot una tantum. */
  data: string | null;
  inizioMin: number;
  fineMin: number;
  ripete: boolean;
}

/** Un giorno in cui il nutrizionista non riceve. Estremi INCLUSI. */
export interface PeriodoChiuso {
  dal: string;
  al: string;
}

/** Un orario concreto, prenotabile. */
export interface Occorrenza {
  slotId: string;
  data: string;
  inizioMin: number;
  fineMin: number;
}

export const MINUTI_IN_UN_GIORNO = 24 * 60;

// ---------- Orari ----------

/** `09:05` → 545. `null` se non è un orario. */
export function minutiDaOra(ora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((ora ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 545 → `09:05`. */
export function oraDaMinuti(minuti: number): string {
  const m = Math.max(0, Math.min(MINUTI_IN_UN_GIORNO - 1, Math.round(minuti)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---------- Il fuso, dove fa male ----------

let parti: Intl.DateTimeFormat | null = null;
function formattatore(): Intl.DateTimeFormat | null {
  if (parti) return parti;
  try {
    parti = new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    return parti;
  } catch {
    return null;
  }
}

/** Di quanti minuti Roma è avanti rispetto a UTC, in QUEL momento (+60 d'inverno, +120 d'estate). */
export function offsetRomaMinuti(istante: Date): number {
  const f = formattatore();
  if (!f) return 0;
  const p = Object.fromEntries(f.formatToParts(istante).map((x) => [x.type, x.value]));
  const comeSeUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return Math.round((comeSeUtc - istante.getTime()) / 60000);
}

/**
 * L'istante vero di «quel giorno, a quel minuto, a Roma».
 *
 * ⚠️ Due passate, e la seconda non è un lusso. La prima ipotesi usa l'offset dell'istante
 * sbagliato (quello letto come se fosse UTC); nei giorni del cambio dell'ora quell'offset può
 * essere quello di prima del cambio, e l'appuntamento finirebbe un'ora fuori. La seconda passata
 * ricalcola l'offset sull'istante corretto e, se è cambiato, lo usa. È il caso di due domeniche
 * l'anno — cioè di due domeniche l'anno in cui una cliente si presenta a un'ora che nessuno le ha
 * detto.
 */
export function istanteRomano(data: string, minuti: number): Date {
  const [a, m, g] = data.split('-').map(Number);
  const comeSeUtc = Date.UTC(a, (m ?? 1) - 1, g ?? 1, Math.floor(minuti / 60), minuti % 60);
  const primoOffset = offsetRomaMinuti(new Date(comeSeUtc));
  let istante = comeSeUtc - primoOffset * 60000;
  const secondoOffset = offsetRomaMinuti(new Date(istante));
  if (secondoOffset !== primoOffset) istante = comeSeUtc - secondoOffset * 60000;
  return new Date(istante);
}

// ---------- Sovrapposizioni ----------

/**
 * Due intervalli si accavallano? Estremi **aperti a destra**: uno slot che finisce alle 10:00 e
 * uno che comincia alle 10:00 non si accavallano. È il caso normale di un'agenda attaccata, e
 * trattarlo come collisione impedirebbe di scrivere la giornata più ovvia che esista.
 */
export const siAccavallano = (
  a: { inizioMin: number; fineMin: number },
  b: { inizioMin: number; fineMin: number },
): boolean => a.inizioMin < b.fineMin && b.inizioMin < a.fineMin;

const giornoDellaSettimana = (data: string): number => {
  const [a, m, g] = data.split('-').map(Number);
  return new Date(Date.UTC(a, (m ?? 1) - 1, g ?? 1)).getUTCDay();
};

/** Il giorno della settimana di uno slot, comunque sia stato scritto. */
export const weekdayDi = (s: SlotDefinito): number | null =>
  s.ripete ? s.weekday : s.data ? giornoDellaSettimana(s.data) : null;

/**
 * Lo slot esistente con cui il nuovo si accavalla, o `null`.
 *
 * Il confronto è sul giorno della settimana quando almeno uno dei due si ripete — un ricorrente
 * del lunedì tocca **tutti** i lunedì, quindi anche il lunedì di quello una tantum. Due slot una
 * tantum si confrontano solo se sono lo stesso giorno.
 */
export function slotInConflitto(nuovo: SlotDefinito, esistenti: SlotDefinito[]): SlotDefinito | null {
  const wNuovo = weekdayDi(nuovo);
  for (const e of esistenti) {
    if (e.id === nuovo.id) continue;
    if (!siAccavallano(nuovo, e)) continue;
    if (!nuovo.ripete && !e.ripete) {
      if (nuovo.data && e.data && nuovo.data === e.data) return e;
      continue;
    }
    if (wNuovo !== null && wNuovo === weekdayDi(e)) return e;
  }
  return null;
}

/** Errori possibili di uno slot scritto male, come frasi da mostrare. */
export function erroreDelloSlot(s: { inizioMin: number; fineMin: number; ripete: boolean; weekday: number | null; data: string | null }): string | null {
  if (!Number.isInteger(s.inizioMin) || !Number.isInteger(s.fineMin)) return 'Gli orari non sono validi.';
  if (s.inizioMin < 0 || s.fineMin > MINUTI_IN_UN_GIORNO) return 'Gli orari devono stare dentro la giornata.';
  if (s.fineMin <= s.inizioMin) return "L'ora di fine deve venire dopo quella di inizio.";
  // Uno slot di cinque minuti è quasi sempre un refuso; uno di otto ore non è uno slot.
  if (s.fineMin - s.inizioMin < 10) return 'Uno slot dura almeno 10 minuti.';
  if (s.fineMin - s.inizioMin > 8 * 60) return 'Uno slot non può durare più di 8 ore.';
  if (s.ripete && (s.weekday === null || s.weekday < 0 || s.weekday > 6)) return 'Scegli il giorno della settimana.';
  if (!s.ripete && !s.data) return 'Scegli la data.';
  return null;
}

// ---------- Da settimana tipo a orari veri ----------

const sommaGiorni = (data: string, giorni: number): string => {
  const [a, m, g] = data.split('-').map(Number);
  const d = new Date(Date.UTC(a, (m ?? 1) - 1, g ?? 1));
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
};

const dentro = (data: string, p: PeriodoChiuso): boolean => data >= p.dal && data <= p.al;

/**
 * Gli orari concreti di un intervallo di giorni: la settimana tipo srotolata, meno le ferie e meno
 * le festività.
 *
 * ⚠️ Non toglie gli slot già prenotati: quello lo sa solo il database, e mescolare le due cose qui
 * vorrebbe dire non poter più testare questa funzione senza un database. Il chiamante toglie i
 * prenotati dal risultato.
 */
export function occorrenze(
  slots: SlotDefinito[],
  chiusure: PeriodoChiuso[],
  dal: string,
  al: string,
): Occorrenza[] {
  const out: Occorrenza[] = [];
  if (!slots.length || dal > al) return out;
  // Un tetto sull'intervallo: chiedere sei anni di disponibilità è un errore di chi chiama, e
  // srotolarli sarebbe un milione di righe.
  for (let data = dal, giri = 0; data <= al && giri < 400; data = sommaGiorni(data, 1), giri += 1) {
    if (eFestivo(data)) continue;
    if (chiusure.some((c) => dentro(data, c))) continue;
    const w = giornoDellaSettimana(data);
    for (const s of slots) {
      const vale = s.ripete ? s.weekday === w : s.data === data;
      if (!vale) continue;
      out.push({ slotId: s.id, data, inizioMin: s.inizioMin, fineMin: s.fineMin });
    }
  }
  return out.sort((a, b) => (a.data === b.data ? a.inizioMin - b.inizioMin : a.data < b.data ? -1 : 1));
}
