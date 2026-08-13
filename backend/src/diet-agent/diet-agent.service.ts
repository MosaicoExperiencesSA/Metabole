import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { PESATE_PER_PLATEAU, pesoNonScende } from '../menu/plateau';
import { statoViaggioAttivo } from '../common/stato-viaggio';
import { aGiorno } from '../common/date-only';

export type AgentState =
  | 'normale'
  | 'conforto'
  | 'pre_evento'
  | 'post_evento'
  | 'plateau'
  /**
   * ⚠️ PLATEAU **E** UMORE BASSO INSIEME — decisione di Simone (13/8): «vince l'efficacia, ma resta
   * un giorno di conforto a settimana». È uno stato suo e non un flag appeso al plateau perché lo si
   * deve poter **vedere**: nei log e nella diagnosi «peso fermo» e «peso fermo mentre sta giù» sono
   * due situazioni che si guardano con occhi diversi.
   */
  | 'plateau_conforto'
  | 'rientro'
  | 'vacanza';

const DAY = 86_400_000;

const isLowMood = (m: string): boolean => m === 'hard' || m === 'stressed';

/**
 * Agente AI della dieta (Metabole_Agente_AI_Dieta): determina lo STATO del cliente,
 * che modula la selezione dei menu.
 * - pre_evento: evento in agenda entro N giorni → giorni più proteici;
 * - post_evento: evento concluso da poco (ultimi N giorni) → spinge sull'efficacia (recupero);
 * - plateau: nessun calo negli ultimi N cicli → spinge sull'efficacia;
 * - conforto: umore basso recente → menu più amati (per non farla mollare);
 * - rientro: guardrail dopo il conforto → si torna a spingere l'efficacia
 *   (o perché il conforto è durato troppi giorni di fila, o perché l'umore è risalito
 *   dopo un periodo difficile);
 * - vacanza: la cliente è via (modalità viaggio, «Vacanze in Serenità») → menu che mangerà
 *   davvero, non menu che la farebbero calare. Vince su tutto: spingere l'efficacia addosso a
 *   chi è al mare produce menu ignorati, non chili persi;
 * - normale: massimizza efficacia × gradimento.
 *
 * La modalità viaggio la imposta lo staff dalla scheda cliente; qui si legge attraverso
 * `statoViaggioAttivo`, che la fa SCADERE — un «in vacanza» dimenticato non deve restare
 * acceso a novembre. Il rientro invece è un istante, non un periodo: dura `agent_return_days`
 * dall'evento `travel_return`, che nasce nel momento esatto in cui l'operatrice segna il
 * rientro.
 * La sicurezza (esclusioni) e il bilanciamento restano prioritari e li applica MenuService.
 * La "memoria" dello stato si ricava dallo storico dei check-in (nessuna tabella dedicata).
 */
@Injectable()
export class DietAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async stateFor(clientId: string): Promise<AgentState> {
    const [preDays, postDays, plateauPesate, comfortMax, reentryDays, travelMaxDays, returnDays] = await Promise.all([
      this.configParams.getNumber('agent_pre_event_days', 3),
      this.configParams.getNumber('agent_post_event_days', 3),
      this.configParams.getNumber('agent_plateau_pesate', PESATE_PER_PLATEAU),
      this.configParams.getNumber('agent_comfort_max_days', 3),
      this.configParams.getNumber('agent_reentry_days', 3),
      this.configParams.getNumber('travel_max_days', 30),
      this.configParams.getNumber('agent_return_days', 7),
    ]);
    const today = aGiorno(new Date());

    // 0. MODALITÀ VIAGGIO — segnale esplicito dello staff, quindi vince sui segnali dedotti.
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { travelState: true, travelStart: true, travelEnd: true },
    })) as { travelState: string | null; travelStart: Date | null; travelEnd: Date | null } | null;
    const viaggio = statoViaggioAttivo(profilo, new Date(), travelMaxDays);
    // In vacanza: menu che mangerà davvero. È il senso di «Vacanze in Serenità» — si tiene il
    // peso, non si cerca il calo — e vince anche su plateau e conforto.
    if (viaggio === 'in_vacanza') return 'vacanza';
    // In partenza: è un evento a tutti gli effetti, e ha lo stesso trattamento (più proteico).
    if (viaggio === 'in_partenza') return 'pre_evento';

    // 0-bis. RIENTRO dal viaggio («Ritorno in Equilibrio»): spinta al recupero, ma per pochi
    // giorni. La durata si conta dall'evento `travel_return`, non dal campo sul profilo: lo
    // stato `rientrato` resta scritto per sempre, l'evento invece ha una data.
    if (profilo?.travelState === 'rientrato') {
      const rientro = (await this.prisma.analyticsEvent.findFirst({
        where: { userId: clientId, name: 'travel_return' },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      })) as { receivedAt: Date } | null;
      if (rientro && aGiorno(rientro.receivedAt).getTime() >= today.getTime() - returnDays * DAY) {
        return 'post_evento';
      }
    }

    // 1. Pre-evento: evento del cliente in arrivo entro N giorni.
    const horizon = new Date(today.getTime() + preDays * DAY);
    const upcoming = await this.prisma.event.findFirst({
      where: { clientId, startDate: { gte: today, lte: horizon } },
      select: { id: true },
    });
    if (upcoming) return 'pre_evento';

    // 2. Post-evento: evento concluso di recente (endDate negli ultimi N giorni) → recupero.
    const postFloor = new Date(today.getTime() - postDays * DAY);
    const recentEnded = await this.prisma.event.findFirst({
      where: { clientId, endDate: { gte: postFloor, lt: today } },
      select: { id: true },
    });
    if (recentEnded) return 'post_evento';

    /**
     * 3. PLATEAU — **tre pesate consecutive** senza calo. Risposta di Simone (13/8): «se il problema
     * è il peso che non scende o che è aumentato vince l'efficacia», e «tre pesi registrati
     * consecutivi».
     *
     * ⚠️ Prima si guardavano i **cicli** (`CycleFeedback.esitoPeso`, due di fila). Il segnale è
     * cambiato di proposito, e il vecchio **sparisce**: due regole per la stessa domanda sono la
     * cosa che questo progetto passa il tempo a togliere. Il ciclo dipende da un feedback che
     * qualcuno deve compilare; la pesata è il fatto.
     *
     * ⚠️ Si guarda `plateauPesate` (parametro `agent_plateau_pesate`, 3) e non `plateauCycles`.
     */
    const misure = (await this.prisma.measurement.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: plateauPesate,
      select: { weightKg: true },
    })) as { weightKg: number }[];
    const fermo = pesoNonScende(misure.map((m) => m.weightKg), plateauPesate);

    // 4. Conforto / guardrail / rientro — dalla "memoria" dei check-in recenti.
    const lookback = Math.max(comfortMax, reentryDays) + 3;
    const checkins = (await this.prisma.dailyCheckin.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: lookback,
      select: { mood: true, date: true },
    })) as { mood: string; date: Date }[];

    if (checkins.length) {
      const latest = checkins[0];
      const latestDaysAgo = Math.floor((today.getTime() - aGiorno(latest.date).getTime()) / DAY);
      // Il segnale umore conta solo se il check-in più recente è di oggi/ieri.
      if (latestDaysAgo <= 1) {
        if (isLowMood(latest.mood)) {
          // Giorni "difficili" consecutivi (dai check-in più recenti).
          let streak = 0;
          for (const c of checkins) {
            if (isLowMood(c.mood)) streak++;
            else break;
          }
          // Guardrail: se il conforto dura troppi giorni di fila si RIENTRA (spinta efficacia),
          // per non lasciare la cliente ferma nei menu "amati"; sotto la soglia → conforto.
          return streak > comfortMax ? 'rientro' : 'conforto';
        }
        // Umore risalito: se c'è stato un periodo difficile nella finestra di rientro → rientro.
        const reentryFloor = new Date(today.getTime() - reentryDays * DAY);
        const recentLow = checkins.some(
          (c) => isLowMood(c.mood) && aGiorno(c.date).getTime() >= reentryFloor.getTime(),
        );
        if (recentLow) return 'rientro';
      }
    }

    return 'normale';
  }
}
