import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { calcolaTargetKcal, spiegaTargetKcal, correzioneAttiva } from './correzione-kcal';

/**
 * Fabbisogno calorico giornaliero della cliente (kcal/giorno), stimato dal profilo.
 *
 * Metodo: BMR con Mifflin-St Jeor (sesso, età, altezza, peso attuale) × fattore di attività,
 * poi — solo per l'obiettivo "dimagrimento" — si applica un deficit derivato dal RITMO di calo
 * dell'obiettivo (kg/settimana ≈ 7700 kcal/kg), con tetto massimo e SOGLIA MINIMA di sicurezza
 * (non si scende mai sotto una certa soglia in kcal). In "mantenimento" il target è il fabbisogno.
 *
 * Le costanti di sicurezza (soglie, tetti) sono configurabili via config_param. I fattori di
 * attività sono costanti standard (indicati sotto) e all'occorrenza spostabili in config.
 *
 * ⚠️ **Il tratto finale non sta più qui.** Dal §15.5 (11/8) il nutrizionista può scrivere a mano il
 * deficit e una correzione percentuale sul totale, e l'ordine in cui queste entrano — e quali soglie
 * valgono ancora quando ci sono — è una regola clinica che vive in `correzione-kcal.ts`, provata per
 * tabella. Qui si raccolgono i dati (fabbisogno, deficit dedotto, soglie, valori scritti a mano) e
 * si passano di là. Questo servizio parla al database; quel modulo decide.
 */

// Fattori di attività (PAL) per la domanda dedicata sull'attività fisica.
const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2, // poco/nessun movimento
  light: 1.375, // attività leggera 1-3 gg/sett
  moderate: 1.55, // moderata 3-5 gg/sett
  active: 1.725, // intensa 6-7 gg/sett
  very_active: 1.9, // molto intensa / lavoro fisico + sport
};
// Fallback dal campo "lavoro" (lifestyle.work) quando l'attività dedicata non è impostata.
const WORK_FACTOR: Record<string, number> = {
  sedentary: 1.3,
  standing: 1.5,
  shifts: 1.5,
  travel: 1.55,
};
const DEFAULT_FACTOR = 1.4;

export interface KcalEstimate {
  bmr: number;
  activityFactor: number;
  activitySource: 'activity' | 'work' | 'default';
  tdee: number; // fabbisogno di mantenimento
  target: number; // kcal/giorno consigliate (dopo deficit, correzioni e soglie)
  deficit: number; // kcal sottratte (0 in mantenimento)
  floored: boolean; // true se ha agito la soglia minima di sicurezza
  objective: string;
  weightKg: number;
  // --- §15.5: cosa ha scritto il nutrizionista, e cosa ne è uscito ---
  /** Da dove viene il deficit: scritto a mano, dedotto dal motore, o nessuno. */
  fonteDeficit: 'imposto' | 'calcolato' | 'nessuno';
  /** Il deficit che il motore avrebbe usato da solo: serve a mostrare il «prima» accanto al «dopo». */
  deficitCalcolato: number;
  /** La correzione percentuale sul totale, 0 se non impostata. */
  correzionePct: number;
  /** Il target sta SOTTO la soglia minima, per scelta esplicita del nutrizionista. */
  sottoSoglia: boolean;
  /** Il tetto ha tagliato il deficit dedotto (succede solo su quello dedotto). */
  tettoApplicato: boolean;
  /** Fino a quando vale la correzione (`null` = finché non la tolgono). */
  correzioneFinoAl: string | null;
  /** La correzione è scritta ma SCADUTA: il target è già tornato normale, e va detto. */
  correzioneScaduta: boolean;
  /** La frase che spiega il numero, già pronta per la scheda e per lo storico. */
  spiegazione: string;
}

@Injectable()
export class KcalNeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Solo il target in kcal/giorno (o null se mancano i dati minimi). Usato dal generatore menu. */
  async computeTargetKcal(clientId: string): Promise<number | null> {
    const est = await this.estimate(clientId);
    return est ? est.target : null;
  }

  /**
   * Stima completa (per backoffice/diagnostica). Null se mancano sesso/età/altezza/peso.
   *
   * `simulazione` serve al backoffice PRIMA di salvare: «se scrivo 450 di deficit, che numero le
   * arriva nel piatto?». Senza, l'unico modo di saperlo sarebbe salvare e guardare — cioè scoprire
   * di aver messo una cliente a 980 kcal dopo averla messa a 980 kcal.
   */
  async estimate(
    clientId: string,
    simulazione?: { deficitImposto?: number | null; correzionePct?: number | null },
  ): Promise<KcalEstimate | null> {
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId: clientId } });
    if (!profile) return null;
    const sex = profile.sex as 'female' | 'male' | null;
    const age = profile.age ?? null;
    const heightCm = profile.heightCm ?? null;
    if (!sex || !age || !heightCm) return null;

    // Peso attuale = ultima misura, altrimenti peso iniziale del profilo.
    const lastMeasure = await this.prisma.measurement.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { weightKg: true },
    });
    const weightKg = lastMeasure?.weightKg ?? profile.startWeightKg ?? null;
    if (!weightKg) return null;

    // Costanti di sicurezza (configurabili).
    const [floorF, floorM, deficitMaxPct, deficitMaxKcal, kcalPerKg, defaultDeficitPct] = await Promise.all([
      this.configParams.getNumber('kcal_need_floor_female', 1200),
      this.configParams.getNumber('kcal_need_floor_male', 1500),
      this.configParams.getNumber('kcal_need_deficit_max_pct', 0.3),
      this.configParams.getNumber('kcal_need_deficit_max_kcal', 1000),
      this.configParams.getNumber('kcal_need_kcal_per_kg', 7700),
      this.configParams.getNumber('kcal_need_default_deficit_pct', 0.15),
    ]);

    // BMR — Mifflin-St Jeor.
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);

    // Fattore di attività: prima l'attività dedicata, poi il lavoro, poi default.
    let activityFactor = DEFAULT_FACTOR;
    let activitySource: KcalEstimate['activitySource'] = 'default';
    const activityLevel = (profile as { activityLevel?: string | null }).activityLevel ?? null;
    const work = (profile.lifestyle as { work?: string } | null)?.work ?? null;
    if (activityLevel && ACTIVITY_FACTOR[activityLevel]) {
      activityFactor = ACTIVITY_FACTOR[activityLevel];
      activitySource = 'activity';
    } else if (work && WORK_FACTOR[work]) {
      activityFactor = WORK_FACTOR[work];
      activitySource = 'work';
    }

    const tdee = bmr * activityFactor;
    const objective = profile.objective ?? 'dimagrimento';

    // Deficit dedotto, SENZA tetti: i tetti li mette `calcolaTargetKcal`, perché è lì che si sa se
    // il deficit è dedotto o prescritto — e su quello prescritto non vanno messi.
    let deficitCalcolato = 0;
    if (objective !== 'mantenimento') {
      const rateDeficit = await this.deficitFromObjectiveRate(clientId, weightKg, kcalPerKg);
      // Se non ho un ritmo valido dall'obiettivo, uso un deficit di default (percentuale del TDEE).
      deficitCalcolato = Math.max(0, rateDeficit != null ? rateDeficit : tdee * defaultDeficitPct);
    }

    const p = profile as {
      kcalDeficitOverride?: number | null;
      kcalAdjustPct?: number | null;
      kcalAdjustUntil?: Date | null;
    };
    /**
     * ⚠️ LA CORREZIONE SCADE (14/8, risposta di Nocanty: «del 10% per 7 giorni e poi riprendi col
     * normale ritmo»). La scadenza si guarda QUI, al momento del calcolo: nessun cron azzera il
     * campo, e il valore resta scritto — spento — per chi apre la scheda dopo.
     * ⚠️ La simulazione del backoffice non passa da qui: sta chiedendo «se scrivessi questo», e
     * quello che scriverebbe parte oggi.
     */
    const correzioneDelProfilo = correzioneAttiva(p.kcalAdjustPct ?? null, p.kcalAdjustUntil ?? null);
    const esito = calcolaTargetKcal({
      tdee,
      deficitCalcolato,
      deficitImposto: simulazione ? simulazione.deficitImposto ?? null : p.kcalDeficitOverride ?? null,
      correzionePct: simulazione ? simulazione.correzionePct ?? null : correzioneDelProfilo,
      soglia: sex === 'male' ? floorM : floorF,
      tettoDeficitPct: deficitMaxPct,
      tettoDeficitKcal: deficitMaxKcal,
    });

    return {
      bmr: Math.round(bmr),
      activityFactor,
      activitySource,
      tdee: Math.round(tdee),
      target: esito.target,
      deficit: esito.deficit,
      floored: esito.sogliaApplicata,
      objective,
      weightKg,
      fonteDeficit: esito.fonteDeficit,
      deficitCalcolato: Math.round(deficitCalcolato),
      correzionePct: esito.correzionePct,
      sottoSoglia: esito.sottoSoglia,
      tettoApplicato: esito.tettoApplicato,
      correzioneFinoAl: p.kcalAdjustUntil ? p.kcalAdjustUntil.toISOString().slice(0, 10) : null,
      // Scritta ma non più attiva: il numero è già tornato normale da solo, e chi guarda la scheda
      // deve poterlo capire senza rifare i conti a mente.
      correzioneScaduta: !!p.kcalAdjustPct && !!p.kcalAdjustUntil && correzioneDelProfilo === 0,
      spiegazione: spiegaTargetKcal(esito, tdee, {
        finoAl: p.kcalAdjustUntil ?? null,
        scaduta: !!p.kcalAdjustPct && !!p.kcalAdjustUntil && correzioneDelProfilo === 0,
        pctScritta: p.kcalAdjustPct ?? null,
      }),
    };
  }

  /**
   * Deficit giornaliero (kcal) dal ritmo di calo dell'obiettivo: (kg da perdere / settimane
   * rimaste) × 7700 / 7. Ritorna null se non c'è un obiettivo con peso target e data futura.
   */
  private async deficitFromObjectiveRate(clientId: string, weightKg: number, kcalPerKg: number): Promise<number | null> {
    const obj = await this.prisma.objective.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { targetWeightKg: true, targetDate: true },
    });
    if (!obj?.targetWeightKg || !obj.targetDate) return null;
    const kgToLose = weightKg - obj.targetWeightKg;
    if (kgToLose <= 0) return null; // già a target o sotto: nessun deficit
    const msLeft = obj.targetDate.getTime() - Date.now();
    const weeksLeft = msLeft / (7 * 86_400_000);
    if (weeksLeft < 1) return null; // scadenza passata/troppo vicina: non forzo un deficit dal ritmo
    const ratePerWeek = kgToLose / weeksLeft; // kg/settimana
    return (ratePerWeek * kcalPerKg) / 7; // kcal/giorno
  }
}
