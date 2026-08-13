import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatiLavoro, datiSpunta, normalizzaLavoro, ordinaLavori } from './lavoro';

/**
 * L'ELENCO DEI LAVORI — «cosa manca», in un posto solo.
 *
 * Richiesta di Simone (13/8). ⚠️ Non è un doppione di `progetto/REGISTRO.md`: quello racconta **cosa
 * è stato scritto**, per sempre e riga per riga; questo risponde a **cosa manca**, e la spunta ci
 * aggiunge quando è stato chiuso e da chi.
 */

@Injectable()
export class LavoriService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * L'elenco intero, in un colpo solo: sono decine di righe, non migliaia, e paginarle vorrebbe dire
   * nascondere metà di quello che manca dietro un pulsante «avanti».
   *
   * ⚠️ **Da fare in cima, fatte in fondo.** Le fatte non spariscono — è la parte «così è tutto
   * registrato» della richiesta — ma non devono nemmeno stare in mezzo, o l'elenco smette di
   * rispondere a «cosa resta» a colpo d'occhio. Fra le fatte, le ultime chiuse per prime.
   */
  async elenco() {
    const righe = await this.prisma.lavoro.findMany({
      orderBy: [{ fatto: 'asc' }, { categoria: 'asc' }, { ordine: 'asc' }, { createdAt: 'asc' }],
      include: { fattoDa: { select: { displayName: true } } },
    });
    const daFare = righe.filter((r) => !r.fatto).length;
    return {
      righe: ordinaLavori(righe),
      totale: righe.length,
      daFare,
      fatte: righe.length - daFare,
    };
  }

  async crea(dati: DatiLavoro) {
    const campi = normalizzaLavoro(dati, true);
    return this.prisma.lavoro.create({
      data: campi as { titolo: string },
      include: { fattoDa: { select: { displayName: true } } },
    });
  }

  async aggiorna(id: string, dati: DatiLavoro) {
    const campi = normalizzaLavoro(dati, false);
    await this.esiste(id);
    return this.prisma.lavoro.update({
      where: { id },
      data: campi,
      include: { fattoDa: { select: { displayName: true } } },
    });
  }

  /**
   * La spunta.
   *
   * ⚠️ **Togliendola si azzerano anche chi e quando.** Una voce riaperta che continua a dire «fatta
   * da Simone il 13 agosto» è una riga che fa perdere fiducia in tutta la lista — e una lista di cui
   * non ci si fida non si guarda più, che è l'unico modo in cui questa pagina può fallire.
   */
  async segna(id: string, fatto: boolean, actorUserId: string) {
    await this.esiste(id);
    const staff = fatto
      ? await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })
      : null;
    return this.prisma.lavoro.update({
      where: { id },
      data: datiSpunta(fatto, staff?.id, new Date()),
      include: { fattoDa: { select: { displayName: true } } },
    });
  }

  /**
   * Si cancella solo quello che è stato scritto per sbaglio. ⚠️ Chiudere un lavoro è **spuntarlo**,
   * non cancellarlo: se il modo di togliere una riga dall'elenco fosse `Elimina`, dopo un mese la
   * pagina non saprebbe più dire cosa è stato fatto — cioè metà del motivo per cui esiste.
   */
  async elimina(id: string) {
    await this.esiste(id);
    await this.prisma.lavoro.delete({ where: { id } });
    return { ok: true };
  }

  private async esiste(id: string) {
    const r = await this.prisma.lavoro.findUnique({ where: { id }, select: { id: true } });
    if (!r) throw new NotFoundException('Questa voce non esiste più: qualcuno l\'ha eliminata.');
    return r;
  }
}
