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
 *
 * ⛔ **E NON DICE «dopo che l'avevi già aperta» — corretto il 9/9.** Diceva così perché fino all'8
 * partiva solo per giornate che sapevamo aperte. Con le porte di Vera parte anche per quelle di cui
 * **non sappiamo** (app vecchia: il giorno del rilascio sono tutte), e su quelle la frase afferma un
 * fatto che non abbiamo — a lei, sul suo menu.
 *
 * ⚠️ **Il testo è UNO per tutti i chiamanti, e per due di loro la frase era vera.** Si è tolta lo
 * stesso: un testo condiviso può dire solo quello che vale per tutti quelli che lo mandano, e
 * l'alternativa — un parametro «lo sappiamo o no» da passare per cinque punti — è la strada per cui
 * fra un mese uno dei cinque lo passa sbagliato e nessuno se ne accorge. ⚠️ Non si perde niente: la
 * parte che serve è la seconda, ed è già condizionale — «**se** avevi già fatto la spesa».
 */
export function testoGiornoRiscritto(dataISO: string, oggiISO: string): { title: string; body: string } {
  const quando = etichettaGiorno(dataISO, oggiISO);
  return {
    title: `Il menu di ${quando} è cambiato`,
    body:
      'Quella giornata è stata rivista. '
      + 'Se avevi già fatto la spesa, ricontrolla la lista: qualche ingrediente può essere diverso.',
  };
}

/**
 * ⚠️ **Cosa è successo davvero**, perché chi ha appena scritto il menu deve poterlo dire senza
 * indovinare: la coda che legge la nutrizionista cambia a seconda che l'avviso sia partito o no.
 */
export type Esito = 'avvisata' | 'gia_detto' | 'passato' | 'non_partito';

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
  /** ⛔ «Avvisata» solo se la riga è stata scritta davvero: vedi il gemello multiplo qui sotto. */
  const scritta = await notificaUtente(prisma, push, {
    userId: input.clientId,
    type: TIPO_AVVISO_GIORNO_RISCRITTO,
    title,
    body,
    payload: { kind: KIND_GIORNO_RISCRITTO, giorno: input.dataISO },
  });
  return scritta ? 'avvisata' : 'non_partito';
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
  /**
   * ⛔ **L'AVVISO NON È PARTITO, e allora si chiede di farlo a voce** — 9/9, con `notificaUtente` che
   * ha imparato a dire se la riga è stata scritta. Prima questo caso non esisteva: cadeva nel `null`
   * finale, cioè **silenzio**, su una cliente che quel giorno l'aveva aperto davvero. È il caso in
   * cui la strada umana è l'unica rimasta, ed è quello in cui non si diceva niente.
   */
  if (esito === 'non_partito') {
    return 'La cliente quel giorno lo aveva già aperto e l\'avviso NON le è partito: scrivile tu, '
      + 'se può aver già fatto la spesa.';
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

/**
 * ⛔ **QUANDO I GIORNI RISCRITTI SONO PIÙ D'UNO** — 8/9, seconda metà della stessa decisione.
 *
 * «Rigenera menu» e la rierogazione automatica non toccano **un** giorno: cancellano e rifanno
 * **tutti quelli futuri**, e partono da sole a ogni cambio di kcal, di dieta, di pesata o di data
 * d'inizio. La conseguenza per la cliente è la stessa di una giornata riscritta a mano — solo
 * moltiplicata per sette — e fino a oggi non gliela diceva nessuno.
 *
 * ⚠️ **Un avviso solo, non uno per giorno.** Sette notifiche in fila per un gesto solo sono un
 * campanello che si smette di guardare, ed è il contrario di quello che questo avviso serve a fare.
 * Si nomina **il primo** giorno cambiato — «da giovedì 10 in poi» — perché è quello da cui la spesa
 * non vale più.
 *
 * ⚠️ **Stesso tipo e stesso `kind` dell'avviso singolo**, di proposito: il dedup, l'icona nella
 * campanella e la rotta del tocco sono già scritti una volta sola, e una seconda regola qui sarebbe
 * la seconda regola che un giorno dice il contrario della prima.
 */
export function testoGiorniRiscritti(dalGiornoISO: string, quanti: number, oggiISO: string): { title: string; body: string } {
  /**
   * ⛔ **Con un giorno solo si CHIAMA l'altra, non si riscrive la stessa frase** — trovato da una
   * revisione avversariale l'8/9: le due funzioni producevano la stessa identica stringa scritta
   * due volte, e il giorno che si ritocca il singolare la porta multipla avrebbe continuato a dire
   * la frase vecchia senza dirlo a nessuno.
   */
  if (quanti <= 1) return testoGiornoRiscritto(dalGiornoISO, oggiISO);
  const quando = etichettaGiorno(dalGiornoISO, oggiISO);
  return {
    title: `Il tuo menu è cambiato da ${quando} in poi`,
    body:
      /** ⚠️ E qui come nel singolare: niente «che avevi già aperto». Vedi `testoGiornoRiscritto`. */
      `Sono state riviste ${quanti} giornate. `
      + 'Se avevi già fatto la spesa, ricontrolla la lista: qualche ingrediente può essere diverso.',
  };
}

/**
 * Avvisa la cliente che PIÙ giornate sono state riscritte in un colpo solo.
 *
 * ⚠️ **Chi avvisare lo decide il chiamante, e i chiamanti non fanno tutti lo stesso** — la
 * differenza è reale e non è una svista:
 *  · le porte di **Vera** riscrivono anche le giornate di cui **non sappiamo** se le ha aperte, e le
 *    avvisano (`vera-chat.service.ts`, `applica-proposta.ts`);
 *  · **`MenuService`** quelle giornate non le tocca affatto — per lui restano intoccabili — quindi
 *    non ha niente da avvisare, e passa solo quelle aperte davvero.
 * In tutti e due i casi la regola è la stessa: *si avvisa per quello che le si è cambiato sotto*.
 *
 * ⚠️ Nessuno passa le giornate che **sappiamo** non aperte: quelle non le aveva in mano, e un
 * campanello che suona sempre si smette di guardare. E come per il singolo, non lancia mai: il
 * lavoro vero è il menu.
 */
export async function avvisaGiorniRiscritti(
  prisma: PrismaService,
  push: PushMinimo,
  input: { clientId: string; giorniISO: string[]; adesso?: Date },
): Promise<Esito> {
  const oggiISO = giornoLocale(input.adesso ?? new Date());
  /** ⚠️ Solo i giorni che non sono già passati, e in ordine: il primo è quello che si nomina. */
  const futuri = [...new Set(input.giorniISO)].filter((g) => distanzaGiorni(g, oggiISO) >= 0).sort();
  if (!futuri.length) return 'passato';

  const daLeggere = (await prisma.notification.findMany({
    where: { userId: input.clientId, type: TIPO_AVVISO_GIORNO_RISCRITTO, readAt: null, archivedAt: null },
    select: { payload: true },
    take: 20,
  }).catch(() => [])) as { payload?: unknown }[];
  /**
   * ⚠️ **Il dedup guarda il primo giorno**, che è quello che l'avviso nomina: se glielo abbiamo già
   * detto e non l'ha ancora letto, un secondo avviso identico non aggiunge niente.
   *
   * ⛔ **E guarda anche QUANTE giornate copriva** — 9/9, trovato da una revisione avversariale.
   * `avvisaGiornoRiscritto` scrive lo stesso `type` e la stessa chiave `giorno`, con `quanti`
   * assente: un avviso per **una** giornata non letta faceva quindi saltare l'avviso per **sette**
   * che partiva dieci minuti dopo. Scenario vero: Lucia riscrive domani a mano dalla scheda, poi
   * detta «niente pesce» — la cliente legge «Il menu di domani è cambiato» e non sa niente degli
   * altri sei giorni, con la spesa della settimana già fatta. Un avviso più piccolo non copre uno
   * più grande.
   */
  const giaDetto = daLeggere.some((r) => {
    const p = (r.payload ?? {}) as { giorno?: unknown; quanti?: unknown };
    if (p.giorno !== futuri[0]) return false;
    /** ⚠️ `quanti` assente = l'avviso singolo, cioè una giornata sola. */
    return (typeof p.quanti === 'number' ? p.quanti : 1) >= futuri.length;
  });
  if (giaDetto) return 'gia_detto';

  const { title, body } = testoGiorniRiscritti(futuri[0], futuri.length, oggiISO);
  /**
   * ⛔ **«Avvisata» solo se la riga è stata scritta davvero** — 9/9. `notificaUtente` si mangia ogni
   * errore per non far fallire il lavoro vero (giusto), quindi rendere `'avvisata'` a prescindere
   * voleva dire affermare l'avviso senza averlo — e la nutrizionista legge quella parola per decidere
   * se telefonare a una cliente che ha già fatto la spesa.
   */
  const scritta = await notificaUtente(prisma, push, {
    userId: input.clientId,
    type: TIPO_AVVISO_GIORNO_RISCRITTO,
    title,
    body,
    payload: { kind: KIND_GIORNO_RISCRITTO, giorno: futuri[0], quanti: futuri.length },
  });
  return scritta ? 'avvisata' : 'non_partito';
}
