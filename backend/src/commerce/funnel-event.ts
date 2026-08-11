/**
 * EVENTO DI FUNNEL (`trial_started`, `trial_converted`, `trial_expired`, …) — in un posto solo.
 *
 * Era un metodo privato di `CommerceService`. L'11/8 `trial_started` si è spostato dall'attivazione
 * della prova al **primo menu erogato** (decisione di Simone: «Prova» su una cliente che non ha
 * ancora visto un piatto dice il falso), e il primo menu lo eroga `MenuService` — che non può
 * dipendere da `CommerceService`. Da qui l'estrazione: una funzione libera che riceve `prisma`,
 * usata sia dal commercio sia dal motore dei menu.
 *
 * L'arricchimento con SEGMENTO e CANALE resta dentro: è la ragione per cui questa funzione esiste
 * invece di una `create` sparsa in venti punti. Un evento senza segmento non si può leggere in
 * `funnel-overview`, e la differenza non si vede finché qualcuno non apre il grafico.
 */
import { randomUUID } from 'crypto';
import { deriveSegment } from '../common/funnel-segment';
import type { PrismaService } from '../prisma/prisma.service';

export async function emettiEventoFunnel(
  prisma: PrismaService,
  userId: string,
  name: string,
  data?: Record<string, unknown>,
): Promise<void> {
  let segment: string | null = null;
  let channel: string | null = null;
  try {
    const rec = (await prisma.crmRecord.findUnique({
      where: { clientId: userId },
      select: { segment: true, channel: true, previousStatus: true, historicalPaidCents: true, stage: true } as never,
    })) as {
      segment: string | null;
      channel: string | null;
      previousStatus: string | null;
      historicalPaidCents: number | null;
      stage: string;
    } | null;
    if (rec) {
      segment = deriveSegment(rec);
      channel = rec.channel ?? null;
    }
  } catch {
    /* l'arricchimento non deve mai bloccare l'evento */
  }
  await prisma.analyticsEvent
    .create({
      data: {
        eventId: randomUUID(),
        name,
        userId,
        phase: 'funnel',
        data: { ...(data ?? {}), ...(segment ? { segment } : {}), ...(channel ? { channel } : {}) } as never,
      } as never,
    })
    .catch(() => undefined); // il tracciamento non deve mai rompere il flusso
}

/**
 * L'evento `name` è già stato emesso per questa persona?
 *
 * Serve all'idempotenza dei passaggi di funnel che ora possono essere tentati più volte:
 * `deliverIfEligible` gira a ogni apertura dell'app, e senza questo controllo `trial_started`
 * comparirebbe una volta per ogni erogazione — cioè il conto delle prove avviate diventerebbe il
 * conto dei cicli di menu.
 */
export async function eventoGiaEmesso(prisma: PrismaService, userId: string, name: string): Promise<boolean> {
  const trovato = await prisma.analyticsEvent
    .findFirst({ where: { userId, name } as never, select: { id: true } })
    .catch(() => null);
  return !!trovato;
}
