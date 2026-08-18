import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DatedValue,
  movingAverage,
  progressPercent,
  projectTargetDate,
  slopePerDay,
  stallDays,
  weeklyLossRate,
} from './stats';
import { MIN_GIORNI_DEFAULT, MIN_PESATE_DEFAULT, spiegaAllarmeSpento, statoAllarmeCalo } from './allarme-calo';

/**
 * Quante misure si leggono per calcolare la tendenza. Non è «tutte»: la media mobile, la pendenza
 * recente e i giorni di stallo guardano l'ultimo tratto, e il grafico ne mostra trenta.
 */
const FINESTRA_MISURE = 120;

/**
 * GET /me/progress: % verso l'obiettivo, tendenze su media mobile,
 * proiezione della data, giorni di stallo, flag calo rapido.
 * Ragiona SEMPRE sulla tendenza (media mobile), mai sul singolo dato (spec 7.2).
 *
 * ## Il difetto che c'era qui (trovato l'11/8 cercando i troncamenti silenziosi)
 *
 * Le misure si leggevano con `orderBy: { date: 'asc' }, take: 120`: cioè le 120 **più vecchie**. Le
 * misure sono una al giorno (`upsert` su `clientId_date`), quindi dopo circa quattro mesi di pesate
 * costanti la finestra si riempiva di passato e da lì in poi **questa schermata si congelava**:
 *  - «misure registrate» fermo a 120 per sempre;
 *  - `current.weightKg` = il peso di mesi prima, presentato come peso di oggi;
 *  - `lostKg`, la proiezione della data obiettivo e la pendenza settimanale, tutti sul tratto
 *    sbagliato del percorso;
 *  - `stallDays` calcolato su una data ferma, quindi **`stalled: true` falso** — e quell'alert va
 *    alla coach.
 *
 * Non peggiorava col volume del database: peggiorava con la **costanza della cliente**. A leggere
 * questa funzione sono l'alert di stallo della coach (`signals.service`) e il motore
 * (`engine/signals-collector`), quindi il dato vecchio arrivava a tutti e due.
 *
 * ⚠️ **Qui c'era scritto anche «l'app della cliente», e non è vero**: `GET /me/progress` non lo
 * chiama nessuna schermata (verificato il 18/8 sera, `progetto/DECISIONE_Due_Schermate_App.md`).
 * L'app la percentuale se la calcola da sola in `Obiettivo.tsx`, sull'**ultima misura** invece che
 * sulla media mobile — cioè risponde alla stessa domanda in un altro modo. Il commento sbagliato è
 * il motivo per cui la cosa è rimasta invisibile: chi passava di qui leggeva che l'app c'era già.
 *
 * Ora si leggono le 120 **più recenti** (`desc`) e si rimettono in ordine cronologico in memoria,
 * perché tutto il resto — media mobile, pendenza, stallo — presuppone l'ordine dal più vecchio al più
 * nuovo. Con due accorgimenti che il troncamento rende necessari:
 *  - **il conteggio** arriva da un `count()` sul database: la lunghezza dell'array è, per
 *    definizione, al massimo 120, e mostrarla come «misure registrate» era la parte visibile del
 *    difetto;
 *  - **il peso di partenza**, quando il profilo non lo ha, arriva dalla prima misura *in assoluto* e
 *    non dalla prima della finestra: con `asc` erano la stessa cosa, con `desc` no — e la prima della
 *    finestra sarebbe il peso di quattro mesi fa, cioè chili persi inventati.
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async getProgress(clientId: string) {
    const [profile, objective, recenti, misureTotali, primaMisura] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        // `rapidLossBaselineAt`: se il nutrizionista ha autorizzato a proseguire, l'**allarme**
        // calo rapido si calcola solo sulle pesate successive. Tutto il resto di questa funzione —
        // media mobile, chili persi, proiezione, serie del grafico — continua a leggere l'intera
        // storia, ed è la parte che non va toccata: azzerare i progressi di chi sta perdendo peso
        // troppo in fretta significherebbe cancellarle dallo schermo l'unica cosa che dà senso al
        // percorso, per una decisione clinica che non la riguarda.
        select: { startWeightKg: true, startWaistCm: true, startHipsCm: true, rapidLossBaselineAt: true },
      }),
      this.prisma.objective.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      }),
      // `desc`: le PIÙ RECENTI. Si rimettono in ordine cronologico due righe più sotto.
      this.prisma.measurement.findMany({
        where: { clientId },
        orderBy: { date: 'desc' },
        take: FINESTRA_MISURE,
      }),
      this.prisma.measurement.count({ where: { clientId } }),
      // Il peso della prima misura in assoluto: serve solo come ripiego se il profilo non ha il peso
      // di partenza, e non può venire dalla finestra (vedi il commento in testa alla classe).
      this.prisma.measurement.findFirst({
        where: { clientId },
        orderBy: { date: 'asc' },
        select: { weightKg: true },
      }),
    ]);
    /** Dalla più vecchia alla più recente: è l'ordine che media mobile, pendenza e stallo aspettano. */
    const measurements = [...recenti].reverse();
    if (!profile) throw new NotFoundException('Profilo non trovato: completa il questionario.');

    const [window, stallThreshold, rapidThreshold, minGiorniRiarmo, minPesateRiarmo] = await Promise.all([
      this.configParams.getNumber('moving_average_window', 3),
      this.configParams.getNumber('stall_days_before_coach_alert', 6),
      this.configParams.getNumber('max_weight_change_alert_kg_week', 1.5),
      // Il pavimento del ri-armo dopo «Autorizza a proseguire»: numeri clinici, quindi dai
      // Parametri e non costanti nel codice. Vedi `allarme-calo.ts`.
      this.configParams.getNumber('rapid_loss_resume_min_days', MIN_GIORNI_DEFAULT),
      this.configParams.getNumber('rapid_loss_resume_min_measures', MIN_PESATE_DEFAULT),
    ]);

    if (measurements.length === 0) {
      return {
        measurementsCount: 0,
        message: 'Ancora nessuna misura: inserisci la prima per vedere i progressi.',
        objective,
      };
    }

    type M = { date: Date; weightKg: number; waistCm: number | null; hipsCm: number | null };
    const weights = measurements.map((m: M) => m.weightKg);
    const ma = movingAverage(weights, window);
    const maSeries: DatedValue[] = measurements.map((m: M, i: number) => ({
      date: m.date,
      value: Math.round(ma[i] * 100) / 100,
    }));

    const currentMA = maSeries[maSeries.length - 1].value;
    const latest = measurements[measurements.length - 1] as M;
    const today = new Date();

    // Pendenza sul tratto recente della media mobile (ultime ~4 finestre).
    const recentSpan = Math.max(window * 4, 6);
    const recentMA = maSeries.slice(-recentSpan);
    const rate = slopePerDay(recentMA);
    const weeklyRate = weeklyLossRate(rate);

    /**
     * IL RITMO PER L'ALLARME, che è un'altra cosa dal ritmo dei progressi.
     *
     * Se il nutrizionista ha autorizzato a proseguire, l'allarme guarda **solo le pesate
     * successive** e resta spento finché non ce ne sono abbastanza (4 giorni e 3 pesate, dai
     * Parametri): senza quel pavimento due pesate ravvicinate ricostruiscono una pendenza
     * ripidissima e l'allarme risuona il giorno dopo l'ok.
     */
    const allarme = statoAllarmeCalo(
      maSeries,
      (profile as { rapidLossBaselineAt?: Date | null }).rapidLossBaselineAt ?? null,
      today,
      minGiorniRiarmo,
      minPesateRiarmo,
    );
    const rapidLossArmato = allarme.armato;
    const rateAllarme = rapidLossArmato
      ? weeklyLossRate(slopePerDay(allarme.pesate.slice(-recentSpan)))
      : null;

    const target = objective?.targetWeightKg ?? null;
    const start = profile.startWeightKg ?? primaMisura?.weightKg ?? weights[0];

    const projection =
      target !== null ? projectTargetDate(currentMA, target, rate, today) : null;
    const stall = stallDays(maSeries, today);

    return {
      // Il conteggio VERO, non la lunghezza della finestra: quella si ferma a 120 per costruzione.
      measurementsCount: misureTotali,
      current: {
        date: latest.date,
        weightKg: latest.weightKg,
        weightKgMovingAvg: currentMA,
        waistCm: latest.waistCm,
        hipsCm: latest.hipsCm,
      },
      start: { weightKg: start, waistCm: profile.startWaistCm, hipsCm: profile.startHipsCm },
      objective,
      progress: {
        weightPercent: target !== null ? progressPercent(start, currentMA, target) : null,
        lostKg: Math.round((start - currentMA) * 10) / 10,
        remainingKg: target !== null ? Math.round((currentMA - target) * 10) / 10 : null,
      },
      trend: {
        weeklyRateKg: weeklyRate, // positivo = calo
        direction:
          weeklyRate === null ? 'unknown' : weeklyRate > 0.05 ? 'down' : weeklyRate < -0.05 ? 'up' : 'flat',
        projectedTargetDate: projection,
        movingAverageWindow: window,
      },
      alerts: {
        stallDays: stall,
        stalled: stall >= stallThreshold,
        /**
         * L'ALLARME si calcola sul tratto **dopo l'autorizzazione**, il resto no.
         *
         * `weeklyRateKg` qui sopra, `lostKg`, la proiezione e la serie del grafico continuano a
         * leggere tutta la storia: sono i progressi della cliente e non c'entrano niente con una
         * decisione clinica presa su di lei. Quello che «Autorizza a proseguire» sposta è **solo
         * questo booleano**, che è ciò che fa suonare il guardrail e riempie la coda.
         *
         * Senza questa riga il campo `rapidLossBaselineAt` sarebbe stato scritto e mai usato: il
         * nutrizionista avrebbe premuto un pulsante e la stessa riga sarebbe tornata in coda la
         * notte dopo. È il difetto che una suite verde non trova, perché la regola può essere
         * giusta e collegata a niente.
         */
        rapidLoss: rapidLossArmato && rateAllarme !== null && rateAllarme > rapidThreshold,
        /** Perché non sta suonando, quando è in pausa: «non suona» e «va tutto bene» si somigliano troppo. */
        rapidLossInPausa: spiegaAllarmeSpento(allarme),
      },
      series: maSeries.slice(-30), // per il grafico (media mobile)
    };
  }
}
