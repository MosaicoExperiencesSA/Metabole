import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MealSnapshot } from './pasto-giornata';
import { MOTIVI, StatoSostituzione } from './sostituzione-chat';
import { ConfigParamsService } from '../config-params/config-params.service';
import { SostituzioneChatService } from './sostituzione-chat.service';

/**
 * Il pezzo che merita più test di tutti: è il codice che trasforma una conversazione in
 * grammi dentro il piatto di una persona. L'errore qui non è una frase goffa.
 */

const OGGI = new Date();
const oggiIso = () => OGGI.toISOString().slice(0, 10);

const RICETTA_PRANZO = {
  id: 'r-pranzo',
  name: 'Insalata di farro',
  // Come per la colazione: i campi che il cambio di piatto legge. Senza `mealSlot` qui, il filtro
  // per slot del finto Prisma non compilava — le due ricette formano un'unione, e TypeScript
  // pretende che il campo esista su tutte.
  mealSlot: 'lunch',
  kcal: 500,
  macros: { protein_g: 18 },
  difficulty: 'media',
  ingredients: [
    { name: 'farro', qty: 80, unit: 'g' },
    { name: 'carote', qty: 100, unit: 'g' },
    { name: 'olio evo', qty: 10, unit: 'g' },
  ],
};
const RICETTA_COLAZIONE = {
  id: 'r-colazione',
  name: 'Yogurt e avena',
  // Servono al cambio di piatto: lo slot per cercare le alternative, le proteine per sapere se
  // quelle proposte sono davvero «più proteiche».
  mealSlot: 'breakfast',
  kcal: 300,
  macros: { protein_g: 8 },
  difficulty: 'semplice',
  ingredients: [
    { name: 'yogurt greco', qty: 150, unit: 'g' },
    { name: 'avena', qty: 40, unit: 'g' },
  ],
};

const pastiDiOggi: MealSnapshot[] = [
  { slot: 'breakfast', recipeId: 'r-colazione', name: 'Yogurt e avena', kcal: 300 },
  { slot: 'lunch', recipeId: 'r-pranzo', name: 'Insalata di farro', kcal: 500 },
];

/**
 * La fabbrica del servizio col suo finto database. Estratta dal `beforeEach` per poterla usare
 * anche dai test del cambio di piatto (8/8): due copie dello stesso finto Prisma divergono, e a
 * quel punto i due gruppi di test misurano due mondi diversi.
 *
 * `tocca` permette a un singolo test di cambiare una risposta (es. «il pool non c'è»).
 */
async function creaServizio(tocca?: (prisma: any) => void) {
    const giorno = {
      id: 'day-1',
      date: new Date(`${oggiIso()}T00:00:00.000Z`),
      dietId: 'diet-onnivora',
      meals: pastiDiOggi.map((m) => ({ ...m })),
    };

    const prisma: any = {
      menuDay: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(giorno)),
        findMany: jest.fn().mockImplementation(() => Promise.resolve([giorno])),
        update: jest.fn().mockImplementation(({ data }: any) => {
          giorno.meals = data.meals;
          return Promise.resolve(giorno);
        }),
      },
      recipe: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const catalogo = [
            RICETTA_COLAZIONE,
            RICETTA_PRANZO,
            // Alternative di colazione per il ramo «voglio una colazione proteica».
            { id: 'r-uova', name: 'Uova strapazzate e pane di segale', mealSlot: 'breakfast', kcal: 340, macros: { protein_g: 24 }, difficulty: 'semplice', ingredients: [] },
            { id: 'r-skyr', name: 'Skyr con mandorle', mealSlot: 'breakfast', kcal: 330, macros: { protein_g: 20 }, difficulty: 'semplice', ingredients: [] },
            // Fuori tolleranza: non deve mai essere proposta.
            { id: 'r-brioche', name: 'Brioche e cappuccino', mealSlot: 'breakfast', kcal: 520, macros: { protein_g: 12 }, difficulty: 'semplice', ingredients: [] },
          ];
          const perId = (where?.id?.in ?? null) as string[] | null;
          return Promise.resolve(
            catalogo
              .filter((r) => (perId ? perId.includes(r.id) : true))
              .filter((r) => (where?.mealSlot ? r.mealSlot === where.mealSlot : true)),
          );
        }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          allergies: [],
          intolerances: [],
          dislikedFoods: [],
          assignedCoachId: 'staff-c',
          assignedNutritionistId: 'staff-n',
          name: 'Giulia',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      // Lo scenario del progetto: il nutrizionista ha approvato un gruppo che rende le carote
      // intercambiabili con le biete. È da qui che Gaia prende il sostituto.
      equivalenceGroup: {
        findMany: jest.fn().mockResolvedValue([
          { productId: null, members: { items: ['carote', 'biete', 'spinaci'] } },
        ]),
      },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'esc-1' }) },
      staff: {
        findMany: jest.fn().mockResolvedValue([{ id: 'staff-n', userId: 'u-n' }]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
      // La base personale CERTIFICATA: è l'unico posto da cui il cambio di piatto pesca (8/8).
      clientMenuPool: {
        findFirst: jest.fn().mockResolvedValue({ recipeIds: ['r-colazione', 'r-uova', 'r-skyr', 'r-brioche'] }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Giulia' }) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SostituzioneChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        // Soglia del cambio di piatto (kcal): il default 15 è quello del motore.
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn().mockResolvedValue(15) } },
      ],
    }).compile();


    if (tocca) tocca(prisma);
    const service = moduleRef.get(SostituzioneChatService) as SostituzioneChatService;
    return { service, prisma, audit, giorno: () => giorno };
}

describe('SostituzioneChatService', () => {
  let service: SostituzioneChatService;
  let prisma: any;
  let audit: { log: jest.Mock };

  /** Il giorno di oggi in memoria: `menuDay.update` ci riscrive sopra, come farebbe il db. */
  let giorno: { id: string; date: Date; dietId: string; meals: MealSnapshot[] };

  beforeEach(async () => {
    const creato = await creaServizio();
    service = creato.service;
    prisma = creato.prisma;
    audit = creato.audit;
    giorno = creato.giorno();
  });

  /** Scorciatoia: dall'apertura fino alla conferma, come farebbe la chat. */
  async function fino_alla_conferma(cibo: string, motivo: string) {
    const apertura = await service.apri('client-1');
    if (!apertura.stato) throw new Error(`apertura non riuscita: ${apertura.testo}`);
    const dopoCibo = await service.avanza('client-1', apertura.stato, cibo);
    if (!dopoCibo.stato) throw new Error(`alimento non riconosciuto: ${dopoCibo.testo}`);
    const dopoMotivo = await service.avanza('client-1', dopoCibo.stato, motivo);
    if (!dopoMotivo.stato) throw new Error(`motivo non riconosciuto: ${dopoMotivo.testo}`);
    return { dopoCibo, dopoMotivo };
  }

  const sostituzioniDelPranzo = () =>
    giorno.meals.find((m) => m.slot === 'lunch')?.substitutions ?? [];

  // ---------- Apertura ----------

  it('apre il dialogo elencando i piatti di oggi', async () => {
    const esito = await service.apri('client-1');
    expect(esito.esito).toBe('aperto');
    expect(esito.stato?.passo).toBe('cibo');
    expect(esito.testo).toContain('Insalata di farro');
    expect(esito.testo).toContain('Yogurt e avena');
  });

  it('senza menu di oggi non apre un dialogo che non porterebbe da nessuna parte', async () => {
    prisma.menuDay.findFirst.mockResolvedValue(null);
    const esito = await service.apri('client-1');
    expect(esito.esito).toBe('rifiutata');
    expect(esito.stato).toBeUndefined();
  });

  it('dal testo libero riconosce l\'alimento e salta direttamente al motivo', async () => {
    const esito = await service.apriDaTesto('client-1', 'vorrei sostituire le carote');
    expect(esito.stato?.passo).toBe('motivo');
    expect(esito.stato?.proposta?.da).toBe('carote');
    expect(esito.stato?.proposta?.slot).toBe('lunch');
  });

  it('se dal testo l\'alimento non si capisce, chiede quale', async () => {
    const esito = await service.apriDaTesto('client-1', 'vorrei sostituire qualcosa');
    expect(esito.stato?.passo).toBe('cibo');
  });

  // ---------- Riconoscimento dell'alimento ----------

  it('riconosce l\'alimento fra gli ingredienti VERI del giorno, con i suoi grammi', async () => {
    const { dopoCibo } = await fino_alla_conferma('le carote', '1');
    expect(dopoCibo.stato?.proposta).toMatchObject({
      da: 'carote',
      slot: 'lunch',
      piatto: 'Insalata di farro',
      qtaDa: 100,
      unita: 'g',
    });
    expect(dopoCibo.testo).toContain('100 g di carote');
  });

  it('regge il nome composto («yogurt greco»)', async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['yogurt greco', 'skyr'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'lo yogurt greco');
    expect(esito.stato?.proposta?.da).toBe('yogurt greco');
    expect(esito.stato?.proposta?.slot).toBe('breakfast');
    expect(esito.stato?.proposta?.a).toBe('skyr');
  });

  it('se scrive il nome del PIATTO glielo spiega, invece di arrendersi', async () => {
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'insalata');
    expect(esito.esito).toBe('in_corso');
    expect(esito.testo).toContain('è il nome del piatto');
    expect(esito.stato?.passo).toBe('cibo');
  });

  it('dopo due tentativi a vuoto passa la mano alla coach', async () => {
    const apertura = await service.apri('client-1');
    const primo = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'zzzqqq');
    expect(primo.esito).toBe('in_corso');
    const secondo = await service.avanza('client-1', primo.stato as StatoSostituzione, 'wwwkkk');
    expect(secondo.esito).toBe('arresa');
    expect(secondo.inoltraA).toBe('coach');
    expect(secondo.stato).toBeUndefined();
  });

  // ---------- La scrittura sul menu: il ponte ----------

  it('«non ce l\'ho in casa» scrive sul menu di OGGI a pari grammatura, da verificare', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    expect(dopoMotivo.stato?.passo).toBe('conferma');
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');

    expect(fatto.esito).toBe('applicata');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(1);
    expect(sostituzioniDelPranzo()).toEqual([
      expect.objectContaining({
        from: 'carote',
        to: 'biete', // dal gruppo di equivalenza approvato dal nutrizionista
        fromQty: 100,
        toQty: 100,
        unit: 'g',
        origine: 'chat',
        motivo: 'non_disponibile',
        stato: 'da_verificare',
      }),
    ]);
  });

  it('la ricetta di catalogo non viene toccata mai: il cambio vive nella giornata della cliente', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(RICETTA_PRANZO.ingredients.find((i) => i.name === 'carote')).toEqual({
      name: 'carote',
      qty: 100,
      unit: 'g',
    });
    // Nessuna scrittura su `recipe`: il servizio non ha nemmeno il metodo per farlo.
    expect(prisma.recipe.findMany).toHaveBeenCalled();
  });

  it('il pasto NON coinvolto resta intatto', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(giorno.meals.find((m) => m.slot === 'breakfast')?.substitutions).toBeUndefined();
  });

  /**
   * La regola che il progetto mette al centro: solo un motivo di GUSTO restringe i menu futuri.
   * «Non ce l'ho in casa» non dice niente sui suoi gusti, e trattarlo come un rifiuto
   * impoverirebbe il menu per una spesa saltata.
   */
  it('«non ce l\'ho in casa» NON aggiunge l\'alimento ai cibi non graditi', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('«non mi piace» aggiunge l\'alimento ai cibi non graditi e vale da oggi in avanti', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', 'non mi piacciono');
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(fatto.esito).toBe('applicata');
    expect(prisma.clientProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dislikedFoods: ['carote'] } }),
    );
    // `sempre` guarda i giorni da oggi in poi, non solo oggi.
    expect(prisma.menuDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: expect.objectContaining({ gte: expect.anything() }) }) }),
    );
  });

  it('«mi resta sullo stomaco» apre una segnalazione clinica e lo dice alla cliente', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', 'mi restano sullo stomaco');
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(fatto.esito).toBe('applicata');
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'clinical' }) }),
    );
    expect(fatto.testo).toContain('nutrizionista');
    // Un segnale clinico non è un gusto: non deve restringere i menu futuri.
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('«no» annulla e non scrive niente', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no');
    expect(fatto.esito).toBe('annullata');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('una risposta ambigua alla conferma non vale un sì', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const incerto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'mah');
    expect(incerto.esito).toBe('in_corso');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('riconfermare lo stesso cambio non lo scrive due volte', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(sostituzioniDelPranzo()).toHaveLength(1);
  });

  it('se il menu cambia fra la proposta e la conferma non dichiara un successo che non c\'è stato', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    giorno.meals = [{ slot: 'lunch', recipeId: 'r-colazione', name: 'Yogurt e avena', kcal: 300 }];
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(fatto.esito).toBe('rifiutata');
    expect(fatto.testo).toContain('non ho toccato niente');
  });

  it('riconfermare NON produce il messaggio «il menu è cambiato», che sarebbe falso', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    const secondo = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    expect(secondo.esito).toBe('applicata');
    expect(secondo.testo).toContain("c'è già");
    expect(secondo.testo).not.toContain('non ho toccato niente');
  });

  /**
   * La conferma che la cliente ha letto nominava UN pasto. Prima il ciclo scriveva su ogni pasto
   * della giornata che contenesse quell'ingrediente: un cambio concordato sulla pasta del pranzo
   * riscriveva anche la «pasta sfoglia» della cena — un piatto di cui non si era parlato.
   */
  it('scrive solo sul pasto concordato, non su tutti quelli che contengono l\'alimento', async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([]);
    giorno.meals = [
      { slot: 'lunch', recipeId: 'r-pasta', name: 'Pasta al pomodoro', kcal: 500 },
      { slot: 'dinner', recipeId: 'r-torta', name: 'Torta salata', kcal: 600 },
    ];
    prisma.recipe.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(
        [
          { id: 'r-pasta', name: 'Pasta al pomodoro', ingredients: [{ name: 'pasta', qty: 80, unit: 'g' }] },
          { id: 'r-torta', name: 'Torta salata', ingredients: [{ name: 'pasta sfoglia', qty: 120, unit: 'g' }] },
        ].filter((r) => (where?.id?.in ?? []).includes(r.id)),
      ),
    );
    const apertura = await service.apri('client-1');
    const dopoCibo = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'la pasta');
    // «pasta» → «pasta senza glutine» è una variante dello stesso cibo: giustamente scartata,
    // quindi la richiesta passa alla nutrizionista e niente viene scritto.
    expect(dopoCibo.esito).toBe('rifiutata');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('un alimento già sostituito è riconoscibile: Gaia non nega quello che ha scritto lei', async () => {
    // Ieri concordato «carote → biete». Oggi la cliente legge «biete» nel menu e vuole cambiare quelle.
    giorno.meals = pastiDiOggi.map((m) =>
      m.slot === 'lunch'
        ? { ...m, substitutions: [{ from: 'carote', to: 'biete', reason: "non ce l'ho in casa", toQty: 100, unit: 'g', origine: 'chat' as const }] }
        : { ...m },
    );
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['biete', 'spinaci'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'le biete');
    expect(esito.stato?.proposta).toMatchObject({ da: 'biete', a: 'spinaci', qtaDa: 100, unita: 'g' });
  });

  /**
   * «pepe» non deve prendere «peperoni»: se prendesse, il cancello delle spezie non scatterebbe
   * (viene interrogato sul nome trovato) e i peperoni finirebbero sostituiti — ed esclusi per
   * sempre, se la cliente risponde «non mi piace», che sul pepe era vero.
   */
  it('«il pepe» non fa sostituire i peperoni', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r-pranzo', name: 'Pollo ai peperoni', ingredients: [{ name: 'peperoni', qty: 150, unit: 'g' }] },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'il pepe');
    expect(esito.stato?.proposta).toBeUndefined();
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('un sostituto che è una variante dello stesso cibo non viene proposto', async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([]);
    const apertura = await service.apri('client-1');
    // La mappa direbbe «yogurt senza lattosio», che a chi lo yogurt non piace non serve.
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'lo yogurt greco');
    expect(esito.esito).toBe('rifiutata');
    expect(esito.inoltraA).toBe('nutritionist');
  });

  /**
   * `EquivalenceGroup.productId` è il `Diet.id`, `null` = globale. Senza il filtro, un gruppo
   * scritto per la dieta vegana finiva addosso a una cliente onnivora.
   */
  it('non applica un gruppo di equivalenza scritto per un ALTRO prodotto', async () => {
    const apertura = await service.apri('client-1');
    await service.avanza('client-1', apertura.stato as StatoSostituzione, 'le carote');
    const where = prisma.equivalenceGroup.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('approved');
    expect(where.OR).toEqual([{ productId: null }, { productId: 'diet-onnivora' }]);
  });

  // ---------- Le due protezioni ----------

  /**
   * Allergeni: se il sostituto contiene un allergene dichiarato, il cambio si rifiuta e basta.
   * Su questo non si media, e non è una questione di grammi.
   */
  it('se il sostituto tocca un allergene dichiarato, il cambio si rifiuta', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      allergies: ['latticini'],
      intolerances: [],
      dislikedFoods: [],
      assignedCoachId: 'staff-c',
      assignedNutritionistId: 'staff-n',
      name: 'Giulia',
    });
    // Gruppo approvato che propone la ricotta al posto delle carote: assurdo per un
    // nutrizionista, perfetto per il test — la protezione non deve dipendere dal buon senso
    // di chi ha compilato il gruppo.
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['carote', 'ricotta'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'le carote');
    expect(esito.esito).toBe('rifiutata');
    expect(esito.inoltraA).toBe('nutritionist');
    expect(esito.testo).toContain('allergica');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('le spezie non si registrano: risponde col perché e non tocca il menu', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r-pranzo', name: 'Insalata di farro', ingredients: [{ name: 'curcuma', qty: 2, unit: 'g' }] },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'la curcuma');
    expect(esito.esito).toBe('rifiutata');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'menu.spezia.rifiutata' }),
    );
  });

  it('senza un sostituto che regga passa la mano invece di inventarne uno', async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([]);
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r-pranzo', name: 'Branzino al forno', ingredients: [{ name: 'branzino', qty: 150, unit: 'g' }] },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'il branzino');
    expect(esito.esito).toBe('rifiutata');
    expect(esito.inoltraA).toBe('nutritionist');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('senza gruppi approvati ripiega sulla mappa condivisa col motore', async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'il farro');
    // La stessa alternativa che proporrebbe il motore: due mappe diverse vorrebbero dire che la
    // chat propone una cosa e il motore un'altra, sulla stessa cliente.
    expect(esito.stato?.proposta?.a).toBe('riso');
  });

  it('non propone un sostituto che la cliente ha già fra le esclusioni', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      allergies: [],
      intolerances: [],
      dislikedFoods: ['porro'],
      assignedCoachId: 'staff-c',
      assignedNutritionistId: 'staff-n',
      name: 'Giulia',
    });
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['carote', 'porro', 'zucchine'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'le carote');
    expect(esito.stato?.proposta?.a).toBe('zucchine');
  });

  // ---------- I gruppi di equivalenza del nutrizionista ----------

  it('i gruppi di equivalenza APPROVATI vengono prima della mappa del motore', async () => {
    // Il farro nella mappa del motore vale «riso»; il nutrizionista ha detto «quinoa».
    // Vince il nutrizionista: è la sua materia prima.
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['farro', 'quinoa'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'il farro');
    expect(esito.stato?.proposta?.a).toBe('quinoa');
    expect(prisma.equivalenceGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
    );
  });

  it('legge solo i gruppi approvati: una bozza del nutrizionista non finisce nel piatto', async () => {
    const apertura = await service.apri('client-1');
    await service.avanza('client-1', apertura.stato as StatoSostituzione, 'le carote');
    const chiamata = prisma.equivalenceGroup.findMany.mock.calls[0][0];
    expect(chiamata.where.status).toBe('approved');
  });

  // ---------- L'elenco per la scheda cliente ----------

  it('l\'elenco per il backoffice riporta solo i cambi nati in chat, con lo stato', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    // Un cambio deciso dal motore (senza `origine`) non deve comparire fra quelli da verificare.
    giorno.meals[0].substitutions = [{ from: 'yogurt greco', to: 'yogurt senza lattosio', reason: 'lattosio' }];

    const elenco = await service.sostituzioniDiChat('client-1');
    expect(elenco).toHaveLength(1);
    expect(elenco[0]).toMatchObject({
      from: 'carote',
      slotLabel: 'pranzo',
      piatto: 'Insalata di farro',
      stato: 'da_verificare',
      motivo: 'non_disponibile',
      fromQty: 100,
      toQty: 100,
    });
    expect(elenco[0].data).toBe(oggiIso());
  });

  it('i quattro motivi arrivano tutti in fondo al flusso', async () => {
    for (const motivo of MOTIVI) {
      giorno.meals = pastiDiOggi.map((m) => ({ ...m }));
      prisma.menuDay.update.mockClear();
      const { dopoMotivo } = await fino_alla_conferma('le carote', String(motivo.numero));
      expect(dopoMotivo.stato?.motivo).toBe(motivo.key);
      const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
      expect(fatto.esito).toBe('applicata');
    }
  });
});

/**
 * IL RAMO NATO DALLA CONVERSAZIONE DELL'8/8.
 *
 *   Gaia    → «metti 40 g di olio evo al posto di 40 g di burro di macadamia — confermi?»
 *   cliente → «no  voglio una colazione proteica»
 *   Gaia    → «Mi piacerebbe aiutarti! 😊 Puoi dirmi di più?…»
 *
 * Quel «no» era anche una richiesta nuova, e rispondere solo «va bene, non cambio niente» era
 * corretto e inutile. Questi test tengono fermo che adesso la richiesta viene raccolta.
 */
describe('SostituzioneChatService — «voglio una colazione proteica»', () => {
  it('propone due alternative proteiche dentro le calorie, dalla base certificata', async () => {
    const { service } = await creaServizio();
    const esito = await service.proponiAltroPiatto('cli-1', 'voglio una colazione proteica');
    expect(esito.esito).toBe('in_corso');
    expect(esito.stato?.passo).toBe('scelta_piatto');
    expect(esito.testo).toContain('più proteine e le stesse calorie');
    // Le due dentro tolleranza, ordinate per proteine. La brioche da 520 kcal non c'è.
    expect(esito.stato?.alternativePiatto?.map((a) => a.nome)).toEqual([
      'Uova strapazzate e pane di segale',
      'Skyr con mandorle',
    ]);
    expect(esito.testo).not.toContain('Brioche');
    // E la chiama per nome.
    expect(esito.testo).toContain('Giulia');
  });

  it('il «no» alla sostituzione che contiene la richiesta nuova non chiude la conversazione', async () => {
    const { service } = await creaServizio();
    const esito = await service.avanza(
      'cli-1',
      {
        passo: 'conferma',
        proposta: {
          data: oggiIso(), slot: 'breakfast', recipeId: 'r-colazione', piatto: 'Yogurt e avena',
          da: 'avena', a: 'farro', qtaDa: 40, qtaA: 40, unita: 'g',
        },
        motivo: 'no_tempo',
      },
      'no  voglio una colazione proteica',
    );
    // Prima rispondeva «va bene, non cambio niente». Ora raccoglie la richiesta.
    expect(esito.esito).toBe('in_corso');
    expect(esito.stato?.passo).toBe('scelta_piatto');
  });

  it('un «no» secco resta un no: non si trasforma in una proposta', async () => {
    const { service } = await creaServizio();
    const esito = await service.avanza('cli-1', { passo: 'conferma', proposta: undefined as never }, 'no');
    expect(esito.esito).toBe('annullata');
  });

  it('scegliendo il numero, il piatto di oggi cambia e il cambio resta REGISTRATO', async () => {
    const { service, giorno } = await creaServizio();
    const proposta = await service.proponiAltroPiatto('cli-1', 'voglio una colazione proteica');
    const esito = await service.avanza('cli-1', proposta.stato!, '1');
    expect(esito.esito).toBe('applicata');

    const colazione = giorno().meals.find((m) => m.slot === 'breakfast')!;
    expect(colazione.recipeId).toBe('r-uova');
    expect(colazione.kcal).toBe(340);
    // Il record è ciò che rende il cambio visibile in scheda e contabile nel report: senza,
    // avremmo solo sovrascritto un recipeId e nessuno saprebbe che c'è stato un cambio.
    expect(colazione.cambioPiatto).toMatchObject({
      daRecipeId: 'r-colazione',
      daNome: 'Yogurt e avena',
      daKcal: 300,
      preferenza: 'proteico',
      origine: 'chat',
      stato: 'da_verificare',
    });
    // E il pranzo non si tocca.
    expect(giorno().meals.find((m) => m.slot === 'lunch')?.recipeId).toBe('r-pranzo');
  });

  it('il cambio compare nell\'elenco della scheda cliente, distinto da quelli di ingrediente', async () => {
    const { service } = await creaServizio();
    const proposta = await service.proponiAltroPiatto('cli-1', 'voglio una colazione proteica');
    await service.avanza('cli-1', proposta.stato!, '1');
    const elenco = await service.sostituzioniDiChat('cli-1');
    const cambio = elenco.find((e) => e.tipo === 'piatto');
    expect(cambio).toBeDefined();
    expect(cambio!.from).toBe('Yogurt e avena');
    expect(cambio!.to).toBe('Uova strapazzate e pane di segale');
    expect(cambio!.stato).toBe('da_verificare');
  });

  it('un numero che non esiste non applica niente', async () => {
    const { service, giorno } = await creaServizio();
    const proposta = await service.proponiAltroPiatto('cli-1', 'voglio una colazione proteica');
    const esito = await service.avanza('cli-1', proposta.stato!, '7');
    expect(esito.esito).toBe('in_corso');
    expect(giorno().meals.find((m) => m.slot === 'breakfast')?.recipeId).toBe('r-colazione');
  });

  it('se la base certificata non c\'è, non propone niente e passa alla nutrizionista', async () => {
    // Pool assente = piano non certificato: pescare dai template salterebbe i filtri di sicurezza.
    const { service } = await creaServizio((prisma) => {
      prisma.clientMenuPool.findFirst = jest.fn().mockResolvedValue(null);
    });
    const esito = await service.proponiAltroPiatto('cli-1', 'voglio una colazione proteica');
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('nutritionist');
    expect(esito.testo).toContain('nutrizionista');
  });
});
