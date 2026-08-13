/**
 * «SERVE LA VISITA» IN AUTOMATICO — i criteri di Nocanty (13/8, pagina Lavori; Decisioni §15).
 *
 * La risposta, testuale: «allergia dichiarata, utilizzo farmaci, problemi sanitari». Mappa su dati
 * che esistono già: farmaci e problemi = `screeningFlag` (lo calcola il questionario), allergia =
 * `allergies` non vuoto. È lo stesso criterio di `daValutare()` — di proposito: un criterio scritto
 * due volte diverge, e qui decide chi finisce davanti a una nutrizionista.
 *
 * ## ⚠️ I paletti (dalle trappole già pagate in `idoneita.ts`)
 *
 * - Si apre SOLO se `idoneita` è vuota: una valutazione clinica scritta non si riapre da un
 *   automatismo — il via libera non scade su un timer.
 * - È un EVENTO (la dichiarazione che arriva), mai un cron: niente riaperture notturne.
 * - Il dedup è quello di `apriSegnalazione`: una clinica già aperta non si duplica.
 * - Chi scrive le allergie dalla scheda (nutrizionista/capo) NON passa da qui: ha la scheda
 *   davanti e il campo idoneità a un click — un automatismo lì sarebbe rumore verso se stessa.
 *
 * ## Non lancia mai
 *
 * Sta in fondo a operazioni che devono riuscire comunque (questionario, risposta della scheda in
 * home): una presa in carico non aperta è un lavoro in più per qualcuno, un'eccezione qui è un
 * salvataggio che fallisce. L'errore però si scrive nei log.
 */
import { Logger } from '@nestjs/common';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import type { PrismaService } from '../prisma/prisma.service';
import { daValutare } from './idoneita';

const logger = new Logger('ServeVisita');

/** Le parole del motivo: si dicono i criteri veri, non un generico «da valutare». */
export function motivoVisita(p: { allergies?: string[] | null; screeningFlag?: boolean | null }): string {
  const parti: string[] = [];
  if ((p.allergies ?? []).length > 0) parti.push('allergia dichiarata');
  if (p.screeningFlag) parti.push('farmaci o problemi sanitari dallo screening');
  return parti.join(' + ');
}

export async function apriServeVisita(
  prisma: PrismaService,
  clientId: string,
  origine: 'questionario' | 'scheda-in-home' | 'campagna-allergie' | string,
): Promise<{ aperta: boolean }> {
  try {
    const p = (await prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { allergies: true, screeningFlag: true, idoneita: true } as never,
    })) as { allergies?: string[]; screeningFlag?: boolean; idoneita?: string | null } | null;
    if (!p) return { aperta: false };
    // La valutazione scritta vince sull'automatismo, in tutte e due le direzioni.
    if (p.idoneita) return { aperta: false };
    if (!daValutare(p)) return { aperta: false };

    const esito = await apriSegnalazione(prisma as never, {
      clientId,
      category: 'clinical' as never,
      source: 'screening',
      reason: `Serve la visita (criteri Nocanty 13/8): ${motivoVisita(p)} — da ${origine}.`,
      dedupe: true,
    });
    return { aperta: !!esito };
  } catch (e) {
    logger.warn(`Presa in carico non aperta (cliente=${clientId}, origine=${origine}): ${e instanceof Error ? e.message : e}`);
    return { aperta: false };
  }
}
