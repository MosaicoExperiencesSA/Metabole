import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { MailService } from '../mail/mail.service';
import { PdfService } from '../pdf/pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope } from '../common/coach-team';
import { ConfigParamsService } from '../config-params/config-params.service';
import { litriObiettivo } from '../common/obiettivo-acqua';

export interface MonthlyReport {
  clientId: string;
  name: string;
  email: string;
  locale: string | null;
  periodLabel: string;
  startWeightKg: number | null;
  currentWeightKg: number | null;
  lostTotalKg: number | null;
  lostThisMonthKg: number | null;
  targetWeightKg: number | null;
  toGoKg: number | null;
  checkins: number;
  measurements: number;
  // Abitudini del mese (per il Diario in PDF): medie + serie giornaliere.
  waterAvgL: number | null;
  waterGoalL: number | null;
  waterSeries: number[]; // litri per giorno (max 31)
  stepsAvg: number | null;
  stepsGoal: number;
  stepsSeries: number[]; // passi per giorno (max 31)
  /**
   * Quante volte il menu è stato adattato a lei in chat nel mese: ingredienti scambiati e piatti
   * cambiati, contati insieme. Richiesta di Simone (8/8): «i cambi vanno poi salvati nella scheda
   * cliente e nel report di fine mese».
   *
   * Non è una statistica di servizio, è un **dato di personalizzazione** (punto 5 di
   * `progetto/PROGETTO_gaia-cambio-menu.md`): dice alla cliente quante volte il piano si è piegato
   * su di lei invece del contrario. Zero è un numero legittimo e va mostrato come tale.
   */
  cambiInChat: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly pdfTemplates: PdfService,
    // Gli obiettivi di acqua e passi si leggono dai Parametri, come in app: erano scritti a mano qui.
    private readonly configParams: ConfigParamsService,
  ) {}

  /**
   * Visibilità per ruolo: coach/nutrizionista possono vedere e inviare il report SOLO
   * dei clienti assegnati a loro; manager coach (sales), capo nutrizionista e admin tutti.
   */
  async assertReportAccess(actorUserId: string, clientId: string) {
    const actor = (await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } })) as { role: string } | null;
    const role = actor?.role;
    if (role !== 'coach' && role !== 'coach_coordinator' && role !== 'nutritionist') return;
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    if (role === 'nutritionist') {
      const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
      if (prof?.assignedNutritionistId !== staff?.id) throw new ForbiddenException('Questo cliente non è assegnato a te.');
      return;
    }
    // Coach → sue clienti; coordinatrice → sue + del suo team.
    const ids = (await coachTeamScope(this.prisma, actorUserId)) ?? [];
    if (!prof?.assignedCoachId || !ids.includes(prof.assignedCoachId)) throw new ForbiddenException('Questo cliente non è assegnato a te.');
  }

  /** Calcola il riepilogo del mese per una cliente. */
  async buildMonthlyReport(clientId: string): Promise<MonthlyReport> {
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { name: true, startWeightKg: true, user: { select: { email: true, locale: true } } },
    })) as { name: string | null; startWeightKg: number | null; user: { email: string; locale: string | null } } | null;
    if (!profile) throw new NotFoundException('Profilo cliente non trovato.');

    const measurements = (await this.prisma.measurement.findMany({
      where: { clientId },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true },
    })) as { date: Date; weightKg: number }[];
    const objective = (await this.prisma.objective.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { targetWeightKg: true },
    })) as { targetWeightKg: number | null } | null;

    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
    const latest = measurements[measurements.length - 1] ?? null;
    const startWeightKg = profile.startWeightKg ?? measurements[0]?.weightKg ?? null;
    const currentWeightKg = latest?.weightKg ?? startWeightKg;
    const lostTotalKg = startWeightKg != null && currentWeightKg != null ? round1(startWeightKg - currentWeightKg) : null;

    const beforeWindow = [...measurements].reverse().find((m) => m.date <= monthAgo) ?? measurements[0] ?? null;
    const lostThisMonthKg = beforeWindow && latest ? round1(beforeWindow.weightKg - latest.weightKg) : null;

    const targetWeightKg = objective?.targetWeightKg ?? null;
    const toGoKg = targetWeightKg != null && currentWeightKg != null ? round1(currentWeightKg - targetWeightKg) : null;

    const [checkins, measurementsThisMonth, waterRows, stepRows, giorniMese] = await Promise.all([
      this.prisma.dailyCheckin.count({ where: { clientId, date: { gte: monthAgo } } }),
      this.prisma.measurement.count({ where: { clientId, date: { gte: monthAgo } } }),
      this.prisma.waterLog.findMany({ where: { clientId, date: { gte: monthAgo } }, orderBy: { date: 'asc' }, select: { glasses: true } }) as Promise<{ glasses: number }[]>,
      this.prisma.stepLog.findMany({ where: { clientId, date: { gte: monthAgo } }, orderBy: { date: 'asc' }, select: { steps: true } }) as Promise<{ steps: number }[]>,
      // I cambi concordati in chat nel mese. Si contano dai giorni erogati, dove sono registrati:
      // gli scambi di ingrediente in `substitutions` (solo quelli con `origine: 'chat'` — gli altri
      // sono sostituzioni di sicurezza decise dal motore, non scelte sue) e i piatti cambiati in
      // `cambioPiatto`.
      this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: monthAgo } },
        select: { meals: true },
      }) as Promise<{ meals: unknown }[]>,
    ]);
    let cambiInChat = 0;
    for (const g of giorniMese) {
      for (const pasto of ((g.meals as { substitutions?: { origine?: string }[]; cambioPiatto?: { origine?: string } }[]) ?? [])) {
        if (!pasto) continue;
        cambiInChat += (pasto.substitutions ?? []).filter((s) => s?.origine === 'chat').length;
        if (pasto.cambioPiatto?.origine === 'chat') cambiInChat += 1;
      }
    }
    // Abitudini: 1 bicchiere = 0,25 L; obiettivo acqua ~30 ml/kg sul peso attuale; passi 8.000.
    const waterSeries = waterRows.slice(-31).map((w) => round1(w.glasses * 0.25));
    const stepsSeries = stepRows.slice(-31).map((s) => s.steps);
    const waterAvgL = waterSeries.length ? round1(waterSeries.reduce((a, v) => a + v, 0) / waterSeries.length) : null;
    // ⚠️ Stessa regola della home e del report di fine piano (12/8): `water_ml_per_kg` dai
    // Parametri, con i limiti in bicchieri. Qui c'era un 30 scritto a mano.
    const mlPerKg = await this.configParams.getNumber('water_ml_per_kg', 33).catch(() => 33);
    const stepsGoal = await this.configParams.getNumber('steps_goal', 8000).catch(() => 8000);
    const waterGoalL = currentWeightKg != null ? litriObiettivo(currentWeightKg, mlPerKg) : null;
    const stepsAvg = stepsSeries.length ? Math.round(stepsSeries.reduce((a, v) => a + v, 0) / stepsSeries.length) : null;

    return {
      clientId,
      name: profile.name ?? profile.user.email,
      email: profile.user.email,
      locale: profile.user.locale,
      periodLabel: now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
      startWeightKg,
      currentWeightKg,
      lostTotalKg,
      lostThisMonthKg,
      targetWeightKg,
      toGoKg,
      checkins,
      measurements: measurementsThisMonth,
      waterAvgL,
      waterGoalL,
      waterSeries,
      stepsAvg,
      stepsGoal,
      stepsSeries,
      cambiInChat,
    };
  }

  /**
   * Mini-grafico a barre per il PDF (frammento HTML iniettato nel segnaposto):
   * una barra per giorno, linea tratteggiata = obiettivo, barre piene quando
   * l'obiettivo è raggiunto (come nel Diario in app).
   */
  private barsHtml(values: number[], goal: number | null, color: string): string {
    if (values.length < 2) return '';
    const H = 34;
    const max = Math.max(...values, goal ?? 0, 0.1);
    const bars = values
      .map((v) => {
        const h = Math.max(2, Math.round((v / max) * H));
        const on = goal != null && v >= goal;
        return `<i style="flex:1;max-width:9px;height:${h}px;border-radius:2px;background:${color};opacity:${on ? '1' : '.35'}"></i>`;
      })
      .join('');
    const goalLine = goal != null && goal > 0
      ? `<span style="position:absolute;left:0;right:0;top:${Math.max(0, Math.round(H - (goal / max) * H))}px;border-top:1.2px dashed #d9482f;opacity:.7"></span>`
      : '';
    return `<div style="position:relative;display:flex;align-items:flex-end;gap:2px;height:${H}px;margin:4px 0 2px">${goalLine}${bars}</div>`;
  }

  private trendText(r: MonthlyReport): string {
    if (r.lostThisMonthKg == null) return 'Continua a registrare le pesate per vedere i progressi.';
    if (r.lostThisMonthKg > 0) return `Ottimo lavoro: questo mese hai perso ${r.lostThisMonthKg} kg. Continua così!`;
    if (r.lostThisMonthKg === 0) return 'Peso stabile questo mese: teniamo il ritmo, va bene così.';
    return 'Piccola risalita questo mese: capita, ripartiamo insieme dal prossimo obiettivo.';
  }

  private buildPdf(r: MonthlyReport): Promise<Buffer> {
    const kg = (n: number | null) => (n == null ? '—' : `${n} kg`);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor('#10403a').fontSize(24).text('Metabole');
      doc.moveDown(0.2);
      doc.fillColor('#7c8c88').fontSize(12).text(`Report di ${r.periodLabel}`);
      doc.moveDown(1);
      doc.fillColor('#111').fontSize(14).text(r.name);
      doc.moveDown(0.8);

      doc.fontSize(11);
      const row = (label: string, value: string) => {
        doc.font('Helvetica-Bold').text(label, { continued: true }).font('Helvetica').text('   ' + value);
        doc.moveDown(0.5);
      };
      row('Perso questo mese:', kg(r.lostThisMonthKg));
      row('Perso dall\'inizio:', kg(r.lostTotalKg));
      row('Peso attuale:', kg(r.currentWeightKg));
      /**
       * ⚠️ IL NUMERO DI QUESTO REPORT È IL PESO **MISURATO**, E VA DETTO — decisione di Simone, 19/8.
       *
       * Dal 19/8 l'app, la home, la lista della coach e i traguardi rispondono alla domanda «quanto
       * manca» sulla **media mobile** (la tendenza), perché una giornata storta non deve far tornare
       * indietro una barra. Il Report no, ed è una scelta: è un documento firmato su un periodo, e
       * «il peso alla data del report» è un fatto verificabile — la tendenza è un'interpretazione, e
       * un documento che lei può portare dal medico deve dire il numero della bilancia.
       *
       * ⚠️ Ma allora si dice, qui dentro: senza questa riga restano due numeri diversi sulla stessa
       * persona e nessuno che spieghi perché — che è precisamente il difetto che il 19/8 è stato
       * speso a togliere da tutto il resto del prodotto.
       */
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(8.5).fillColor('#6b6a63')
        .text(
          'I numeri di questa pagina sono le misure registrate a quella data. Nell\'app la percentuale ' +
            'verso l\'obiettivo è calcolata sulla media degli ultimi giorni, per non farla oscillare ' +
            'con una singola pesata: per questo i due valori possono non coincidere.',
          { width: 483 },
        );
      doc.fillColor('#10403a').fontSize(11);
      doc.moveDown(0.3);
      row('Obiettivo:', kg(r.targetWeightKg));
      if (r.toGoKg != null) row('Ancora da perdere:', kg(r.toGoKg > 0 ? r.toGoKg : 0));
      row('Pesate nel mese:', String(r.measurements));
      row('Check-in nel mese:', String(r.checkins));
      if (r.waterAvgL != null) row('Acqua (media/giorno):', `${r.waterAvgL} L${r.waterGoalL != null ? ` · obiettivo ${r.waterGoalL} L` : ''}`);
      if (r.stepsAvg != null) row('Passi (media/giorno):', `${r.stepsAvg} · obiettivo ${r.stepsGoal}`);

      doc.moveDown(0.8);
      doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#e6e2d8').stroke();
      doc.moveDown(0.8);
      doc.font('Helvetica').fillColor('#10403a').fontSize(12).text(this.trendText(r));
      doc.end();
    });
  }

  /** PDF del report con la GRAFICA dell'editor (Grafica PDF -> "Report mensile"). */
  private async templatePdf(r: MonthlyReport): Promise<Buffer> {
    const kg = (n: number | null) => (n == null ? '—' : `${n} kg`);
    const it = (n: number) => n.toLocaleString('it-IT');
    return this.pdfTemplates.renderTemplatePdf('monthly_report', {
      name: r.name,
      period: r.periodLabel,
      lostThisMonth: kg(r.lostThisMonthKg),
      lostTotal: kg(r.lostTotalKg),
      currentWeight: kg(r.currentWeightKg),
      target: kg(r.targetWeightKg),
      checkins: String(r.checkins),
      measurements: String(r.measurements),
      trend: this.trendText(r),
      // Abitudini (Gaia consiglia): medie + mini-grafici a barre come in app.
      waterAvg: r.waterAvgL != null ? `${it(r.waterAvgL)} L` : '—',
      waterGoal: r.waterGoalL != null ? `${it(r.waterGoalL)} L` : '—',
      waterBars: this.barsHtml(r.waterSeries, r.waterGoalL, '#3a6ea5'),
      stepsAvg: r.stepsAvg != null ? it(r.stepsAvg) : '—',
      stepsGoal: it(r.stepsGoal),
      stepsBars: this.barsHtml(r.stepsSeries, r.stepsGoal, '#137a55'),
      // Il menu adattato a lei: è un dato di personalizzazione, non una statistica di servizio.
      // Zero è legittimo e si scrive come tale, senza far sembrare che sia mancato qualcosa.
      cambiInChat: it(r.cambiInChat),
      cambiInChatFrase:
        r.cambiInChat === 0
          ? 'Questo mese il menu è andato bene così: nessun cambio richiesto.'
          : r.cambiInChat === 1
            ? 'Questo mese il tuo menu è stato adattato a te una volta.'
            : `Questo mese il tuo menu è stato adattato a te ${it(r.cambiInChat)} volte.`,
    });
  }

  /** Invia il report mensile via email (con PDF allegato) — SOLO invio manuale dello staff. */
  async sendMonthlyReport(clientId: string): Promise<MonthlyReport> {
    const r = await this.buildMonthlyReport(clientId);
    // Grafica allineata al modello (editor "Grafica PDF"); il vecchio PDFkit resta
    // come ripiego se Chromium non fosse disponibile a runtime.
    const pdf = await this.templatePdf(r).catch(() => this.buildPdf(r).catch(() => null));
    await this.mail.sendMonthlyReport(
      r.email,
      {
        name: r.name,
        period: r.periodLabel,
        lostThisMonth: r.lostThisMonthKg == null ? '—' : `${r.lostThisMonthKg} kg`,
        lostTotal: r.lostTotalKg == null ? '—' : `${r.lostTotalKg} kg`,
        currentWeight: r.currentWeightKg == null ? '—' : `${r.currentWeightKg} kg`,
        target: r.targetWeightKg == null ? '—' : `${r.targetWeightKg} kg`,
        checkins: String(r.checkins),
        trend: this.trendText(r),
      },
      r.locale,
      pdf ? [{ name: `report-${r.periodLabel.replace(' ', '-')}.pdf`, content: pdf.toString('base64') }] : undefined,
    );
    return r;
  }

  /** Cron: invia il report a tutte le clienti attive con almeno una pesata. */
  async sendMonthlyBatch(): Promise<{ sent: number }> {
    const clients = (await this.prisma.user.findMany({
      where: { role: 'client', status: 'active', deletedAt: null, measurements: { some: {} } },
      select: { id: true },
    })) as { id: string }[];
    let sent = 0;
    for (const c of clients) {
      try {
        await this.sendMonthlyReport(c.id);
        sent++;
      } catch {
        /* un errore su una cliente non blocca le altre */
      }
    }
    return { sent };
  }
}
