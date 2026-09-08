/**
 * ⛔ **QUANDO IL MENU CAMBIA SOTTO, LA CLIENTE LO DEVE SAPERE** — 8/9.
 *
 * L'8/9 la decisione di Simone — *«il nutrizionista sostituisce anche se il cliente ha già visto.
 * Vince su tutto»* — ha tolto il cancello che impediva di riscrivere un giorno già aperto. La
 * revisione avversariale ha trovato subito la metà che mancava: **non esisteva niente che lo dicesse
 * alla cliente**, da nessuna delle due porte.
 *
 * ⚠️ E il caso peggiore è il caso **normale**, non un caso di bordo: aprire la **lista della spesa**
 * segna aperti **tutti e sette** i giorni consegnati (`segnaGiorniAperti`), quindi chi viene
 * riscritto è quasi sempre chi **ha già comprato**. La lista si ricalcola a ogni lettura: le voci
 * del piatto tolto spariscono **insieme alla loro spunta**, quelle nuove compaiono da spuntare, e
 * una quantità già spuntata può cambiare sotto. Senza una riga che dica perché, la cliente vede una
 * lista che si è rimescolata da sola, con in frigo la roba di un menu che non esiste più.
 *
 * ⛔ **Si avvisa SOLO se l'aveva davvero aperto**, non a ogni scrittura a mano. La nutrizionista
 * compone giornate future tutti i giorni: un avviso per ognuna sarebbe un campanello che suona
 * sempre, cioè un campanello che si smette di guardare. ⚠️ Il prezzo di questa scelta va detto:
 * chi ha l'app vecchia non ci manda le aperture (`apertureTracciate: false`), quindi **non riceve
 * questo avviso** anche se il menu ce l'aveva in mano. È un buco che si chiude da solo man mano che
 * le app si aggiornano, e nel frattempo la coda che la nutrizionista legge dice «valuta se
 * avvisarla»: la strada umana resta aperta.
 *
 * ⚠️ **Una funzione libera, non un servizio.** `MenuAManoService` e `VeraChatService` stanno in due
 * moduli diversi, e la regola deve essere **una**: se ognuno si scrivesse la sua notifica, il giorno
 * che una delle due cambia testo l'altra continuerebbe a dire la frase vecchia senza dirlo a
 * nessuno. È la stessa forma di `notificaUtente` e `avvisaCoachDellaCliente`.
 */
import { distanzaGiorni, etichettaGiorno } from './giorno-conversazione';
import { giornoLocale } from '../common/date-only';
import { notificaUtente, type PushMinimo } from '../notifications/notifica-utente';
import type { PrismaService } from '../prisma/prisma.service';

/** Il tipo della riga: serve a contarle, e a spegnerle un giorno se diventassero troppe. */
export const TIPO_AVVISO_GIORNO_RISCRITTO = 'menu_giorno_riscritto';

/**
 * ⚠️ **`kind` è quello che l'app legge per sapere DOVE portare** il tocco: `/menu?giorno=…`, cioè
 * proprio la giornata cambiata. Senza, la notifica direbbe «è cambiato qualcosa» e lascerebbe
 * cercare — che su una lista della spesa già fatta è la parte peggiore.
 */
export const KIND_GIORNO_RISCRITTO = 'menu_giorno_cambiato';

/**
 * Il testo, separato dall'invio così si prova senza finti.
 *
 * ⚠️ **Non nomina chi l'ha riscritto.** La rotta la possono usare nutrizionista, capo nutrizionista
 * e admin: scrivere «la tua nutrizionista» sarebbe vero quasi sempre e falso qualche volta, e una
 * notifica che dice il falso su chi ha toccato il suo menu è peggio di una che non lo dice.
 */
export function testoGiornoRiscritto(dataISO: string, oggiISO: string): { title: string; body: string } {
  const quando = etichettaGiorno(dataISO, oggiISO);
  return {
    title: `Il menu di ${quando} è cambiato`,
    body:
      'Quella giornata è stata rivista dopo che l\'avevi già aperta. '
      + 'Se avevi già fatto la spesa, ricontrolla la lista: qualche ingrediente può essere diverso.',
  };
}

/**
 * ⚠️ **Cosa è successo davvero**, perché chi ha appena scritto il menu deve poterlo dire senza
 * indovinare: la coda che legge la nutrizionista cambia a seconda che l'avviso sia partito o no.
 */
export type Esito = 'avvisata' | 'gia_detto' | 'passato';

/**
 * Avvisa la cliente che una sua giornata è stata riscritta.
 *
 * ⚠️ Non lancia mai (lo garantisce `notificaUtente`): il lavoro vero è il menu, e un avviso che non
 * parte non deve far tornare indietro una giornata già scritta.
 */
export async function avvisaGiornoRiscritto(
  prisma: PrismaService,
  push: PushMinimo,
  input: { clientId: string; dataISO: string; adesso?: Date },
): Promise<Esito> {
  const oggiISO = giornoLocale(input.adesso ?? new Date());

  /**
   * ⛔ **UN GIORNO GIÀ PASSATO NON SI AVVISA** — revisione avversariale, 8/9. `giornoValido` non
   * rifiuta le date passate, quindi si può correggere una giornata di ieri: dirle «ricontrolla la
   * lista della spesa» per un pranzo che ha già mangiato è un allarme senza niente da fare, e un
   * allarme senza niente da fare insegna a non aprirli.
   */
  if (distanzaGiorni(input.dataISO, oggiISO) < 0) return 'passato';

  /**
   * ⛔ **NON SI SUONA TRE VOLTE PER LA STESSA GIORNATA.** La nutrizionista salva, si accorge che la
   * cena non torna, risalva, poi corregge lo spuntino: senza questo, alla cliente arrivano tre
   * push identiche in cinque minuti — cioè il «campanello che suona sempre» preso da un'altra
   * strada.
   *
   * ⚠️ Il confine è **«non l'ha ancora letta»**, non una finestra di tempo: finché quella riga è lì
   * da leggere, dice già tutto quello che direbbe la seconda. Se invece l'ha letta e il giorno
   * cambia di nuovo, è una notizia nuova e va data.
   *
   * ⚠️ Si filtra in memoria e non con un `path` dentro il JSON: sono poche righe non lette per
   * cliente, e una query che dipende dalla forma del JSON è la prima a rompersi in silenzio.
   */
  const daLeggere = (await prisma.notification.findMany({
    where: { userId: input.clientId, type: TIPO_AVVISO_GIORNO_RISCRITTO, readAt: null, archivedAt: null },
    select: { payload: true },
    take: 20,
  }).catch(() => [])) as { payload?: unknown }[];
  const giaDetto = daLeggere.some((r) => (r.payload as { giorno?: unknown } | null)?.giorno === input.dataISO);
  if (giaDetto) return 'gia_detto';

  const { title, body } = testoGiornoRiscritto(input.dataISO, oggiISO);
  await notificaUtente(prisma, push, {
    userId: input.clientId,
    type: TIPO_AVVISO_GIORNO_RISCRITTO,
    title,
    body,
    payload: { kind: KIND_GIORNO_RISCRITTO, giorno: input.dataISO },
  });
  return 'avvisata';
}

/**
 * ⛔ **COSA LEGGE CHI HA APPENA SALVATO — e l'8/9 era esattamente al contrario.**
 *
 * La prima stesura diceva «valuta se avvisarla» **quando l'avviso era appena partito da solo** (la
 * cliente riceveva la notizia due volte, una dal sistema e una dalla nutrizionista che credeva di
 * essere l'unica), e **non diceva niente** nel caso «non lo so» — cioè il solo caso in cui la
 * strada umana è l'unica che resta, perché l'app di quella cliente non ci manda le aperture.
 *
 * ⚠️ La spinta va dove serve: si chiede di scrivere **solo** quando nessun avviso è partito e
 * qualcuno potrebbe avere quel menu in mano.
 */
export function codaPerChiHaSalvato(esito: Esito | null, nonSappiamo: boolean): string | null {
  if (esito === 'avvisata') {
    return 'La cliente quel giorno lo aveva già aperto: l\'abbiamo avvisata, le è arrivato «Il menu '
      + 'di quel giorno è cambiato».';
  }
  /** ⚠️ Già avvisata poco fa e non ancora letta: non gliene mandiamo una seconda, e lo si dice. */
  if (esito === 'gia_detto') {
    return 'La cliente quel giorno lo aveva già aperto. Un avviso le era appena arrivato e non l\'ha '
      + 'ancora letto, quindi non gliene abbiamo mandato un altro.';
  }
  /** ⚠️ Riscritto un giorno passato: non le si dice niente perché non c'è più niente da fare. */
  if (esito === 'passato') {
    return 'Quel giorno è già passato: non le abbiamo mandato nessun avviso, non ci sarebbe stato '
      + 'niente da fare.';
  }
  if (nonSappiamo) {
    /**
     * ⚠️ **Niente asterischi**: questa riga la legge la nutrizionista in DUE posti — il banner di
     * «Scrivi il menu a mano», che è testo semplice, e la chat di Vera, che disegna il markdown.
     * Uno dei due mostrerebbe gli asterischi. Una sentinella del progetto lo pretende, e ha preso
     * questa riga il giorno che è stata scritta.
     */
    return 'La sua app non ci dice se aveva già aperto quel giorno, quindi non le è partito nessun '
      + 'avviso: se pensi che ce l\'avesse in mano, scrivile tu.';
  }
  return null;
}

/**
 * ⛔ **«È CAMBIATO» DEV'ESSERE VERO** — revisione avversariale, 8/9.
 *
 * Salvare non vuol dire cambiare: si riapre una giornata, si guarda, si salva senza toccare niente
 * — o si scrive solo il motivo di una forzatura. Mandare «il menu di giovedì è cambiato,
 * ricontrolla la spesa» a chi ha in mano **esattamente gli stessi piatti** è un allarme falso, e un
 * allarme falso costa più di un allarme mancato: la prossima volta non lo apre.
 *
 * ⚠️ Si confrontano **pasto e ricetta**, non l'oggetto intero: le kcal ricalcolate, il nome di chi
 * ha salvato o una nota interna cambiano la riga senza cambiare niente di quello che lei cucina.
 */
export function laGiornataECambiata(prima: unknown, dopo: unknown): boolean {
  const chiave = (m: unknown): string => {
    const righe = Array.isArray(m) ? m : [];
    return righe
      .map((r) => {
        const p = (r ?? {}) as { slot?: unknown; recipeId?: unknown };
        return `${String(p.slot ?? '')}:${String(p.recipeId ?? '')}`;
      })
      .sort()
      .join('|');
  };
  return chiave(prima) !== chiave(dopo);
}
