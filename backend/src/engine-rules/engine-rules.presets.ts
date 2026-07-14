/**
 * Regole BASE suggerite per tipo di nutrizione, fondate sulla letteratura
 * (LARN/EFSA/AMDR, StatPearls, ISSN, NHLBI, ADA…). Seminate in `rule_preset` con
 * `suggested=true`: il capo nutrizionista le vede col flag "suggerita", può
 * modificarle, aggiungerne e applicarle a una dieta. `rules` mappa i codici del
 * catalogo motore (frazioni proteiche 0–1, tolleranze in %, pesi selezione).
 *
 * Le soglie in grammi assoluti (carboidrati, fibre, sodio) e per-pasto NON sono
 * ancora parametri del motore: restano in `clinicalNotes` come regole da
 * implementare (richiedono nuovi parametri: carbs_max_g, fat_min, g/kg, IG…).
 */
export interface PresetSeed {
  style: string;
  label: string;
  description: string;
  regime?: string | null;
  objective?: string | null;
  rules: Record<string, number | boolean>;
  clinicalNotes?: string;
  source?: string;
  sortOrder: number;
}

const R = (protMin: number, protMax: number, kcalTol: number, penalty: number, wEff: number, wGrad: number, twoDays: boolean) => ({
  menu_daycombo_protein_min: protMin,
  menu_daycombo_protein_max: protMax,
  menu_kcal_balance_tolerance_pct: kcalTol,
  menu_penalty_repeat: penalty,
  menu_select_w_eff: wEff,
  menu_select_w_grad: wGrad,
  menu_repeat_two_days_default: twoDays,
});

export const SUGGESTED_PRESETS: PresetSeed[] = [
  // ---- 5 stili esistenti ----
  {
    style: 'mediterranean', label: 'Mediterranea', sortOrder: 10,
    description: 'Bilanciata, cardio-protettiva: carbo 45–55%, proteine 15–20%, grassi 30–40% (olio d’oliva). Aderenza a lungo termine.',
    rules: R(0.15, 0.22, 13, 1.5, 0.8, 1.2, false),
    clinicalNotes: 'SFA < 10% kcal; pesce ≥ 2/sett, legumi ≥ 2–3/sett, carne rossa limitata; fibra ≥ 25 g/die. (Richiedono: cap SFA, frequenze settimanali, fibre_g.)',
    source: 'SINU LARN 2014; PREDIMED (NEJM 2013/2018).',
  },
  {
    style: 'protein', label: 'Proteica', sortOrder: 20,
    description: 'Alta in proteine (25–35% kcal; 1.6–2.0 g/kg) per massa magra/ricomposizione. Carbo 35–45%, grassi 25–30%.',
    rules: R(0.25, 0.40, 11, 0.5, 1.2, 0.9, true),
    clinicalNotes: '≥ 1.6 g proteine/kg peso; 20–40 g proteine/pasto su 3–4 pasti. (Richiedono: target g/kg e dose per-pasto; oggi solo % kcal.)',
    source: 'ISSN Position Stand: Protein and Exercise (2017); Morton et al. (BJSM 2018).',
  },
  {
    style: 'low_carb', label: 'Low carb', sortOrder: 30,
    description: 'Carboidrati ridotti (< 26% kcal o < 130 g/die), proteine 25–35%, grassi 35–50%. Spesso per dimagrimento.',
    rules: R(0.25, 0.35, 13, 1, 1, 1, false),
    clinicalNotes: 'Carboidrati < 130 g/die a basso indice glicemico, ricchi di fibra; grassi insaturi. (Richiedono: carbs_max_g, indice glicemico, cap SFA.)',
    source: 'StatPearls, Low-Carbohydrate Diet (2023); ADA Nutrition Consensus (2019).',
  },
  {
    style: 'flexible', label: 'Flessibile', sortOrder: 40,
    description: 'Bilanciata e permissiva (IIFYM-like): carbo 40–55%, proteine 18–25%, grassi 25–35%. Massima varietà e aderenza.',
    rules: R(0.18, 0.30, 18, 1.5, 0.8, 1.2, false),
    clinicalNotes: 'Nessun alimento vietato ma ≥ 80% da alimenti a densità nutrizionale alta; unico vincolo forte = kcal. (Richiede: quota whole-foods.)',
    source: 'IOM/NASEM AMDR (2005); EFSA DRV (2010–2012).',
  },
  {
    style: 'keto', label: 'Keto (non terapeutica)', sortOrder: 50,
    description: 'Chetogenica: carbo 5–10% (20–50 g/die), proteine 15–25%, grassi 65–80%. Uso a tempo, non in gravidanza.',
    rules: R(0.15, 0.25, 12, 0.5, 1.1, 1, true),
    clinicalNotes: 'Carboidrati < 50 g/die (20–30 g netti) INDISPENSABILE; grassi ≥ 65–70%; proteine non oltre 1.7–2.0 g/kg. (Richiedono: carbs_max_g essenziale, fat_min.)',
    source: 'StatPearls, Ketogenic Diet (2023); Harvard T.H. Chan, Diet Review.',
  },

  // ---- Nuovi tipi compatibili (suggeriti) ----
  {
    style: 'dash', label: 'DASH (anti-ipertensiva)', sortOrder: 60, regime: 'omnivore',
    description: 'Per pressione medio-alta/prevenzione cardiovascolare: ~55% carbo, 18% proteine, 27% grassi, SFA ~6%.',
    rules: R(0.15, 0.20, 13, 1.5, 0.9, 1.1, false),
    clinicalNotes: 'Sodio ≤ 2300 mg/die (o 1500); ricca di frutta/verdura/latticini magri/integrali. (Richiedono: cap sodio, porzioni min frutta/verdura.)',
    source: 'NHLBI, DASH Eating Plan.',
  },
  {
    style: 'mediterranean', label: 'Mediterranea ipocalorica', sortOrder: 61, objective: 'dimagrimento',
    description: 'Profilo mediterraneo + deficit kcal 15–25%, per dimagrimento cardio-protettivo.',
    rules: R(0.15, 0.22, 11, 1.5, 1.0, 1.1, false),
    clinicalNotes: 'Deficit gestito dal livello kcal + tolleranza stretta; mantiene qualità lipidica mediterranea.',
    source: 'PREDIMED-Plus (Diabetes Care 2019).',
  },
  {
    style: 'protein', label: 'Iperproteica sportiva / ricomposizione', sortOrder: 62, regime: 'omnivore',
    description: 'Sportivi/ricomposizione (sani, attivi): proteine 1.6–2.2 g/kg, carbo periodizzati, grassi 20–30%.',
    rules: R(0.28, 0.40, 11, 0.5, 1.2, 0.9, true),
    clinicalNotes: 'Proteine 1.6–2.2 g/kg e distribuzione per-pasto. (Richiedono: target g/kg e dose per-pasto.)',
    source: 'ISSN Position Stand: Protein and Exercise (2017).',
  },
  {
    style: 'flexible', label: 'Vegetariana (latto-ovo)', sortOrder: 70, regime: 'vegetarian',
    description: 'Esclude carne e pesce; proteine da legumi/latticini/uova. Attenzione a ferro, B12, zinco.',
    rules: R(0.16, 0.25, 15, 1.5, 0.9, 1.1, false),
    clinicalNotes: 'Presidiare adeguatezza proteica con fonti vegetali. (Richiede: soglia proteica minima dedicata.)',
    source: 'Academy of Nutrition and Dietetics, Position: Vegetarian Diets (2016).',
  },
  {
    style: 'flexible', label: 'Vegana', sortOrder: 71, regime: 'vegan',
    description: '100% vegetale; densità proteica dei pasti da presidiare. B12 da integrare (avviso, non pasto).',
    rules: R(0.17, 0.25, 15, 1.5, 0.9, 1.1, false),
    clinicalNotes: 'Integrazione B12 raccomandata; alzare la quota proteica minima per la minore qualità proteica. (Richiede: flag avviso B12.)',
    source: 'Academy of Nutrition and Dietetics (2016); EFSA DRV B12.',
  },
  {
    style: 'mediterranean', label: 'Pescetariana', sortOrder: 72, regime: 'pescetarian',
    description: 'Esclude carne ma include pesce (buon profilo omega-3); impianto mediterraneo.',
    rules: R(0.15, 0.22, 13, 1.5, 0.9, 1.1, false),
    clinicalNotes: 'Pesce ≥ 2–3 volte/settimana. (Richiedono: regime pescetariano, frequenza pesce.)',
    source: 'EPIC-Oxford (Am J Clin Nutr 2016).',
  },
  {
    style: 'flexible', label: 'Flexitariana', sortOrder: 73, regime: 'omnivore',
    description: 'Prevalentemente vegetale con carne/pesce occasionali; enfasi sui legumi.',
    rules: R(0.16, 0.26, 16, 1.5, 0.85, 1.15, false),
    clinicalNotes: 'Carne rossa ≤ 1–2 volte/settimana. (Richiede: frequenza massima settimanale per categoria.)',
    source: 'EAT-Lancet Commission (Lancet 2019).',
  },
  {
    style: 'low_carb', label: 'Basso indice glicemico', sortOrder: 74,
    description: 'Per stabilità glicemica (non diabete in terapia): carbo 40–50% a basso IG, fibra alta, zuccheri < 10%.',
    rules: R(0.18, 0.28, 13, 1.5, 1.0, 1.0, false),
    clinicalNotes: 'Carboidrati a basso indice/carico glicemico, fibra elevata. (Richiedono: IG/carico glicemico per ricetta, fibre_min_g.)',
    source: 'ADA Standards of Care – Nutrition (Diabetes Care 2024).',
  },
  {
    style: 'flexible', label: 'Digiuno intermittente (16:8)', sortOrder: 75,
    description: 'Finestra alimentare di 8 ore, macro libere, spesso lieve deficit. Incide sulla distribuzione dei pasti.',
    rules: R(0.18, 0.30, 15, 1.5, 1.0, 1.0, false),
    clinicalNotes: 'Concentrare 2–3 pasti in 8 ore. (Richiede: finestra oraria di erogazione pasti; oggi solo mealsPerDay ridotto.)',
    source: 'Meta-analisi TRE 16:8 (Eur J Clin Nutr 2023).',
  },
];
