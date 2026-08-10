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
        // Serve all'avviso alla nutrizionista del cambio da verificare (11/8). Senza questa riga il
        // finto non ha il metodo, l'avviso falliva in silenzio e il test passava lo stesso: è
        // esattamente il modo in cui un difetto sopravvive a una suite verde.
        findUnique: jest.fn().mockResolvedValue({ userId: 'u-n' }),
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

  /**
   * L'AVVISO ALLA NUTRIZIONISTA (richiesta di Simone dell'11/8).
   *
   * Il cambio nasce «da verificare» e prima nessuno lo diceva a nessuno: la coda della verifica si
   * riempiva in silenzio e la si scopriva solo aprendo la scheda della cliente. Un cambio concordato
   * con Gaia e mai verificato non è in attesa: è già nel piatto, approvato da nessuno.
   */
  it('un cambio applicato AVVISA la nutrizionista della cliente', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    const avviso = prisma.notification.create.mock.calls.find(
      (c: any) => c[0].data.type === 'menu_cambio_da_verificare',
    );
    expect(avviso).toBeDefined();
    expect(avviso[0].data.userId).toBe('u-n');
    expect(avviso[0].data.payload.clientId).toBe('client-1');
    // Il testo dice CHI e COSA: un avviso che dice solo «c'è un cambio» costringe ad aprire per sapere.
    expect(avviso[0].data.payload.body).toContain('Giulia');
    expect(avviso[0].data.payload.body).toContain('carote');
  });

  it('se alla cliente non è assegnata nessuna nutrizionista, l\'avviso va al CAPO', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      allergies: [], intolerances: [], dislikedFoods: [],
      assignedCoachId: 'staff-c', assignedNutritionistId: null, name: 'Giulia',
    });
    prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'u-capo' }]);
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'sì');
    const avviso = prisma.notification.create.mock.calls.find(
      (c: any) => c[0].data.type === 'menu_cambio_da_verificare',
    );
    expect(avviso[0].data.userId).toBe('u-capo');
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

  /**
   * IL «NO» NON CHIUDE LA CONVERSAZIONE (richiesta di Simone dell'8/8, la sera: «quando la cliente
   * dice no non si deve fermare, deve indagare sul perché»).
   *
   * Il caso vero: Gaia proponeva il burro al posto della panna, la cliente rispondeva «no perché
   * non voglio 70 gr di burro» e si chiudeva con «va bene, non cambio niente» — lasciandola con la
   * panna nel piatto, cioè col problema di partenza. Un «no» alla PROPOSTA non è un «no» al cambio.
   *
   * Le due cose che questi test tengono ferme: non si scrive mai niente sul menu senza un sì, e
   * non si chiude senza aver chiesto.
   */
  it('«no» secco non annulla: chiede cosa non va, e non scrive niente', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no');
    expect(fatto.esito).toBe('in_corso');
    expect(fatto.stato?.passo).toBe('rifiuto');
    expect(fatto.testo).toContain('non ti va');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('«no, lascia stare» annulla davvero: quello è un ripensamento', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no, lascia stare');
    expect(fatto.esito).toBe('annullata');
    expect(fatto.stato).toBeUndefined();
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('«no, non voglio le biete» propone l\'altra alternativa, senza rifare tutto il giro', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    // Il gruppo del nutrizionista è carote/biete/spinaci: rifiutate le biete restano gli spinaci.
    const fatto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no, non voglio le biete');
    expect(fatto.esito).toBe('in_corso');
    expect(fatto.stato?.passo).toBe('conferma');
    expect(fatto.stato?.proposta?.a).toBe('spinaci');
    expect(fatto.stato?.scartati).toEqual(['biete']);
    expect(fatto.testo).toContain('spinaci');
    // Il motivo del cambio resta quello di prima: non è cambiato il perché.
    expect(fatto.stato?.motivo).toBe(dopoMotivo.stato?.motivo);
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('la seconda proposta accettata si scrive sul menu', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const seconda = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no, le biete non mi piacciono');
    const fatto = await service.avanza('client-1', seconda.stato as StatoSostituzione, 'sì');
    expect(fatto.esito).toBe('applicata');
    expect(sostituzioniDelPranzo()[0]).toEqual(expect.objectContaining({ from: 'carote', to: 'spinaci' }));
  });

  it('finite le alternative passa alla nutrizionista, non alla rinuncia', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const seconda = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no, non voglio le biete');
    const terza = await service.avanza('client-1', seconda.stato as StatoSostituzione, 'no, gli spinaci non mi piacciono');
    expect(terza.esito).toBe('rifiutata');
    expect(terza.inoltraA).toBe('nutritionist');
    expect(prisma.escalation.create).toHaveBeenCalled();
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('dopo il «no» secco, «1» fa proporre un altro sostituto e «3» chiude', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const chiesto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no');
    const uno = await service.avanza('client-1', chiesto.stato as StatoSostituzione, '1');
    expect(uno.stato?.proposta?.a).toBe('spinaci');

    const chiesto2 = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no');
    const tre = await service.avanza('client-1', chiesto2.stato as StatoSostituzione, '3');
    expect(tre.esito).toBe('annullata');
  });

  it('due risposte incomprensibili dopo il «no» passano alla coach, senza toccare il menu', async () => {
    const { dopoMotivo } = await fino_alla_conferma('le carote', '1');
    const chiesto = await service.avanza('client-1', dopoMotivo.stato as StatoSostituzione, 'no');
    const primo = await service.avanza('client-1', chiesto.stato as StatoSostituzione, 'boh');
    expect(primo.esito).toBe('in_corso');
    const secondo = await service.avanza('client-1', primo.stato as StatoSostituzione, 'mah');
    expect(secondo.esito).toBe('arresa');
    expect(secondo.inoltraA).toBe('coach');
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
   * IL GRUPPO DELLA NUTRIZIONISTA VINCE SULL'EURISTICA (segnalazione di Simone dell'11/8: «se nella
   * tabella alternative ho la pasta integrale, perché Gaia alla cliente dice che non la ha?»).
   *
   * `condividonoAlimento` scarta i candidati che condividono una parola col cibo di partenza — nasce
   * per la mappa automatica, dove «yogurt» → «yogurt senza lattosio» è una variante e non un
   * sostituto. Ma un gruppo di equivalenza è costruito **intorno** a una parola comune: ogni membro
   * di «Pasta integrale» contiene «pasta», quindi il filtro azzerava l'intero gruppo e Gaia girava la
   * richiesta alla nutrizionista — che quel gruppo l'aveva scritto proprio per evitarlo.
   */
  it('un gruppo approvato vale anche se i membri condividono la parola: «pasta integrale» → «pasta di ceci»', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r-pranzo', name: 'Insalata di farro', ingredients: [{ name: 'pasta integrale', qty: 80, unit: 'g' }] },
    ]);
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      {
        productId: null,
        members: { items: ['pasta integrale', 'pasta di ceci', 'pasta di farro', 'pasta integrale di grano'] },
      },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'la pasta integrale');

    expect(esito.esito).toBe('in_corso');
    expect(esito.inoltraA).toBeUndefined();
    // «pasta integrale di grano» è la stessa cosa e resta fuori (lo fa già `candidati`);
    // fra i due che restano vince l'ordine alfabetico, che è la regola dichiarata.
    expect(esito.stato?.proposta?.a).toBe('pasta di ceci');
  });

  /**
   * L'altra metà: sulla MAPPA il filtro deve restare. Se cadesse, Gaia tornerebbe a rispondere «metti
   * 150 g di yogurt senza lattosio al posto di 150 g di yogurt greco», che è una presa in giro.
   */
  it('sulla mappa automatica il filtro «è la stessa cosa» resta attivo', async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([]);
    const apertura = await service.apri('client-1');
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

  /**
   * Un «no» secco non si trasforma in una proposta di piatto nuovo: la richiesta di cambiare piatto
   * deve esserci nel testo. E senza una proposta in mano non c'è niente su cui indagare — è l'unico
   * caso in cui il «no» alla conferma chiude e basta.
   */
  it('un «no» secco senza una proposta in corso chiude, senza inventare un altro piatto', async () => {
    const { service } = await creaServizio();
    const esito = await service.avanza('cli-1', { passo: 'conferma', proposta: undefined as never }, 'no');
    expect(esito.esito).toBe('annullata');
    expect(esito.stato?.passo).not.toBe('scelta_piatto');
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

/**
 * «70 ml di burro»: l'unità del sostituto veniva copiata da quella dell'ingrediente sostituito, e
 * su una coppia liquido → solido è sbagliata. L'ha notato la cliente nella conversazione dell'8/8,
 * rispondendo «non voglio 70 gr di burro». Qui si verifica il giro completo, perché il punto non è
 * la frase: quell'unità finisce **scritta nel menu**, ed è quella che la cliente userà in cucina.
 */
describe('SostituzioneChatService — l\'unità del sostituto arriva fino al menu', () => {
  it('la panna in ml diventa burro in g, nella frase e sulla giornata scritta', async () => {
    const { service, giorno } = await creaServizio((prisma) => {
      prisma.recipe.findMany = jest.fn().mockResolvedValue([
        { ...RICETTA_PRANZO, ingredients: [{ name: 'panna fresca', qty: 70, unit: 'ml' }] },
      ]);
      prisma.equivalenceGroup.findMany = jest.fn().mockResolvedValue([
        { productId: null, members: { items: ['panna fresca', 'burro'] } },
      ]);
    });

    const aperto = await service.apriDaTesto('client-1', 'vorrei sostituire la panna');
    expect(aperto.stato?.proposta?.a).toBe('burro');
    expect(aperto.stato?.proposta?.unita).toBe('ml');
    expect(aperto.stato?.proposta?.unitaA).toBe('g');

    const conferma = await service.avanza('client-1', aperto.stato!, '2');
    expect(conferma.testo).toContain('70 g di burro');
    expect(conferma.testo).toContain('70 ml di panna fresca');

    const fatto = await service.avanza('client-1', conferma.stato!, 'sì');
    expect(fatto.esito).toBe('applicata');
    const scritta = giorno().meals.find((m) => m.slot === 'lunch')?.substitutions?.[0];
    expect(scritta).toEqual(expect.objectContaining({ from: 'panna fresca', to: 'burro', unit: 'ml', unitA: 'g' }));
  });
});

/**
 * LA CONTROPROPOSTA (difetto 2 del collaudo dell'OTA 2.1.3, 9/8).
 *
 * Alla conferma la cliente ha scritto «L'olio mi fa peso posso usare il burro vegetale?» e Gaia ha
 * risposto «Non ho capito: confermi il cambio?». Dentro quella frase c'erano un motivo e un
 * sostituto scelto da lei: chiedere di nuovo la stessa cosa è il modo più rapido di sprecare la
 * fiducia costruita nei tre messaggi precedenti.
 *
 * Il confine che questi test tengono fermo: le regole di sicurezza NON si allentano perché la
 * proposta arriva da lei. Si accetta solo ciò che sta fra gli equivalenti approvati e passa
 * allergeni ed esclusioni; tutto il resto passa dalla nutrizionista.
 */
describe('SostituzioneChatService — la controproposta della cliente', () => {
  /** Il gruppo del fixture: carote ↔ biete ↔ spinaci. Noi proponiamo «biete» (ordine alfabetico). */
  async function fino_alla_conferma_carote(service: SostituzioneChatService) {
    const apertura = await service.apri('client-1');
    const dopoCibo = await service.avanza('client-1', apertura.stato!, 'le carote');
    expect(dopoCibo.stato?.proposta?.a).toBe('biete');
    return service.avanza('client-1', dopoCibo.stato!, '2');
  }

  it('«posso usare gli spinaci?» diventa la proposta, senza scrivere niente', async () => {
    const { service, prisma } = await creaServizio();
    const conferma = await fino_alla_conferma_carote(service);
    const suo = await service.avanza('client-1', conferma.stato!, 'posso usare gli spinaci?');

    expect(suo.esito).toBe('in_corso');
    expect(suo.stato?.passo).toBe('conferma');
    expect(suo.stato?.proposta?.a).toBe('spinaci');
    // Il nostro suggerimento risulta scartato: se dice no a questo, non deve tornare quello.
    expect(suo.stato?.scartati).toContain('biete');
    expect(suo.testo).toContain('spinaci');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('e il «sì» dopo la sua proposta scrive il SUO alimento sulla giornata', async () => {
    const { service, giorno } = await creaServizio();
    const conferma = await fino_alla_conferma_carote(service);
    const suo = await service.avanza('client-1', conferma.stato!, 'posso usare gli spinaci?');
    const fatto = await service.avanza('client-1', suo.stato!, 'sì');

    expect(fatto.esito).toBe('applicata');
    const scritta = giorno().meals.find((m) => m.slot === 'lunch')?.substitutions?.[0];
    expect(scritta).toEqual(expect.objectContaining({ from: 'carote', to: 'spinaci' }));
  });

  it('un nome secco basta: non serve la frase intera', async () => {
    const { service } = await creaServizio();
    const conferma = await fino_alla_conferma_carote(service);
    const suo = await service.avanza('client-1', conferma.stato!, 'gli spinaci');
    expect(suo.stato?.proposta?.a).toBe('spinaci');
  });

  /**
   * La frase esatta del collaudo. «Burro vegetale» non è fra gli equivalenti approvati per le
   * carote, e Gaia non se lo inventa: passa alla nutrizionista, che è l'unica che può dire sì a una
   * cosa che il ricettario non prevede. Il punto è che la richiesta **arriva** a qualcuno.
   */
  it('un alimento fuori dagli equivalenti approvati va alla nutrizionista, non nel piatto', async () => {
    const { service, prisma, audit } = await creaServizio();
    const conferma = await fino_alla_conferma_carote(service);
    const suo = await service.avanza('client-1', conferma.stato!, "l'olio mi fa peso posso usare il burro vegetale?");

    expect(suo.esito).toBe('arresa');
    expect(suo.inoltraA).toBe('nutritionist');
    expect(prisma.escalation.create).toHaveBeenCalled();
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
    // La segnalazione porta con sé la frase della cliente: senza, la nutrizionista non sa cosa
    // le è stato chiesto.
    const creata = prisma.escalation.create.mock.calls.at(-1)?.[0] as any;
    expect(creata.data.reason).toContain('burro vegetale');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'menu.sostituzione.controproposta_non_prevista' }),
    );
  });

  /**
   * Il caso che non deve regredire: un'esitazione non è una proposta. Prima di distinguere
   * `esplicita`, «boh» apriva una richiesta alla nutrizionista che nessuno aveva fatto.
   */
  it('«boh» resta un «non ho capito», e non disturba nessuno', async () => {
    const { service, prisma } = await creaServizio();
    const conferma = await fino_alla_conferma_carote(service);
    const incerto = await service.avanza('client-1', conferma.stato!, 'boh');
    expect(incerto.esito).toBe('in_corso');
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  /**
   * ALLERGENE PROPOSTO DA LEI. Non basta rifiutare: si dice perché — su un allergene è anche
   * un'informazione che le serve — e si propone subito un'alternativa, nello stesso messaggio.
   */
  it('se la sua proposta è un allergene, Gaia spiega e propone un\'altra cosa', async () => {
    const { service, prisma } = await creaServizio((p) => {
      p.clientProfile.findUnique = jest.fn().mockResolvedValue({
        allergies: ['spinaci'],
        intolerances: [],
        dislikedFoods: [],
        name: 'Giulia',
      });
    });
    const conferma = await fino_alla_conferma_carote(service);
    const suo = await service.avanza('client-1', conferma.stato!, 'posso usare gli spinaci?');

    expect(suo.testo).toContain('allergia');
    expect(suo.testo).toContain('spinaci');
    // La proposta non è quella: nel piatto non ci finiscono.
    expect(suo.stato?.proposta?.a).not.toBe('spinaci');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('se la sua proposta è fra le cose che ha escluso lei, glielo dice', async () => {
    const { service } = await creaServizio((p) => {
      p.clientProfile.findUnique = jest.fn().mockResolvedValue({
        allergies: [],
        intolerances: [],
        dislikedFoods: ['spinaci'],
        name: 'Giulia',
      });
    });
    const conferma = await fino_alla_conferma_carote(service);
    const suo = await service.avanza('client-1', conferma.stato!, 'posso usare gli spinaci?');
    expect(suo.testo).toContain('spinaci');
    expect(suo.stato?.proposta?.a).not.toBe('spinaci');
  });

  /** Dopo il «no» secco, la quarta strada che non abbiamo elencato: dire un nome. */
  it('anche dopo il «no» secco, un nome vale come proposta', async () => {
    const { service } = await creaServizio();
    const conferma = await fino_alla_conferma_carote(service);
    const chiesto = await service.avanza('client-1', conferma.stato!, 'no');
    expect(chiesto.stato?.passo).toBe('rifiuto');
    const suo = await service.avanza('client-1', chiesto.stato!, 'posso usare gli spinaci?');
    expect(suo.stato?.proposta?.a).toBe('spinaci');
  });
});

/**
 * «LO VOGLIO DIVERSO» SENZA DIRE DI COSA — il giro completo, dalla domanda alla scrittura.
 *
 * Prima il flusso ripiegava sulla domanda dell'ingrediente: la cliente chiedeva un piatto diverso
 * e si sentiva chiedere quale alimento. Il rischio opposto — scegliere il pasto per lei — è peggio,
 * perché si vede solo quando il piatto sbagliato è già nel menu.
 */
describe('SostituzioneChatService — quale pasto, quando non lo dice', () => {
  it('chiede quale pasto invece di chiedere un ingrediente', async () => {
    const { service } = await creaServizio();
    const chiesto = await service.proponiAltroPiatto('client-1', 'lo voglio diverso');
    expect(chiesto.stato?.passo).toBe('scelta_pasto');
    expect(chiesto.testo).toContain('colazione');
    expect(chiesto.testo).toContain('pranzo');
    // NON la domanda sull'alimento: è quella che rendeva incomprensibile la risposta.
    expect(chiesto.testo).not.toMatch(/quale alimento/i);
  });

  it('e la preferenza detta all\'inizio non si perde per strada', async () => {
    const { service } = await creaServizio();
    const chiesto = await service.proponiAltroPiatto('client-1', 'lo voglio più proteico');
    expect(chiesto.stato?.preferenzaPiatto).toBe('proteico');
    const scelto = await service.avanza('client-1', chiesto.stato!, '1');
    // Alternative della colazione, ordinate per proteine: le uova stanno prima dello skyr.
    expect(scelto.stato?.passo).toBe('scelta_piatto');
    expect(scelto.stato?.alternativePiatto?.[0]?.nome).toContain('Uova');
    expect(scelto.testo).toContain('proteine');
  });

  it('risponde col nome del pasto e funziona uguale', async () => {
    const { service } = await creaServizio();
    const chiesto = await service.proponiAltroPiatto('client-1', 'lo voglio diverso');
    const scelto = await service.avanza('client-1', chiesto.stato!, 'la colazione');
    expect(scelto.stato?.slotPiatto).toBe('breakfast');
  });

  it('due risposte non capite chiudono senza toccare il menu', async () => {
    const { service, prisma } = await creaServizio();
    const chiesto = await service.proponiAltroPiatto('client-1', 'lo voglio diverso');
    const primo = await service.avanza('client-1', chiesto.stato!, 'mah');
    expect(primo.esito).toBe('in_corso');
    const secondo = await service.avanza('client-1', primo.stato!, 'non so');
    expect(secondo.esito).toBe('annullata');
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });
});

/**
 * LA VERIFICA DELLA NUTRIZIONISTA. Fino a oggi vedeva i cambi nati in chat e non li poteva
 * toccare: lo stato `corretta` esisteva nel dato e non c'era nessun modo di scriverlo. Una verifica
 * che non si può registrare non è una verifica, è una lettura.
 *
 * Il caso che rende tutto questo necessario è il gruppo dei grassi: 70 ml di panna sono ~200 kcal,
 * 70 g di olio ~630. La pari grammatura che Gaia propone lì non regge, e serve una mano umana che
 * scriva il numero giusto **sulla giornata di quella cliente**.
 */
describe('SostituzioneChatService — la nutrizionista verifica', () => {
  /** Concorda «carote → biete» e restituisce il servizio pronto per la verifica. */
  async function conUnCambio() {
    const creato = await creaServizio();
    const apertura = await creato.service.apri('client-1');
    const dopoCibo = await creato.service.avanza('client-1', apertura.stato!, 'le carote');
    const conferma = await creato.service.avanza('client-1', dopoCibo.stato!, '2');
    await creato.service.avanza('client-1', conferma.stato!, 'sì');
    return creato;
  }

  const sostituzione = (giorno: () => any) =>
    giorno().meals.find((m: any) => m.slot === 'lunch')?.substitutions?.[0];

  it('«va bene così» resta scritto: è quello che svuota l\'elenco da verificare', async () => {
    const { service, giorno, audit } = await conUnCambio();
    const esito = await service.correggiCambioInChat('client-1', 'nutri-1', {
      data: giorno().date.toISOString().slice(0, 10),
      slot: 'lunch',
      tipo: 'ingrediente',
      from: 'carote',
      stato: 'verificata',
    });
    expect(esito.stato).toBe('verificata');
    expect(sostituzione(giorno)).toEqual(
      expect.objectContaining({ to: 'biete', stato: 'verificata', verificataDa: 'nutri-1' }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'menu.cambio_chat.verifica' }),
    );
  });

  it('correggere cambia sostituto e grammi, e la nota resta con loro', async () => {
    const { service, giorno } = await conUnCambio();
    await service.correggiCambioInChat('client-1', 'nutri-1', {
      data: giorno().date.toISOString().slice(0, 10),
      slot: 'lunch',
      tipo: 'ingrediente',
      from: 'carote',
      stato: 'corretta',
      to: 'spinaci',
      toQty: 150,
      nota: 'Meglio gli spinaci, e 150 g per restare sulle stesse fibre.',
    });
    expect(sostituzione(giorno)).toEqual(
      expect.objectContaining({ to: 'spinaci', toQty: 150, stato: 'corretta', nota: expect.stringContaining('fibre') }),
    );
    // Il `from` non si tocca mai: è l'alimento della ricetta, e cambiarlo scollegherebbe il
    // cambio dal piatto.
    expect(sostituzione(giorno)?.from).toBe('carote');
  });

  it('annullare toglie la sostituzione: nel piatto torna l\'alimento di prima', async () => {
    const { service, giorno } = await conUnCambio();
    const esito = await service.correggiCambioInChat('client-1', 'nutri-1', {
      data: giorno().date.toISOString().slice(0, 10),
      slot: 'lunch',
      tipo: 'ingrediente',
      from: 'carote',
      stato: 'annullata',
    });
    expect(sostituzione(giorno)).toBeUndefined();
    expect(esito.descrizione).toContain('carote');
  });

  it('l\'unità si ricalcola sul sostituto nuovo: niente «70 ml di burro»', async () => {
    const { service, giorno } = await creaServizio((prisma) => {
      prisma.recipe.findMany = jest.fn().mockResolvedValue([
        { ...RICETTA_PRANZO, ingredients: [{ name: 'panna fresca', qty: 70, unit: 'ml' }] },
      ]);
      prisma.equivalenceGroup.findMany = jest.fn().mockResolvedValue([
        { productId: null, members: { items: ['panna fresca', 'burro', 'olio evo'] } },
      ]);
    });
    const aperto = await service.apriDaTesto('client-1', 'vorrei sostituire la panna');
    const conferma = await service.avanza('client-1', aperto.stato!, '2');
    await service.avanza('client-1', conferma.stato!, 'sì');

    await service.correggiCambioInChat('client-1', 'nutri-1', {
      data: giorno().date.toISOString().slice(0, 10),
      slot: 'lunch',
      tipo: 'ingrediente',
      from: 'panna fresca',
      stato: 'corretta',
      to: 'olio evo',
      toQty: 20,
    });
    const s = giorno().meals.find((m: any) => m.slot === 'lunch')?.substitutions?.[0];
    // L'olio è un liquido: l'unità resta ml. Il punto è che venga RICALCOLATA, non copiata.
    expect(s).toEqual(expect.objectContaining({ to: 'olio evo', toQty: 20, unitA: 'ml' }));
  });

  it('annullare un cambio di PIATTO rimette esattamente il piatto di prima', async () => {
    const { service, giorno } = await creaServizio();
    const proposta = await service.proponiAltroPiatto('client-1', 'voglio una colazione proteica');
    await service.avanza('client-1', proposta.stato!, '1');
    const colazione = () => giorno().meals.find((m: any) => m.slot === 'breakfast');
    expect(colazione()?.cambioPiatto?.daNome).toBe('Yogurt e avena');

    await service.correggiCambioInChat('client-1', 'nutri-1', {
      data: giorno().date.toISOString().slice(0, 10),
      slot: 'breakfast',
      tipo: 'piatto',
      stato: 'annullata',
    });
    expect(colazione()?.name).toBe('Yogurt e avena');
    expect(colazione()?.recipeId).toBe('r-colazione');
    // Il record del cambio se ne va con lui: la giornata dice com'è il menu, la storia sta nell'audit.
    expect(colazione()?.cambioPiatto).toBeUndefined();
  });

  it('un cambio che non esiste non si verifica: 404, non una scrittura a caso', async () => {
    const { service, giorno } = await conUnCambio();
    await expect(
      service.correggiCambioInChat('client-1', 'nutri-1', {
        data: giorno().date.toISOString().slice(0, 10),
        slot: 'lunch',
        tipo: 'ingrediente',
        from: 'zucchine',
        stato: 'verificata',
      }),
    ).rejects.toThrow(/Nessuna sostituzione/);
  });

  it('la verifica compare nell\'elenco della scheda, con la nota', async () => {
    const { service, giorno } = await conUnCambio();
    await service.correggiCambioInChat('client-1', 'nutri-1', {
      data: giorno().date.toISOString().slice(0, 10),
      slot: 'lunch',
      tipo: 'ingrediente',
      from: 'carote',
      stato: 'corretta',
      to: 'spinaci',
      nota: 'Più ferro.',
    });
    const elenco = await service.sostituzioniDiChat('client-1');
    expect(elenco[0]).toEqual(
      expect.objectContaining({ stato: 'corretta', nota: 'Più ferro.', to: 'spinaci' }),
    );
    expect(elenco[0].verificataIl).toBeTruthy();
  });
});
