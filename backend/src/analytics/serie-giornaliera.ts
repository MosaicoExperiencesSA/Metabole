/**
 * FATTURATO E NUOVE CLIENTI **PER GIORNATA** — logica pura.
 *
 * Richiesta di Simone dell'8/8, in due pezzi che vanno insieme:
 *
 *   «il fatturato cumulato: la scala di tempo deve essere a giorni e si azzera ogni mese, poi posso
 *    scorrere i mesi storici» · «sarebbe bello avere nello stesso grafico il confronto aggiornato
 *    alla giornata col mese precedente» · «un grafico coi nuovi clienti per giornata».
 *
 * ## Perché la serie mensile non bastava
 *
 * La pagina Grafici aveva (e conserva) una serie a **sei mesi**, un punto per mese. Con quella, la
 * domanda che interessa a metà mese — «stiamo andando meglio o peggio del mese scorso?» — non ha
 * risposta: il totale di un mese finito contro un mese a metà non dice niente, e sembra sempre un
 * crollo. Il confronto che informa è **alla stessa giornata**: l'8 agosto contro l'8 luglio.
 *
 * ## Perché sta in un file a parte, e puro
 *
 * Perché la parte che si sbaglia è il **giorno**. Il giorno di un incasso è quello di Europe/Rome
 * (`giornoLocale`), non quello UTC: un pagamento delle 00:30 del 1° agosto è di luglio per UTC e di
 * agosto per noi — e finirebbe nel mese sbagliato, con l'aggravante che il totale del mese resta
 * giusto e solo i due grafici non tornano. Qui il raggruppamento si verifica con date fisse, senza
 * database e senza aspettare la mezzanotte.
 */

import { giornoLocale } from '../common/date-only';

/** `2026-08` → l'anno e il mese, o `null` se la stringa non è un mese. */
export function leggiMese(mese: string | undefined | null): { anno: number; mese: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec((mese ?? '').trim());
  if (!m) return null;
  const anno = +m[1];
  const numero = +m[2];
  if (numero < 1 || numero > 12 || anno < 2000 || anno > 2100) return null;
  return { anno, mese: numero };
}

/** `2026-08` del mese in cui cade quell'istante, nel fuso dell'azienda. */
export const meseDi = (d: Date): string => giornoLocale(d).slice(0, 7);

/** Il mese prima (o dopo, con `passo` positivo) di `2026-08`. */
export function meseSpostato(mese: string, passo: number): string {
  const letto = leggiMese(mese);
  if (!letto) return mese;
  const totale = letto.anno * 12 + (letto.mese - 1) + passo;
  const anno = Math.floor(totale / 12);
  const numero = (totale % 12) + 1;
  return `${anno}-${String(numero).padStart(2, '0')}`;
}

/** Quanti giorni ha `2026-02`. */
export function giorniDelMese(mese: string): number {
  const letto = leggiMese(mese);
  if (!letto) return 31;
  return new Date(Date.UTC(letto.anno, letto.mese, 0)).getUTCDate();
}

const MESI_LUNGHI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** «agosto 2026»: l'etichetta che legge chi scorre i mesi. */
export function meseAParole(mese: string): string {
  const letto = leggiMese(mese);
  return letto ? `${MESI_LUNGHI[letto.mese - 1]} ${letto.anno}` : mese;
}

/**
 * L'intervallo di istanti da chiedere al database per coprire un mese **locale**.
 *
 * Largo un giorno per lato di proposito: il mese locale non coincide con il mese UTC, e chiedere
 * esattamente `[1° del mese, 1° del mese dopo)` in UTC taglierebbe fuori le prime ore del primo
 * giorno. Il filtro fine lo fa `raggruppaPerGiorno`, sul giorno locale.
 */
export function finestraDelMese(mese: string): { da: Date; a: Date } {
  const letto = leggiMese(mese) ?? { anno: 2000, mese: 1 };
  const inizio = Date.UTC(letto.anno, letto.mese - 1, 1);
  const fine = Date.UTC(letto.anno, letto.mese, 1);
  return { da: new Date(inizio - 86_400_000), a: new Date(fine + 86_400_000) };
}

export interface PuntoGiorno {
  /** Giorno del mese, da 1. */
  giorno: number;
  ricaviCents: number;
  /** Ricavi dal 1° del mese a questo giorno compreso: è la curva che si azzera ogni mese. */
  ricaviCumulatiCents: number;
  nuoveClienti: number;
  nuoveClientiCumulate: number;
}

export interface IngressoSerie {
  /** Pagamenti approvati, con l'istante vero: il giorno lo decide questa funzione. */
  pagamenti: { createdAt: Date; amountCents: number }[];
  /** Le clienti, con la data di iscrizione. */
  clienti: { createdAt: Date }[];
}

/**
 * La serie di un mese, un punto per giorno di calendario — **tutti** i giorni, anche quelli senza
 * incassi. Un grafico che salta i giorni vuoti mente sulla pendenza: due incassi a distanza di una
 * settimana sembrerebbero due giorni consecutivi.
 */
export function serieDelMese(mese: string, dati: IngressoSerie): PuntoGiorno[] {
  const giorni = giorniDelMese(mese);
  const ricaviPerGiorno = raggruppaPerGiorno(mese, dati.pagamenti, (p) => p.amountCents);
  const clientiPerGiorno = raggruppaPerGiorno(mese, dati.clienti, () => 1);

  let cumRicavi = 0;
  let cumClienti = 0;
  const out: PuntoGiorno[] = [];
  for (let g = 1; g <= giorni; g += 1) {
    const ricavi = ricaviPerGiorno.get(g) ?? 0;
    const nuove = clientiPerGiorno.get(g) ?? 0;
    cumRicavi += ricavi;
    cumClienti += nuove;
    out.push({
      giorno: g,
      ricaviCents: ricavi,
      ricaviCumulatiCents: cumRicavi,
      nuoveClienti: nuove,
      nuoveClientiCumulate: cumClienti,
    });
  }
  return out;
}

/**
 * Somma per giorno del mese, leggendo il giorno nel fuso dell'azienda. Quello che non appartiene a
 * `mese` viene scartato: è per questo che la finestra chiesta al database può essere larga.
 */
function raggruppaPerGiorno<T extends { createdAt: Date }>(
  mese: string,
  righe: T[],
  valore: (r: T) => number,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of righe) {
    const giorno = giornoLocale(r.createdAt);
    if (!giorno.startsWith(`${mese}-`)) continue;
    const g = Number(giorno.slice(8, 10));
    out.set(g, (out.get(g) ?? 0) + valore(r));
  }
  return out;
}

/**
 * Il confronto **alla stessa giornata**: quanto valeva il mese precedente il giorno in cui siamo
 * arrivati oggi. È il numero che risponde alla domanda vera, e non si può ricavare dai totali.
 *
 * `finoAlGiorno` è il giorno corrente se stiamo guardando il mese in corso, e l'ultimo giorno del
 * mese se stiamo guardando un mese finito — perché un mese chiuso si confronta per intero.
 */
export function confrontoAllaGiornata(
  serie: PuntoGiorno[],
  seriePrecedente: PuntoGiorno[],
  finoAlGiorno: number,
): {
  giorno: number;
  ricaviCents: number;
  ricaviPrecedenteCents: number;
  nuoveClienti: number;
  nuoveClientiPrecedente: number;
  /** Differenza in percentuale sui ricavi. `null` se il mese prima era a zero: non si divide. */
  variazionePct: number | null;
} {
  const fino = Math.max(1, Math.min(finoAlGiorno, serie.length || 1));
  const a = serie[fino - 1]?.ricaviCumulatiCents ?? 0;
  // Il mese prima può essere più corto (31 → 30 giorni): si prende l'ultimo punto che ha.
  const indicePrec = Math.min(fino, seriePrecedente.length) - 1;
  const b = indicePrec >= 0 ? seriePrecedente[indicePrec]?.ricaviCumulatiCents ?? 0 : 0;
  return {
    giorno: fino,
    ricaviCents: a,
    ricaviPrecedenteCents: b,
    nuoveClienti: serie[fino - 1]?.nuoveClientiCumulate ?? 0,
    nuoveClientiPrecedente: indicePrec >= 0 ? seriePrecedente[indicePrec]?.nuoveClientiCumulate ?? 0 : 0,
    variazionePct: b > 0 ? Math.round(((a - b) / b) * 100) : null,
  };
}
