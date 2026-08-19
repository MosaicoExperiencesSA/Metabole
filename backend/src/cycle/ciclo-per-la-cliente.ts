/**
 * COSA VEDE **LEI** DEL CICLO — e con quali parole.
 *
 * `GET /me/cycle` esiste dal principio e non lo chiama nessuno
 * (`progetto/DECISIONE_Due_Schermate_App.md`). Quello che manda dentro è pensato per il motore, e
 * darlo all'app così com'è vorrebbe dire mettere sotto gli occhi di una persona tre cose che non
 * sono per lei:
 *
 * ⚠️ **Il `gradimento` non è il gradimento.** È il minimo, fra le ricette del ciclo, del massimo
 * delle stelle che ognuna ha preso — con **default 5 quando una ricetta non è mai stata valutata**.
 * Scriverle «il tuo gradimento: 5 ⭐» quando non ha votato niente sarebbe **esattamente** il difetto
 * delle tre stelle inventate (voce 270), rifatto in una schermata. Resta fuori (decisione di Simone,
 * 19/8).
 *
 * ⚠️ **Gli esiti sono un enum** (`perso | stabile | preso | n.d.`). «esitoPeso: preso» non è una
 * frase che si scrive a una persona: qui diventa una riga in italiano, e ⚠️ **«n.d.» diventa il
 * silenzio** — non «non disponibile», che è un modo tecnico di dire una cosa che non si sa.
 *
 * ⚠️ **Il peso che è salito si dice**, senza girarci intorno e senza colpevolizzare: nascondere una
 * settimana storta vuol dire che la schermata parla solo quando le cose vanno bene, e allora smette
 * di essere un'informazione e diventa un applauso.
 */
import { etichettaMetodo } from '../common/metodi-cottura';

export type Esito = 'perso' | 'stabile' | 'preso' | 'n.d.' | string;

/**
 * I numeri piccoli si scrivono in lettere quando li legge una persona. Oltre il sette non serve:
 * `menu_days_delivered` è la finestra di un ciclo di menu, non un mese.
 */
const PAROLE = ['zero', 'un', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette'];
const inLettere = (n: number): string => PAROLE[n] ?? String(n);

export interface EsitoPrecedente {
  /** La riga da mostrare, già in italiano. */
  riga: string;
  /** Ha seguito il menu? Serve al tono di chi legge, non è un voto. */
  seguito: boolean;
}

/**
 * La riga sull'ultimo ciclo chiuso, o `null` se non c'è niente da dire.
 *
 * ⚠️ `null` e non una frase di circostanza: senza un esito, «non ci sono dati sul ciclo precedente»
 * occupa lo stesso spazio di un'informazione senza esserlo — e la prima cosa che si impara a
 * saltare è la riga che c'è sempre.
 */
export function esitoPrecedenteInItaliano(
  ultimo: { esitoPeso: Esito; esitoCm: Esito; followed: boolean; cycleEnd?: Date | null } | null | undefined,
  inizioDelCicloAttuale?: Date | null,
  giorniDelCiclo = 2,
): EsitoPrecedente | null {
  if (!ultimo) return null;
  /**
   * ⚠️ **PRECEDENTE VUOL DIRE PRECEDENTE.** Il feedback più recente può essere quello dei giorni che
   * sta guardando **adesso**: si scrive quando lei si pesa al secondo giorno del ciclo, cioè prima
   * che arrivi l'erogazione nuova. In quella finestra la scheda diceva «in questi giorni si cucina…»
   * e subito sotto «nei due giorni precedenti il peso è sceso» — parlando degli stessi due giorni.
   *
   * Se non si sa di quale ciclo parla l'esito (nessuna data), si tace: una riga che potrebbe
   * riferirsi a due periodi diversi non è un'informazione.
   */
  if (inizioDelCicloAttuale) {
    if (!ultimo.cycleEnd) return null;
    if (ultimo.cycleEnd.getTime() >= inizioDelCicloAttuale.getTime()) return null;
  }
  const peso = ultimo.esitoPeso;
  const cm = ultimo.esitoCm;
  // «n.d.» vuol dire che non c'erano misure per dirlo: allora non si dice.
  const noto = (e: Esito) => e === 'perso' || e === 'stabile' || e === 'preso';
  if (!noto(peso) && !noto(cm)) return null;

  const pezzi: string[] = [];
  if (noto(peso)) {
    pezzi.push(peso === 'perso' ? 'il peso è sceso' : peso === 'preso' ? 'il peso è salito' : 'il peso è rimasto stabile');
  }
  if (noto(cm)) {
    pezzi.push(cm === 'perso' ? 'i centimetri sono calati' : cm === 'preso' ? 'i centimetri sono aumentati' : 'i centimetri sono rimasti stabili');
  }

  // ⚠️ «Nei due giorni» non è scritto a mano: la finestra del ciclo è `menu_days_delivered`, e il
  // giorno che diventasse tre questa riga direbbe una cosa falsa senza che nessuno se ne accorga.
  // ⚠️ E il numero si scrive in lettere: «Nei 2 giorni precedenti» è il modo in cui parla un
  // programma, non una persona — e questa riga la legge lei.
  const quando = giorniDelCiclo === 1 ? 'Nel giorno precedente' : `Nei ${inLettere(giorniDelCiclo)} giorni precedenti`;
  return {
    riga: `${quando} ${pezzi.join(' e ')}.`,
    seguito: !!ultimo.followed,
  };
}

/** Le due cotture del ciclo, con l'etichetta che si legge — e senza i buchi. */
export function cottureDelCiclo(g1: string | null | undefined, g2: string | null | undefined): { tipo: string; etichetta: string }[] {
  // ⚠️ Le due cotture possono essere la stessa (o mancare): si mostra quello che c'è davvero.
  // «Al forno · Al forno» non è una varietà, è una riga che si è dimenticata di controllare.
  const viste = new Set<string>();
  const fuori: { tipo: string; etichetta: string }[] = [];
  for (const t of [g1, g2]) {
    if (!t || viste.has(t)) continue;
    viste.add(t);
    fuori.push({ tipo: t, etichetta: etichettaMetodo(t) });
  }
  return fuori;
}
