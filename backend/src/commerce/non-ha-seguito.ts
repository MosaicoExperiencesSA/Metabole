import { giornoDelDato } from '../common/date-only';
import { inizioFinestraPuntoA } from '../menu/misura-di-partenza';

/**
 * ⛔ **«NON HA SEGUITO» — chi ha comprato un piano e non si è mai pesata mentre correva.**
 *
 * Richiesta di Simone (24/8): «se una persona attiva un piano e non inserisce le misure nemmeno una
 * volta, a piano scaduto nella pipeline non deve andare in Piano concluso, ma in "non ha seguito"».
 *
 * Le due colonne rispondono a due domande diverse, ed è la ragione per cui vale la pena separarle:
 * «Percorso concluso» vuol dire *ha finito*, e chi ha finito si richiama per rinnovare. Chi non ha
 * mai messo un peso non ha finito niente — non ha nemmeno cominciato — e la telefonata che le si fa
 * è un'altra. Tenerle nella stessa colonna vuol dire fare a tutte e due la stessa telefonata.
 *
 * ## ⚠️ Perché NON si può chiedere «ha almeno una misura?»
 *
 * Perché la risposta è quasi sempre **sì**, e per un motivo che non ha niente a che vedere col
 * seguire il piano: alla consegna del questionario `OnboardingService.submitAnswers` scrive **da
 * sola** una riga in `measurement` col peso di partenza dichiarato, datata al giorno del
 * questionario. Quella riga è **indistinguibile** da una inserita a mano — nessun campo dice che è
 * automatica. `measurement.count({ clientId })` risponderebbe 1 su chiunque abbia compilato il
 * questionario, e questa colonna resterebbe vuota per sempre. È la stessa domanda sbagliata che sta
 * ancora in `coach-tasks.service.ts` e che `menu/misura-di-partenza.ts` esiste per non ripetere.
 *
 * ⛔ **E «di prima che il piano cominci» NON basta: la prima stesura di questo file lo diceva, ed
 * era falsa nel caso più comune di tutti.** Chi finisce il questionario attiva «Conosciamoci» lo
 * stesso giorno (`commerce.attivaBenvenuto`, e `piano-prova` accetta «oggi»), quindi quella misura
 * cade **dentro** il piano. Con la finestra più larga copriva anche tutti i piani successivi: una
 * cliente che ha attivato Conosciamoci il giorno del questionario non sarebbe **mai più** potuta
 * finire in questa colonna, nemmeno dopo tre mesi di piano pagato senza una pesata. Trovato in
 * revisione il 24/8, misurato: la colonna si sarebbe riempita solo con chi aveva **posticipato** la
 * data d'inizio — cioè per un fatto che non c'entra niente con l'aver seguito.
 *
 * ## La regola vera (decisa da Simone il 24/8)
 *
 * Non ha seguito = **nessuna misura nella finestra del piano, esclusa quella scritta dal
 * questionario**. E la finestra comincia `menu_visible_days_before_start` giorni **prima**
 * dell'inizio: è la stessa finestra di `menu/misura-di-partenza.ts`, quella in cui il prodotto
 * *chiede* la pesata per sbloccare i menu. Chiedere una pesata due giorni prima e poi non contarla
 * vorrebbe dire accusare chi ha fatto esattamente quello che le avevamo chiesto.
 *
 * ⚠️ **La misura del questionario si riconosce dalla DATA**, non da un campo: `submitAnswers` la
 * scrive datata a oggi, e `ClientProfile.onboardingCompletedAt` dice qual è quel giorno. Non c'è
 * niente di meglio finché quella riga non porta un marcatore suo.
 * ⛔ **Il prezzo, scritto perché si sappia**: se una cliente si è pesata **davvero** il giorno del
 * questionario e mai più, quella pesata non la salva. Sotto è la stessa riga — l'`upsert` del
 * questionario non sovrascrive una misura già inserita quel giorno, quindi le due sono
 * indistinguibili. Simone lo sa e ha scelto così il 24/8.
 *
 * ⚠️ **E la finestra è la più LARGA possibile**, non l'ultimo piano: dal primo giorno del primo
 * piano all'ultimo dell'ultimo. Il verso in cui si può sbagliare non è simmetrico — mettere in «Non
 * ha seguito» una che invece si è pesata è un'accusa sbagliata che la coach legge e su cui chiama;
 * lasciarne una in «Percorso concluso» è lo stato di ieri, che non fa danno a nessuno. Quindi, nel
 * dubbio, **non si accusa**.
 */

/** La chiave della colonna nuova, in fondo alla board. Sta in `prisma/seed.ts` fra i `defaults`. */
export const STAGE_NON_SEGUITA = 'non_seguita';

/** La colonna di prima: ha comprato, ha finito, non ha rinnovato. */
export const STAGE_PERCORSO_CONCLUSO = 'path_ended';

interface PianoLetto {
  startDate: Date | null;
  endDate: Date | null;
}

/** Il minimo che serve a questa funzione: si fa iniettare, così i test non montano Prisma. */
export interface PrismaPerNonHaSeguito {
  subscription: { findMany(args: unknown): Promise<PianoLetto[]> };
  measurement: { findFirst(args: unknown): Promise<{ id: string } | null> };
  clientProfile: { findUnique(args: unknown): Promise<{ onboardingCompletedAt: Date | null } | null> };
}

/**
 * Ha comprato un piano e non si è **mai** pesata mentre quel piano correva?
 *
 * ⚠️ Tre risposte, non due: `null` vuol dire **non lo so** — nessun piano con date leggibili, quindi
 * non c'è nessuna finestra dentro cui cercare. Chi chiama deve trattarlo come «Percorso concluso»:
 * «non lo so» deve costare meno di «ho indovinato», e qui indovinare vuol dire accusare qualcuno.
 */
export async function nonHaMaiSeguito(
  prisma: PrismaPerNonHaSeguito,
  clientId: string,
  /** `menu_visible_days_before_start`: lo stesso valore che decide da quando il menu è visibile. */
  giorniPrima: number,
): Promise<boolean | null> {
  /**
   * ⚠️ Fuori solo i `pending`: un ordine mai pagato non ha fatto correre niente, e la sua finestra
   * allargherebbe il periodo per un piano che non è mai esistito. Un `cancelled` invece **è** stato
   * vivo per un pezzo, e quei giorni erano giorni in cui ci si poteva pesare: resta dentro.
   */
  const piani = await prisma.subscription.findMany({
    where: {
      clientId,
      status: { not: 'pending' },
      startDate: { not: null },
      endDate: { not: null },
    },
    select: { startDate: true, endDate: true },
  });

  const validi = piani.filter((p): p is { startDate: Date; endDate: Date } => !!p.startDate && !!p.endDate);
  if (validi.length === 0) return null;

  /**
   * ⚠️ **I due estremi si portano al GIORNO, e in UTC** — è il difetto che questo progetto ha già
   * pagato tre volte. `Measurement.date` è una colonna `DATE`: dentro c'è la mezzanotte UTC del
   * giorno. `Subscription.startDate` invece può avere **un'ora dentro** (un piano in coda eredita
   * l'istante di scadenza di quello prima). Confrontando i due così com'sono, una misura fatta *il
   * giorno stesso* in cui il piano è cominciato — mezzanotte UTC — risulterebbe **prima**
   * dell'inizio, e la cliente finirebbe in «Non ha seguito» per una pesata che ha fatto davvero.
   *
   * `giornoDelDato` è la porta dichiarata per questo: «di che giorno è questa data salvata», letta
   * in UTC come la colonna che si va a confrontare.
   */
  const dal = inizioFinestraPuntoA(new Date(Math.min(...validi.map((p) => p.startDate.getTime()))), giorniPrima);
  const al = giornoDelDato(new Date(Math.max(...validi.map((p) => p.endDate.getTime()))));

  /**
   * Il giorno in cui è stato consegnato il questionario: è la data della misura che il sistema si è
   * scritto da solo. ⚠️ Se il profilo non si legge o il campo è vuoto **non si esclude niente**: nel
   * dubbio non si accusa, e una cliente in più lasciata in «Percorso concluso» non fa danno.
   */
  const profilo = await prisma.clientProfile
    .findUnique({ where: { clientId }, select: { onboardingCompletedAt: true } })
    .catch(() => null);
  const giornoQuestionario = profilo?.onboardingCompletedAt ? giornoDelDato(profilo.onboardingCompletedAt) : null;

  const misura = await prisma.measurement.findFirst({
    where: {
      clientId,
      date: { gte: dal, lte: al },
      ...(giornoQuestionario ? { NOT: { date: giornoQuestionario } } : {}),
    },
    select: { id: true },
  });
  return !misura;
}
