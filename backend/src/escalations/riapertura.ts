/**
 * «SE HA RISOLTO, BASTA FINO A NUOVA SEGNALAZIONE.»
 *
 * Due segnalazioni di Simone dell'11/8, che sono lo stesso difetto:
 *  - «nelle segnalazioni perché se il nutrizionista mette risolta continui a riaprirle?»
 *  - «il calo peso se è troppo rapido e il nutrizionista dice ok, resta ok, non devi continuare a
 *    tediarlo».
 *
 * ## Perché si riaprivano
 *
 * Chi apriva una segnalazione controllava una cosa sola: «ce n'è già una **aperta** per questa
 * causa?». Se sì, non ne apriva un'altra. Il controllo è giusto e non basta, perché guarda solo il
 * presente: appena la nutrizionista mette «risolta», quel controllo torna a dire «non ce n'è
 * nessuna» — e la condizione clinica, nel frattempo, non è cambiata. Una cliente che perde 2,8
 * kg/settimana continua a perderli anche dopo che qualcuno ha detto «ok, lo so, la sto seguendo».
 * Quindi la sera stessa, o al primo peso del giorno dopo, la segnalazione ricompariva identica.
 *
 * L'effetto non è un fastidio: è che **le segnalazioni smettono di voler dire qualcosa**. Chi le
 * riceve impara che ricompaiono da sole, e a quel punto le chiude senza leggerle — comprese quelle
 * nuove.
 *
 * ## La regola
 *
 * 1. Se ce n'è una **aperta o in corso** per la stessa causa: non se ne apre un'altra. (Come prima.)
 * 2. Se è stata **risolta di recente** — entro `escalation_reopen_days`, default 14 giorni — non si
 *    riapre. È la richiesta di Simone: chi ha guardato quel caso ha deciso, e la sua decisione vale.
 * 3. **Eccezione, e non è un dettaglio:** si riapre comunque se la cosa è **peggiorata** oltre una
 *    soglia. Un calo di 1,8 kg/settimana su cui la nutrizionista ha detto «ok» che diventa 3,5 non è
 *    la stessa segnalazione che torna: è un fatto nuovo, ed è esattamente il caso in cui tacere
 *    farebbe danno. Questa è la parte che rende la regola sicura invece che solo silenziosa.
 * 4. Se è stata risolta **prima** della finestra: si riapre. Se dopo due settimane la condizione è
 *    ancora lì, dirlo di nuovo è giusto — quella non è insistenza, è un problema che non si è
 *    risolto.
 *
 * ## La gravità
 *
 * Il punto 3 ha bisogno di sapere **quanto** era grave quando è stata risolta, quindi la gravità si
 * scrive sulla riga (`severity`) invece di essere sepolta nel testo del motivo. Prima si poteva solo
 * leggere «Calo rapido: 2,87 kg/settimana» e provare a estrarre il numero da una frase: funziona
 * finché qualcuno non riscrive la frase.
 *
 * Le segnalazioni senza gravità (piano bloccato, umore, aderenza: non hanno un «quanto») usano solo
 * i punti 1, 2 e 4 — per loro il peggioramento non è definibile, e inventarne uno sarebbe peggio.
 */

/** Il minimo del client Prisma che serve: così è testabile con un oggetto finto. */
export interface PrismaPerRiapertura {
  escalation: {
    findFirst(args: unknown): Promise<{
      id: string;
      status: string;
      severity?: number | null;
      resolvedAt?: Date | null;
      updatedAt?: Date | null;
    } | null>;
  };
}

export interface DomandaRiapertura {
  clientId: string;
  /** La causa. Almeno uno dei due: la categoria, o un pezzo di testo del motivo. */
  category?: string;
  motivoContiene?: string;
  /** Quanto è grave ADESSO (es. kg/settimana di calo). Senza, il punto 3 non si applica. */
  gravita?: number | null;
  /** Giorni di tregua dopo una «risolta». Arriva da `escalation_reopen_days`. */
  finestraGiorni: number;
  /** Di quanto deve peggiorare perché si riapra comunque. Senza, il punto 3 non si applica. */
  peggioramentoMinimo?: number | null;
  /** Iniettabile nei test: qui non si usa `new Date()` a caso. */
  adesso?: Date;
}

export interface DecisioneRiapertura {
  apri: boolean;
  /** Perché sì o perché no, in italiano: finisce nell'audit e nei log, e si legge. */
  motivo: string;
  /** La riga che ha deciso, quando c'è: utile a chi vuole tracciare. */
  precedente?: { id: string; status: string };
}

const GIORNO = 86_400_000;

export async function decidiRiapertura(
  prisma: PrismaPerRiapertura,
  d: DomandaRiapertura,
): Promise<DecisioneRiapertura> {
  const dove = {
    clientId: d.clientId,
    ...(d.category ? { category: d.category } : {}),
    ...(d.motivoContiene ? { reason: { contains: d.motivoContiene } } : {}),
  };

  // 1. Già aperta o in corso: non se ne aggiunge un'altra.
  const attiva = await prisma.escalation.findFirst({
    where: { ...dove, status: { in: ['open', 'in_progress'] } },
    select: { id: true, status: true },
  } as never);
  if (attiva) {
    return { apri: false, motivo: 'ce n\'è già una aperta per la stessa causa', precedente: attiva };
  }

  // 2/3/4. L'ultima risolta.
  const risolta = await prisma.escalation.findFirst({
    where: { ...dove, status: 'resolved' },
    orderBy: [{ resolvedAt: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, status: true, severity: true, resolvedAt: true, updatedAt: true },
  } as never);
  if (!risolta) return { apri: true, motivo: 'nessuna segnalazione precedente per questa causa' };

  const quando = risolta.resolvedAt ?? risolta.updatedAt ?? null;
  const adesso = d.adesso ?? new Date();
  const giorniDaAllora = quando ? Math.floor((adesso.getTime() - quando.getTime()) / GIORNO) : Infinity;

  if (giorniDaAllora >= d.finestraGiorni) {
    return {
      apri: true,
      motivo: `risolta ${giorniDaAllora} giorni fa (oltre la tregua di ${d.finestraGiorni}) e la condizione è ancora presente`,
      precedente: risolta,
    };
  }

  // Il punto 3: si riapre solo se è PEGGIORATA oltre la soglia.
  const gravitaOra = typeof d.gravita === 'number' ? d.gravita : null;
  const gravitaPrima = typeof risolta.severity === 'number' ? risolta.severity : null;
  const soglia = typeof d.peggioramentoMinimo === 'number' ? d.peggioramentoMinimo : null;
  if (gravitaOra !== null && gravitaPrima !== null && soglia !== null && gravitaOra >= gravitaPrima + soglia) {
    return {
      apri: true,
      motivo:
        `peggiorata da ${gravitaPrima} a ${gravitaOra} dopo la chiusura di ${giorniDaAllora} giorni fa ` +
        `(oltre la soglia di ${soglia}): è un fatto nuovo, non la stessa segnalazione`,
      precedente: risolta,
    };
  }

  return {
    apri: false,
    motivo: `risolta ${giorniDaAllora} giorni fa e non è peggiorata: la decisione di chi l'ha chiusa vale fino a ${d.finestraGiorni} giorni`,
    precedente: risolta,
  };
}
