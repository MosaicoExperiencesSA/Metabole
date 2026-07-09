/**
 * Schema del questionario di onboarding — 15 pagine.
 * Fonte: Metabole_Prototipo (Metabole_Sondaggio_Iniziale.html).
 * Servito da GET /onboarding/questions; il frontend lo renderizza.
 */
export const ONBOARDING_QUESTIONS = {
  version: 1,
  pages: [
    {
      key: 'identity',
      title: 'Chi sei',
      subtitle: 'Partiamo dalle basi.',
      fields: [
        { key: 'name', type: 'text', label: 'Nome', required: true },
        { key: 'age', type: 'number', label: 'Età', min: 18, max: 100, required: true },
        { key: 'heightCm', type: 'number', label: 'Altezza (cm)', min: 120, max: 230, required: true },
        { key: 'sex', type: 'choice', label: 'Sesso', options: ['female', 'male'], labels: ['Donna', 'Uomo'], required: true },
      ],
    },
    {
      key: 'baseline',
      title: 'Il tuo punto di partenza',
      subtitle: 'Le aggiornerai ogni 2 giorni.',
      fields: [
        { key: 'startWeightKg', type: 'number', label: 'Peso (kg)', min: 35, max: 250, required: true },
        { key: 'startWaistCm', type: 'number', label: 'Vita (cm)', min: 40, max: 200 },
        { key: 'startHipsCm', type: 'number', label: 'Fianchi (cm)', min: 40, max: 200 },
      ],
    },
    {
      key: 'regime',
      title: 'Il tuo regime alimentare',
      subtitle: 'Su cosa costruiamo i menu.',
      fields: [
        { key: 'regime', type: 'choice', options: ['omnivore', 'vegetarian', 'vegan'], labels: ['Onnivoro', 'Vegetariano', 'Vegano'], required: true },
      ],
    },
    {
      key: 'style',
      title: 'Stile che preferisci',
      fields: [
        { key: 'dietStyle', type: 'choice', options: ['mediterranean', 'protein', 'low_carb', 'flexible'], labels: ['Mediterranea', 'Proteica', 'Low-carb', 'Flessibile'], required: true },
      ],
    },
    {
      key: 'intolerances',
      title: 'Intolleranze o allergie',
      subtitle: 'Puoi sceglierne più di una.',
      fields: [
        { key: 'intolerances', type: 'multi_choice', options: ['none', 'gluten', 'lactose', 'nuts', 'other'], labels: ['Nessuna', 'Glutine', 'Lattosio', 'Frutta secca', 'Altro'] },
      ],
    },
    {
      key: 'tastes',
      title: 'Cibi che non ami',
      subtitle: 'Li terrò alla larga dai tuoi menu.',
      fields: [{ key: 'dislikedFoods', type: 'tags', label: 'Es. pesce, legumi, funghi…' }],
    },
    {
      key: 'lifestyle',
      title: 'La tua vita e il lavoro',
      subtitle: 'Così i menu diventano fattibili.',
      fields: [
        { key: 'work', type: 'choice', label: 'Che lavoro fai?', options: ['sedentary', 'standing', 'shifts', 'travel'], labels: ['Sedentario', 'In piedi', 'Turni', 'Viaggio spesso'] },
        { key: 'cookingTime', type: 'choice', label: 'Tempo per cucinare', options: ['very_little', 'some', 'love_cooking'], labels: ['Pochissimo', "Un po'", 'Mi piace cucinare'] },
        { key: 'weekdayLunch', type: 'choice', label: 'Dove pranzi nei feriali', options: ['home', 'canteen', 'out', 'on_the_go'], labels: ['Da casa', 'Mensa', 'Fuori', 'Al volo'] },
      ],
    },
    {
      key: 'meals',
      title: 'Quanti pasti riesci a fare?',
      subtitle: 'Alcuni percorsi ne prevedono 5-6.',
      fields: [
        { key: 'mealsPerDay', type: 'choice', options: [3, 4, 5], labels: ['3 pasti', '4 pasti', '5-6 pasti'], required: true },
      ],
    },
    {
      key: 'path',
      title: 'Che percorso preferisci?',
      fields: [
        { key: 'pathType', type: 'choice', options: ['classic3', 'five', 'supplements', 'intermittent_fasting'], labels: ['3 pasti classico', '5 pasti', 'Con integratori', 'Digiuno intermittente'], required: true },
      ],
    },
    {
      key: 'health',
      title: 'La tua salute',
      subtitle: 'Serve per la tua sicurezza. Se segnali una condizione, ti prende in carico il nutrizionista.',
      fields: [
        { key: 'hasConditions', type: 'choice', label: 'Hai patologie in corso?', options: ['no', 'yes', 'tell_in_visit'], labels: ['No', 'Sì', 'Lo dico in visita'], required: true },
        { key: 'takesMedications', type: 'choice', label: 'Assumi farmaci?', options: ['no', 'yes'], labels: ['No', 'Sì'], required: true },
      ],
    },
    {
      key: 'objective',
      title: 'Il tuo obiettivo',
      subtitle: 'Con calma e in modo sostenibile.',
      fields: [
        { key: 'weightToLoseKg', type: 'number', label: 'Peso da perdere (kg)', min: 1, max: 20, required: true },
        { key: 'weeks', type: 'number', label: 'Entro (settimane)', min: 3, max: 52, required: true },
        { key: 'waistToLoseCm', type: 'number', label: 'Vita da perdere (cm)', min: 0, max: 40 },
      ],
    },
    {
      key: 'pause_periods',
      title: 'Periodi senza dieta',
      subtitle: 'Vacanze e feste in cui non vuoi seguire la dieta. In quei giorni niente dieta, ma se il peso sale arriva un mini-piano.',
      fields: [
        { key: 'pausePeriods', type: 'date_ranges', label: 'Aggiungi periodo' },
      ],
    },
    {
      key: 'coach_style',
      title: 'Come vuoi essere seguita?',
      subtitle: 'Dalla tua coach.',
      fields: [
        { key: 'coachStyle', type: 'choice', options: ['daily', 'when_needed', 'on_request'], labels: ['Ogni giorno', 'Quando serve', 'Solo su richiesta'], required: true },
      ],
    },
    {
      key: 'character',
      title: 'Che tipo sei?',
      subtitle: "Così taro la coach e l'AI sul tuo carattere.",
      fields: [
        { key: 'character', type: 'choice', options: ['follows', 'needs_push', 'perseveres', 'quits'], labels: ['Seguo bene', 'Vado spronata', 'Persevero da sola', 'Tendo a mollare'], required: true },
      ],
    },
    {
      key: 'theme',
      title: 'Scegli il colore della tua app',
      fields: [
        { key: 'themeColor', type: 'color', options: ['#12A386', '#2563EB', '#E8825A', '#7F77DD', '#D4537E', '#B8863B'] },
      ],
    },
  ],
} as const;
