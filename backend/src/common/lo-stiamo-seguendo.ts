import { conUnPianoOggi } from '../commerce/abbonamento-in-corso';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import type { PrismaService } from '../prisma/prisma.service';

/** Le righe di abbonamento che servono alla risposta: chi le ha già lette può passarle. */
type PianoLetto = { status: string; startDate: Date | null; endDate: Date | null };

/**
 * ⛔ **«QUESTA PERSONA LA STIAMO ANCORA SEGUENDO?» — la domanda che spegne tutto il resto.**
 *
 * Nasce il 12/9 con la decisione di Simone *«se un cliente non ha piani attivi va staccato tutto»*
 * (notifiche alla cliente **e** avvisi alla coach), e sta in un posto solo perché la chiedono tre
 * organi diversi — il giro notturno delle notifiche, il gate delle misure e la coda della coach. Se
 * divergessero, una cliente smetterebbe di ricevere le notifiche ma resterebbe con l'app murata, o
 * il contrario.
 *
 * Sono **due** cose, e la seconda è quella che si dimentica:
 *
 * 1. **Un abbonamento con un piano oggi** (`conUnPianoOggi`). Monitoraggio a €19 e Mantenimento
 *    contano: sono abbonamenti attivi e pagati (decisione di Simone, 12/9).
 *
 * 2. ⛔ **Il MONITORAGGIO OMAGGIO, che non è un abbonamento.** `monitoring.service.start()` lo
 *    concede **solo a chi non ha nessuna riga** in `STATI_QUALCOSA_IN_BALLO`: è un
 *    `MonitoringPeriod` e basta. Guardando i soli abbonamenti, quella persona risultava «senza
 *    piano» — e intanto `monitoring.service` le **eroga i menu di rientro** (`menuDay.upsert`) se
 *    il peso risale. Si sarebbe creato di nuovo lo stato che l'11/8 è stato chiuso apposta: i menu
 *    arrivano e nessuno chiede il peso. Trovato dalla revisione avversariale prima di consegnare,
 *    non dalla richiesta.
 *
 * ⚠️ **Non è `filtroClienteConPianoAttivo`** (`common/piano-attivo.ts`), che il monitoraggio lo
 * esclude apposta perché risponde a un'altra domanda: «il motore ha un piano alimentare da
 * correggere?». Le due non vanno scambiate.
 */
export async function loStiamoSeguendo(
  prisma: PrismaService,
  clientId: string,
  /** Gli abbonamenti, se chi chiama li ha già letti: evita una lettura in più sulla stessa cosa. */
  pianiGiaLetti?: readonly PianoLetto[],
  adesso: Date = new Date(),
): Promise<boolean> {
  const piani =
    pianiGiaLetti ??
    ((await prisma.subscription.findMany({
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      // ⚠️ I tre campi che `conUnPianoOggi` legge. Una `select` più stretta non fa errore: rende
      // `endDate` indefinito, cioè «non finisce mai», e il cancello non si chiuderebbe più.
      select: { status: true, startDate: true, endDate: true },
    })) as PianoLetto[]);
  if (conUnPianoOggi(piani, adesso)) return true;

  const monitoraggio = await prisma.monitoringPeriod.findFirst({
    where: { clientId, status: 'active', endsAt: { gte: adesso } },
    select: { id: true },
  });
  return !!monitoraggio;
}
