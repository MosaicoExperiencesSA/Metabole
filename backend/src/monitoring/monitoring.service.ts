import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { aPrezzoAlMese, prezzoPiano } from '../commerce/prezzo-piano';
import { STATI_GIA_COMPRATO, STATI_QUALCOSA_IN_BALLO } from '../commerce/stati-abbonamento';
import { KcalNeedService } from '../menu/kcal-need.service';
import { TETTI_PREDEFINITI } from '../menu/porzione-scalata';
import { riporzionaSulFabbisogno } from '../menu/riporziona-giornata';
import { aGiorno } from '../common/date-only';

interface Period {
  id: string;
  clientId: string;
  status: string;
  startedAt: Date;
  endsAt: Date;
  referenceWeightKg: number;
  regainOfferedAt: Date | null;
  frozenAt: Date | null;
  closedAt: Date | null;
  convertedTo: string | null;
  lastMeasureAskAt: Date | null;
}

/**
 * Livello "Monitoraggio": sorveglianza a tempo. Esiste in due forme, e la regola è la stessa:
 * Gaia **non eroga menu di piano**, guarda le misure, e se il peso sale oltre la soglia
 * (+3 kg parametrizzabile) prepara una SETTIMANA DI MENU DI RIENTRO presi dallo storico
 * personale della cliente — i giorni che su di lei hanno fatto perdere di più.
 *  - **gratuito**, per chi finisce il percorso e non rinnova (`start()`, la chiede lei);
 *  - **in abbonamento** a €19/mese, che si può tenere anche per sempre (`avviaPerAbbonamento()`,
 *    parte dall'attivazione del piano).
 *
 * ⚠️ Il peso **si chiede, non si impone** (decisione Simone 9/8): Gaia lo domanda ogni tanto con
 * una notifica, e nel monitoraggio non c'è nessun popup bloccante né blocco dell'app — il gate
 * misure è disattivato apposta in `menu.service.ts → measurementGate`. Tutto il resto dell'app,
 * e la coach in chat, restano raggiungibili come sempre.
 *
 * ⚠️ **I menu di rientro NON si vendono più** (decisione Simone 7/8). Erano un prodotto a €29
 * («Menu di rientro (8 giorni)»): la cliente riprendeva peso, e per riavere una mano doveva
 * pagare. Ora sono **inclusi** — nel monitoraggio gratuito perché ha già pagato il percorso, in
 * quello a €19/mese perché lo sta pagando. Con loro sparisce anche il CONGELAMENTO per mancato
 * acquisto: non c'è più niente da acquistare, quindi non c'è più niente da rifiutare.
 * Tono sempre supportivo, mai punitivo — e adesso lo è anche il modello, non solo il testo.
 */
@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    // ⚠️ Il fabbisogno serve a RIPORZIONARE le giornate copiate dal kit di rientro (voce 255): è la
    // stessa classe che usa l'erogazione, non un secondo calcolo.
    private readonly kcalNeed: KcalNeedService,
  ) {}

  private readonly logger = new Logger(MonitoringService.name);

  private async funnelEvent(name: string, clientId: string, data: Record<string, unknown> = {}): Promise<void> {
    await this.prisma.analyticsEvent
      .create({ data: { eventId: randomUUID(), name, userId: clientId, phase: 'funnel', data: data as never } as never })
      .catch(() => undefined);
  }

  private async activePeriod(clientId: string): Promise<Period | null> {
    return (await this.prisma.monitoringPeriod.findFirst({
      where: { clientId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    })) as Period | null;
  }


  private async lastWeight(clientId: string): Promise<{ weightKg: number; date: Date } | null> {
    return (await this.prisma.measurement.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { weightKg: true, date: true },
    })) as { weightKg: number; date: Date } | null;
  }

  // ---------- Stato per l'app ----------

  /** Stato del monitoraggio per la cliente: periodo corrente + dati per la card in app. */
  async myStatus(clientId: string) {
    const period = (await this.prisma.monitoringPeriod.findFirst({
      where: { clientId },
      orderBy: { startedAt: 'desc' },
    })) as Period | null;

    // Idoneo ad attivarlo: nessun abbonamento attivo/in attesa e nessun monitoraggio attivo.
    const activeSub = await this.prisma.subscription.findFirst({
      // ⚠️ Con la coda dentro: chi ha un piano che parte lunedì non è idoneo al monitoraggio
      // (voce 258). Senza, avrebbe attivato il monitoraggio sopra un piano già pagato.
      where: { clientId, status: { in: [...STATI_QUALCOSA_IN_BALLO] } as never },
      select: { id: true },
    });
    /**
     * Idoneo al monitoraggio SOLO dopo un piano di MANTENIMENTO concluso (progressione: percorso →
     * mantenimento → monitoraggio). Prima bastava un qualsiasi abbonamento pregresso, così il
     * monitoraggio compariva subito a fine prova/piano: non è più così. Fuori i `pending`, che sono
     * ordini non pagati e sbloccavano il monitoraggio a chi aveva solo premuto «acquista».
     *
     * ⚠️ Questa condizione **da sola** direbbe sì anche a mantenimento in corso, e dal 12/8 la regola
     * è «solo a mantenimento scaduto e non rinnovato» (vedi `commerce.service.statoMonitoraggio`).
     * Qui il risultato è già quello giusto, ma per un'altra strada: `activeSub` qui sopra esclude chi
     * ha un abbonamento attivo o in attesa, quindi un mantenimento in corso blocca da lì.
     *
     * Le due condizioni non sono lo stesso codice — `CommerceService` dipende già da questo servizio,
     * e chiamarlo al contrario chiuderebbe un ciclo fra i moduli. Restano quindi due, e vanno tenute
     * d'accordo a mano: se un domani si toccasse `activeSub`, questa riga smetterebbe di rispettare
     * la regola **senza che nessun test lo dica**, perché il difetto vivrebbe nella combinazione.
     */
    const hadMaintenance = await this.prisma.subscription.findFirst({
      where: { clientId, status: { in: [...STATI_GIA_COMPRATO] } as never, plan: { period: 'maintenance' } } as never,
      select: { id: true },
    });
    const last = await this.lastWeight(clientId);
    const regainKg = await this.configParams.getNumber('monitoring_regain_kg', 3);

    const active = period?.status === 'active' ? period : null;
    return {
      eligible: !activeSub && !!hadMaintenance && (!period || period.status !== 'active'),
      period: period
        ? {
            id: period.id,
            status: period.status,
            startedAt: period.startedAt.toISOString(),
            endsAt: period.endsAt.toISOString(),
            daysLeft: active ? Math.max(0, Math.ceil((period.endsAt.getTime() - Date.now()) / 86_400_000)) : 0,
            referenceWeightKg: period.referenceWeightKg,
            regainOffered: period.regainOfferedAt != null,
          }
        : null,
      lastWeightKg: last?.weightKg ?? null,
      deltaKg: active && last ? Math.round((last.weightKg - active.referenceWeightKg) * 10) / 10 : null,
      regainThresholdKg: regainKg,
      // I menu di rientro sono inclusi: qui si dice solo SE sono già stati erogati, non a
      // quanto si comprano. Il campo `rientro` con planId e prezzo non esiste più.
      rientroErogato: period?.regainOfferedAt != null,
    };
  }

  // ---------- Attivazione ----------

  /** Attiva il monitoraggio gratuito (cliente, a fine percorso). */
  async start(clientId: string): Promise<{ started: true; endsAt: string }> {
    const activeSub = await this.prisma.subscription.findFirst({
      // ⚠️ Con la coda dentro: chi ha un piano che parte lunedì non è idoneo al monitoraggio
      // (voce 258). Senza, avrebbe attivato il monitoraggio sopra un piano già pagato.
      where: { clientId, status: { in: [...STATI_QUALCOSA_IN_BALLO] } as never },
      select: { id: true },
    });
    if (activeSub) throw new BadRequestException('Hai già un piano attivo: il monitoraggio serve dopo la fine del percorso.');
    const existing = await this.activePeriod(clientId);
    if (existing) throw new BadRequestException('Il monitoraggio è già attivo.');
    const last = await this.lastWeight(clientId);
    if (!last) throw new BadRequestException('Serve almeno una pesata registrata per attivare il monitoraggio.');

    const days = await this.configParams.getNumber('monitoring_duration_days', 30);
    const endsAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.monitoringPeriod.create({
      data: { clientId, status: 'active', endsAt, referenceWeightKg: last.weightKg } as never,
    });
    await this.funnelEvent('monitoraggio_started', clientId, { referenceWeightKg: last.weightKg, days });
    await this.notifications
      .notify({
        userId: clientId,
        type: 'monitoring_started',
        title: 'Monitoraggio attivo 🛡️',
        body: `Per ${days} giorni resto in allerta con te: ti chiederò il peso ogni tanto. Il tuo storico resta al sicuro, e se ti serve una mano io sono qui.`,
      })
      .catch(() => undefined);
    return { started: true, endsAt: endsAt.toISOString() };
  }

  // ---------- Cron giornaliero ----------

  /**
   * Giro giornaliero sui monitoraggi attivi: scadenza del mese, proposta di rientro al superamento
   * della soglia, richiesta misure se la cliente non si pesa da qualche giorno.
   *
   * Il **congelamento** non c'è più (rimosso il 7/8 insieme ai menu di rientro a pagamento): chi è in
   * monitoraggio non viene più congelato per non aver comprato niente. Con lui è sparito l'unico uso di
   * `monitoring_offer_days`, che però continuava a essere letto qui — un parametro visibile nei
   * Parametri, modificabile, e senza alcun effetto. Peggio di un parametro assente, perché chi lo
   * cambia crede di aver cambiato qualcosa.
   */
  async dailyTick(): Promise<{ expired: number; offered: number; frozen: number; asked: number }> {
    const now = new Date();
    const [regainKg, askDays] = await Promise.all([
      this.configParams.getNumber('monitoring_regain_kg', 3),
      this.configParams.getNumber('monitoring_measure_ask_days', 3),
    ]);
    const periods = (await this.prisma.monitoringPeriod.findMany({ where: { status: 'active' } })) as Period[];
    let expired = 0;
    let offered = 0; // ora sono menu EROGATI, non offerte di acquisto
    const frozen = 0; // il congelamento per mancato acquisto non esiste più: non c'è più un acquisto
    let asked = 0;

    for (const p of periods) {
      try {
        // (Qui c'era il CONGELAMENTO di chi non comprava il kit di rientro entro la finestra.
        // Tolto il 7/8 insieme al prodotto: i menu ora sono inclusi, quindi non c'è più un
        // acquisto da rifiutare — e nessuno viene messo in pausa per non aver speso €29.)

        // 2) Scadenza del mese → chiuso, con le tre strade (percorso / mantenimento / nuovo monitoraggio).
        if (p.endsAt.getTime() <= now.getTime()) {
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            data: { status: 'expired', closedAt: now } as never,
          });
          await this.funnelEvent('monitoraggio_scaduto', p.clientId);
          // Il prezzo lo dice il NEGOZIO, non questa riga: qui c'era «€29/mese» scritto a mano da
          // quando il Mantenimento costava 29, e dal giorno in cui è passato a 49 mandavamo un
          // prezzo sbagliato senza che nessuno potesse accorgersene. Se il piano non si trova la
          // frase esce senza cifra — meglio una parola in meno che una promessa da spiegare.
          const mantenimento = await prezzoPiano(this.prisma, { period: 'maintenance' });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_expired',
              title: 'Il mese di monitoraggio è finito 🌱',
              body: 'Come vuoi proseguire? Puoi ripartire con un percorso di dimagrimento, tenere il peso '
                + `col mantenimento${aPrezzoAlMese(mantenimento)}, o riattivare un altro mese di monitoraggio. `
                + 'Ti aspetto in app.',
            })
            .catch(() => undefined);
          expired++;
          continue;
        }

        const last = await this.lastWeight(p.clientId);

        // 2-bis) PESO DI RIFERIMENTO MANCANTE (solo monitoraggio in abbonamento: si entra anche
        // senza essersi mai pesate). Alla prima pesata quello diventa il riferimento, e da lì
        // in poi la soglia ha un senso. Senza questo blocco il confronto sarebbe `70 − 0 = 70`
        // e i menu di rientro partirebbero il giorno stesso, a una persona che non è aumentata
        // di un grammo.
        if (p.referenceWeightKg <= 0) {
          if (last) {
            await this.prisma.monitoringPeriod.update({
              where: { id: p.id },
              data: { referenceWeightKg: last.weightKg } as never,
            });
          }
          continue;
        }

        /**
         * 3) Trigger di rientro: peso oltre la soglia → si EROGANO i menu, senza chiedere niente.
         *    Prima qui partiva un'offerta a €29: la cliente riprendeva peso e, per avere una mano,
         *    doveva comprare. Dal 7/8 sono inclusi.
         *
         * ⚠️ **QUESTO TRIGGER GUARDA L'ULTIMA PESATA, E LE PORZIONI DEL KIT LA MEDIA MOBILE** — sono
         * due numeri diversi nella stessa esecuzione, e va scritto perché sembra una svista e non lo
         * è (27/8, in revisione, dopo il passaggio del fabbisogno alla tendenza).
         *
         * Le due domande sono diverse: qui si chiede **«è risalita?»**, che è uno scarto fra oggi e
         * un riferimento — e uno scarto lo si vede prima sull'ultima pesata; `generateRientroMenus`
         * riporziona sul fabbisogno, che chiede **«quanto pesa adesso»**, e a quella il progetto
         * risponde con la tendenza da sempre.
         *
         * ✅ **RISOLTO IL 3/9, e la risposta è stata l'opposta di quella che sembrava.** Il difetto
         * era: il trigger scatta *perché* l'ultima pesata è un salto, e `generateRientroMenus`
         * riporzionava sulla media, che quel salto lo diluisce — riferimento 68, pesate 68,2 /
         * 68,0 / 71,0 → il kit partiva per 3 chili e riporzionava come per 1,07.
         *
         * Sembrava che a doversi muovere fosse **questo trigger** (farlo partire più tardi, con la
         * media). Simone ha deciso il contrario: *«Sì esatto»* alla strada b — **le porzioni**
         * partono dall'ultima pesata, come il trigger. ⚠️ Adesso i due guardano lo stesso numero, ed
         * è quello il punto: non erano due scelte, era una incoerenza.
         */
        if (!p.regainOfferedAt && last && last.weightKg - p.referenceWeightKg >= regainKg) {
          const generati = await this.generateRientroMenus(p.clientId);
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            // Il campo si chiama ancora `regainOfferedAt` (era "offerto"): ora vuol dire
            // "menu di rientro già erogati", e serve a non rierogarli ogni giorno.
            data: { regainOfferedAt: now } as never,
          });
          await this.funnelEvent('monitoraggio_rientro_erogato', p.clientId, {
            deltaKg: Math.round((last.weightKg - p.referenceWeightKg) * 10) / 10,
            menus: generati,
          });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_rientro_ready',
              title: 'Ti ho preparato i menu di rientro 🧰',
              body: `Capita a tutte (vacanze, periodi pieni…). Trovi in app ${generati} giornate scelte sul tuo storico: quelle che su di te hanno funzionato meglio. Di solito bastano 4-6 giorni per rimettersi in riga.`,
            })
            .catch(() => undefined);
          offered++;
          continue;
        }

        // 4) Richiesta misure: niente pesata da `askDays` giorni (e non gliel'ho già chiesto da poco).
        const staleMeasure = !last || now.getTime() - last.date.getTime() >= askDays * 86_400_000;
        const askedRecently = p.lastMeasureAskAt && now.getTime() - p.lastMeasureAskAt.getTime() < askDays * 86_400_000;
        if (staleMeasure && !askedRecently) {
          await this.prisma.monitoringPeriod.update({
            where: { id: p.id },
            data: { lastMeasureAskAt: now } as never,
          });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'monitoring_measure_ask',
              title: 'Ci pesiamo? ⚖️',
              body: 'Sono qui che veglio su di te: una pesata al volo e so che va tutto bene. Bastano 10 secondi in app.',
            })
            .catch(() => undefined);
          asked++;
        }
      } catch {
        /* un errore su una cliente non blocca il giro */
      }
    }
    return { expired, offered, frozen, asked };
  }

  /** Traccia in audit un giro forzato dall'admin (collaudo/sblocco manuale). */
  async auditTick(actorId: string, result: { expired: number; offered: number; frozen: number; asked: number }): Promise<void> {
    await this.audit.log({
      action: 'monitoring.tick.manual',
      actorId,
      entityType: 'monitoring_period',
      entityId: 'batch',
      metadata: result as never,
    });
  }

  // ---------- Hook dal commercio ----------

  /**
   * Chiamato all'ATTIVAZIONE di un piano (pagamento approvato): il monitoraggio gratuito in
   * corso si chiude, perché la cliente è passata a qualcosa di pagato — un percorso, il
   * mantenimento, o il monitoraggio in abbonamento.
   *
   * ⚠️ Qui c'era il ramo del «Menu di rientro (8 giorni)» a €29: pagato quel piano, si erogavano
   * gli 8 menu e ripartiva un mese gratuito. Il prodotto è stato eliminato il 7/8 — i menu di
   * rientro sono inclusi in entrambi i monitoraggi — quindi il ramo non ha più ragione di
   * esistere: i menu li eroga direttamente il giro giornaliero quando il peso risale.
   */
  async onPlanActivated(clientId: string, plan: { id: string; name: string; priceCents: number; period: string }): Promise<void> {
    try {
      const period = await this.activePeriod(clientId);

      // MONITORAGGIO IN ABBONAMENTO (€19/mese): è l'eccezione, e prima non c'era.
      // «Qualsiasi piano a pagamento chiude il monitoraggio» valeva anche per QUESTO piano, che
      // di monitoraggio è fatto: chi pagava si comprava la fine del servizio che stava
      // comprando. Niente più richieste del peso e — soprattutto — niente menu di rientro se il
      // peso risaliva, perché il giro giornaliero lavora solo sui periodi attivi. Senza nessun
      // errore: semplicemente non succedeva più niente.
      if (plan.period === 'monitoring') {
        await this.avviaPerAbbonamento(clientId, period);
        return;
      }

      // Conversione: qualsiasi ALTRO piano a pagamento chiude il monitoraggio in corso.
      if (period && plan.priceCents > 0) {
        const dest = plan.period === 'maintenance' ? 'mantenimento' : 'dimagrimento';
        await this.prisma.monitoringPeriod.update({
          where: { id: period.id },
          data: { status: 'converted', convertedTo: plan.name, closedAt: new Date() } as never,
        });
        await this.funnelEvent('monitoraggio_converted', clientId, { to: dest, planId: plan.id });
      }
    } catch {
      /* il commercio non deve mai fallire per il monitoraggio */
    }
  }

  /**
   * Apre (o prolunga) la sorveglianza per chi ha comprato il **Monitoraggio in abbonamento**.
   *
   * Differenze rispetto a `start()`, che è la versione gratuita richiesta dalla cliente:
   *  - **non pretende che non ci sia un piano attivo**: qui il piano attivo è proprio questo;
   *  - **non pretende una pesata già registrata**. Il peso di riferimento, se manca, si prende
   *    alla prima pesata utile: chiederlo come condizione d'ingresso vorrebbe dire far pagare
   *    un servizio e poi non erogarlo finché non sale sulla bilancia. Nel monitoraggio il peso
   *    **si chiede, non si impone** (decisione Simone 9/8), e questo vale anche qui.
   *  - se un periodo è già aperto lo **prolunga** invece di aprirne un altro: al rinnovo
   *    mensile si passa di qui ogni volta.
   */
  private async avviaPerAbbonamento(clientId: string, esistente: Period | null): Promise<void> {
    const giorni = await this.configParams.getNumber('monitoring_duration_days', 30);
    const endsAt = new Date(Date.now() + giorni * 86_400_000);

    if (esistente) {
      // Prolunga e riapre la finestra del rientro: un mese nuovo è un'occasione nuova.
      await this.prisma.monitoringPeriod.update({
        where: { id: esistente.id },
        data: { status: 'active', endsAt, regainOfferedAt: null } as never,
      });
      return;
    }

    const last = await this.lastWeight(clientId);
    await this.prisma.monitoringPeriod.create({
      data: {
        clientId,
        status: 'active',
        endsAt,
        // Senza pesate il riferimento resta 0: la soglia non può scattare finché non c'è un
        // peso vero, ed è giusto così — non si può dire «sei aumentata di 3 kg» rispetto a niente.
        referenceWeightKg: last?.weightKg ?? 0,
      } as never,
    });
    await this.funnelEvent('monitoraggio_abbonamento_started', clientId, {
      referenceWeightKg: last?.weightKg ?? null,
      giorni,
    });
    await this.notifications
      .notify({
        userId: clientId,
        type: 'monitoring_started',
        title: 'Monitoraggio attivo 🛡️',
        body: 'Resto in allerta con te: ogni tanto ti chiedo il peso — quando ti va, senza obblighi. Se dovesse risalire, ti preparo io una settimana di menu scelti fra quelli che su di te hanno funzionato meglio. E la tua coach resta qui.',
      })
      .catch(() => undefined);
  }

  // ---------- Menu di rientro ----------

  /**
   * Sceglie i giorni di menu che su QUESTA cliente hanno fatto perdere di più e li ricrea nei
   * giorni successivi. Ordine di preferenza delle fonti:
   * 1) cicli con esito peggiore→migliore dal learning del motore (cycle_feedback);
   * 2) delta misure attorno a ogni giorno di menu; 3) i giorni più recenti.
   *
   * Quanti giorni: **una settimana** (`monitoring_rientro_days`, default 7). Erano 8 — un numero
   * ereditato dal vecchio prodotto «Menu di rientro (8 giorni)» a €29, che non esiste più. Sette
   * è la settimana, che è come la cliente pensa il tempo: «per una settimana mangi così».
   */
  async generateRientroMenus(clientId: string, quantiGiorni?: number): Promise<number> {
    /**
     * ⚠️ **Quanti giorni: chi chiama può dirlo** (1/9, Fase 6.2). L'omaggio dato **durante** la
     * pausa è di 4 giornate — richiesta di Simone del 27/8 — mentre il kit di fine monitoraggio
     * resta di 7. ⛔ Sono due cose diverse e non devono condividere il parametro: cambiare
     * `monitoring_rientro_days` per accorciare l'omaggio accorcerebbe anche il kit del piano a
     * €19, cioè un prodotto che qualcuno ha comprato.
     */
    const giorni = Math.max(1, quantiGiorni ?? await this.configParams.getNumber('monitoring_rientro_days', 7));
    const history = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lte: new Date() } },
      orderBy: { date: 'desc' },
      take: 400,
      select: { date: true, dietId: true, level: true, meals: true },
    })) as { date: Date; dietId: string; level: number; meals: unknown }[];
    if (history.length === 0) return 0;
    const byKey = new Map<string, { date: Date; dietId: string; level: number; meals: unknown }>();
    for (const h of history) byKey.set(h.date.toISOString().slice(0, 10), h);

    const picked: { date: Date; dietId: string; level: number; meals: unknown }[] = [];
    const pickedKeys = new Set<string>();
    const push = (d: { date: Date; dietId: string; level: number; meals: unknown } | undefined) => {
      if (!d) return;
      const k = d.date.toISOString().slice(0, 10);
      if (pickedKeys.has(k) || picked.length >= giorni) return;
      pickedKeys.add(k);
      picked.push(d);
    };

    // 1) Cicli ordinati per calo (deltaWeightKg più negativo prima): i loro giorni sono i migliori.
    const cycles = (await this.prisma.cycleFeedback.findMany({
      where: { clientId, deltaWeightKg: { lt: 0 } },
      orderBy: { deltaWeightKg: 'asc' },
      take: 20,
      select: { cycleStart: true, cycleEnd: true },
    })) as { cycleStart: Date; cycleEnd: Date }[];
    for (const c of cycles) {
      for (let t = this.dayKey(c.cycleStart); t <= this.dayKey(c.cycleEnd); t += 86_400_000) {
        push(byKey.get(new Date(t).toISOString().slice(0, 10)));
      }
      if (picked.length >= giorni) break;
    }

    // 2) Delta misure attorno ai singoli giorni di menu.
    if (picked.length < giorni) {
      const ms = (await this.prisma.measurement.findMany({
        where: { clientId },
        orderBy: { date: 'asc' },
        select: { date: true, weightKg: true },
      })) as { date: Date; weightKg: number }[];
      const scored = history
        .map((h) => {
          const d = this.dayKey(h.date);
          let before: number | null = null;
          let after: number | null = null;
          for (const m of ms) {
            const t = this.dayKey(m.date);
            if (t <= d) before = m.weightKg;
            else if (after == null && t <= d + 3 * 86_400_000) after = m.weightKg;
          }
          return { h, delta: before != null && after != null ? after - before : null };
        })
        .filter((x): x is { h: (typeof history)[number]; delta: number } => x.delta != null && x.delta < 0)
        .sort((x, y) => x.delta - y.delta);
      for (const s of scored) push(s.h);
    }

    // 3) Riempi con i giorni più recenti.
    for (const h of history) push(h);

    /**
     * ⚠️ LE GIORNATE COPIATE SI RIPORZIONANO SUL FABBISOGNO DI ADESSO (voce 255, ultima coda).
     *
     * Copiarle di peso sbaglia in due modi: una giornata di prima del 18/8 **non è scalata** e
     * tornerebbe nel futuro al 65% — e nessuno la aggiusterebbe più, perché `deliverIfEligible`
     * compone solo le date che non esistono ancora; e una scalata mesi fa porta un fattore
     * dimensionato su un fabbisogno che oggi non è più il suo. Il perché e i tre ⚠️ (a partire da
     * «non si scala quello che è già scalato») stanno in `menu/riporziona-giornata.ts`.
     */
    /**
     * ⛔ **SULL'ULTIMA PESATA, NON SULLA TENDENZA** — regola di Simone, 3/9: *«Sì esatto»* alla
     * strada b della voce `kit-rientro-quale-peso`.
     *
     * Il kit parte **perché** l'ultima pesata è un salto — cioè proprio il dato che la media
     * diluisce. Riferimento 68, pesate 68,2 / 68,0 / 71,0: partiva perché era salita di 3 chili e
     * riporzionava come se ne avesse ripresi 1,07. ⚠️ Adesso il trigger e le porzioni guardano **lo
     * stesso numero**, ed è quella la cosa che non tornava: due numeri diversi nella stessa
     * esecuzione, sulla stessa persona, nello stesso istante.
     *
     * ⛔ **Non «porzioni più grandi»**, e la prima stesura di questo commento lo diceva: il target
     * non cresce col peso in tutti i regimi — la derivata è `10·PAL − 1100/settimane`, negativa in
     * quello dominante. Quanto si sposta dipende dal regime, e in un verso o nell'altro vale
     * qualche decina di kcal. Il motivo della correzione è la **coerenza**, non l'ampiezza.
     *
     * ⚠️ La tendenza resta la regola dappertutto: qui no perché al rientro è vecchia **per
     * definizione**, non perché sia passato del tempo.
     */
    const targetKcal = await this.kcalNeed.computeTargetKcal(clientId, { sullUltimaPesata: true });
    const tetti = {
      principale: await this.configParams.getNumber('porzione_tetto_pasto_principale', TETTI_PREDEFINITI.principale),
      colazione: await this.configParams.getNumber('porzione_tetto_colazione', TETTI_PREDEFINITI.colazione),
      spuntino: await this.configParams.getNumber('porzione_tetto_spuntino', TETTI_PREDEFINITI.spuntino),
    };
    if (!targetKcal) {
      // ⚠️ Detto e non dedotto: senza fabbisogno le giornate restano com'erano — che è la scelta
      // prudente (riportarle al catalogo le rimpicciolirebbe in silenzio), ma chi legge i log deve
      // sapere che quelle porzioni sono quelle di allora.
      /**
       * ⚠️ **IL MOTIVO NON È PIÙ UNO SOLO** (28/8). Questa riga diceva «Mancano sesso, età, altezza
       * o peso nel profilo»: dal 28/8 il fabbisogno risponde `null` **anche** quando le pesate della
       * cliente non stanno in piedi fra loro (`peso-incoerente.ts`), e quella frase sarebbe
       * diventata una bugia scritta nei log — cioè la peggior specie di log, quella che manda a
       * cercare nel posto sbagliato.
       *
       * ⚠️ Il motivo preciso — quale dei due — lo scrive `KcalNeedService` in **tutt'e due** i rami,
       * col `clientId` dentro la frase. La prima stesura scriveva «il motivo è nella riga sopra»:
       * ⛔ falso, perché quel logger scriveva solo il ramo delle pesate incoerenti, e perché questo
       * giro passa su più clienti da due logger diversi. Il cliente nel messaggio è ciò che lega le
       * due righe senza promettere che siano adiacenti.
       */
      this.logger.warn(
        `Kit di rientro per ${clientId}: fabbisogno non disponibile — mancano sesso, età, altezza o ` +
          'un peso da cui partire, oppure le sue pesate non stanno in piedi fra loro (in quel secondo ' +
          `caso KcalNeedService ha scritto il dettaglio per lo stesso cliente). Le giornate copiate ` +
          'tengono le porzioni che avevano.',
      );
    }

    // Ricrea i giorni scelti nei prossimi giorni (a partire da domani), saltando date già occupate.
    // Il giorno di Roma (era `setHours`, cioè il fuso del processo): questi giorni si ricreano «da
    // domani», e con il calendario spostato «domani» poteva essere oggi.
    const today = aGiorno(new Date());
    /**
     * ⛔ **ANCHE QUESTE GIORNATE DEVONO SAPERE SE POSSIAMO SAPERLO** (26/8, voce
     * `visto-non-vuol-dire-aperto`). Il kit di rientro crea `MenuDay` per conto suo, e senza questa
     * riga nascevano con `apertureTracciate` a `false` — cioè «non lo so» **per sempre**, anche per
     * una cliente il cui telefono manda il segnale da mesi. Conseguenza: i suoi giorni di rientro
     * non si sarebbero mai potuti rifare da soli, e — peggio — avrebbero bloccato la coda di tutti
     * quelli dopo. Un campo dimenticato in un secondo punto di creazione è il modo classico in cui
     * una regola nuova smette di valere senza che nessuno se ne accorga.
     */
    const profiloAperture = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { apertureDal: true } as never,
    })) as { apertureDal?: Date | null } | null;
    const apertureTracciate = !!profiloAperture?.apertureDal;
    let createdCount = 0;
    for (let i = 0; i < Math.min(picked.length, giorni); i++) {
      const target = new Date(today.getTime() + (i + 1) * 86_400_000);
      const src = picked[i];
      const { meals: pasti } = riporzionaSulFabbisogno(src.meals, targetKcal, tetti);
      try {
        await this.prisma.menuDay.upsert({
          where: { clientId_date: { clientId, date: target } } as never,
          create: {
            clientId,
            date: target,
            dietId: src.dietId,
            level: src.level,
            meals: pasti as never,
            status: 'planned',
            visibleFrom: today,
            apertureTracciate,
          } as never,
          /**
           * ⛔ **UN GIORNO GIÀ EROGATO NON SI SOVRASCRIVE** (corretto il 23/8, in revisione).
           *
           * Il commento due righe sopra diceva «saltando date già occupate», e questo `update`
           * faceva il contrario: riscriveva sopra. Difetto silenzioso fino a ieri, **quasi certo**
           * da oggi — al rientro da una sospensione la pesata è obbligatoria, quindi il confronto
           * con `refWeightKg` c'è sempre, e il kit del cron notturno riscriveva sopra il menu del
           * rientro appena promesso alla cliente. Le cambiava sotto la giornata per cui aveva
           * appena fatto la spesa.
           *
           * È la stessa regola di `deliverIfEligible` (`update: {}`): un menu che è già in mano a
           * qualcuno non si tocca.
           */
          update: {} as never,
        });
        createdCount++;
      } catch {
        /* un giorno che fallisce non blocca gli altri */
      }
    }
    await this.audit.log({
      action: 'monitoring.rientro.menus',
      actorId: clientId,
      entityType: 'user',
      entityId: clientId,
      metadata: { menus: createdCount },
    });
    return createdCount;
  }

  /**
   * Il giorno di una data **salvata** (inizio/fine ciclo, misure): si legge in UTC, come sono
   * scritte. ⚠️ Era `setHours(0,0,0,0)`, che è il fuso del *processo*: su Render dà lo stesso
   * risultato per caso, ma su una macchina configurata a Roma no. Scriverlo esplicito toglie una
   * dipendenza da una variabile d'ambiente che nessuno ha impostato.
   */
  private dayKey(d: Date): number {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
}
