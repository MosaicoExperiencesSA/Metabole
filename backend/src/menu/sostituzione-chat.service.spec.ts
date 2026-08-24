/**
 * ⚠️ **«OGGI» SI CHIEDE, ANCHE NEI TEST — corretto il 20/8 alle 00:02.**
 *
 * Qui il giorno si ricavava da `new Date().toISOString().slice(0, 10)`, cioè il giorno **UTC**,
 * mentre il codice risponde col giorno di **Roma**. Fra mezzanotte e le 02:00 italiane le due
 * risposte differiscono di un giorno e questi test diventavano rossi.
 *
 * ⛔ Cioè la suite era **verde 22 ore su 24 e rossa 2**, e nessuno l'avrebbe scoperto se non
 * lanciandola all'una di notte — che è quello che è successo. Un test che si ricalcola da sé la
 * cosa che sta verificando non la verifica: la ripete, e quando il codice cambia fuso il test resta
 * indietro **senza dirlo**.
 */
import { Test } from '@nestjs/testing';
import { giornoLocale } from '../common/date-only';
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
const oggiIso = () => giornoLocale(OGGI);

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

  /**
   * ⛔ **L'APERTURA È CAMBIATA IL 24/8** (Simone: «questa domanda non funziona, Gaia si perde»).
   * Prima era una domanda sola con tutta la giornata incollata sotto e «scrivimi il nome
   * dell'alimento»; adesso è una domanda per volta, numerata. Qui la cliente vede **un solo giorno**,
   * quindi la domanda uno non si fa: si parte dal pasto.
   */
  it('apre chiedendo di quale PASTO parliamo, coi pasti numerati', async () => {
    const esito = await service.apri('client-1');
    expect(esito.esito).toBe('aperto');
    expect(esito.stato?.passo).toBe('pasto');
    expect(esito.testo).toContain('1) Colazione — Yogurt e avena');
    expect(esito.testo).toContain('2) Pranzo — Insalata di farro');
    expect(esito.testo).toContain('Rispondi col numero');
  });

  it('e col numero del pasto arriva l\'elenco degli alimenti, numerato', async () => {
    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato as StatoSostituzione, '2');
    expect(dopo.stato?.passo).toBe('cibo');
    expect(dopo.testo).toContain('«Insalata di farro»');
    expect(dopo.testo).toContain('1) farro');
    expect(dopo.stato?.cibiPerScelta).toContain('carote');
  });

  /**
   * ⛔ **E il numero dell'alimento chiude il giro**: è la parte che prima non c'era, e per cui la
   * cliente doveva scrivere a mano una parola fra quindici.
   */
  it('⛔ «2» sull\'elenco degli alimenti sceglie il secondo, senza scrivere niente', async () => {
    const apertura = await service.apri('client-1');
    const dopoPasto = await service.avanza('client-1', apertura.stato as StatoSostituzione, '2');
    const dopoCibo = await service.avanza('client-1', dopoPasto.stato as StatoSostituzione, '2');
    expect(dopoCibo.stato?.proposta?.da).toBe('carote');
    expect(dopoCibo.stato?.passo).toBe('motivo');
  });

  /**
   * ⚠️ **Le parole continuano a funzionare**: i numeri sono la strada facile, non l'unica. Chi
   * scrive «le carote» salta la domanda del pasto — ha già detto quello che vuole.
   */
  it('⚠️ chi risponde a parole va avanti come prima', async () => {
    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'le carote');
    expect(dopo.stato?.proposta?.da).toBe('carote');
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

  /**
   * ⚠️ Dal 24/8 non si ripete «scrivimi il nome dell'alimento» a chi ha appena scritto una frase che
   * non abbiamo capito: si passa alle domande a numeri, che sono fatte apposta per lei.
   */
  it('se dal testo l\'alimento non si capisce, si passa alle domande a numeri', async () => {
    const esito = await service.apriDaTesto('client-1', 'vorrei sostituire qualcosa');
    expect(esito.stato?.passo).toBe('pasto');
    expect(esito.testo).toContain('1) Colazione');
  });

  it('⚠️ e se aveva nominato il pasto si salta anche quella domanda: elenco degli alimenti', async () => {
    const esito = await service.apriDaTesto('client-1', 'vorrei cambiare qualcosa a pranzo');
    expect(esito.stato?.passo).toBe('cibo');
    expect(esito.testo).toContain('«Insalata di farro»');
    expect(esito.testo).toContain('1) farro');
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

  /**
   * ⚠️ **Il nome del piatto adesso è una risposta buona al passo del pasto**: dal 24/8 «insalata»
   * non è più un equivoco da spiegare — è il modo in cui una persona indica il pranzo, e le si
   * risponde con gli alimenti di quel piatto. Il vecchio messaggio «è il nome del piatto» resta al
   * passo dell'alimento, dove serve ancora (il test qui sotto).
   */
  it('al passo del pasto, il nome del piatto porta ai suoi alimenti', async () => {
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'insalata');
    expect(esito.stato?.passo).toBe('cibo');
    expect(esito.testo).toContain('«Insalata di farro»');
  });

  it('al passo dell\'ALIMENTO, se scrive il nome del piatto glielo spiega, invece di arrendersi', async () => {
    const esito = await service.avanza(
      'client-1',
      { passo: 'cibo', tentativi: 0, data: oggiIso() } as StatoSostituzione,
      'insalata',
    );
    expect(esito.esito).toBe('in_corso');
    expect(esito.testo).toContain('è il nome del piatto');
    expect(esito.stato?.passo).toBe('cibo');
  });

  /**
   * ⚠️ Si parte dal passo dell'ALIMENTO: al passo del pasto due risposte non capite non passano più
   * alla coach ma ripiegano sulla domanda a parole (24/8) — la mano si passa qui, dove la cliente ha
   * già davanti l'elenco e continua a non farsi capire.
   */
  it('dopo due tentativi a vuoto passa la mano alla coach', async () => {
    const apertura = { stato: { passo: 'cibo', tentativi: 0, data: oggiIso() } as StatoSostituzione };
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
   * ⚠️ E L'ALTRA META ANCORA: IL CIBO CHE HA NOMINATO LEI NON TORNA INDIETRO — caso Jolanda, 17/8.
   *
   * Ha scritto «sostituisci a pranzo i ceci» e Gaia le ha risposto «metti 200 g di ceci secchi al
   * posto di 200 g di ceci cotti in scatola». È il rovescio esatto della correzione qui sopra: da
   * quando il filtro delle parole condivise vale solo per la mappa, un gruppo può restituire una
   * preparazione diversa dello **stesso** alimento. E la rete di `candidati` non la prende, perché
   * pretende che ogni parola combaci e «secchi» non sta dentro «cotti in scatola».
   *
   * Il confronto giusto è con la parola che ha scritto LEI, non col nome in ricetta: ha detto
   * «ceci», e il sostituto non può essere un cece. Il caso della pasta qui sopra non si muove,
   * perché lì aveva scritto «pasta integrale» e «pasta di ceci» non lo combacia.
   */
  it('⚠️ «i ceci» non si sostituiscono con altri ceci, nemmeno dentro un gruppo approvato', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r-pranzo', name: 'Insalata di ceci con feta', ingredients: [{ name: 'ceci cotti in scatola', qty: 200, unit: 'g' }] },
    ]);
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['ceci cotti in scatola', 'ceci secchi', 'lenticchie'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'i ceci');

    expect(esito.esito).toBe('in_corso');
    expect(esito.stato?.proposta?.a).toBe('lenticchie');
  });

  it('⚠️ se nel gruppo ci sono SOLO altri ceci, si dice che non c\'è alternativa invece di girarci intorno', async () => {
    // Fra i due errori possibili — «non ho un\'alternativa che mi convinca», che passa la palla
    // alla coach, e «ti do lo stesso cibo con un\'altra preparazione» — il secondo è quello che
    // insegna a una cliente che non l\'abbiamo ascoltata. Si sceglie sempre il primo.
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r-pranzo', name: 'Insalata di ceci con feta', ingredients: [{ name: 'ceci cotti in scatola', qty: 200, unit: 'g' }] },
    ]);
    prisma.equivalenceGroup.findMany.mockResolvedValue([
      { productId: null, members: { items: ['ceci cotti in scatola', 'ceci secchi', 'ceci in barattolo'] } },
    ]);
    const apertura = await service.apri('client-1');
    const esito = await service.avanza('client-1', apertura.stato as StatoSostituzione, 'i ceci');

    expect(esito.esito).toBe('rifiutata');
    expect(esito.inoltraA).toBe('nutritionist');
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

/**
 * LA CONVERSAZIONE DEL 12/8, quella girata da Simone.
 *
 * Gaia elenca i piatti, la cliente scrive «Voglio cambiare il menu di oggi **a pranzo** con verdura
 * cruda e tonno al naturale», e Gaia risponde parlando della **cena** perché ha trovato «cruda»
 * dentro la «quinoa cruda». Tre difetti in una riga: l'aggettivo scambiato per un cibo, il pasto
 * nominato ignorato, e la risposta data lo stesso invece di dire «non ho capito».
 */
describe('SostituzioneChatService — ascoltare meglio (12/8)', () => {
  it('⚠️ non risponde più del pasto sbagliato: il pasto intero apre il BIVIO', async () => {
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1');
    const risposta = await service.avanza(
      'client-1',
      apertura.stato!,
      'Voglio cambiare il menu di oggi a pranzo con verdura cruda e tonno al naturale',
    );

    // Non parla di colazione né propone un sostituto: chiede quale delle due strade vuole.
    expect(risposta.stato?.passo).toBe('pasto_intero');
    expect(risposta.testo).toContain('tutto il pasto');
    expect(risposta.testo).toContain('a pranzo'); // il pasto che aveva nominato LEI
    expect(risposta.testo).toContain('1)');
    expect(risposta.testo).toContain('2)');
    expect(risposta.testo).not.toContain('Yogurt e avena');
  });

  it('«1» passa alla nutrizionista, con il testo che aveva scritto', async () => {
    const { service, prisma } = await creaServizio();
    const apertura = await service.apri('client-1');
    const bivio = await service.avanza('client-1', apertura.stato!, 'voglio cambiare il pranzo con insalata e tonno');
    const esito = await service.avanza('client-1', bivio.stato!, '1');

    expect(esito.inoltraA).toBe('nutritionist');
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: expect.stringContaining('insalata e tonno') }),
      }),
    );
  });

  it('«2» fa proporre a Gaia un\'alternativa dal ricettario, a pari calorie', async () => {
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1');
    // Il bivio sulla COLAZIONE, che è lo slot per cui il finto catalogo ha delle alternative.
    const bivio = await service.avanza('client-1', apertura.stato!, 'voglio cambiare la colazione con pane e marmellata');
    expect(bivio.stato?.passo).toBe('pasto_intero');

    // Dal 14/8 sulla colazione senza preferenza c'è prima «dolce o salata?» (richiesta di Simone).
    const gusto = await service.avanza('client-1', bivio.stato!, '2');
    expect(gusto.stato?.passo).toBe('colazione_gusto');
    const esito = await service.avanza('client-1', gusto.stato!, 'fa lo stesso');
    expect(esito.stato?.passo).toBe('scelta_piatto');
    // Alternative vere, dal pool approvato per lei, non il piatto che aveva già.
    expect(esito.testo).toMatch(/Uova strapazzate|Skyr/);
    expect(esito.stato?.alternativePiatto?.some((a) => a.recipeId === 'r-colazione')).toBe(false);
  });

  it('a una risposta che non c\'entra dice «non ho capito» e RIPETE la domanda', async () => {
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1');
    const domanda = apertura.testo;

    const risposta = await service.avanza('client-1', apertura.stato!, 'boh vedi tu quello che ti sembra meglio');

    expect(risposta.testo).toContain('non ho capito');
    // Identica, non riscritta: chi non aveva capito rilegge, e un testo diverso lo confonde.
    expect(risposta.testo).toContain(domanda);
  });

  /**
   * ⚠️ **Dal 24/8 chi nomina il pasto non si sente più dire «non ho capito»**: «a pranzo qualcosa
   * che non ricordo» è una risposta che il pasto lo dice eccome, e la si prende — arriva l'elenco
   * numerato degli alimenti di quel piatto, che è esattamente quello che «non ricordo» chiedeva.
   * La domanda mirata ripetuta resta al passo dell'alimento (il test qui sotto).
   */
  it('chi nomina il pasto riceve gli alimenti di QUEL pasto, non un «non ho capito»', async () => {
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1');
    const risposta = await service.avanza('client-1', apertura.stato!, 'a pranzo qualcosa che non ricordo');

    expect(risposta.stato?.passo).toBe('cibo');
    expect(risposta.testo).toContain('Insalata di farro');
    expect(risposta.testo).toContain('1) farro');
    expect(risposta.testo).not.toContain('Yogurt e avena');
  });

  it('e al passo dell\'ALIMENTO, se aveva nominato un pasto, ripete la domanda MIRATA su quel pasto', async () => {
    const { service } = await creaServizio();
    const risposta = await service.avanza(
      'client-1',
      { passo: 'cibo', tentativi: 0, data: oggiIso() } as StatoSostituzione,
      'a pranzo qualcosa che non ricordo',
    );

    expect(risposta.testo).toContain('non ho capito');
    expect(risposta.testo).toContain('Insalata di farro'); // il piatto del pranzo
    expect(risposta.testo).toContain('farro, carote, olio evo'); // i suoi ingredienti
    expect(risposta.testo).not.toContain('Yogurt e avena');
  });

  it('il pasto nominato restringe davvero: «a pranzo, le carote» non guarda la colazione', async () => {
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1');
    const risposta = await service.avanza('client-1', apertura.stato!, 'a pranzo vorrei togliere le carote');
    expect(risposta.stato?.proposta?.slot).toBe('lunch');
    expect(risposta.stato?.proposta?.da).toBe('carote');
  });
});

/**
 * ⛔ **LE TRE DOMANDE A NUMERI** — Simone, 24/8, guardando una chat vera: *«questa domanda non
 * funziona, Gaia si perde, miglioriamola così: (domanda uno) su quale menu vuoi lavorare? 1 oggi
 * 2 domani 3 dopodomani (ovviamente in base a quanti ne vede); (domanda due) di quale pasto
 * parliamo? 1 Colazione 2 spuntino… (anche qui in funzione del numero di pasti); e con lo stesso
 * principio mettiamo l'elenco dei cibi, in modo che la cliente scriva dei numeri»*.
 *
 * Il difetto era di forma, ma costava conversazioni: una domanda sola, tutta la giornata incollata
 * sotto («colazione: … · pranzo: … · cena: …») e la richiesta di **scrivere a mano** il nome di uno
 * fra quindici alimenti. Una parola sbagliata e si ricominciava; alla seconda si passava alla coach.
 */
describe('SostituzioneChatService — le tre domande a numeri (24/8)', () => {
  const piu = (n: number) => {
    const d = new Date(`${oggiIso()}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  };
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  /** Tre giornate visibili, ognuna coi suoi pasti: è il caso dell'esempio di Simone. */
  async function conTreGiorni(pastiPerGiorno?: MealSnapshot[][]) {
    const giorni = [0, 1, 2].map((n) => ({
      id: `day-${n}`,
      date: piu(n),
      dietId: 'diet-onnivora',
      meals: (pastiPerGiorno?.[n] ?? pastiDiOggi).map((m) => ({ ...m })),
    }));
    const creato = await creaServizio((prisma: any) => {
      prisma.menuDay.findMany = jest.fn().mockResolvedValue(giorni);
      prisma.menuDay.findFirst = jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(giorni.find((g) => iso(g.date) === iso(where.date)) ?? null));
    });
    return creato;
  }

  /**
   * ⛔ **«In base a quanti ne vede»** (Simone). La query che decide l'elenco dei giorni è l'unica
   * cosa che tiene quella promessa, e la revisione del 25/8 ha misurato che nessun test la copriva:
   * i finti rispondevano sempre le stesse giornate, qualunque `where`. Qui il finto **onora il
   * where**, e le tre condizioni si vedono una per una.
   */
  it('⛔ propone solo le giornate VISIBILI, non passate e con dei pasti dentro', async () => {
    const dentro = { id: 'ok', date: piu(1), dietId: 'd', meals: pastiDiOggi, visibleFrom: piu(-1) };
    const tutte = [
      { id: 'ieri', date: piu(-1), dietId: 'd', meals: pastiDiOggi, visibleFrom: piu(-2) },
      dentro,
      { id: 'nonvisibile', date: piu(2), dietId: 'd', meals: pastiDiOggi, visibleFrom: piu(2) },
      { id: 'vuota', date: piu(2), dietId: 'd', meals: [], visibleFrom: piu(-1) },
      { id: 'lontana', date: piu(9), dietId: 'd', meals: pastiDiOggi, visibleFrom: piu(-1) },
    ];
    const { service } = await creaServizio((prisma: any) => {
      prisma.menuDay.findMany = jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(tutte.filter((g) =>
          g.date >= where.date.gte && g.date <= where.date.lte && g.visibleFrom <= where.visibleFrom.lte)));
      prisma.menuDay.findFirst = jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(tutte.find((g) => iso(g.date) === iso(where.date) && g.meals.length) ?? null));
    });

    const apertura = await service.apri('client-1');
    // Resta una sola giornata proponibile: la domanda uno non si fa nemmeno, si va al pasto.
    expect(apertura.stato?.passo).toBe('pasto');
    expect(apertura.stato?.data).toBe(iso(piu(1)));
    expect(apertura.testo).toContain('per il menu di domani');
  });

  it('domanda uno: i giorni che vede, numerati', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    expect(apertura.stato?.passo).toBe('giorno');
    expect(apertura.testo).toContain('Su quale menu vuoi lavorare?');
    expect(apertura.testo).toContain('1) oggi');
    expect(apertura.testo).toContain('2) domani');
    expect(apertura.testo).toContain('3) dopodomani');
  });

  it('«2» sceglie domani, e la conversazione si porta dietro quella data', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato!, '2');
    expect(dopo.stato?.data).toBe(iso(piu(1)));
    expect(dopo.stato?.passo).toBe('pasto');
    expect(dopo.testo).toContain('per il menu di domani');
  });

  it('⚠️ e le parole funzionano lo stesso: «dopodomani» vale come «3»', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato!, 'dopodomani');
    expect(dopo.stato?.data).toBe(iso(piu(2)));
  });

  /**
   * ⛔ **Un giorno che non ha non si prende per buono.** «Fra una settimana» il menu non c'è ancora:
   * portarla avanti su una giornata vuota vorrebbe dire farle scegliere un pasto che non esiste, e
   * scoprirlo due domande dopo.
   */
  it('⛔ un giorno FUORI dall\'elenco non passa: si ripete la domanda', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    // Un giorno della settimana che cade **oltre** i tre proposti: riconosciuto come giorno, ma il
    // menu non c'è. È il caso che conta — «fra una settimana» non lo capirebbe nessuno dei due, e
    // un test che passa comunque non protegge niente.
    const nomeGiorni = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
    const oltre = new Date(`${oggiIso()}T00:00:00.000Z`).getUTCDay();
    const dopo = await service.avanza('client-1', apertura.stato!, nomeGiorni[(oltre + 4) % 7]);
    expect(dopo.stato?.passo).toBe('giorno');
    expect(dopo.testo).toContain('non ho capito');
  });

  /**
   * ⚠️ **Alla seconda risposta non capita si va avanti sul primo giorno**, invece di arrendersi:
   * quasi sempre è oggi, ed è la giornata che sta guardando. Passare alla coach una cliente che
   * voleva togliere le carote perché non ha scritto «1» sarebbe sproporzionato.
   */
  it('⚠️ due risposte non capite non passano alla coach: si prosegue sul primo giorno', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    const primo = await service.avanza('client-1', apertura.stato!, 'zzzqqq');
    const secondo = await service.avanza('client-1', primo.stato!, 'wwwkkk');
    expect(secondo.stato?.passo).toBe('pasto');
    expect(secondo.stato?.data).toBe(oggiIso());
  });

  /**
   * ⛔ **Una domanda con una risposta sola non si fa.** Se quel giorno ha un pasto solo, si salta
   * direttamente agli alimenti: un passaggio in più prima della domanda vera è l'attrito che fa
   * abbandonare la chat.
   */
  it('⛔ con un pasto solo si salta la domanda due', async () => {
    const solaCena: MealSnapshot[] = [{ slot: 'lunch', recipeId: 'r-pranzo', name: 'Insalata di farro', kcal: 500 }];
    const { service } = await conTreGiorni([solaCena, solaCena, solaCena]);
    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato!, '1');
    expect(dopo.stato?.passo).toBe('cibo');
    expect(dopo.testo).toContain('1) farro');
  });

  /**
   * ⛔ **IL NUMERO SI RISOLVE DENTRO IL PASTO SCELTO, non cercando il nome nella giornata** —
   * rilievo della revisione del 25/8, il più grave. Con l'olio evo (o il pane, o i pomodorini) in
   * due pasti, il «3» scelto sull'elenco del pranzo faceva scrivere la sostituzione **sulla
   * colazione**: alla conferma la cliente si vedeva cambiare un piatto di cui non si parlava.
   */
  it('⛔ con lo stesso alimento in due pasti, il numero cambia quello del pasto SCELTO', async () => {
    const duePasti: MealSnapshot[] = [
      { slot: 'breakfast', recipeId: 'r-col-carote', name: 'Pane e carote', kcal: 300 },
      { slot: 'lunch', recipeId: 'r-pranzo', name: 'Insalata di farro', kcal: 500 },
    ];
    const giorni = [0, 1, 2].map((n) => ({ id: `day-${n}`, date: piu(n), dietId: 'diet-onnivora', meals: duePasti.map((m) => ({ ...m })) }));
    const { service } = await creaServizio((prisma: any) => {
      prisma.menuDay.findMany = jest.fn().mockResolvedValue(giorni);
      prisma.menuDay.findFirst = jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(giorni.find((g) => iso(g.date) === iso(where.date)) ?? null));
      const originale = prisma.recipe.findMany;
      prisma.recipe.findMany = jest.fn().mockImplementation(async (args: any) => {
        const dal = await originale(args);
        const chiede = (args?.where?.id?.in ?? null) as string[] | null;
        if (!chiede || !chiede.includes('r-col-carote')) return dal;
        return [
          ...dal,
          {
            id: 'r-col-carote', name: 'Pane e carote', mealSlot: 'breakfast', kcal: 300,
            macros: { protein_g: 8 }, difficulty: 'semplice',
            ingredients: [{ name: 'pane', qty: 60, unit: 'g' }, { name: 'carote', qty: 30, unit: 'g' }],
          },
        ];
      });
    });

    const apertura = await service.apri('client-1');
    const dopoGiorno = await service.avanza('client-1', apertura.stato!, '1');
    const dopoPasto = await service.avanza('client-1', dopoGiorno.stato!, '2'); // il PRANZO
    expect(dopoPasto.stato?.cibiPerScelta).toEqual(['farro', 'carote', 'olio evo']);
    const dopoCibo = await service.avanza('client-1', dopoPasto.stato!, '2'); // le carote del pranzo

    expect(dopoCibo.stato?.proposta?.slot).toBe('lunch');
    expect(dopoCibo.stato?.proposta?.qtaDa).toBe(100); // quelle del pranzo, non i 30 g della colazione
  });

  /**
   * ⛔ **«A pranzo» restringe anche qui** — è la riga nata dalla conversazione del 12/8 («a pranzo» e
   * Gaia rispondeva della cena), che la prima stesura di questo passo aveva perso.
   */
  it('⛔ «a pranzo, le carote» al passo del pasto non guarda la colazione', async () => {
    const duePasti: MealSnapshot[] = [
      { slot: 'breakfast', recipeId: 'r-col-carote', name: 'Pane e carote', kcal: 300 },
      { slot: 'lunch', recipeId: 'r-pranzo', name: 'Insalata di farro', kcal: 500 },
    ];
    const giorni = [{ id: 'day-0', date: piu(0), dietId: 'diet-onnivora', meals: duePasti.map((m) => ({ ...m })) }];
    const { service } = await creaServizio((prisma: any) => {
      prisma.menuDay.findMany = jest.fn().mockResolvedValue(giorni);
      prisma.menuDay.findFirst = jest.fn().mockResolvedValue(giorni[0]);
      const originale = prisma.recipe.findMany;
      prisma.recipe.findMany = jest.fn().mockImplementation(async (args: any) => {
        const dal = await originale(args);
        return [
          ...dal,
          {
            id: 'r-col-carote', name: 'Pane e carote', mealSlot: 'breakfast', kcal: 300,
            macros: { protein_g: 8 }, difficulty: 'semplice',
            ingredients: [{ name: 'pane', qty: 60, unit: 'g' }, { name: 'carote', qty: 30, unit: 'g' }],
          },
        ];
      });
    });

    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato!, 'a pranzo vorrei cambiare le carote');
    expect(dopo.stato?.proposta?.slot).toBe('lunch');
  });

  /**
   * ⛔ **Un numero fuori elenco NON passa alla coach.** Prima scivolava nella ricerca per parole:
   * «non trovo «7» fra gli ingredienti», e alla seconda «ho girato la richiesta alla tua coach» —
   * a una cliente che aveva solo sbagliato a contare.
   */
  it('⛔ «7» su tre alimenti dice che quel numero non c\'è, e resta lì', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    const dopoGiorno = await service.avanza('client-1', apertura.stato!, '1');
    const dopoPasto = await service.avanza('client-1', dopoGiorno.stato!, '2');
    const fuori = await service.avanza('client-1', dopoPasto.stato!, '7');
    expect(fuori.esito).toBe('in_corso');
    expect(fuori.stato?.passo).toBe('cibo');
    expect(fuori.inoltraA).toBeUndefined();
    // ⚠️ Dice che quel NUMERO non c'è, non che non trova un alimento chiamato «7»: è la differenza
    // fra una risposta e uno scivolamento nel ramo sbagliato.
    expect(fuori.testo).toContain('rispondi con un numero da 1 a 3');
    expect(fuori.testo).not.toContain('Non trovo');
    // E l'elenco resta in mano: al giro dopo «2» funziona ancora.
    const poi = await service.avanza('client-1', fuori.stato!, '2');
    expect(poi.stato?.proposta?.da).toBe('carote');
  });

  /**
   * ⛔ **Le spezie non si elencano**: hanno un cancello loro (Gaia non le sostituisce) e la risposta
   * CHIUDE la conversazione. Elencarle come opzione numerata voleva dire proporgliele noi, per poi
   * rifiutarle e farle ricominciare tutto da capo.
   */
  it('⛔ sale e pepe restano fuori dall\'elenco numerato', async () => {
    const unPasto: MealSnapshot[] = [{ slot: 'lunch', recipeId: 'r-speziato', name: 'Pollo alle spezie', kcal: 500 }];
    const giorni = [{ id: 'day-0', date: piu(0), dietId: 'diet-onnivora', meals: unPasto }];
    const { service } = await creaServizio((prisma: any) => {
      prisma.menuDay.findMany = jest.fn().mockResolvedValue(giorni);
      prisma.menuDay.findFirst = jest.fn().mockResolvedValue(giorni[0]);
      prisma.recipe.findMany = jest.fn().mockResolvedValue([
        {
          id: 'r-speziato', name: 'Pollo alle spezie', mealSlot: 'lunch', kcal: 500,
          macros: { protein_g: 40 }, difficulty: 'semplice',
          ingredients: [
            { name: 'pollo', qty: 150, unit: 'g' },
            { name: 'sale', qty: 1, unit: 'g' },
            { name: 'pepe nero', qty: 1, unit: 'g' },
            { name: 'pollo', qty: 20, unit: 'g' },
          ],
        },
      ]);
    });

    const apertura = await service.apri('client-1');
    // ⚠️ E senza doppioni: «pollo» compare due volte nella ricetta, una sola nell'elenco.
    // ⚠️ Il SALE resta: non è nel vocabolario delle spezie del prodotto (`menu/spezie.ts`), e
    // inventarsi qui una seconda idea di «cosa è una spezia» vorrebbe dire due elenchi che
    // divergono. Se un giorno il sale deve uscire, esce da lì — dove sta scritto per tutti.
    expect(apertura.stato?.cibiPerScelta).toEqual(['pollo', 'sale']);
    expect(apertura.testo).not.toContain('pepe');
  });

  it('⚠️ e l\'elenco dice sempre che si può rispondere anche a parole', async () => {
    const { service } = await conTreGiorni();
    const apertura = await service.apri('client-1');
    const dopoGiorno = await service.avanza('client-1', apertura.stato!, '1');
    const dopoPasto = await service.avanza('client-1', dopoGiorno.stato!, '2');
    expect(dopoPasto.testo).toContain('scrivimi il suo nome');
  });

  /**
   * ⛔ **Gli alimenti elencati sono quelli che ha DAVANTI**, sostituzioni già concordate comprese:
   * se ieri ha concordato «carote → biete», l'elenco dice biete. Elencare il catalogo le farebbe
   * scegliere un alimento che nel suo piatto non c'è più — ed è il difetto che
   * `ingredientiEffettivi` esiste per chiudere.
   */
  it('⛔ l\'elenco degli alimenti tiene conto delle sostituzioni già concordate', async () => {
    const conSostituzione: MealSnapshot[] = [
      {
        slot: 'lunch', recipeId: 'r-pranzo', name: 'Insalata di farro', kcal: 500,
        substitutions: [{ from: 'carote', to: 'biete', reason: 'non gradito' }],
      } as MealSnapshot,
    ];
    const { service } = await conTreGiorni([conSostituzione, conSostituzione, conSostituzione]);
    const apertura = await service.apri('client-1');
    const dopo = await service.avanza('client-1', apertura.stato!, '1');
    expect(dopo.testo).toContain('biete');
    expect(dopo.testo).not.toContain('carote');
  });
});

/**
 * §16.2 — «anche il menu di domani o dopodomani, se lo vedo».
 *
 * Fino al 12/8 la giornata era cablata su oggi in sei punti del servizio: una cliente che apriva il
 * menu di domani e chiedeva un cambio si sentiva elencare i piatti di oggi.
 */
describe('SostituzioneChatService — la giornata di cui si parla (§16.2)', () => {
  const domaniIso = () => {
    const d = new Date(`${oggiIso()}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  it('il pulsante dell\'app porta con sé il giorno, e Gaia lo dice', async () => {
    const { service, prisma } = await creaServizio();
    const apertura = await service.apri('client-1', domaniIso());

    expect(apertura.stato?.data).toBe(domaniIso());
    // ⚠️ Il giorno si ripete nella domanda del pasto: la domanda uno è stata saltata (la data
    // arriva dal pulsante), e senza questa riga non si saprebbe di quale giornata si parla.
    expect(apertura.testo).toContain('per il menu di domani');
    const where = prisma.menuDay.findFirst.mock.calls[0][0].where;
    expect(where.date.toISOString().slice(0, 10)).toBe(domaniIso());
    // ⚠️ Solo le giornate che la cliente VEDE: è la condizione che Simone ha messo lui nella
    // richiesta, «se lo vedo».
    expect(where.visibleFrom.lte).toBeInstanceOf(Date);
  });

  it('«domani» detto a parole sposta la conversazione', async () => {
    const { service, prisma } = await creaServizio();
    const apertura = await service.apri('client-1');
    expect(apertura.stato?.data).toBe(oggiIso());

    const dopo = await service.avanza('client-1', apertura.stato!, 'domani vorrei togliere le carote');
    expect(dopo.stato?.data).toBe(domaniIso());
    expect(dopo.stato?.proposta?.data).toBe(domaniIso());
    const ultimo = prisma.menuDay.findFirst.mock.calls.at(-1)[0].where;
    expect(ultimo.date.toISOString().slice(0, 10)).toBe(domaniIso());
  });

  it('la giornata NON si riazzera a metà conversazione', async () => {
    // Un «sì» al passo della conferma non deve riportare tutto a oggi mentre si sta per scrivere.
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1', domaniIso());
    const dopoCibo = await service.avanza('client-1', apertura.stato!, 'le carote');
    const dopoMotivo = await service.avanza('client-1', dopoCibo.stato!, '1');
    expect(dopoMotivo.stato?.data).toBe(domaniIso());
    expect(dopoMotivo.testo).toContain('solo per domani');
  });

  it('il passato non si corregge: un menu di ieri è già stato mangiato', async () => {
    const { service, prisma } = await creaServizio();
    const ieri = new Date(`${oggiIso()}T00:00:00.000Z`);
    ieri.setUTCDate(ieri.getUTCDate() - 1);

    const apertura = await service.apri('client-1', ieri.toISOString().slice(0, 10));
    expect(apertura.esito).toBe('rifiutata');
    // Non si è nemmeno andati a chiedere al database.
    expect(prisma.menuDay.findFirst).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Fino al 24/8 questo test diceva «le frasi restano identiche a prima»**, ed era la rete di
   * sicurezza di §16.2: il giorno predefinito non doveva cambiare una parola. Quella promessa è
   * stata sciolta da Simone quando ha chiesto le domande a numeri — ma la metà che conta resta, ed è
   * questa: **si dice sempre di quale giornata si sta parlando**, oggi compreso.
   */
  it('anche per OGGI si dice di quale giornata si parla, dall\'apertura fino alla conferma', async () => {
    const { service } = await creaServizio();
    const apertura = await service.apri('client-1');
    expect(apertura.testo).toContain('per il menu di oggi');
    const dopoCibo = await service.avanza('client-1', apertura.stato!, 'le carote');
    const dopoMotivo = await service.avanza('client-1', dopoCibo.stato!, '1');
    expect(dopoMotivo.testo).toContain('solo per oggi: domani torna come prima');
  });
});

/**
 * «DOLCE O SALATA?» — richiesta di Simone del 14/8, dallo screenshot della chat di Antonio.
 * Sul cambio della COLAZIONE senza una preferenza detta, Gaia chiede il gusto e cerca fra le
 * colazioni taggate da Lucia (`piatto:dolce`/`piatto:salato`), a pari calorie.
 */
describe('SostituzioneChatService — cambio colazione: «dolce o salata?» (14/8)', () => {
  const conTag = (prisma: any) => {
    const catalogo = [
      { id: 'r-colazione', name: 'Yogurt e avena', mealSlot: 'breakfast', kcal: 320, macros: { protein_g: 14 }, difficulty: 'semplice', ingredients: [], tags: ['piatto:dolce'] },
      { id: 'r-uova', name: 'Uova strapazzate e pane di segale', mealSlot: 'breakfast', kcal: 340, macros: { protein_g: 24 }, difficulty: 'semplice', ingredients: [], tags: ['piatto:salato'] },
      { id: 'r-toast', name: 'Toast integrale con ricotta', mealSlot: 'breakfast', kcal: 330, macros: { protein_g: 18 }, difficulty: 'semplice', ingredients: [], tags: ['piatto:salato'] },
      { id: 'r-porridge', name: 'Porridge ai frutti di bosco', mealSlot: 'breakfast', kcal: 335, macros: { protein_g: 12 }, difficulty: 'semplice', ingredients: [], tags: ['piatto:dolce'] },
      // ⚠️ Senza tag: nessuno l'ha classificata, e nella ricerca filtrata NON deve comparire.
      { id: 'r-skyr', name: 'Skyr con mandorle', mealSlot: 'breakfast', kcal: 330, macros: { protein_g: 20 }, difficulty: 'semplice', ingredients: [], tags: [] },
    ];
    prisma.recipe.findMany = jest.fn().mockImplementation(({ where }: any) => {
      const perId = (where?.id?.in ?? null) as string[] | null;
      return Promise.resolve(
        catalogo
          .filter((r) => (perId ? perId.includes(r.id) : true))
          .filter((r) => (where?.mealSlot ? r.mealSlot === where.mealSlot : true)),
      );
    });
    prisma.clientMenuPool.findFirst = jest.fn().mockResolvedValue({
      recipeIds: ['r-colazione', 'r-uova', 'r-toast', 'r-porridge', 'r-skyr'],
    });
  };

  it('sul cambio colazione senza preferenza CHIEDE il gusto, non propone alla cieca', async () => {
    const { service } = await creaServizio(conTag);
    const esito = await service.proponiAltroPiatto('cli-1', 'vorrei cambiare la colazione');
    expect(esito.stato?.passo).toBe('colazione_gusto');
    expect(esito.testo).toContain('dolce o salata');
  });

  it('«salata» → solo le colazioni taggate salate, a pari calorie; la senza-tag resta fuori', async () => {
    const { service } = await creaServizio(conTag);
    const domanda = await service.proponiAltroPiatto('cli-1', 'vorrei cambiare la colazione');
    const esito = await service.avanza('cli-1', domanda.stato!, 'salata');
    expect(esito.stato?.passo).toBe('scelta_piatto');
    const nomi = esito.stato?.alternativePiatto?.map((a) => a.nome) ?? [];
    expect(nomi).toContain('Uova strapazzate e pane di segale');
    expect(nomi).toContain('Toast integrale con ricotta');
    expect(nomi).not.toContain('Skyr con mandorle');
    expect(nomi).not.toContain('Porridge ai frutti di bosco');
  });

  it('«fa lo stesso» → si cerca senza filtro', async () => {
    const { service } = await creaServizio(conTag);
    const domanda = await service.proponiAltroPiatto('cli-1', 'vorrei cambiare la colazione');
    const esito = await service.avanza('cli-1', domanda.stato!, 'fa lo stesso');
    expect(esito.stato?.passo).toBe('scelta_piatto');
    expect((esito.stato?.alternativePiatto ?? []).length).toBeGreaterThan(0);
  });

  it('⚠️ «una colazione proteica» NON fa la domanda: ha già detto cosa vuole', async () => {
    const { service } = await creaServizio(conTag);
    const esito = await service.proponiAltroPiatto('cli-1', 'voglio una colazione proteica');
    expect(esito.stato?.passo).toBe('scelta_piatto');
  });

  it('risposta non capita: si ripete UNA volta, poi si cerca senza filtro', async () => {
    const { service } = await creaServizio(conTag);
    const domanda = await service.proponiAltroPiatto('cli-1', 'vorrei cambiare la colazione');
    const primo = await service.avanza('cli-1', domanda.stato!, 'mah');
    expect(primo.esito).toBe('in_corso');
    expect(primo.stato?.passo).toBe('colazione_gusto');
    const secondo = await service.avanza('cli-1', primo.stato!, 'non so dirti');
    expect(secondo.stato?.passo).toBe('scelta_piatto');
  });

  it('col filtro e niente dentro le calorie: lo dice col gusto chiesto e passa alla nutrizionista', async () => {
    const { service } = await creaServizio((prisma: any) => {
      conTag(prisma);
      // Solo colazioni dolci nel pool: chiedere «salata» deve finire alla nutrizionista.
      prisma.clientMenuPool.findFirst = jest.fn().mockResolvedValue({ recipeIds: ['r-colazione', 'r-porridge'] });
    });
    const domanda = await service.proponiAltroPiatto('cli-1', 'vorrei cambiare la colazione');
    const esito = await service.avanza('cli-1', domanda.stato!, 'salata');
    expect(esito.esito).toBe('arresa');
    expect(esito.testo).toContain('salata');
    expect(esito.inoltraA).toBe('nutritionist');
  });

  it('il pranzo NON fa la domanda del gusto: è una cosa della colazione', async () => {
    const { service } = await creaServizio(conTag);
    const esito = await service.proponiAltroPiatto('cli-1', 'voglio cambiare il pranzo');
    expect(esito.stato?.passo).not.toBe('colazione_gusto');
  });
});
