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
  /** Struttura pasti della variante: '3' | '5' | 'fasting' (16:8). Assente = '5' (storico). */
  meals?: '3' | '5' | 'fasting';
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

/**
 * KETO-MEDITERRANEA — famiglia completa, agganciata al generatore esistente.
 *
 * Nasce dal feedback clienti del 5/8 ("i menu della Keto hanno ingredienti molto complessi"),
 * chiarito da Simone: il problema non è il tempo di preparazione ma la REPERIBILITÀ —
 * farine speciali, dolcificanti particolari, prodotti "keto" confezionati che al supermercato
 * sotto casa non ci sono. La risposta non è rattoppare la Keto (regola ferrea n.1: i cataloghi
 * non si mischiano mai) ma un PRODOTTO NUOVO: chetogenica con la dispensa mediterranea.
 *
 * Sta qui, e non in uno script a parte, perché il catalogo lo deve produrre il generatore che
 * il capo nutrizionista già usa (Creazione e validazione): stessa strada, stesse bozze, stessa
 * validazione. `clinicalNotes` finisce dentro il prompt del generatore: è lì che vive il
 * vincolo "solo ingredienti da supermercato italiano", ed è per questo che è così dettagliata.
 *
 * VEGANA esclusa di proposito: senza legumi (fuori per definizione in chetosi) e senza i
 * derivati della soia da negozio specializzato, una keto vegana con soli ingredienti comuni
 * non regge né sul fronte proteico né su quello della reperibilità. Se servirà, la valuta la
 * nutrizionista come prodotto a sé.
 */
const KM_BASE = R(0.15, 0.25, 12, 0.5, 1.1, 1, true);

const KM_NOTE_COMUNE =
  'CHETOSI: carboidrati < 50 g/die (20–30 g netti) — vincolo non negoziabile; grassi 65–75% delle kcal, proteine moderate (non oltre 1.7–2.0 g/kg). ' +
  'GRASSI DI QUALITÀ (è il senso del prodotto): olio extravergine d\'oliva come grasso di riferimento, poi pesce azzurro, frutta secca al naturale, olive, avocado. Burro, panna e insaccati solo occasionali. ' +
  'SOLO INGREDIENTI DA SUPERMERCATO ITALIANO COMUNE. Ammessi: verdure a basso contenuto di carboidrati (zucchine, melanzane, peperoni, spinaci, bietole, cicoria, catalogna, broccoli, cavolfiore, verza, cavolo nero, finocchi, sedano, asparagi, carciofi, funghi, insalate, ravanelli; pomodori e cetrioli con misura); pesce (sgombro, alici, sardine, tonno, salmone, orata, branzino, merluzzo, platessa, seppie, calamari, gamberi, cozze, vongole); uova; pollo, tacchino, manzo, maiale, coniglio; latticini (mozzarella, stracchino, ricotta, parmigiano, grana, pecorino, provola, yogurt greco intero al naturale, mascarpone); frutta secca e semi; olive; avocado; aromi freschi e secchi, limone, aceto, capperi, acciughe sotto sale, peperoncino. Frutti di bosco in porzioni piccole. ' +
  'VIETATI PERCHÉ NON REPERIBILI (è il motivo per cui questo prodotto esiste): farine speciali (mandorle, cocco, lupino, psillio), dolcificanti particolari (eritritolo, allulosio, monk fruit), prodotti "keto" confezionati (pane, biscotti, barrette, pasta di konjac), olio MCT, proteine in polvere, gomma xantana e addensanti, sciroppi senza zucchero. ' +
  'FUORI PER DEFINIZIONE: pane, pasta, riso, patate, legumi, cereali, frutta zuccherina, dolci, bibite. ' +
  'RICETTE SEMPLICI: pochi ingredienti, preparazioni brevi, niente attrezzatura particolare — la semplicità è parte del prodotto, non un di più. ' +
  'CLINICA: non indicata in gravidanza e allattamento; valutazione attenta con problemi renali, epatici, pancreatici o cardiaci; chi assume farmaci per diabete o pressione può aver bisogno di aggiustamenti. Nessun claim medico nei testi. ' +
  '(Il vincolo carboidrati in grammi non è ancora un parametro del motore: resta qui e va verificato in validazione.)';

const KM_NOTE_REGIME: Record<string, string> = {
  omnivore: ' REGIME ONNIVORO: il pesce azzurro è la fonte proteica di riferimento (almeno un pasto principale su due), la carne resta presente ma non domina.',
  vegetarian: ' REGIME VEGETARIANO: niente carne né pesce. Le proteine arrivano da uova, latticini freschi e stagionati, frutta secca e semi: presidiare la densità proteica di ogni pasto, che senza pesce e senza legumi è il punto fragile di questo schema.',
};

const KM_KCAL: Record<string, number> = { dimagrimento: 1500, mantenimento: 1800 };

export const KETO_MEDITERRANEA: PresetSeed[] = (['omnivore', 'vegetarian'] as const).flatMap((regime) =>
  (['dimagrimento', 'mantenimento'] as const).flatMap((objective) =>
    (['3', '5', 'fasting'] as const).map((meals) => ({
      style: 'keto_mediterranean',
      label: 'Keto-Mediterranea',
      sortOrder: 55,
      regime,
      objective,
      meals,
      description:
        'Chetogenica costruita con la dispensa mediterranea: stessa riduzione drastica dei carboidrati, ma i grassi arrivano da olio d\'oliva, pesce azzurro, frutta secca e olive. Solo ingredienti da supermercato italiano: niente farine speciali, dolcificanti particolari o prodotti confezionati "keto".',
      rules: { ...KM_BASE, menu_daycombo_kcal_target: KM_KCAL[objective] },
      clinicalNotes: KM_NOTE_COMUNE + (KM_NOTE_REGIME[regime] ?? ''),
      source:
        'Dieta chetogenica mediterranea in sovrappeso/obesità con prediabete o T2D (PMC9610411); chetogeniche a base di olio d\'oliva e profilo lipidico (PubMed 26700799, 30497921); Keto-Med randomized trial (PMC8002540); Harvard T.H. Chan — The Nutrition Source, Ketogenic Diet.',
    })),
  ),
);

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
  {
    style: 'detox', label: 'Detossinante (reset depurativo)', sortOrder: 76,
    description: 'Reset breve (1–2 settimane) che SOSTIENE i normali processi depurativi di fegato, reni e intestino: verdure (crucifere e amare), fibra alta, molta acqua, zero alcol, pochi zuccheri/sodio/ultra-processati. Poi si passa a uno stile di lungo periodo.',
    rules: R(0.18, 0.25, 14, 2, 0.7, 1.2, false),
    clinicalNotes:
      'Impostazione EVIDENCE-BASED, senza claim medici: il corpo si depura da solo (fegato/reni); nessuna promessa di "eliminare tossine" — le detox commerciali (succhi/digiuni/integratori) non hanno evidenza clinica. Questo piano SUPPORTA gli organi emuntori: verdure ≥ 4–5 porzioni/die con crucifere (broccoli, cavolo) e foglie amare quotidiane; fibra ≥ 25–30 g/die; idratazione ~2 L acqua/die (acqua, tè verde/tisane non zuccherate); ALCOL ZERO per tutta la durata; zuccheri aggiunti < 5–10% kcal; sodio ≤ 2000 mg/die; niente ultra-processati e fritture; proteine adeguate 18–25% (gli enzimi epatici richiedono aminoacidi: MAI abbinare "detox" a proteine bassissime); kcal mai sotto il metabolismo basale, niente digiuni né soli liquidi. Durata 1–2 settimane, poi passaggio a mediterranea o flessibile. Controindicazioni (gravidanza/allattamento, patologie epato-renali, DCA): solo con validazione del nutrizionista. (Richiedono parametri motore: porzioni min verdura, fibre_min_g, cap sodio/zuccheri, flag no-alcol.)',
    source: 'Klein & Kiat, Detox diets: critical review (J Hum Nutr Diet 2015) — nessuna evidenza per le detox commerciali; consenso dietetico (BDA/AND): supporto agli organi emuntori via fibra, idratazione, riduzione alcol/ultra-processati.',
  },
  // ---- Protocolli stagionali estate (luglio) ----
  {
    style: 'summer_holiday', label: 'Vacanze in Serenità', sortOrder: 5,
    regime: null, objective: 'mantenimento',
    description: 'Piano estivo di MANTENIMENTO per chi è in vacanza: difende il risultato senza restrizione né sensi di colpa. Piatti freschi, freddi e portabili, idratazione, porzioni consapevoli.',
    rules: { ...R(0.15, 0.22, 20, 1.2, 0.4, 1.3, false), menu_daycombo_kcal_target: 1800 },
    clinicalNotes: 'Obiettivo mantenimento, NON deficit: kcal ~ fabbisogno, tolleranza ampia. Priorità a piatti freddi/portabili (spiaggia, viaggio) e ad alto contenuto d’acqua (frutta/verdura); idratazione; per ogni pasto una nota “fuori casa/ristorante”. Nessun digiuno né taglio. Patologie/gravidanza/allattamento: piano validato dal nutrizionista.',
    source: 'National Weight Control Registry — strategie di mantenimento nei periodi a rischio (auto-monitoraggio, attività regolare, niente restrizione).',
  },
  {
    style: 'summer_return', label: 'Ritorno in Equilibrio', sortOrder: 6,
    regime: null, objective: 'dimagrimento',
    description: 'Ripartenza DOLCE post-vacanza: settimana 1 reset leggero (sgonfiare, reidratare, ordine in sonno/pasti), settimana 2 ritmo pieno verso l’obiettivo. Niente diete lampo.',
    rules: { ...R(0.20, 0.28, 14, 1.3, 0.7, 1.1, false), menu_daycombo_kcal_target: 1600 },
    clinicalNotes: 'Settimana 1 “reset”: verdure e fibra, ridurre il sodio e aumentare potassio/idratazione (attenua ritenzione/gonfiore), ritmo sonno-pasti, movimento leggero, misure gentili. Settimana 2: spinta efficacia graduale (stato “rientro”), porzioni standard, niente fame. Mai diete lampo o digiuni. Guardrail clinici come sopra. (Sodio/potassio: oggi in nota, non ancora parametri motore.)',
    source: 'National Weight Control Registry (ripartenza graduale, no crash diet) + evidenze su ritenzione idrica (sodio/potassio/idratazione).',
  },

  // ---- Keto-Mediterranea: 12 varianti (2 regimi × 2 obiettivi × 3 strutture pasti) ----
  ...KETO_MEDITERRANEA,
];
