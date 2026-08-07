/**
 * Avanzamento automatico della scheda CRM che **non fa retrocedere**.
 *
 * Sta qui e non dentro `CrmService` per una ragione pratica: gli stati li scrivono anche moduli
 * che non hanno (e non devono avere) una dipendenza dal modulo commerce — il questionario, per
 * dirne uno. Farli passare da `CrmService` significherebbe importare CommerceModule dentro
 * OnboardingModule solo per una riga, e mettersi in casa un giro di dipendenze fra moduli che
 * prima o poi si chiude ad anello. Qui la funzione riceve il client Prisma e basta.
 *
 * ## Perché "non retrocedere"
 *
 * Gli stati di percorso (questionario completato, percorso concluso) segnano un passaggio, non
 * una posizione. Se la cliente è già più avanti — ha comprato, l'ha presa in carico una coach,
 * ha fatto la prima visita — riportarla indietro cancellerebbe il lavoro di chi ha spostato la
 * scheda a mano, e la coach si ritroverebbe in colonna una cliente che aveva già lavorato.
 * Il confronto è sull'`order` degli stati, che è quello che decide la colonna sulla board.
 *
 * Se lo stato richiesto non esiste (l'admin l'ha eliminato: la pipeline è sua) non fa niente e
 * non protesta.
 */

/** Il minimo che serve del client Prisma: così la funzione è testabile con un oggetto finto. */
export interface PrismaPerStato {
  pipelineStage: { findUnique(args: unknown): Promise<{ order: number } | null> };
  crmRecord: {
    findUnique(args: unknown): Promise<{ stage: string; stageDates?: unknown } | null>;
    update(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
}

export async function avanzaStatoSeIndietro(
  prisma: PrismaPerStato,
  clientId: string,
  stage: string,
  byUserId: string,
): Promise<boolean> {
  try {
    const target = await prisma.pipelineStage.findUnique({ where: { key: stage }, select: { order: true } });
    if (!target) return false;

    const record = await prisma.crmRecord.findUnique({
      where: { clientId },
      select: { stage: true, stageDates: true },
    });

    if (record) {
      const attuale = await prisma.pipelineStage.findUnique({
        where: { key: record.stage },
        select: { order: true },
      });
      // Stato attuale sconosciuto (eliminato dall'admin): meglio non muovere niente.
      if (attuale && attuale.order >= target.order) return false;
    }

    const stageDates = {
      ...((record?.stageDates as Record<string, unknown>) ?? {}),
      [stage]: { at: new Date().toISOString(), byUserId },
    };
    if (record) {
      await prisma.crmRecord.update({
        where: { clientId },
        data: { stage: stage as never, stageDates: stageDates as never },
      });
    } else {
      await prisma.crmRecord.create({
        data: { clientId, stage: stage as never, stageDates: stageDates as never },
      });
    }
    return true;
  } catch {
    /* il CRM non deve mai bloccare il flusso principale */
    return false;
  }
}
