import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  assegnaLaRiserva,
  clientiConLeadMaSenzaCoach,
  clientiSenzaCoach,
  coachDiRiserva,
  riagganciaLeadAccettati,
  type CoachDiRiserva,
  type EsitoGiro,
} from '../common/coach-di-riserva';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ⚠️ **Il servizio non giudica: chiama `common/coach-di-riserva.ts` e basta.** Sta qui per avere un
 * posto nel cron (il giro notturno) e un endpoint per la tendina del backoffice. Il perché di
 * tutto sta in testa a quel modulo.
 */
@Injectable()
export class CoachDiRiservaService {
  private readonly logger = new Logger(CoachDiRiservaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  /** Chi è la riserva oggi, o perché non c'è. */
  chi(): Promise<CoachDiRiserva> {
    return coachDiRiserva(this.prisma as never, this.configParams);
  }

  /**
   * ⛔ **IL GIRO NOTTURNO: ripesca chi è rimasta senza coach da qualunque porta.** Le due porte che
   * una persona attraversa (questionario, rimozione a mano) applicano la regola subito; questo
   * passo chiude tutte le altre — importazioni, lead senza coach, clienti senza scheda profilo.
   *
   * ⚠️ Con la riserva spenta non legge nemmeno le clienti; con la riserva **non valida** non scrive
   * niente e lo dice nei log con il motivo: è la differenza fra «nessuno l'ha voluta» e «è
   * configurata male», e chi legge i log deve poterla vedere.
   */
  async giroNotturno(): Promise<{ riserva: CoachDiRiserva['esito']; senzaCoach: number; riagganciate?: number; schedeCreateDalLead?: number } & Partial<EsitoGiro>> {
    const riserva = await this.chi();
    if (riserva.esito === 'spenta') return { riserva: 'spenta', senzaCoach: 0 };
    if (riserva.esito === 'non_valida') {
      this.logger.warn(
        `Coach di riserva NON valida (parametro coach_di_riserva = "${riserva.valore}": ${riserva.motivo}). `
        + 'Nessuna cliente assegnata: la riga in Parametri va sistemata.',
      );
      return { riserva: 'non_valida', senzaCoach: 0 };
    }
    /**
     * ⚠️ Prima chi ha un lead ACCETTATO e la scheda vuota: è di quella coach, non della riserva, e si
     * ripara col ponte del 6/8 (`riagganciaLeadAccettati`). Simone, 5/9: niente più comandi a mano.
     */
    const conLead = await clientiConLeadMaSenzaCoach(this.prisma as never);
    const riagganciate = await riagganciaLeadAccettati(this.prisma, conLead);
    if (riagganciate.riagganciate) {
      this.logger.log(`Lead accettati con la scheda vuota: ${riagganciate.riagganciate} riagganciate alla loro coach (${riagganciate.schedeCreateDalLead} schede create).`);
    }
    const senza = await clientiSenzaCoach(this.prisma as never);
    if (!senza.length) return { riserva: 'ok', senzaCoach: 0, assegnate: 0, schedeCreate: 0, giaAssegnate: 0, ...riagganciate };
    const esito = await assegnaLaRiserva(
      this.prisma, riserva, senza, 'giro_notturno',
      (riga) => this.audit.log(riga),
    );
    this.logger.log(
      `Coach di riserva (${riserva.displayName}): ${senza.length} senza coach, ${esito.assegnate} assegnate `
      + `(${esito.schedeCreate} schede create), ${esito.giaAssegnate} già di qualcuno.`,
    );
    return { riserva: 'ok', senzaCoach: senza.length, ...esito, ...riagganciate };
  }
}
