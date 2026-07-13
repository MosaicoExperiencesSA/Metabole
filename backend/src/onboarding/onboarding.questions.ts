/**
 * Schema del questionario di onboarding.
 * Fonte di verità: docs/Metabole_Prototipo_Navigabile.html (direttiva replica 1:1).
 * Titoli e testi di Gaia (subtitle) copiati verbatim dal prototipo.
 * Servito da GET /onboarding/questions; il frontend lo renderizza.
 * NB: schermo 16 "Stile che preferisci" (style) verrà reso dinamico dai Product
 * (Keto ecc.) nel filone prodotti dinamici; qui resta invariato per ora.
 */
export const ONBOARDING_QUESTIONS = {
  version: 1,
  pages: [
    {
      key: 'identity',
      title: 'Come vuoi essere chiamata?',
      subtitle: 'Come vuoi che ti chiami? Scrivi qui il tuo nome.',
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
      subtitle: 'Inseriscimi le tue misure di partenza. Ricordati che dovrai aggiornarle ogni due giorni. Se non sai come prenderle, guarda il video toccando il pulsante.',
      fields: [
        { key: 'startWeightKg', type: 'number', label: 'Peso (kg)', min: 35, max: 250, required: true },
        { key: 'startWaistCm', type: 'number', label: 'Vita (cm)', min: 40, max: 200 },
        { key: 'startHipsCm', type: 'number', label: 'Fianchi (cm)', min: 40, max: 200 },
      ],
    },
    {
      key: 'regime',
      title: 'Il tuo regime alimentare',
      subtitle: 'La base del tuo menu: qual è il tuo regime alimentare? Onnivoro, vegetariano o vegano?',
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
      subtitle: 'Un punto molto importante: le tue allergie o intolleranze. È importante che le conosca, così posso evitarti i cibi che potrebbero farti male.',
      fields: [
        { key: 'intolerances', type: 'multi_choice', options: ['none', 'gluten', 'lactose', 'nuts', 'other'], labels: ['Nessuna', 'Glutine', 'Lattosio', 'Frutta secca', 'Altro'] },
      ],
    },
    {
      key: 'tastes',
      title: 'Cibi che non ami',
      subtitle: 'Mangiare non deve essere uno stress: elencami i cibi che proprio non riesci a mangiare.',
      fields: [{ key: 'dislikedFoods', type: 'tags', label: 'Es. pesce, legumi, funghi…' }],
    },
    {
      key: 'lifestyle',
      title: 'La tua vita e il lavoro',
      subtitle: 'Parliamo del tuo lavoro. Il tuo lavoro è: sedentario, in piedi, a turni, o viaggi spesso?',
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
      subtitle: 'Quale percorso preferisci: cinque pasti, tre pasti classico, o con integratori? Il digiuno intermittente arriverà presto.',
      fields: [
        { key: 'pathType', type: 'choice', options: ['classic3', 'five', 'supplements', 'intermittent_fasting'], labels: ['3 pasti classico', '5 pasti', 'Con integratori', 'Digiuno intermittente'], required: true },
      ],
    },
    {
      key: 'health',
      title: 'La tua salute',
      subtitle: 'Altro punto importante: le patologie di cui soffri e le medicine che prendi. Indicale con cura.',
      fields: [
        { key: 'hasConditions', type: 'choice', label: 'Hai patologie in corso?', options: ['no', 'yes', 'tell_in_visit'], labels: ['No', 'Sì', 'Lo dico in visita'], required: true },
        { key: 'takesMedications', type: 'choice', label: 'Assumi farmaci?', options: ['no', 'yes'], labels: ['No', 'Sì'], required: true },
      ],
    },
    {
      key: 'objective',
      title: 'Il tuo obiettivo',
      subtitle: 'Siamo arrivati al passo più importante: qual è il tuo obiettivo? Dimmi quanti chili vuoi perdere, quanti centimetri su fianchi e vita e soprattutto entro quando. Se è sostenibile, organizzerò al meglio il tuo percorso per fartelo raggiungere senza indugio.',
      fields: [
        { key: 'weightToLoseKg', type: 'number', label: 'Peso da perdere (kg)', min: 1, max: 20, required: true },
        { key: 'weeks', type: 'number', label: 'Entro (settimane)', min: 3, max: 52, required: true },
        { key: 'waistToLoseCm', type: 'number', label: 'Vita da perdere (cm)', min: 0, max: 40 },
      ],
    },
    {
      key: 'pause_periods',
      title: 'Periodi senza dieta',
      subtitle: 'Aggiungi tutte le feste, gli eventi, le vacanze o semplicemente i momenti di pausa: così pianifichiamo insieme la strategia migliore per fartele godere appieno, senza rimpianti.',
      fields: [
        { key: 'pausePeriods', type: 'date_ranges', label: 'Aggiungi periodo' },
      ],
    },
    {
      key: 'why',
      title: 'Perché vuoi iniziare adesso?',
      subtitle: 'Dimmi la spinta più vera: mi aiuta a costruire il percorso giusto per te.',
      fields: [
        { key: 'why', type: 'choice', options: ['wellbeing', 'clothes', 'health', 'event'], labels: ['Sentirmi bene con me stessa', 'Rientrare nei miei vestiti', 'Salute ed energia', 'Un evento importante'], required: true },
      ],
    },
    {
      key: 'coach_style',
      title: 'Come vuoi essere seguita?',
      subtitle: "Oltre a me sarai seguita anche da un coach umano, che ti affiancherà nel tuo percorso. Per assegnarti l'assistente più adatta devo capire alcune cose, così non sarò né invadente né superficiale. Con che frequenza vuoi essere seguita dalla tua coach: ogni giorno, quando serve, o su tua richiesta?",
      fields: [
        { key: 'coachStyle', type: 'choice', options: ['daily', 'when_needed', 'on_request'], labels: ['Ogni giorno', 'Quando serve', 'Solo su richiesta'], required: true },
      ],
    },
    {
      key: 'character',
      title: 'Quale caratteristica ti contraddistingue quando prendi un impegno?',
      subtitle: 'Quando prendi un impegno, quale caratteristica ti contraddistingue? Segui bene, vai spronata, perseveri da sola, o tendi a mollare?',
      fields: [
        { key: 'character', type: 'choice', options: ['follows', 'needs_push', 'perseveres', 'quits'], labels: ['Seguo bene', 'Vado spronata', 'Persevero da sola', 'Tendo a mollare'], required: true },
      ],
    },
    {
      key: 'theme',
      title: 'Scegli il colore della tua app',
      fields: [
        { key: 'themeColor', type: 'color', options: ['#F2B807', '#E23B3B', '#E86FA6', '#2F80ED', '#12A386', '#F2820A'] },
      ],
    },
  ],
} as const;
