import type { PrismaService } from '../prisma/prisma.service';

/**
 * AVVISARE LA MANAGER DELLE COACH — «hai un nuovo lead da assegnare».
 *
 * Richiesta di Simone dell'11/8: «alla manager delle coach deve arrivare notifica **e push** che
 * dice hai un nuovo lead da assegnare. **Tutte le volte** che si registra un nuovo lead va
 * avvisata.»
 *
 * ## Perché serve
 *
 * Un lead che nessuno assegna non dà nessun segnale: resta in tabella, in mezzo agli altri, e più
 * passa il tempo meno vale — quando qualcuno lo chiama non si ricorda nemmeno di essersi iscritta.
 * L'unico modo di accorgersene era aprire Gestione lead di propria iniziativa e cercare i «— non
 * assegnato —».
 *
 * ## La regola del destinatario, di nuovo
 *
 * Il ruolo è `sales` (la manager delle coach). Se non esiste nessun utente con quel ruolo — o è
 * sospeso — l'avviso **non si butta via**: va agli **admin**. È la lezione di
 * `escalations/apri-segnalazione.ts` e di `avvisa-nutrizionista.ts`: a luglio tre segnalazioni
 * cliniche sono rimaste senza destinatario e sono passati venti giorni. **Un avviso senza
 * destinatario non è un avviso.**
 *
 * ## Non fallisce mai
 *
 * Chi chiama sta registrando una persona o accogliendo un contatto dal sito. Un avviso che non parte
 * non deve far fallire quello. Ma il motivo si SCRIVE nei log: un catch muto è un mistero, e
 * «nessuno è stato avvisato» è esattamente il tipo di silenzio che qui si sta cercando di togliere.
 */
interface Notificatore {
  notify(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<unknown>;
}

/** Gli utenti da avvisare: la manager delle coach, o gli admin se non ce n'è nessuna attiva. */
export async function destinatariManagerCoach(prisma: PrismaService): Promise<string[]> {
  const attivi = { status: 'active', deletedAt: null } as never;
  const manager = (await prisma.user.findMany({
    where: { role: 'sales' as never, ...(attivi as object) },
    select: { id: true },
  })) as { id: string }[];
  if (manager.length) return manager.map((u) => u.id);
  const admin = (await prisma.user.findMany({
    where: { role: 'admin' as never, ...(attivi as object) },
    select: { id: true },
  })) as { id: string }[];
  return admin.map((u) => u.id);
}

/**
 * «Hai un nuovo lead da assegnare.» Il `payload.url` porta alla tabella dei non assegnati: la
 * richiesta era esplicita — «se clicca sulla notifica le si apre una tabella».
 */
export async function avvisaNuovoLeadDaAssegnare(
  prisma: PrismaService,
  notificatore: Notificatore | null | undefined,
  lead: { id: string; nome?: string | null; email?: string | null },
  log?: { warn: (m: string) => void },
): Promise<number> {
  try {
    if (!notificatore) {
      log?.warn('[nuovo-lead] nessun notificatore disponibile: la manager delle coach non è stata avvisata.');
      return 0;
    }
    const destinatari = await destinatariManagerCoach(prisma);
    if (!destinatari.length) {
      log?.warn('[nuovo-lead] nessun utente con ruolo sales né admin attivo: avviso non recapitato.');
      return 0;
    }
    const chi = lead.nome?.trim() || lead.email?.trim() || 'un nuovo contatto';
    for (const userId of destinatari) {
      await notificatore.notify({
        userId,
        type: 'lead_da_assegnare',
        title: 'Hai un nuovo lead da assegnare',
        body: `${chi} si è appena registrata e non ha ancora una coach. Aprila e assegnala: più passa il tempo, meno si ricorda di essersi iscritta.`,
        payload: { url: '/crm/da-assegnare', recordId: lead.id },
      });
    }
    return destinatari.length;
  } catch (e) {
    log?.warn(`[nuovo-lead] avviso alla manager delle coach non riuscito: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}
