import { STAGE_PERCORSO_CONCLUSO, STAGE_NON_SEGUITA } from './non-ha-seguito';

/**
 * ⛔ **LA COLONNA «IN SOSPENSIONE»** — richiesta di Simone (24/8): *«creiamo in pipeline, tra
 * acquisto e senza possibilità economiche, un nuovo stato "In sospensione" dove sostiamo i clienti
 * durante la sospensione e li riportiamo in Acquisto una volta che riprendono il percorso»*.
 *
 * ## Perché non basta guardare le pause
 *
 * Una cliente in vacanza per venti giorni **resta in «Acquisito»**, in mezzo a chi sta seguendo il
 * percorso: chi apre la pipeline non vede la differenza fra chi non risponde perché è ferma di sua
 * volontà e chi non risponde perché è sparita. Sono due telefonate diverse, e oggi sono la stessa
 * colonna.
 *
 * ⚠️ **Solo le VACANZE**, non ogni periodo senza menu: il parcheggio guarda gli `event` di tipo
 * `vacation` (card «Sospensioni», richiesta di pausa dall'app, Calendario). Un ricovero segnato come
 * «Altro» dal Calendario ferma i menu e **non** sposta la scheda — è una scelta, non una svista: la
 * colonna dice «è in pausa e tornerà», e su un «Altro» non lo sappiamo.
 *
 * ## ⚠️ Le tre regole che rendono sicuro un parcheggio automatico
 *
 * 1. **Si ricorda da dove viene.** La scheda torna **esattamente dove stava** (`stagePrimaSospensione`),
 *    non genericamente in «Acquisito»: una cliente che era in «Prima visita» non deve retrocedere di
 *    quattro colonne per essere andata in ferie. Se la colonna di prima non esiste più — l'admin la
 *    può cancellare — si torna in «Acquisito», che è il posto giusto per una cliente che paga.
 * 2. **Non si scavalca una persona.** Al rientro si sposta solo chi è ancora *in sospensione*: se
 *    nel frattempo una coach l'ha trascinata da un'altra parte, quella mano vince sull'automatismo.
 * 3. **Non si parcheggia chi ha finito.** «Percorso concluso» e «Non ha seguito» sono colonne
 *    terminali: una sospensione tecnica su una scheda già chiusa non deve riaprirla.
 *
 * ## ⛔ E la cosa che si rompeva in silenzio
 *
 * In quattro punti del prodotto «cliente» vuol dire **letteralmente** `stage === 'paid'`: il
 * contatore pubblico delle clienti seguite, il badge cliente/lead nel CRM, i filtri delle campagne
 * e la pulizia dei residui demo. Parcheggiando una scheda altrove, una cliente che paga sarebbe
 * diventata **un lead** per il marketing — e avrebbe ricevuto le email di chi non ha ancora comprato
 * mentre era in vacanza col piano pagato. Perciò «cliente» non è più una chiave sola ma
 * `STAGE_DA_CLIENTE`, e sta qui, dove chi aggiunge la colonna sta già leggendo.
 */
export const STAGE_IN_SOSPENSIONE = 'in_sospensione';

/** La colonna dell'acquisto: è il ripiego del rientro e la colonna «cliente» di sempre. */
export const STAGE_ACQUISITO = 'paid';

/**
 * ⛔ **Chi è «cliente» per il prodotto.** Era scritto `stage: 'paid'` in quattro punti; adesso è un
 * elenco, e ogni colonna che vuol dire «sta pagando» va aggiunta **qui**, non nei quattro punti.
 */
export const STAGE_DA_CLIENTE = [STAGE_ACQUISITO, STAGE_IN_SOSPENSIONE];

/** Colonne terminali: una scheda che ci sta dentro non si parcheggia e non si riporta indietro. */
const STAGE_TERMINALI = new Set([STAGE_PERCORSO_CONCLUSO, STAGE_NON_SEGUITA]);

interface PrismaPerSospensione {
  pipelineStage: { findUnique(args: unknown): Promise<{ order: number } | null> };
  crmRecord: {
    findUnique(args: unknown): Promise<{ stage: string; stageDates: unknown; stagePrimaSospensione: string | null } | null>;
    update(args: unknown): Promise<unknown>;
  };
}

function conData(stageDates: unknown, stage: string, byUserId: string) {
  return { ...((stageDates as Record<string, unknown>) ?? {}), [stage]: { at: new Date().toISOString(), byUserId } };
}

/**
 * Parcheggia la scheda in «In sospensione», ricordandosi da dove viene.
 *
 * ⚠️ **Non usa `avanzaStatoSeIndietro`**, ed è deliberato: quella funzione esiste per non far
 * *retrocedere* una scheda lungo il funnel, e una sospensione non è un avanzamento — è una parentesi.
 * Passando di lì, una cliente in «Follow-up» non si sarebbe mai parcheggiata (la colonna sta prima) e
 * la richiesta sarebbe rimasta vera solo per metà delle clienti, in silenzio. Per lo stesso motivo
 * **l'ordine della colonna sulla board non conta** per questo automatismo: Simone la può trascinare
 * dove vuole.
 *
 * Torna `true` se ha spostato qualcosa.
 */
export async function parcheggiaInSospensione(
  prisma: PrismaPerSospensione,
  clientId: string,
  byUserId: string,
): Promise<boolean> {
  try {
    const colonna = await prisma.pipelineStage.findUnique({ where: { key: STAGE_IN_SOSPENSIONE } });
    // ⚠️ Colonna assente (admin l'ha cancellata, o seed non ancora girato): non si inventa niente e
    // non si tocca la scheda. Meglio una pipeline com'era che una scheda in una colonna fantasma.
    if (!colonna) return false;
    const record = await prisma.crmRecord.findUnique({ where: { clientId } });
    if (!record) return false;
    if (record.stage === STAGE_IN_SOSPENSIONE) return false; // già parcheggiata
    if (STAGE_TERMINALI.has(record.stage)) return false;
    /**
     * ⛔ **SI PARCHEGGIA SOLO CHI È GIÀ CLIENTE** — rilievo della revisione del 25/8, ed era il
     * difetto simmetrico a quello che questo file dice di risolvere. Un `pause_period` lo può creare
     * **chiunque** dal Calendario in app, anche chi ha attivato solo la prova gratuita: parcheggiata,
     * quella scheda entrava in `STAGE_DA_CLIENTE` e diventava una **cliente** — saliva il contatore
     * pubblico delle clienti seguite, saliva la conversione del cruscotto, e le arrivavano le
     * campagne di chi ha comprato. Una settimana di ferie non è un acquisto.
     *
     * Il confine è lo stesso del cruscotto vendite: dalla colonna dell'acquisto in poi. Così restano
     * dentro anche le clienti più avanti nel funnel («Prima visita», «Follow-up»), che sono clienti a
     * tutti gli effetti, e restano fuori prova, questionario e lead.
     */
    const acquisto = await prisma.pipelineStage.findUnique({ where: { key: STAGE_ACQUISITO } });
    const attuale = await prisma.pipelineStage.findUnique({ where: { key: record.stage } });
    if (!acquisto || !attuale || attuale.order < acquisto.order) return false;
    await prisma.crmRecord.update({
      where: { clientId },
      data: {
        stage: STAGE_IN_SOSPENSIONE,
        stageDates: conData(record.stageDates, STAGE_IN_SOSPENSIONE, byUserId) as never,
        /**
         * ⛔ **Da dove viene si scrive SEMPRE, e la prima stesura scriveva `?? record.stage`.** Quel
         * ripiego proteggeva un caso **impossibile** (qui `record.stage` non può essere
         * «in sospensione»: c'è un `return` sopra) e in cambio conservava valori **vecchi**, rimasti
         * da una parentesi già chiusa — per esempio da un rinnovo, che riporta la scheda in
         * «Acquisito» senza cancellare la memoria. Alla vacanza dell'anno dopo la cliente sarebbe
         * tornata in «Prima visita»: una visita che in quel percorso non è mai avvenuta.
         */
        stagePrimaSospensione: record.stage,
      } as never,
    });
    return true;
  } catch {
    /* il CRM non deve mai bloccare una sospensione: i menu contano di più della board */
    return false;
  }
}

/**
 * Riporta la scheda dove stava prima della sospensione (o in «Acquisito», se quella colonna non
 * esiste più). Sposta **solo** chi è ancora in «In sospensione»: una coach che l'ha trascinata
 * altrove nel frattempo ha deciso, e l'automatismo non la contraddice.
 */
export async function riportaDallaSospensione(
  prisma: PrismaPerSospensione,
  clientId: string,
  byUserId: string,
): Promise<string | null> {
  try {
    const record = await prisma.crmRecord.findUnique({ where: { clientId } });
    if (!record || record.stage !== STAGE_IN_SOSPENSIONE) return null;
    const ricordata = record.stagePrimaSospensione;
    const esiste = ricordata ? await prisma.pipelineStage.findUnique({ where: { key: ricordata } }) : null;
    const destinazione = esiste && ricordata ? ricordata : STAGE_ACQUISITO;
    const arrivo = await prisma.pipelineStage.findUnique({ where: { key: destinazione } });
    if (!arrivo) return null; // nemmeno «Acquisito» esiste: non si inventa una colonna
    await prisma.crmRecord.update({
      where: { clientId },
      data: {
        stage: destinazione,
        stageDates: conData(record.stageDates, destinazione, byUserId) as never,
        // La memoria si cancella: la prossima sospensione riparte da dove sarà allora.
        stagePrimaSospensione: null,
      } as never,
    });
    return destinazione;
  } catch {
    return null;
  }
}
