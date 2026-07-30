import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

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
  target: number; // kcal/giorno consigliate (dopo eventuale deficit + soglie)
  deficit: number; // kcal sottratte (0 in mantenimento)
  floored: boolean; // true se ha agito la soglia minima di sicurezza
  objective: string;
  weightKg: number;
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

  /** Stima completa (per backoffice/diagnostica). Null se mancano sesso/età/altezza/peso. */
  async estimate(clientId: string): Promise<KcalEstimate | null> {
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

    // Deficit solo in dimagrimento.
    let deficit = 0;
    if (objective !== 'mantenimento') {
      const rateDeficit = await this.deficitFromObjectiveRate(clientId, weightKg, kcalPerKg);
      // Se non ho un ritmo valido dall'obiettivo, uso un deficit di default (percentuale del TDEE).
      deficit = rateDeficit != null ? rateDeficit : tdee * defaultDeficitPct;
      // Tetto: non oltre X% del TDEE, e non oltre un tetto assoluto in kcal.
      deficit = Math.min(deficit, tdee * deficitMaxPct, deficitMaxKcal);
      deficit = Math.max(0, deficit);
    }

    let target = tdee - deficit;
    // Soglia minima di sicurezza per sesso.
    const floor = sex === 'male' ? floorM : floorF;
    let floored = false;
    if (target < floor) {
      target = floor;
      floored = true;
    }

    return {
      bmr: Math.round(bmr),
      activityFactor,
      activitySource,
      tdee: Math.round(tdee),
      target: Math.round(target / 10) * 10, // arrotondato a 10 kcal
      deficit: Math.round(deficit),
      floored,
      objective,
      weightKg,
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
