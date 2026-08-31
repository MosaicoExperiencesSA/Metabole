import { abbinaPerRicetta } from '../nutrient-facts/abbinamento-alimenti';
import { scegliPerRicetta } from '../nutrient-facts/stato-alimento';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroVeraService } from './registro.service';
import { RichiesteVeraService } from './richieste.service';
import { ValoriNutrizionaliService } from '../nutrient-facts/valori-nutrizionali.service';
import { ScritturaRicetta } from './scrittura-ricetta';
import { VeraChatService } from './vera-chat.service';
import { StatoVera } from './vera-chat';

/**
 * ⚠️ Il test che conta di più qui è che **niente si scrive senza il sì**.
 *
 * Tutto il resto della conversazione può essere sgraziato e si corregge; una scrittura che scappa
 * prima della conferma no, perché arriva nel piatto di una persona e nel registro compare come se
 * fosse stata decisa.
 */

const CLIENTE = { id: 'c1', email: 'giulia@x.it', firstName: 'Giulia', lastName: 'Rossi', clientProfile: { name: 'Giulia' } };

/**
 * ⛔ **UN GIORNO DI MENU COME LO SALVA IL DATABASE: mezzanotte UTC del giorno di Roma.**
 *
 * ⚠️ Nato da un test **verde di giorno e rosso alle 00:30** (24/8, trovato da `npm run test:notte`).
 * I finti scrivevano `new Date(Date.now() + n * 86_400_000)`, cioè un **istante**, dove `MenuDay.date`
 * è un **giorno di calendario**. Fra la mezzanotte e le 02:00 italiane il giorno di Roma e quello UTC
 * non coincidono: alle 00:30 del 23 a Roma sono ancora le 22:30 del 22 in UTC, quindi «oggi + 0» era
 * un giorno **prima** del confine e il test non trovava più niente da rifare.
 *
 * ⚠️ Era un difetto del finto, non del prodotto — ma è il tipo di finto che nasconde i difetti veri:
 * un dato che non somiglia a quello vero fa passare per verdi comportamenti mai provati. Ora tutti i
 * giorni dei test di questo file passano di qui.
 */
const giornoSalvato = (fraQuanti: number): Date => {
  const oggiARoma = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  return new Date(new Date(`${oggiARoma}T00:00:00.000Z`).getTime() + fraQuanti * 86_400_000);
};

/** L'ultimo messaggio scritto dall'agente, con il suo stato. */
function ultimoAgente(create: jest.Mock): { testo: string; stato?: StatoVera } {
  const chiamate = create.mock.calls.map((c) => c[0].data).filter((d: { ruolo: string }) => d.ruolo === 'agente');
  const ultimo = chiamate[chiamate.length - 1];
  return { testo: ultimo.testo, stato: (ultimo.meta ?? {}).stato };
}

function make(
  over: Record<string, unknown> = {},
  opzioni: {
    statoAperto?: StatoVera;
    profilo?: Record<string, unknown>;
    coda?: unknown[];
    richieste?: unknown[];
    invecchiate?: unknown[];
    valori?: Record<string, unknown>;
    giorniMenu?: unknown[];
    avvisi?: unknown[];
    daVerificare?: number;
    kcal?: { simulaKcal: jest.Mock; impostaKcal: jest.Mock };
    /** La prossima sostituzione da verificare (voce 245). Assente = coda vuota. */
    cambio?: Record<string, unknown> | null;
    /**
     * La SECONDA LETTURA (17/8). Assente = spenta, come in tutti i test scritti prima: `getBool`
     * torna `false` e il comportamento è identico a quello di sempre. Passando una frase qui si
     * accende l'interruttore e si finge la risposta del modello.
     */
    riscritturaModello?: string | null;
    /** L'esito della porta che cambia le ORE del digiuno (25/8). Assente = riesce. */
    digiunoEsito?: { ok: boolean; perche: string; daQuando: 'oggi' | 'domani' };
  } = {},
) {
  const messaggioCreate = jest.fn().mockResolvedValue({ id: 'm1' });
  const profileUpdate = jest.fn().mockResolvedValue({});
  const prisma = {
    messaggioVera: {
      create: messaggioCreate,
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      // Lo stato del dialogo vive nel meta dell'ULTIMO messaggio dell'agente: il finto lo
      // rilegge da quello che il test ha appena scritto, così i giri a più turni funzionano
      // come in produzione. `statoAperto` resta il punto di partenza del primo turno.
      findFirst: jest.fn().mockImplementation(() => {
        const agente = messaggioCreate.mock.calls.map((c) => c[0].data).filter((d: { ruolo: string }) => d.ruolo === 'agente');
        const ultimo = agente[agente.length - 1];
        if (ultimo) return Promise.resolve({ meta: ultimo.meta ?? {}, createdAt: new Date() });
        return Promise.resolve(opzioni.statoAperto ? { meta: { stato: opzioni.statoAperto }, createdAt: new Date() } : null);
      }),
    },
    // `head_nutritionist` → `perimetroClienti` ritorna null: nessun filtro, il test resta sul dialogo.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }), findMany: jest.fn().mockResolvedValue([CLIENTE]) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(opzioni.profilo ?? { dislikedFoods: [], allergies: [], intolerances: [], name: 'Giulia', pastiEsclusi: [] }),
      update: profileUpdate,
    },
    recipe: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    menuDay: {
      findMany: jest.fn().mockResolvedValue(opzioni.giorniMenu ?? []),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue((opzioni.giorniMenu ?? []).length),
    },
    // La guida della giornata (14/8): segnalazioni aperte e campanella. A zero se il test non dice altro.
    escalation: {
      count: jest.fn().mockResolvedValue(0),
      // ⚠️ `findMany` c'è perché l'originale ce l'ha: la lista numerata del 19/8 legge le righe, non
      // il conteggio. Un doppio che conosce solo `count` non verifica niente della lista.
      findMany: jest.fn().mockResolvedValue([]),
    },
    // La riga si RILEGGE prima di scrivere il verdetto (voce 245): di default è ancora da guardare.
    foodSwap: { findUnique: jest.fn().mockResolvedValue({ stato: 'da_verificare' }) },
    notification: { findMany: jest.fn().mockResolvedValue(opzioni.avvisi ?? []) },
    staff: {
      updateMany: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ displayName: 'Lucia' }),
      // Il battesimo è già fatto, salvo nei test che lo mettono alla prova: è una condizione sui dati.
      findFirst: jest.fn().mockResolvedValue({ nomeAgente: 'Vera' }),
    },
    ...over,
  } as unknown as PrismaService;

  const dizionario = {
    risolvi: jest.fn().mockResolvedValue(null),
    insegna: jest.fn().mockResolvedValue({ id: 'v1' }),
    // Nessuna famiglia invecchiata se il test non dice altro: la manutenzione del dizionario è
    // l'ultima coda di `cosaTiPorto`, e senza questa riga si intrometterebbe in mezzo a tutti gli
    // altri dialoghi.
    famiglieDaAggiornare: jest.fn().mockResolvedValue(opzioni.invecchiate ?? []),
    lasciaComEra: jest.fn().mockResolvedValue({ id: 'v1' }),
  } as unknown as DizionarioService;
  const pool = {
    anteprima: jest.fn().mockResolvedValue({
      prima: { totaleRestanti: 40, pastiScoperti: [], slots: [], soglia: 3 },
      dopo: { totaleRestanti: 38, pastiScoperti: [], slots: [], soglia: 3 },
      racconto: 'Questa regola toglie 2 ricette dalle 40 che aveva: ne restano 38.',
    }),
  } as unknown as PoolDisponibileService;
  const registro = {
    scrivi: jest.fn().mockResolvedValue({ id: 'a1' }),
    // La coda è vuota se il test non dice altro: chi parla di coda se la prepara.
    daApprovare: jest.fn().mockResolvedValue(opzioni.coda ?? []),
    approva: jest.fn().mockResolvedValue({ riepilogo: 'Applicata a 3 clienti su 3.' }),
    respingi: jest.fn().mockResolvedValue({ riga: { id: 'a1' } }),
    sostituzioniDaVerificare: jest.fn().mockResolvedValue(opzioni.daVerificare ?? 0),
    // ⚠️ Nessun cambio da verificare se il test non dice altro: come la manutenzione del
    // dizionario, questa coda sta dentro `cosaTiPorto` e senza questa riga si intrometterebbe in
    // mezzo a tutti gli altri dialoghi.
    prossimaDaVerificare: jest.fn().mockResolvedValue(opzioni.cambio ?? null),
    menuDaRifare: jest.fn().mockResolvedValue([]),
  } as unknown as RegistroVeraService;

  const richieste = {
    // Nessuna domanda aperta se il test non dice altro.
    aperte: jest.fn().mockResolvedValue(opzioni.richieste ?? []),
    quante: jest.fn().mockResolvedValue((opzioni.richieste ?? []).length),
    chiudiSenzaRisposta: jest.fn().mockResolvedValue(undefined),
    rispondi: jest.fn().mockResolvedValue({ aggiunti: ['fave', 'legumi'], clienteNome: 'Mariastella' }),
    collega: jest.fn().mockResolvedValue(undefined),
  } as unknown as RichiesteVeraService;

  /**
   * La tabella nutrienti finta. ⚠️ Di default NON conosce niente: così un test che scrive una
   * ricetta deve dire quali valori esistono, e non può passare per caso su numeri inventati.
   */
  const valori = {
    cerca: jest.fn().mockImplementation(async (nome: string) => (opzioni.valori ?? {})[nome] ?? null),
    /**
     * ⚠️ IL DOPPIO DEVE COMPORTARSI COME L'ORIGINALE, o non verifica niente.
     *
     * `cercaPerIngrediente` è nata il 19/8 (abbinamento dei nomi liberi) e il doppio non ce l'aveva:
     * quattro test sono diventati rossi non perché il codice fosse sbagliato, ma perché il finto
     * rispondeva `undefined` dove il vero risponde un valore o `null`. È la stessa lezione della
     * mattina sul doppio di `audit.log`.
     *
     * Qui usa lo **stesso** `abbina` del servizio vero sui valori finti: così un test che si appoggia
     * all'abbinamento («spinaci freschi» → «spinaci») dice qualcosa di vero.
     */
    /**
     * ⚠️ Torna un **esito**, come l'originale dal 19/8 sera: `{tipo, riga}`. Prima tornava una riga
     * nuda, e sei test sono diventati rossi quando il vero è cambiato — è la **terza volta oggi** che
     * un doppio che non segue l'originale fa perdere tempo (dopo `audit.log` e `combinazioni.create`).
     * Qui usa lo **stesso** `abbina` e lo **stesso** `scegliPerRicetta` del servizio vero.
     */
    cercaPerIngrediente: jest.fn().mockImplementation(async (nome: string) => {
      const tabella = (opzioni.valori ?? {}) as Record<string, { name: string; state?: string | null }>;
      /**
       * ⚠️ Le righe finte hanno **la forma di quelle vere** — `name` + `synonyms` + `state` — e la
       * chiave della tabella di prova entra fra i sinonimi invece di essere un campo suo. Prima
       * erano `{chiave, name}` e il doppio doveva chiamare `abbina` con un `nomiDi` tutto suo: cioè
       * era **un secondo modo** di fare l'abbinamento, che è precisamente il difetto trovato il 20/8
       * in `diag:crudo-cotto` (là mancava lo stato, e la diagnostica mandava la nutrizionista a
       * scrivere righe che non servivano). Con la forma giusta il doppio passa dalla stessa porta
       * della produzione, `abbinaPerRicetta`, e non può più divergere.
       */
      const righe = Object.entries(tabella).map(([k, v]) => ({
        ...v,
        name: v.name ?? k,
        synonyms: [k],
        state: v.state ?? null,
      }));
      const esatta = righe.find((r) => r.synonyms.includes(nome) || r.name === nome);
      if (esatta) return scegliPerRicetta([esatta]);
      const trovato = abbinaPerRicetta(nome, righe);
      return trovato ? scegliPerRicetta([trovato.riga]) : { tipo: 'niente' };
    }),
    /**
     * Crudo/cotto (voce 228): di default nessun alimento è ambiguo, cioè il comportamento che
     * questi test già difendevano. `opzioni.ambigui` serve al test che prova il contrario.
     */
    cercaConStato: jest.fn().mockImplementation(async (nome: string) =>
      ((opzioni as { ambigui?: string[] }).ambigui ?? []).includes(nome)
        ? { tipo: 'ambiguo', stati: ['crudo', 'bollito'], righe: [] }
        : { tipo: 'niente' },
    ),
    registraMancante: jest.fn().mockResolvedValue(undefined),
  } as unknown as ValoriNutrizionaliService;
  const ricette = {
    createRecipe: jest.fn().mockResolvedValue({ id: 'r-nuova' }),
    updateRecipe: jest.fn().mockResolvedValue({ id: 'r1' }),
    // Gli allergeni confermati (voce 227): la stessa porta del pulsante in scheda.
    setRecipeAllergens: jest.fn().mockResolvedValue({ id: 'r1' }),
  } as unknown as ScritturaRicetta & { setRecipeAllergens: jest.Mock };
  // La porta della scheda per il cambio di dieta (azione 3, 14/8).
  const clienti = { updateClient: jest.fn().mockResolvedValue({}) };
  // Il minimo proteico della dieta, per l'anteprima delle proteine (14/8).
  const secondaLetturaAccesa = opzioni.riscritturaModello !== undefined;
  const configParams = {
    getNumber: jest.fn().mockResolvedValue(0.2),
    // ⚠️ `vera_seconda_lettura` è l'unica chiave che può essere vera: tutto il resto resta come era,
    // così i test scritti prima del 17/8 collaudano ancora il comportamento che collaudavano.
    getBool: jest.fn((chiave: string) => Promise.resolve(chiave === 'vera_seconda_lettura' && secondaLetturaAccesa)),
  };
  /** Il modello della seconda lettura: finto, e risponde quello che gli dice il test. */
  const ai = {
    generateJson: jest.fn().mockResolvedValue(
      opzioni.riscritturaModello ? { frase: opzioni.riscritturaModello } : null,
    ),
  };
  // La porta delle calorie scritte a mano (14/8, Nocanty via Vera).
  const kcal = opzioni.kcal ?? {
    simulaKcal: jest.fn().mockResolvedValue({ prima: { target: 1600 }, dopo: { target: 1440 } }),
    impostaKcal: jest.fn().mockResolvedValue({}),
  };
  // La porta dei cambi concordati in chat (voce 245): la stessa del pulsante in scheda.
  const sostituzioni = { aggiorna: jest.fn().mockResolvedValue({ id: 's1' }) };
  // La porta delle combinazioni (18/8): la stessa del pulsante in Equivalenze.
  /**
   * ⚠️ `create` c'è perché l'originale ce l'ha (19/8, «aggiungi equivalenza»). Un doppio che si
   * comporta diversamente dall'originale non verifica niente — è la lezione già pagata due volte
   * oggi, su `audit.log` e su `cercaPerIngrediente`.
   */
  const combinazioni = {
    approve: jest.fn().mockResolvedValue({ id: 'g1' }),
    create: jest.fn().mockResolvedValue({ id: 'g-nuovo' }),
  };
  /**
   * La porta della coda «Da validare» (19/8): la stessa dei pulsanti in NutritionistHome. ⚠️ Le
   * regole — azioni ammesse per causa, perimetro, «una decisione si lavora una volta sola» — stanno
   * nel servizio vero e non si duplicano: qui il doppio deve solo **rifiutare come rifiuta lui**,
   * ed è per questo che `opzioni.decisioneErrore` esiste.
   */
  /**
   * ⛔ Le ORE del digiuno (25/8): la porta che la regola della cliente promette. ⚠️ Il finto
   * risponde **come l'originale** — un esito, non un `throw` — perché a una nutrizionista che ha
   * appena detto «mettila a 16:8» si deve poter dire *perché* non si è potuto.
   */
  const digiuno = {
    impostaPerStaff: jest.fn().mockResolvedValue(
      (opzioni as { digiunoEsito?: unknown }).digiunoEsito ?? { ok: true, perche: '', daQuando: 'oggi' },
    ),
  };
  const decisioni = {
    eseguiAzione: jest.fn().mockImplementation(async () => {
      const errore = (opzioni as { decisioneErrore?: string }).decisioneErrore;
      if (errore) throw new Error(errore);
      return { ok: true };
    }),
  };

  return {
    service: new VeraChatService(prisma, dizionario, pool, registro, richieste, valori, configParams as never, ricette, clienti as never, kcal as never, sostituzioni as never, ai as never, combinazioni as never, decisioni as never, digiuno as never),
    valori,
    ricette,
    richieste,
    combinazioni,
    decisioni,
    digiuno,
    messaggioCreate,
    profileUpdate,
    dizionario,
    registro,
    prisma,
    pool,
    clienti,
    kcal,
    sostituzioni,
    ai,
  };
}

describe('VeraChatService — il primo incontro', () => {
  it('si presenta e chiede di essere battezzato', async () => {
    const { service, messaggioCreate, prisma } = make();
    (prisma.messaggioVera.count as jest.Mock).mockResolvedValue(0);
    await service.apri('lucia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    // ⚠️ Agganciato a una parola che resta, non a mezza frase: così il prossimo ritocco di stile
    // non fa rosso un test. (Il 13/8 sera lo stile è cambiato davvero: via il «battezzarmi».)
    expect(testo).toContain('nome');
    expect(stato?.passo).toBe('nome');
  });

  it('riaprire la pagina NON fa ripetere la presentazione', async () => {
    const { service, messaggioCreate } = make();
    await service.apri('lucia');
    expect(messaggioCreate).not.toHaveBeenCalled();
  });

  it('«scegli tu» non lascia bloccati: prende il nome di scorta', async () => {
    const { service, messaggioCreate, prisma } = make({}, { statoAperto: { passo: 'nome', frase: '' } });
    await service.parla('lucia', 'scegli tu');
    expect((prisma.staff.updateMany as jest.Mock).mock.calls[0][0].data.nomeAgente).toBe('Vera');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Vera');
  });

  /**
   * I tre difetti del 13/8 (screenshot di Simone): la risposta al battesimo arrivata DOPO la
   * scadenza dello stato cadeva su «non ci arrivo», e il battesimo restava irraggiungibile per
   * sempre; l'estrattore prendeva la prima parola («Ciao»); e «annulla» a vuoto sembrava un errore.
   */
  it('risponde al battesimo anche a stato scaduto: comanda il dato, non il messaggio', async () => {
    const { service, prisma } = make(); // nessuno statoAperto: come dopo la scadenza
    (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ nomeAgente: null });
    await service.parla('lucia', 'Ciao ti chiamerò Vera');
    expect((prisma.staff.updateMany as jest.Mock).mock.calls[0][0].data.nomeAgente).toBe('Vera');
  });

  it('senza nome ma con una frase di lavoro: il battesimo non tiene in ostaggio', async () => {
    const { service, prisma } = make({}, { statoAperto: { passo: 'nome', frase: '' } });
    (prisma.staff.findFirst as jest.Mock).mockResolvedValue({ nomeAgente: null });
    await service.parla('lucia', 'a Giulia Rossi niente formaggi molli');
    // Niente battesimo per sbaglio: la frase è lavoro, e il lavoro parte.
    expect(prisma.staff.updateMany).not.toHaveBeenCalled();
  });

  it('«annulla» con niente in corso non è un «non ci arrivo»', async () => {
    const { service, messaggioCreate } = make();
    await service.parla('lucia', 'ok annulla tutto');
    expect(ultimoAgente(messaggioCreate).testo).toContain('niente in corso');
  });
});

describe('VeraChatService — quando non capisce', () => {
  it('lo dice, e non inventa niente', async () => {
    const { service, messaggioCreate, profileUpdate } = make();
    await service.parla('lucia', 'ciao come va');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Non ci arrivo');
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('al secondo tentativo a vuoto si arrende e manda alla pagina', async () => {
    const { service, messaggioCreate } = make({}, { statoAperto: { passo: 'conferma', frase: 'x', tentativi: 2 } });
    await service.parla('lucia', 'boh');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('preferisco fermarmi');
    // Nessuno stato: il giro è chiuso, non resta un dialogo aperto ad aspettare.
    expect(stato).toBeUndefined();
  });

  it('una regola su un TIPO DI DIETA non viene applicata a una cliente', async () => {
    // Il ripiego pericoloso sarebbe «allora lo faccio sull'ultima cliente nominata».
    const { service, messaggioCreate, profileUpdate } = make();
    await service.parla('lucia', 'nella dieta mediterranea non deve comparire più il tonno');
    expect(ultimoAgente(messaggioCreate).testo).toContain('tipo di dieta');
    expect(profileUpdate).not.toHaveBeenCalled();
  });
});

describe('VeraChatService — chi è la cliente', () => {
  it('con più omonime chiede cognome o email invece di scegliere', async () => {
    const { service, messaggioCreate, prisma } = make();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([CLIENTE, { ...CLIENTE, id: 'c2', lastName: 'Bianchi' }]);
    await service.parla('lucia', 'a Giulia niente tonno');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('ne ho 2');
    expect(stato?.passo).toBe('quale_cliente');
  });

  it('se non trova nessuno lo dice, e non prosegue', async () => {
    const { service, messaggioCreate, prisma } = make();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    await service.parla('lucia', 'a Ludmilla niente tonno');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Non trovo nessuna cliente');
  });
});

describe('VeraChatService — il dizionario', () => {
  it('una famiglia sconosciuta si chiede, non si indovina', async () => {
    const { service, messaggioCreate, prisma } = make();
    (prisma.recipe.count as jest.Mock).mockResolvedValue(0); // non è un alimento del catalogo
    await service.parla('lucia', 'a Giulia Rossi niente formaggi molli');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Non conosco «formaggi molli»');
    expect(stato?.passo).toBe('quale_famiglia');
  });

  it('la risposta viene imparata, e non la richiede più', async () => {
    const { service, dizionario } = make(
      {},
      { statoAperto: { passo: 'quale_famiglia', frase: 'a Giulia niente formaggi molli', famiglia: 'formaggi molli', famiglieDaChiedere: ['formaggi molli'], clienteId: 'c1', clienteNome: 'Giulia Rossi', intento: { tipo: 'restrizione', cliente: 'Giulia', vietati: ['formaggi molli'], tenuti: [] } } },
    );
    await service.parla('lucia', 'mozzarella, stracchino e ricotta');
    expect((dizionario.insegna as jest.Mock).mock.calls[0][1]).toEqual({
      nome: 'formaggi molli',
      membri: ['mozzarella', 'stracchino', 'ricotta'],
    });
  });
});

describe('VeraChatService — l\'anteprima e la conferma', () => {
  const statoDaConfermare = (over: Partial<StatoVera> = {}): StatoVera => ({
    passo: 'conferma',
    frase: 'a Giulia Rossi niente tonno',
    clienteId: 'c1',
    clienteNome: 'Giulia Rossi',
    intento: { tipo: 'restrizione', cliente: 'Giulia Rossi', vietati: ['tonno'], tenuti: [] },
    famiglieDaChiedere: [],
    ...over,
  });

  it('mostra la regola tradotta e cosa comporta PRIMA di scrivere', async () => {
    const { service, messaggioCreate, profileUpdate } = make();
    await service.parla('lucia', 'a Giulia Rossi niente tonno');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('vieto 1 alimento: tonno');
    expect(testo).toContain('ne restano 38');
    expect(testo).toContain('Confermi?');
    expect(stato?.passo).toBe('conferma');
    // ⚠️ Il punto di tutto: fin qui non è stato scritto NIENTE.
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('un «no» non scrive niente', async () => {
    const { service, messaggioCreate, profileUpdate, registro } = make({}, { statoAperto: statoDaConfermare() });
    await service.parla('lucia', 'no aspetta');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Non ho scritto niente');
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(registro.scrivi).not.toHaveBeenCalled();
  });

  it('una risposta ambigua NON vale come sì', async () => {
    const { service, messaggioCreate, profileUpdate } = make({}, { statoAperto: statoDaConfermare() });
    await service.parla('lucia', 'mah, forse');
    expect(ultimoAgente(messaggioCreate).testo).toContain('nel dubbio non scrivo niente');
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('⚠️ «sì» con l\'accento vale come sì (il confine di parola in JS è ASCII)', async () => {
    // Senza normalizzare gli accenti, `sì\\b` non combacia mai e la risposta più naturale che esista
    // a «Confermi?» verrebbe letta come «non ho capito». Stesso difetto della «é» di «perché».
    const { service, messaggioCreate } = make({}, { statoAperto: statoDaConfermare() });
    await service.parla('lucia', 'sì');
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('ambito');
  });

  it('dopo il sì chiede l\'ambito, e ancora non scrive', async () => {
    const { service, messaggioCreate, profileUpdate } = make({}, { statoAperto: statoDaConfermare() });
    await service.parla('lucia', 'sì');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('o la estendo a tutte');
    expect(stato?.passo).toBe('ambito');
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('avvisa quando la regola tocca un vincolo sanitario — ma non blocca', async () => {
    const { service, messaggioCreate } = make(
      {},
      { profilo: { dislikedFoods: [], allergies: ['latte'], intolerances: [], name: 'Giulia' } },
    );
    await service.parla('lucia', 'a Giulia Rossi niente formaggi ma solo la mozzarella');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('⚠️');
    expect(testo).toContain('Procedo lo stesso?');
    // Comanda lei: il dialogo prosegue, non si ferma.
    expect(stato?.passo).toBe('conferma');
  });
});

describe('VeraChatService — la scrittura', () => {
  const statoAmbito = (over: Partial<StatoVera> = {}): StatoVera => ({
    passo: 'ambito',
    frase: 'a Giulia Rossi niente tonno',
    clienteId: 'c1',
    clienteNome: 'Giulia Rossi',
    intento: { tipo: 'restrizione', cliente: 'Giulia Rossi', vietati: ['tonno'], tenuti: [] },
    ...over,
  });

  it('«solo per lei» scrive fra i NON GRADITI e lascia la riga nel registro', async () => {
    const { service, profileUpdate, registro, messaggioCreate } = make({}, { statoAperto: statoAmbito() });
    await service.parla('lucia', 'solo per lei');
    // ⚠️ dislikedFoods e non intolerances: un'intolleranza BLOCCA il piano quando il motore non
    // trova un sostituto sicuro, e una frase dettata non deve poter fermare l'erogazione.
    expect(profileUpdate.mock.calls[0][0].data.dislikedFoods).toEqual(['tonno']);
    expect((registro.scrivi as jest.Mock).mock.calls[0][0]).toMatchObject({
      azione: 'restrizione_cliente',
      ambito: 'cliente',
      frase: 'a Giulia Rossi niente tonno',
    });
    expect(ultimoAgente(messaggioCreate).testo).toContain('Ho tolto dai suoi menu: tonno');
  });

  /**
   * ⛔ **IL CASO LORENA POLIDORO (23/8): la regola vale anche sui giorni già preparati.**
   *
   * «Niente pesce» scriveva sul profilo e basta: i giorni futuri già composti restavano lì col
   * branzino dentro, la nutrizionista leggeva «ho tolto dai suoi menu» — vero solo a metà — e alla
   * cliente il pesce continuava ad arrivare. Richiesta di Simone: «se Vera crea la regola, va
   * applicata su tutto, perché è del nutrizionista assegnato».
   */
  it('⛔ «niente pesce» rifà i giorni già preparati che lo contengono — e solo quelli', async () => {
    const GIORNO = 86_400_000;
    const fra = (n: number) => giornoSalvato(n);
    const pasto = (recipeId: string, name: string) => [{ slot: 'lunch', recipeId, name, kcal: 500 }];
    const { service, prisma, messaggioCreate } = make(
      {
        recipe: {
          count: jest.fn().mockResolvedValue(4),
          findMany: jest.fn().mockResolvedValue([
            { id: 'r-branzino', name: 'Branzino al forno', ingredients: [] },
            { id: 'r-triglie', name: 'Triglie al pomodoro', ingredients: [] },
            { id: 'r-pollo', name: 'Pollo ai ferri', ingredients: [] },
            // ⛔ La trappola: «carpa» sta dentro «carpaccio». Con un confronto a mano (senza le
            // omonime di `hitsExclusion`) questo giorno verrebbe rifatto per una regola sul pesce.
            { id: 'r-carpaccio', name: 'Carpaccio di manzo con rucola', ingredients: [] },
          ]),
        },
      },
      {
        statoAperto: statoAmbito({
          frase: 'a Lorena niente pesce',
          clienteNome: 'Lorena',
          intento: { tipo: 'restrizione', cliente: 'Lorena', vietati: ['pesce'], tenuti: [] },
        }),
        giorniMenu: [
          // ⚠️ GIÀ APERTO, e PRIMA di quello colpito: resta suo, e non impedisce di rifare la coda.
          { id: 'g-visto', clientId: 'c1', date: fra(1), apertoDallaClienteIl: new Date(), apertureTracciate: true, meals: pasto('r-branzino', 'Branzino al forno') },
          { id: 'g-branzino', clientId: 'c1', date: fra(2), apertoDallaClienteIl: null, apertureTracciate: true, meals: pasto('r-branzino', 'Branzino al forno') },
          // ⚠️ «Triglie» al plurale: lo prende la RADICE di «triglia». Con un `includes` nudo no.
          { id: 'g-triglie', clientId: 'c1', date: fra(3), apertoDallaClienteIl: null, apertureTracciate: true, meals: pasto('r-triglie', 'Triglie al pomodoro') },
          { id: 'g-pollo', clientId: 'c1', date: fra(4), apertoDallaClienteIl: null, apertureTracciate: true, meals: pasto('r-pollo', 'Pollo ai ferri') },
          { id: 'g-carpaccio', clientId: 'c1', date: fra(6), apertoDallaClienteIl: null, apertureTracciate: true, meals: pasto('r-carpaccio', 'Carpaccio di manzo') },
        ],
      },
    );
    await service.parla('lucia', 'solo per lei');

    /**
     * ⛔ **Si cancella dal primo giorno colpito IN AVANTI, non i singoli giorni** — bloccante trovato
     * in revisione. `deliverIfEligible` si ferma se in calendario c'è già un giorno più avanti di
     * oggi, e appende i nuovi **dopo l'ultimo**: cancellare un giorno in mezzo lascia un buco che
     * non si richiude **mai**, e la cliente in quel giorno trova «menu in preparazione» per sempre.
     * Quindi qui spariscono anche `g-pollo` e `g-carpaccio`, che il pesce non ce l'hanno: è il
     * prezzo, e si paga volentieri — un menu rimescolato è un fastidio, un giorno che non torna è
     * una persona senza cena.
     */
    const cancellati = (prisma.menuDay.deleteMany as jest.Mock).mock.calls[0][0].where.id.in as string[];
    expect(cancellati.sort()).toEqual(['g-branzino', 'g-carpaccio', 'g-pollo', 'g-triglie']);
    // ⚠️ E il giorno GIÀ APERTO non è fra questi: resta suo.
    expect(cancellati).not.toContain('g-visto');

    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Ho tolto dai suoi menu: pesce');
    expect(testo).toContain('Ho rifatto anche 4 giornate');
  });

  /**
   * ⛔ **IL CASO LORENA VERO: la parola c'era GIÀ sul profilo.** È quello che Simone ha sistemato a
   * mano il 23/8, ed è la strada che Lucia prenderebbe per rimediare — ridettare la regola. La
   * prima stesura usciva subito con «erano già tutti esclusi» **senza guardare i giorni**: l'unica
   * strada che non ripuliva niente era quella che si sarebbe usata per ripulire.
   */
  it('⛔ se la parola c\'era già, i giorni si guardano lo stesso', async () => {
    const GIORNO = 86_400_000;
    const { service, prisma, profileUpdate, messaggioCreate } = make(
      {
        recipe: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([{ id: 'r-branzino', name: 'Branzino al forno', ingredients: [] }]),
        },
      },
      {
        statoAperto: statoAmbito({
          intento: { tipo: 'restrizione', cliente: 'Lorena', vietati: ['pesce'], tenuti: [] },
        }),
        // Il profilo ce l'ha già: sul profilo non c'è niente da scrivere.
        profilo: { dislikedFoods: ['pesce'], allergies: [], intolerances: [], name: 'Lorena' },
        giorniMenu: [
          {
            id: 'g-branzino', clientId: 'c1', date: giornoSalvato(2), apertoDallaClienteIl: null, apertureTracciate: true,
            meals: [{ slot: 'lunch', recipeId: 'r-branzino', name: 'Branzino al forno', kcal: 500 }],
          },
        ],
      },
    );
    await service.parla('lucia', 'solo per lei');
    expect(profileUpdate).not.toHaveBeenCalled(); // niente da scrivere: giusto
    expect((prisma.menuDay.deleteMany as jest.Mock)).toHaveBeenCalled(); // ma il branzino sparisce
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('sul profilo non ho cambiato niente');
    expect(testo).toContain('Ho rifatto anche 1 giornata');
  });

  /**
   * ⛔ **IL GIORNO DEL RILASCIO: «NON LO SO» SI DICE, e non si spaccia per «non ce n'era»** — 26/8.
   *
   * È il caso per cui tutta questa modifica esiste, ed è il caso in cui era più facile riprodurre il
   * difetto: nessuna giornata è ancora tracciata, quindi il branzino c'è nel menu di domani ma di
   * quel giorno non sappiamo se lei l'ha aperto. ⛔ Con i tre esiti di prima la risposta sarebbe
   * stata «Nei giorni già preparati non ce n'era: non ho toccato niente» — **testualmente** la frase
   * che questa modifica esiste per togliere, falsa nello stesso identico caso, con un campo nuovo
   * sotto. Il quarto esito è quello che chiude il difetto invece di spostarlo.
   */
  it('⛔ di un giorno che non sappiamo si dice «non lo so», mai «non ce n\'era»', async () => {
    const pasto = (recipeId: string) => [{ slot: 'lunch', recipeId, name: 'x', kcal: 500 }];
    const { service, prisma, messaggioCreate } = make(
      {
        recipe: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([{ id: 'r-branzino', name: 'Branzino al forno', ingredients: [] }]),
        },
      },
      {
        statoAperto: statoAmbito({
          intento: { tipo: 'restrizione', cliente: 'Lorena', vietati: ['pesce'], tenuti: [] },
        }),
        giorniMenu: [
          // ⚠️ `apertureTracciate: false`: la sua app non mandava ancora il segnale quando questo
          // menu è stato composto. Non è «non l'ha aperto»: è «non lo so».
          { id: 'g-branzino', clientId: 'c1', date: giornoSalvato(1), apertoDallaClienteIl: null, apertureTracciate: false, meals: pasto('r-branzino') },
        ],
      },
    );
    await service.parla('lucia', 'solo per lei');
    // ⚠️ Nel dubbio non si tocca: si rimanda una correzione, non si toglie un menu di mano.
    expect((prisma.menuDay.deleteMany as jest.Mock)).not.toHaveBeenCalled();
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('non so dirti se li ha già aperti');
    expect(testo).not.toContain('non ce n’era');
    // ⛔ E non le si dice «l'ha già aperto»: sarebbe un fatto inventato al posto di uno mancante.
    expect(testo).not.toContain('l’ha già aperto in app');
    expect(testo).toContain('Rigenera menu');
  });

  /**
   * ⛔ **E se in mezzo c'è un giorno GIÀ APERTO non si tocca niente, e lo si DICE.** Un giorno letto
   * resta suo, ma se sta dopo quello colpito resta lui l'ultimo del calendario e il buco si
   * riaprirebbe. Fingere di aver fatto sarebbe la bugia da cui nasce questo lavoro.
   */
  it('⛔ un giorno già aperto DOPO quello colpito ferma tutto, e la risposta lo dice', async () => {
    const GIORNO = 86_400_000;
    const pasto = (recipeId: string) => [{ slot: 'lunch', recipeId, name: 'x', kcal: 500 }];
    const { service, prisma, messaggioCreate } = make(
      {
        recipe: {
          count: jest.fn().mockResolvedValue(2),
          findMany: jest.fn().mockResolvedValue([
            { id: 'r-branzino', name: 'Branzino al forno', ingredients: [] },
            { id: 'r-pollo', name: 'Pollo ai ferri', ingredients: [] },
          ]),
        },
      },
      {
        statoAperto: statoAmbito({
          intento: { tipo: 'restrizione', cliente: 'Lorena', vietati: ['pesce'], tenuti: [] },
        }),
        giorniMenu: [
          { id: 'g-branzino', clientId: 'c1', date: giornoSalvato(2), apertoDallaClienteIl: null, apertureTracciate: true, meals: pasto('r-branzino') },
          // ⚠️ Aperto, e DOPO: non si può cancellare, e resterebbe lui l'ultimo.
          { id: 'g-letto', clientId: 'c1', date: giornoSalvato(3), apertoDallaClienteIl: new Date(), apertureTracciate: true, meals: pasto('r-pollo') },
        ],
      },
    );
    await service.parla('lucia', 'solo per lei');
    expect((prisma.menuDay.deleteMany as jest.Mock)).not.toHaveBeenCalled();
    const { testo } = ultimoAgente(messaggioCreate);
    /**
     * ⚠️ **E dice QUALE giorno** (24/8): prima diceva «ne ha già aperto uno», che è vero e
     * inservibile — la nutrizionista deve poter andare a guardare **quel** giorno, non ripassarsi
     * tutto il calendario per trovarlo.
     *
     * ⛔ **E dice «le è arrivato in app», non «l'ha aperto»**: `viewedAt` lo mette `getMenu` a ogni
     * apertura dell'app su **tutti** i giorni della finestra, futuri compresi. «L'ha aperto» era una
     * cosa che il dato non sostiene, scritta nella frase che una professionista legge per decidere.
     * Voce `visto-non-vuol-dire-aperto`.
     */
    const [a, m, g] = giornoSalvato(3).toISOString().slice(0, 10).split('-');
    expect(testo).toContain(`il menu del ${g}/${m}/${a} l'ha già aperto in app`);
    expect(testo).toContain('Rigenera menu');
  });

  /**
   * ⚠️ **Solo le ricette dei giorni candidati.** La prima stesura leggeva l'INTERO catalogo a ogni
   * frase detta in chat: qui si guarda che la query porti un `where` sugli id.
   */
  it('⚠️ non si rilegge tutto il catalogo: solo le ricette di quei giorni', async () => {
    const GIORNO = 86_400_000;
    const recipeFindMany = jest.fn().mockResolvedValue([{ id: 'r-1', name: 'Pollo', ingredients: [] }]);
    const { service } = make(
      { recipe: { count: jest.fn().mockResolvedValue(1), findMany: recipeFindMany } },
      {
        statoAperto: statoAmbito(),
        giorniMenu: [
          { id: 'g-1', clientId: 'c1', date: giornoSalvato(1), apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'lunch', recipeId: 'r-1', name: 'Pollo', kcal: 400 }] },
        ],
      },
    );
    await service.parla('lucia', 'solo per lei');
    expect(recipeFindMany.mock.calls[0][0].where.id.in).toEqual(['r-1']);
  });

  /**
   * ⚠️ **E la nutrizionista sa COSA ha appena vietato**: per il motore «pesce» non è una parola ma
   * un elenco — tonno, branzino, nasello, aringa, i derivati. Senza questa riga, l'unico modo di
   * scoprire quanto è largo il divieto è vedere cosa sparisce dai piatti.
   */
  it('⚠️ la risposta spiega che «pesce» è un elenco, non una parola', async () => {
    const { service, messaggioCreate } = make(
      {},
      {
        statoAperto: statoAmbito({
          intento: { tipo: 'restrizione', cliente: 'Giulia Rossi', vietati: ['pesce'], tenuti: [] },
        }),
      },
    );
    await service.parla('lucia', 'solo per lei');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('«pesce» per il motore vuol dire');
    /**
     * ⚠️ **Il taglio è pinnato**: sei voci mostrate, il resto contato. Senza questa riga il numero
     * si poteva cambiare senza che nessun test se ne accorgesse — ed è il numero che decide quanto
     * è leggibile la frase che la nutrizionista si trova davanti.
     */
    const mostrate = testo.split('vuol dire ')[1].split(' e altre ')[0].split(', ');
    expect(mostrate).toHaveLength(6);
    expect(testo).toMatch(/e altre \d+ voci/);
  });

  /**
   * ⚠️ **«e un'altra voce», non «e altre 1 voci».** Lo legge una persona. `crostacei` ha esattamente
   * sette membri, cioè uno oltre il taglio: è il caso che fa comparire il singolare.
   */
  it('⚠️ con una voce sola oltre il taglio la frase è al singolare', async () => {
    const { service, messaggioCreate } = make(
      {},
      {
        statoAperto: statoAmbito({
          intento: { tipo: 'restrizione', cliente: 'Giulia Rossi', vietati: ['crostacei'], tenuti: [] },
        }),
      },
    );
    await service.parla('lucia', 'solo per lei');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('e un\'altra voce');
    expect(testo).not.toContain('altre 1');
  });

  /** ⚠️ E una parola che non è una categoria non si spiega: «tonno» è tonno e basta. */
  it('⚠️ una parola sola non porta nessuna spiegazione', async () => {
    const { service, messaggioCreate } = make({}, { statoAperto: statoAmbito() });
    await service.parla('lucia', 'solo per lei');
    expect(ultimoAgente(messaggioCreate).testo).not.toContain('per il motore vuol dire');
  });

  /**
   * ⚠️ **Se il controllo dei giorni si rompe, la regola resta scritta e il guasto SI DICE.**
   * Rispondere «fatto» su giorni mai controllati è esattamente la bugia da cui nasce questo lavoro;
   * perdere la scrittura per un rifacimento fallito sarebbe il danno peggiore. Né l'una né l'altro.
   */
  it('⚠️ giorni non controllabili: la regola vale, e lo dice', async () => {
    const { service, profileUpdate, messaggioCreate } = make(
      {
        recipe: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockRejectedValue(new Error('database giù')),
        },
      },
      {
        statoAperto: statoAmbito(),
        // ⚠️ Serve una giornata: senza candidati il catalogo non si legge nemmeno, e il guasto che
        // questo test vuole provare non arriverebbe mai.
        giorniMenu: [
          {
            id: 'g-1', clientId: 'c1', date: giornoSalvato(1), apertoDallaClienteIl: null, apertureTracciate: true,
            meals: [{ slot: 'lunch', recipeId: 'r-1', name: 'Tonno e fagioli', kcal: 400 }],
          },
        ],
      },
    );
    await service.parla('lucia', 'solo per lei');
    expect(profileUpdate).toHaveBeenCalled(); // la scrittura non si perde
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Ho tolto dai suoi menu: tonno');
    expect(testo).toContain('non sono riuscita a intervenire');
  });

  it('non raddoppia una regola già scritta', async () => {
    const { service, profileUpdate, messaggioCreate } = make(
      {},
      { statoAperto: statoAmbito(), profilo: { dislikedFoods: ['tonno'], allergies: [], intolerances: [], name: 'Giulia' } },
    );
    await service.parla('lucia', 'ok');
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('già tutti esclusi');
  });

  it('«a tutte» NON scrive sul profilo: apre una proposta in approvazione', async () => {
    const { service, profileUpdate, registro, messaggioCreate } = make({}, { statoAperto: statoAmbito() });
    await service.parla('lucia', 'estendila a tutte');
    expect(profileUpdate).not.toHaveBeenCalled();
    expect((registro.scrivi as jest.Mock).mock.calls[0][0]).toMatchObject({ inApprovazione: true, ambito: 'catalogo' });
    expect(ultimoAgente(messaggioCreate).testo).toContain('approvazione');
  });

  it('l\'eccezione «ma solo il grana» non finisce fra i vietati', async () => {
    const { service, profileUpdate } = make(
      {},
      {
        statoAperto: statoAmbito({
          intento: { tipo: 'restrizione', cliente: 'Giulia', vietati: ['mozzarella', 'grana'], tenuti: ['grana'] },
        }),
      },
    );
    await service.parla('lucia', 'ok');
    // Se il grana restasse fra i vietati, la regola direbbe l'esatto contrario di quella dettata —
    // e sarebbe perfettamente formata.
    expect(profileUpdate.mock.calls[0][0].data.dislikedFoods).toEqual(['mozzarella']);
  });

  it('la sostituzione nasce «verificata» e con origine «manuale»', async () => {
    const { service, prisma } = make(
      { foodSwap: { upsert: jest.fn().mockResolvedValue({ id: 'f1', volte: 1 }) } },
      {
        statoAperto: statoAmbito({
          frase: 'per Giulia sostituisci il pollo con il tacchino',
          intento: { tipo: 'sostituzione', cliente: 'Giulia', from: 'pollo', to: 'tacchino' },
        }),
      },
    );
    await service.parla('lucia', 'solo per lei');
    const dati = (prisma as unknown as { foodSwap: { upsert: jest.Mock } }).foodSwap.upsert.mock.calls[0][0];
    // «manuale» e non «nutrizionista»: quest'ultima vuol dire «letta da una sua frase», dove a poter
    // aver sbagliato è il programma. Qui la traduzione gliel'ho mostrata e lei ha detto sì.
    expect(dati.create.origine).toBe('manuale');
    expect(dati.create.stato).toBe('verificata');
  });

  /**
   * ⛔ **LA CONVERSAZIONE APERTA AL MOMENTO DEL RILASCIO — 31/8.**
   *
   * La prova qui sopra usa la forma **vecchia** dell'intento (`from`/`to`), ed è quella che l'ha
   * scoperto: lo stato della conversazione resta scritto, quindi al rilascio esistono per davvero
   * nutrizioniste che hanno l'anteprima sullo schermo e scrivono «confermo» un minuto dopo. Se il
   * codice nuovo leggesse solo `da`/`a`, quel «confermo» non scriverebbe niente.
   */
  it('⛔ una conversazione già aperta (forma vecchia from/to) scrive lo stesso', async () => {
    const { service, prisma } = make(
      { foodSwap: { upsert: jest.fn().mockResolvedValue({ id: 'f1', volte: 1 }) } },
      {
        statoAperto: statoAmbito({
          frase: 'per Giulia sostituisci il pollo con il tacchino',
          intento: { tipo: 'sostituzione', cliente: 'Giulia', from: 'pollo', to: 'tacchino' },
        }),
      },
    );
    await service.parla('lucia', 'solo per lei');
    const chiamate = (prisma as unknown as { foodSwap: { upsert: jest.Mock } }).foodSwap.upsert.mock.calls;
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0][0].create.fromFood).toBe('pollo');
    expect(chiamate[0][0].create.toFood).toBe('tacchino');
  });

  it('⛔ IL CASO LORENA: tre alimenti per due sostituti fanno SEI righe, non una', async () => {
    const { service, prisma } = make(
      { foodSwap: { upsert: jest.fn().mockResolvedValue({ id: 'f1', volte: 1 }) } },
      {
        statoAperto: statoAmbito({
          frase: 'a Lorena sostituisci Indivia, Scarola, Verza con zucchine, melanzane',
          intento: { tipo: 'sostituzione', cliente: 'Lorena', da: ['Indivia', 'Scarola', 'Verza'], a: ['zucchine', 'melanzane'] },
        }),
      },
    );
    await service.parla('lucia', 'solo per lei');
    const chiamate = (prisma as unknown as { foodSwap: { upsert: jest.Mock } }).foodSwap.upsert.mock.calls;
    // La chiave di FoodSwap è cliente|ricetta|da|a: due alternative per lo stesso alimento sono
    // due righe legittime, e il motore può pescare l'una o l'altra.
    expect(chiamate).toHaveLength(6);
    const scritte = chiamate.map((c) => `${c[0].create.fromFood}→${c[0].create.toFood}`);
    expect(scritte).toContain('Indivia→zucchine');
    expect(scritte).toContain('Verza→melanzane');
  });
});

describe('VeraChatService — la coda del capo nutrizionista', () => {
  const CODA = [
    {
      id: 'a1',
      frase: 'a tutte le mie niente tonno',
      nutrizionistaId: 'lucia',
      soggettoNome: 'Giulia Rossi',
      dettaglio: { termini: ['tonno'] },
      conflittoSanitario: true,
      createdAt: new Date('2026-08-13T08:00:00.000Z'),
    },
    {
      id: 'a2',
      frase: 'a tutte niente pane',
      nutrizionistaId: 'lucia',
      soggettoNome: null,
      dettaglio: { termini: ['pane'] },
      conflittoSanitario: false,
      createdAt: new Date('2026-08-13T09:00:00.000Z'),
    },
  ];

  it('all’apertura gli porta la prima proposta, già istruita', async () => {
    const { service, messaggioCreate } = make({}, { coda: CODA });
    await service.apri('nocanty');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Ci sono 2 cose che aspettano te');
    // «Già istruita»: chi l'ha dettata, la frase originale, e cosa comporta.
    expect(testo).toContain('«a tutte le mie niente tonno»');
    expect(testo).toContain('tonno');
    expect(testo).toContain('⚠️'); // il conflitto sanitario si vede subito
    expect(stato?.passo).toBe('revisione');
    expect(stato?.azioneId).toBe('a1');
  });

  it('con la coda vuota NON dice niente all’apertura', async () => {
    // Un agente che saluta con «non c'è niente da fare» ogni volta insegna a non leggerlo.
    const { service, messaggioCreate } = make({}, { coda: [] });
    await service.apri('nocanty');
    expect(messaggioCreate).not.toHaveBeenCalled();
  });

  it('«sì» approva e passa subito alla prossima', async () => {
    const { service, messaggioCreate, registro } = make(
      {},
      { coda: CODA, statoAperto: { passo: 'revisione', frase: 'x', azioneId: 'a1' } },
    );
    await service.parla('nocanty', 'sì');
    expect((registro.approva as jest.Mock).mock.calls[0][1]).toBe('a1');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Approvata');
    expect(testo).toContain('Applicata a 3 clienti su 3');
    expect(stato?.passo).toBe('revisione'); // la prossima è già lì
  });

  it('«no» NON respinge subito: prima chiede il motivo', async () => {
    const { service, messaggioCreate, registro } = make(
      {},
      { coda: CODA, statoAperto: { passo: 'revisione', frase: 'x', azioneId: 'a1' } },
    );
    await service.parla('nocanty', 'no');
    expect(registro.respingi).not.toHaveBeenCalled();
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Perché la respingi?');
    expect(stato?.passo).toBe('motivo_rifiuto');
  });

  it('il motivo scritto arriva al registro', async () => {
    const { service, registro } = make(
      {},
      { coda: [], statoAperto: { passo: 'motivo_rifiuto', frase: 'x', azioneId: 'a1' } },
    );
    await service.parla('nocanty', 'il tonno serve per il ferro');
    expect((registro.respingi as jest.Mock).mock.calls[0][2]).toBe('il tonno serve per il ferro');
  });

  it('una risposta ambigua lascia la proposta in coda', async () => {
    const { service, messaggioCreate, registro } = make(
      {},
      { coda: CODA, statoAperto: { passo: 'revisione', frase: 'x', azioneId: 'a1' } },
    );
    await service.parla('nocanty', 'mah');
    expect(registro.approva).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('nel dubbio la lascio in coda');
  });
});

describe('VeraChatService — le domande che aspettano lei', () => {
  const RICHIESTA = {
    id: 'r1',
    tipo: 'allergia_da_tradurre',
    clienteId: 'c1',
    clienteNome: 'Mariastella',
    termine: 'Favismo',
    testo: 'Mariastella ha dichiarato un’allergia che non so tradurre: «Favismo». Cosa devo togliere dal suo piatto?',
    origine: 'personal-base',
    createdAt: new Date('2026-08-13T08:00:00.000Z'),
  };

  /**
   * ⛔ **IL PROMEMORIA DI SORVEGLIANZA NON CHIEDE ALIMENTI, E NON NE SCRIVE.**
   *
   * Il difetto trovato in revisione il 25/8: il promemoria è una `RichiestaVera` come le altre, e
   * tutte le altre finivano nel ramo generico che chiede *«quali alimenti tolgo dal piatto?»*.
   * Lucia leggeva «Giulia è in percorso supervisionato…» seguito da quella domanda, rispondeva
   * «guardata, può proseguire» — che è quello che il testo stesso le suggeriva — e quelle due
   * parole finivano **fra le intolleranze alimentari di Giulia**, scritte dal punto unico con tanto
   * di audit. Il giro dopo Vera chiedeva se valeva «per tutte»: una voce del dizionario di tutte le
   * clienti, nata da un promemoria di sorveglianza.
   */
  describe('⛔ il promemoria sui percorsi supervisionati', () => {
    const PROMEMORIA = {
      id: 'rv-1',
      tipo: 'supervisione_da_guardare',
      clienteId: 'c9',
      clienteNome: 'Giulia',
      termine: 'Può proseguire',
      testo:
        "Giulia è in percorso supervisionato (ha dichiarato farmaci o condizioni in registrazione) e "
        + "nessuno l'ha ancora valutata (da 14 giorni). ⚠️ Nel frattempo RICEVE I MENU: il percorso non "
        + 'è fermo. Dalla sua scheda puoi scrivere «Può proseguire», oppure «Serve una visita».',
      origine: 'sorveglianza-supervisione',
      createdAt: new Date('2026-08-25T02:00:00.000Z'),
    };

    it('⛔ NON chiede quali alimenti togliere dal piatto', async () => {
      const { service, messaggioCreate } = make({}, { richieste: [PROMEMORIA] });
      await service.apri('lucia');
      const { testo, stato } = ultimoAgente(messaggioCreate);
      expect(testo).toContain('Giulia');
      expect(testo).not.toMatch(/alimenti da togliere|togliere dal suo piatto|separati da virgola/i);
      expect(stato?.passo).toBe('promemoria_supervisione');
      // ⛔ E dice dove si decide davvero, invece di lasciar credere che si decida da qui.
      expect(testo).toContain('scheda');
    });

    /**
     * ⛔ **E qualunque cosa risponda, non si scrive niente sul profilo di nessuno.** È la prova che
     * conta: il difetto non era il testo, era la scrittura che il testo invitava a fare.
     */
    it('⛔ rispondendo «guardata, può proseguire» non finisce niente fra le esclusioni', async () => {
      const { service, richieste, profileUpdate } = make(
        {},
        {
          richieste: [PROMEMORIA],
          statoAperto: {
            passo: 'promemoria_supervisione',
            frase: PROMEMORIA.testo,
            richiestaId: 'rv-1',
            clienteId: 'c9',
            clienteNome: 'Giulia',
          },
        },
      );
      await service.parla('lucia', 'guardata, può proseguire');
      expect(richieste.rispondi).not.toHaveBeenCalled();
      expect(profileUpdate).not.toHaveBeenCalled();
    });

    /**
     * ⚠️ **Si mette da parte, e questo non archivia la persona**: il giro notturno la ripropone alla
     * finestra dopo finché la decisione clinica non c'è. È anche il motivo per cui la coda di Vera
     * non si riempie di promemoria vecchi.
     */
    it('⚠️ si chiude senza risposta, e Vera lo dice', async () => {
      const { service, richieste, messaggioCreate } = make(
        {},
        {
          richieste: [PROMEMORIA],
          statoAperto: { passo: 'promemoria_supervisione', frase: PROMEMORIA.testo, richiestaId: 'rv-1', clienteId: 'c9', clienteNome: 'Giulia' },
        },
      );
      await service.parla('lucia', 'ok');
      expect(richieste.chiudiSenzaRisposta).toHaveBeenCalledWith('rv-1', 'lucia', expect.any(String));
      expect(ultimoAgente(messaggioCreate).testo).toContain('dalla sua scheda');
    });
  });

  it('porta la domanda ESATTAMENTE com’è stata scritta, senza riformularla', async () => {
    // Il testo lo scrive chi sa cosa manca. Riscriverlo qui vorrebbe dire che quella che legge la
    // nutrizionista è la mia versione — cioè quella di chi non sa cosa manca.
    const { service, messaggioCreate } = make({}, { richieste: [RICHIESTA] });
    await service.apri('lucia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('«Favismo»');
    expect(testo).toContain('Cosa devo togliere dal suo piatto?');
    expect(stato?.passo).toBe('richiesta');
  });

  it('la risposta scrive sulla cliente e POI chiede se vale per tutte', async () => {
    // ⚠️ §2 del contratto: da una risposta escono DUE scritture, e non vanno fuse.
    const { service, messaggioCreate, richieste } = make(
      {},
      {
        richieste: [RICHIESTA],
        statoAperto: { passo: 'richiesta', frase: RICHIESTA.testo, richiestaId: 'r1', clienteId: 'c1', clienteNome: 'Mariastella', termine: 'Favismo' },
      },
    );
    await service.parla('lucia', 'fave, legumi');
    expect((richieste.rispondi as jest.Mock).mock.calls[0][2]).toEqual({
      alimenti: ['fave', 'legumi'],
      risposta: 'fave, legumi',
    });
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('ho aggiunto alle esclusioni fave, legumi');
    expect(testo).toContain('Vale come **regola generale**?');
    expect(stato?.passo).toBe('richiesta_generale');
  });

  it('«sì» NON scrive nel dizionario: apre una proposta per il capo', async () => {
    // Il vocabolario di tutte le clienti non si allarga con una risposta data fra due visite.
    const { service, messaggioCreate, registro, richieste } = make(
      {},
      {
        richieste: [],
        statoAperto: {
          passo: 'richiesta_generale',
          frase: RICHIESTA.testo,
          richiestaId: 'r1',
          clienteId: 'c1',
          termine: 'Favismo',
          alimenti: ['fave', 'legumi'],
        },
      },
    );
    await service.parla('lucia', 'sì');
    const scritta = (registro.scrivi as jest.Mock).mock.calls[0][0];
    expect(scritta.azione).toBe('voce_dizionario');
    expect(scritta.inApprovazione).toBe(true);
    expect(scritta.dettaglio).toEqual({ famiglia: 'Favismo', membri: ['fave', 'legumi'] });
    expect(richieste.collega).toHaveBeenCalledWith('r1', 'a1');
    expect(ultimoAgente(messaggioCreate).testo).toContain('proposta al capo');
  });

  it('«no» chiude e basta: resta solo sulla cliente', async () => {
    const { service, messaggioCreate, registro } = make(
      {},
      {
        richieste: [],
        statoAperto: { passo: 'richiesta_generale', frase: 'x', richiestaId: 'r1', termine: 'Favismo', alimenti: ['fave'] },
      },
    );
    await service.parla('lucia', 'no');
    expect(registro.scrivi).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('resta solo sulla cliente');
  });

  it('«lascia stare» chiude la domanda senza scrivere alimenti', async () => {
    const { service, richieste } = make(
      {},
      {
        richieste: [],
        statoAperto: { passo: 'richiesta', frase: 'x', richiestaId: 'r1', clienteId: 'c1', termine: 'Favismo' },
      },
    );
    await service.parla('lucia', 'lascia stare');
    expect((richieste.rispondi as jest.Mock).mock.calls[0][2].alimenti).toEqual([]);
  });

  it('⚠️ le proposte da approvare vengono PRIMA delle domande, per il capo', async () => {
    // Dietro una proposta c'è una nutrizionista ferma; dietro una domanda una cliente il cui piatto
    // oggi non è filtrato. Le prime bloccano una persona, e vanno per prime.
    const { service, messaggioCreate } = make(
      {},
      {
        richieste: [RICHIESTA],
        coda: [
          {
            id: 'a1',
            frase: 'a tutte niente tonno',
            nutrizionistaId: 'lucia',
            soggettoNome: null,
            dettaglio: { termini: ['tonno'] },
            conflittoSanitario: false,
            createdAt: new Date('2026-08-13T09:00:00.000Z'),
          },
        ],
      },
    );
    await service.apri('nocanty');
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('revisione');
  });
});


/**
 * ⚠️ Questa è l'unica volta in cui l'assistente apre bocca per una cosa che non aspetta nessuno.
 *
 * «Formaggi molli» sono nove nomi spuntati un martedì: entra la burrata e la regola continua a
 * girare su un elenco vecchio, senza nessun errore. Si chiude solo chiedendo — e siccome nessuno
 * sta aspettando questa risposta, la domanda va **ultima** e non deve mai finire davanti a una
 * cliente il cui piatto oggi non è filtrato.
 */
describe('VeraChatService — il dizionario che invecchia', () => {
  const INVECCHIATA = [{ famigliaId: 'f1', nome: 'formaggi molli', membri: ['mozzarella'], candidati: ['burrata', 'crescenza'] }];

  it('lo chiede all’apertura, quando non c’è niente di più urgente', async () => {
    const { service, messaggioCreate } = make({}, { invecchiate: INVECCHIATA });
    await service.apri('lucia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('formaggi molli');
    expect(testo).toContain('burrata');
    expect(stato?.passo).toBe('aggiorna_famiglia');
  });

  it('⚠️ NON si intromette quando c’è una proposta da approvare', async () => {
    // Dietro la coda c'è una nutrizionista ferma; dietro questa domanda non c'è nessuno che aspetta.
    const coda = [{ id: 'a1', frase: 'a tutte niente tonno', nutrizionistaId: 'lucia', soggettoNome: null, dettaglio: {}, conflittoSanitario: false, createdAt: new Date() }];
    const { service, messaggioCreate } = make({}, { coda, invecchiate: INVECCHIATA });
    await service.apri('lucia');
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('revisione');
  });

  it('l’elenco che risponde entra nella famiglia, insieme a quello che c’era già', async () => {
    const { service, dizionario } = make(
      {},
      { statoAperto: { passo: 'aggiorna_famiglia', frase: '', famigliaId: 'f1', famiglia: 'formaggi molli', proposti: ['burrata', 'crescenza'] } },
    );
    (dizionario.risolvi as jest.Mock).mockResolvedValue({ id: 'f1', nome: 'formaggi molli', membri: ['mozzarella'] });
    await service.parla('lucia', 'burrata');
    expect((dizionario.insegna as jest.Mock).mock.calls[0][1]).toEqual({
      nome: 'formaggi molli',
      membri: ['mozzarella', 'burrata'],
    });
  });

  it('⚠️ un nome che non era fra i proposti NON entra', async () => {
    // Qui lei sta spuntando da un elenco, non dettando: un nome scritto a mano finirebbe nella
    // famiglia senza passare dal catalogo, e sarebbe un membro che non toglie niente.
    const { service, dizionario, messaggioCreate } = make(
      {},
      { statoAperto: { passo: 'aggiorna_famiglia', frase: '', famigliaId: 'f1', famiglia: 'formaggi molli', proposti: ['burrata'] } },
    );
    await service.parla('lucia', 'il gorgonzola');
    expect(dizionario.insegna).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('aggiorna_famiglia');
  });

  it('⚠️ «nessuno» scrive lo stesso: sposta la data, o la domanda torna per sempre', async () => {
    // Una domanda che ritorna dopo che le hai risposto è il modo più rapido per insegnare a non
    // leggerla.
    const { service, dizionario, messaggioCreate } = make(
      {},
      { statoAperto: { passo: 'aggiorna_famiglia', frase: '', famigliaId: 'f1', famiglia: 'formaggi molli', proposti: ['burrata'] } },
    );
    await service.parla('lucia', 'nessuno');
    expect(dizionario.lasciaComEra).toHaveBeenCalledWith('lucia', 'f1');
    expect(dizionario.insegna).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('resta com\'era');
  });

  it('«tutti» prende l’elenco intero, che è corto per costruzione', async () => {
    const { service, dizionario } = make(
      {},
      { statoAperto: { passo: 'aggiorna_famiglia', frase: '', famigliaId: 'f1', famiglia: 'formaggi molli', proposti: ['burrata', 'crescenza'] } },
    );
    await service.parla('lucia', 'tutti');
    expect((dizionario.insegna as jest.Mock).mock.calls[0][1].membri).toEqual(['burrata', 'crescenza']);
  });
});

/**
 * ⚠️ Le azioni 4 e 5. Il caso che conta è che una ricetta NON entri viva in catalogo.
 *
 * Una ricetta attiva entra nel motore, e il motore non chiede il permesso a nessuno: quello che
 * scrive Vera nasce spento e lo accende il capo. E una MODIFICA non si scrive affatto — quella
 * ricetta è già nei piatti di oggi.
 */
describe('VeraChatService — le ricette', () => {
  const VALORI = {
    tonno: { name: 'tonno', kcal: 116, protein: 25, carbs: 0, fat: 1 },
    'olive nere': { name: 'olive', kcal: 235, protein: 2, carbs: 6, fat: 23 },
  };
  const RICETTA = 'Tonno alle olive\ntonno 120 g\nolive nere 30 g\npranzo onnivora';

  it('chiede la ricetta invece di indovinarla', async () => {
    const { service, messaggioCreate } = make();
    await service.parla('lucia', 'inseriamo una ricetta per il menu keto');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBe('ricetta_testo');
    expect(stato?.tagsRicetta).toEqual(['keto']);
    // ⚠️ Le dice di non dettare i valori: quelli li prende dalla tabella.
    expect(testo).toContain('tabella nutrienti');
  });

  it('⚠️ un alimento fuori tabella FERMA la ricetta e viene segnato fra quelli da aggiungere', async () => {
    // Senza i valori veri l'unico modo di riempire le calorie sarebbe indovinarle, e su quei numeri
    // il motore calcola le giornate.
    const { service, messaggioCreate, valori, ricette } = make(
      {},
      { statoAperto: { passo: 'ricetta_testo', frase: 'x', modoRicetta: 'nuova' }, valori: VALORI },
    );
    await service.parla('lucia', 'Tempeh saltato\ntempeh 100 g\npranzo vegana');
    expect(ultimoAgente(messaggioCreate).testo).toContain('non è');
    expect(valori.registraMancante).toHaveBeenCalledWith('tempeh');
    expect(ricette.createRecipe).not.toHaveBeenCalled();
  });

  it('quello che manca lo chiede, e non perde quello che le ha già scritto', async () => {
    const { service, messaggioCreate } = make(
      {},
      { statoAperto: { passo: 'ricetta_testo', frase: 'x', modoRicetta: 'nuova' }, valori: VALORI },
    );
    await service.parla('lucia', 'Tonno alle olive\ntonno 120 g\nolive nere 30 g');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('per quale pasto');
    // ⚠️ Il testo si accumula: alla risposta «pranzo onnivora» la ricetta deve essere ancora tutta lì.
    expect(stato?.testoRicetta).toContain('tonno 120 g');
  });

  it('mostra i macro veri prima di scrivere', async () => {
    const { service, messaggioCreate } = make(
      {},
      { statoAperto: { passo: 'ricetta_testo', frase: 'x', modoRicetta: 'nuova' }, valori: VALORI },
    );
    await service.parla('lucia', RICETTA);
    const { testo, stato } = ultimoAgente(messaggioCreate);
    // 120 g di tonno (116/100) + 30 g di olive (235/100) = 139 + 70,5 → 210
    expect(testo).toContain('210 kcal');
    expect(testo).toContain('bozza');
    expect(stato?.passo).toBe('ricetta_conferma');
  });

  /**
   * ⚠️ IL NOME LIBERO CHE ADESSO SI ABBINA (19/8). Le ricette generate — e le nutrizioniste che
   * dettano — scrivono «spinaci freschi» dove in tabella c'è «spinaci»: in produzione sono 1350
   * ricette. Prima l'alimento risultava **fuori tabella** e la ricetta si fermava.
   *
   * ⚠️ Le regole stanno in `abbinamento-alimenti.ts` e sono due sole: le paroline non contano, e la
   * ricetta più specifica prende la riga generica. Non c'è nessuna somiglianza approssimata.
   */
  it('⚠️ «spinaci freschi» trova «spinaci»: un aggettivo in più non è un altro alimento', async () => {
    const { service, messaggioCreate } = make(
      {},
      {
        statoAperto: { passo: 'ricetta_testo', frase: 'x', modoRicetta: 'nuova' },
        // ⚠️ La riga è a CRUDO: è ciò che rende «freschi» innocuo (vedi `abbinamento-alimenti.ts`).
        valori: { spinaci: { name: 'spinaci', state: 'crudo', kcal: 31, protein: 3, carbs: 3, fat: 0 } },
      },
    );
    await service.parla('lucia', 'Spinaci saltati\nspinaci freschi 200 g\npranzo onnivora');
    const { testo } = ultimoAgente(messaggioCreate);
    // 200 g × 31/100 = 62 kcal: se non si fosse abbinato, direbbe «non ho i valori di spinaci freschi».
    expect(testo).toContain('62 kcal');
    expect(testo).not.toContain('non ho i valori');
  });

  /**
   * ⚠️ E QUELLO CHE NON SI DEVE ABBINARE RESTA FUORI. «Riso» non è «riso integrale»: sono due
   * alimenti, e scambiarli è il difetto da cui è nata tutta la storia del crudo/cotto (voce 228).
   */
  it('⚠️ «riso» non diventa «riso integrale»: la ricetta si ferma e lo dice', async () => {
    const { service, messaggioCreate } = make(
      {},
      {
        statoAperto: { passo: 'ricetta_testo', frase: 'x', modoRicetta: 'nuova' },
        valori: { 'riso integrale': { name: 'riso integrale', kcal: 123, protein: 3, carbs: 26, fat: 1 } },
      },
    );
    await service.parla('lucia', 'Riso in bianco\nriso 80 g\npranzo onnivora');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('riso');
    expect(testo).not.toContain('98 kcal');
  });

  it('⚠️ al sì la ricetta nasce SPENTA e va in coda', async () => {
    // Una ricetta attiva entra nel motore, e il motore non chiede il permesso a nessuno.
    const { service, ricette, registro } = make(
      {},
      { statoAperto: { passo: 'ricetta_conferma', frase: 'x', modoRicetta: 'nuova', testoRicetta: RICETTA }, valori: VALORI },
    );
    await service.parla('lucia', 'sì');
    const scritta = (ricette.createRecipe as jest.Mock).mock.calls[0][1];
    expect(scritta.active).toBe(false);
    expect(scritta.kcal).toBe(210);
    expect(scritta.mealSlot).toBe('lunch');
    expect(scritta.regime).toBe('omnivore');
    expect((registro.scrivi as jest.Mock).mock.calls[0][0]).toMatchObject({
      azione: 'ricetta_nuova', inApprovazione: true, soggettoId: 'r-nuova',
    });
  });

  it('⚠️ una MODIFICA non tocca il catalogo: vive nella proposta', async () => {
    // Quella ricetta è già nei piatti di oggi: applicarla subito li cambierebbe stanotte.
    const { service, ricette, registro, messaggioCreate } = make(
      {},
      {
        statoAperto: { passo: 'ricetta_conferma', frase: 'x', modoRicetta: 'modifica', ricettaId: 'r1', testoRicetta: RICETTA },
        valori: VALORI,
      },
    );
    await service.parla('lucia', 'sì');
    expect(ricette.updateRecipe).not.toHaveBeenCalled();
    expect(ricette.createRecipe).not.toHaveBeenCalled();
    expect((registro.scrivi as jest.Mock).mock.calls[0][0]).toMatchObject({
      azione: 'ricetta_modificata', soggettoId: 'r1', inApprovazione: true,
    });
    expect(ultimoAgente(messaggioCreate).testo).toContain('resta quella di adesso');
  });

  it('«no» non scrive niente', async () => {
    const { service, ricette, registro } = make(
      {},
      { statoAperto: { passo: 'ricetta_conferma', frase: 'x', modoRicetta: 'nuova', testoRicetta: RICETTA }, valori: VALORI },
    );
    await service.parla('lucia', 'no');
    expect(ricette.createRecipe).not.toHaveBeenCalled();
    expect(registro.scrivi).not.toHaveBeenCalled();
  });

  it('⚠️ quale ricetta non si indovina: se ce ne sono due, le elenca', async () => {
    // Modificare la ricetta sbagliata cambia il piatto di chi non c'entra.
    const { service, messaggioCreate } = make({
      recipe: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Tonno alle olive' }, { id: 'r2', name: 'Tonno alle olive e capperi' }]),
      },
    });
    await service.parla('lucia', 'voglio cambiare la ricetta tonno alle olive');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBe('ricetta_quale');
    expect(testo).toContain('capperi');
  });

  it('se non trova la ricetta lo dice, e non ne inventa una', async () => {
    const { service, messaggioCreate } = make({
      recipe: { count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    });
    await service.parla('lucia', 'voglio cambiare la ricetta pollo al curry');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Non trovo nessuna ricetta');
  });
});

describe('VeraChatService — i pasti (azione 3, Decisioni 13/8 §14)', () => {
  const DOMANI = giornoSalvato(1);
  const GIORNO_CON_MERENDA = { id: 'g1', clientId: 'c1', date: DOMANI, apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'breakfast', recipeId: 'r1' }, { slot: 'afternoon_snack', recipeId: 'r2' }] };

  it('«lo spuntino» secco: chiede QUALE, non indovina', async () => {
    const { service, messaggioCreate } = make();
    await service.parla('lucia', 'a Giulia Rossi togli lo spuntino');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBe('quale_spuntino');
    expect(testo).toContain('quale');
  });

  it('con lo slot detto: anteprima con kcal ridistribuite e giorni da rifare, passo conferma', async () => {
    const { service, messaggioCreate } = make({}, { giorniMenu: [GIORNO_CON_MERENDA] });
    await service.parla('lucia', 'togli la merenda a Giulia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBe('conferma');
    expect(testo).toContain('merenda');
    expect(testo).toContain('ridistribu'); // le kcal non si perdono, e l'anteprima lo dice
  });

  it('alla conferma scrive pastiEsclusi, rifà i giorni non visti e NON chiede l\'ambito', async () => {
    const stato = {
      passo: 'conferma' as const,
      frase: 'togli la merenda a Giulia',
      intento: { tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'] },
      clienteId: 'c1',
      clienteNome: 'Giulia',
    };
    const { service, messaggioCreate, prisma, profileUpdate } = make({}, { statoAperto: stato, giorniMenu: [GIORNO_CON_MERENDA] });
    await service.parla('lucia', 'sì');
    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pastiEsclusi: ['afternoon_snack'] }) }),
    );
    expect(prisma.menuDay.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g1'] } } });
    const { testo, stato: dopo } = ultimoAgente(messaggioCreate);
    expect(dopo?.passo).toBeUndefined(); // giro chiuso: niente domanda sull'ambito
    expect(testo).not.toContain('per tutte');
  });

  /**
   * ⛔ **E SI CANCELLA LA CODA, NON I GIORNI CON LA MERENDA** (24/8, voce
   * `giorno-cancellato-che-non-torna`).
   *
   * Domani ha la merenda, dopodomani no. Prima si cancellava **solo domani** — e dopodomani restava
   * l'ultimo giorno in calendario, quindi il motore ripartiva da lì in avanti e **domani non tornava
   * mai**: la cliente apriva l'app e trovava «menu in preparazione», per sempre, su quel giorno solo.
   */
  it('⛔ cancella anche la giornata SENZA merenda che sta dopo: è una coda, non un colabrodo', async () => {
    const senzaMerenda = {
      id: 'g2', clientId: 'c1', date: giornoSalvato(2), apertoDallaClienteIl: null, apertureTracciate: true,
      meals: [{ slot: 'breakfast', recipeId: 'r1' }],
    };
    const { service, prisma } = make(
      {},
      {
        statoAperto: {
          passo: 'conferma' as const,
          frase: 'togli la merenda a Giulia',
          intento: { tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'] },
          clienteId: 'c1',
          clienteNome: 'Giulia',
        },
        giorniMenu: [GIORNO_CON_MERENDA, senzaMerenda],
      },
    );
    await service.parla('lucia', 'sì');
    expect(prisma.menuDay.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g1', 'g2'] } } });
  });

  /**
   * ⛔ **E se in coda c'è un giorno GIÀ APERTO non si tocca niente, e lo si dice.** Quel giorno resta
   * suo — magari ci ha fatto la spesa — ma resterebbe anche l'ultimo, e il buco si riaprirebbe.
   */
  it('⛔ un giorno già aperto dopo quello colpito ferma la cancellazione, con la data', async () => {
    const letto = {
      id: 'g2', clientId: 'c1', date: giornoSalvato(2), apertoDallaClienteIl: new Date(), apertureTracciate: true,
      meals: [{ slot: 'breakfast', recipeId: 'r1' }],
    };
    const { service, prisma, messaggioCreate } = make(
      {},
      {
        statoAperto: {
          passo: 'conferma' as const,
          frase: 'togli la merenda a Giulia',
          intento: { tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'] },
          clienteId: 'c1',
          clienteNome: 'Giulia',
        },
        giorniMenu: [GIORNO_CON_MERENDA, letto],
      },
    );
    await service.parla('lucia', 'sì');
    expect(prisma.menuDay.deleteMany).not.toHaveBeenCalled();
    const [a, m, g] = letto.date.toISOString().slice(0, 10).split('-');
    expect(ultimoAgente(messaggioCreate).testo).toContain(`il menu del ${g}/${m}/${a} l'ha già aperto in app`);
  });

  /**
   * ⛔ **LA QUERY NON DEVE FILTRARE «aperto»** — ed è il difetto che rendeva il caso qui sopra
   * impossibile da vedere: filtrandolo, questo punto non sapeva nemmeno che quel giorno letto
   * esistesse. Il finto dei test ignora il `where`, quindi senza questo controllo il filtro potrebbe
   * tornare domani e tutti i test resterebbero verdi.
   *
   * ⚠️ **I nomi sono cambiati il 26/8** (`viewedAt` → `apertoDallaClienteIl` + `apertureTracciate`)
   * e il controllo li nomina tutti e tre: un guardiano che pinza il nome vecchio non protegge più
   * niente, e resta verde mentre il difetto torna sotto un altro nome.
   */
  it('⛔ i giorni si leggono TUTTI, anche quelli già aperti', async () => {
    const { service, prisma } = make({}, { giorniMenu: [GIORNO_CON_MERENDA] });
    await service.parla('lucia', 'togli la merenda a Giulia');
    const dove = (prisma.menuDay.findMany as jest.Mock).mock.calls.map((c) => c[0]?.where ?? {});
    expect(dove.length).toBeGreaterThan(0);
    for (const w of dove) {
      for (const campo of ['viewedAt', 'apertoDallaClienteIl', 'apertureTracciate']) {
        expect(w).not.toHaveProperty(campo);
      }
    }
  });

  /**
   * ⛔ **SE LA CANCELLAZIONE VA STORTA, NON SI SPARISCE** (24/8, seconda revisione).
   *
   * `pastiEsclusi` è già scritto sul profilo quando si arriva a cancellare i giorni, e la riga di
   * registro si scrive dopo. Un'eccezione qui risaliva fino a `parla()`, che non ha `try/catch`:
   * 500, nessuna risposta dell'agente, spuntino tolto dal profilo, giorni col vecchio, e **nel
   * registro nemmeno la riga** — cioè nemmeno l'annulla.
   */
  it('⛔ se il database non cancella, la risposta arriva lo stesso e lo dice', async () => {
    const { service, prisma, messaggioCreate, registro } = make(
      {},
      {
        statoAperto: {
          passo: 'conferma' as const,
          frase: 'togli la merenda a Giulia',
          intento: { tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'] },
          clienteId: 'c1',
          clienteNome: 'Giulia',
        },
        giorniMenu: [GIORNO_CON_MERENDA],
      },
    );
    (prisma.menuDay.deleteMany as jest.Mock).mockRejectedValue(new Error('database giù'));
    await service.parla('lucia', 'sì');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('non sono riuscita a intervenire');
    // ⚠️ E la riga di registro c'è: senza, non ci sarebbe nemmeno l'annulla.
    expect(registro.scrivi).toHaveBeenCalled();
    expect((registro.scrivi as jest.Mock).mock.calls[0][0].dettaglio).toMatchObject({
      esitoGiorni: 'non_riuscita', giorniRifatti: 0,
    });
  });

  it('se era già così, lo dice e non tocca niente', async () => {
    const stato = {
      passo: 'conferma' as const,
      frase: 'togli la merenda a Giulia',
      intento: { tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: ['afternoon_snack'] },
      clienteId: 'c1',
      clienteNome: 'Giulia',
    };
    const { service, messaggioCreate, profileUpdate } = make(
      {},
      { statoAperto: stato, profilo: { dislikedFoods: [], allergies: [], intolerances: [], name: 'Giulia', pastiEsclusi: ['afternoon_snack'] } },
    );
    await service.parla('lucia', 'sì');
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('già');
  });

  it('dal passo quale_spuntino, «il pomeriggio» porta all\'anteprima', async () => {
    const stato = {
      passo: 'quale_spuntino' as const,
      frase: 'togli lo spuntino a Giulia',
      intento: { tipo: 'pasti', cliente: 'Giulia', azione: 'togli', slots: null },
      clienteId: 'c1',
      clienteNome: 'Giulia',
    };
    const { service, messaggioCreate } = make({}, { statoAperto: stato, giorniMenu: [GIORNO_CON_MERENDA] });
    await service.parla('lucia', 'quello del pomeriggio');
    const { stato: dopo } = ultimoAgente(messaggioCreate);
    expect(dopo?.passo).toBe('conferma');
  });
});

describe('VeraChatService — la famiglia chiesta a secco (13/8, 17:47)', () => {
  it('«hai la lista?» su una famiglia nota: la mostra e basta', async () => {
    const { service, messaggioCreate, dizionario } = make({}, {});
    (dizionario as never as { risolvi: jest.Mock }).risolvi.mockResolvedValue({ id: 'v1', membri: ['feta', 'brie', 'gorgonzola'] });
    await service.parla('lucia', 'hai la lista dei formaggi molli?');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('feta');
    expect(stato).toBeUndefined(); // nessun dialogo appeso: era una domanda, ha avuto risposta
  });

  it('su una famiglia ignota chiede l\'elenco, come dentro una regola', async () => {
    const { service, messaggioCreate } = make();
    await service.parla('lucia', 'crea la lista dei formaggi molli');
    const { stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBe('quale_famiglia');
    expect(stato?.famiglia).toBe('formaggi molli');
  });

  it('imparata a secco si chiude lì: niente anteprima su nessuna cliente', async () => {
    const statoAperto = {
      passo: 'quale_famiglia' as const,
      frase: 'crea la lista dei formaggi molli',
      intento: { tipo: 'famiglia', azione: 'crea', nome: 'formaggi molli' },
      famiglia: 'formaggi molli',
      famiglieDaChiedere: ['formaggi molli'],
    };
    const { service, messaggioCreate, pool } = make({}, { statoAperto });
    await service.parla('lucia', 'feta, brie, gorgonzola');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo.toLowerCase()).toContain('formaggi molli');
    expect(stato).toBeUndefined();
    expect((pool as never as { anteprima: jest.Mock }).anteprima).not.toHaveBeenCalled();
  });
});

describe('VeraChatService — «hai segnalazioni per me?»: la guida della giornata (Simone, 14/8)', () => {
  it('a giornata vuota risponde che non c\'è niente — non «non ci arrivo»', async () => {
    // Lo screenshot del 14/8, 08:35: la domanda esplicita cadeva nel «non capito», che è vero e
    // fuorviante — la risposta giusta esisteva già (codaVuota).
    const { service, messaggioCreate } = make();
    await service.parla('nocanty', 'Ciao hai segnalazioni per me?');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Non c\'è niente che aspetta te');
    expect(testo).not.toContain('Non ci arrivo');
  });

  it('col lavoro in coda fa il quadro E porta subito la prima proposta, già istruita', async () => {
    const { service, messaggioCreate } = make({}, {
      coda: [{
        id: 'a1', frase: 'a tutte niente tonno', nutrizionistaId: 'lucia', soggettoNome: null,
        dettaglio: { termini: ['tonno'] }, conflittoSanitario: false, createdAt: new Date('2026-08-13T08:00:00.000Z'),
      }],
    });
    await service.parla('nocanty', 'cosa mi aspetta oggi?');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('da approvare');
    // Guida, non elenca: dopo il quadro c'è già la prima cosa da fare.
    expect(testo).toContain('«a tutte niente tonno»');
    expect(stato?.passo).toBe('revisione');
  });

  it('⚠️ le segnalazioni cliniche vanno IN TESTA (Simone, 14/8, pagina Lavori)', async () => {
    const count = jest.fn().mockImplementation(({ where }: { where: { category?: string } }) =>
      Promise.resolve(where.category === 'clinical' ? 2 : 3));
    const { service, messaggioCreate } = make({ escalation: { count } }, { daVerificare: 1 });
    await service.parla('nocanty', 'hai segnalazioni per me?');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('2 segnalazioni cliniche');
    expect(testo).toContain('1 segnalazione aperta');
    // «in testa a tutte»: la riga clinica viene prima di ogni altra.
    expect(testo.indexOf('cliniche')).toBeLessThan(testo.indexOf('sostituzion'));
  });

  it('legge la campanella: gli avvisi non letti, raggruppati e con l\'etichetta', async () => {
    const { service, messaggioCreate } = make({}, {
      avvisi: [
        { type: 'vera_conflitto_sanitario' },
        { type: 'vera_conflitto_sanitario' },
        { type: 'stall_coach_alert' },
      ],
    });
    await service.parla('nocanty', 'novità?');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('campanella');
    expect(testo).toContain('2 su conflitti sanitari');
  });

  it('⚠️ le vera_richiesta della campanella NON si contano due volte (le code vengono dalle tabelle)', async () => {
    const { service, messaggioCreate } = make({}, { avvisi: [{ type: 'vera_richiesta' }] });
    await service.parla('nocanty', 'novità?');
    const { testo } = ultimoAgente(messaggioCreate);
    // L'unica notifica non letta è già raccontata dalla coda delle domande: niente riga campanella.
    expect(testo).not.toContain('campanella');
  });

  it('⚠️ una fonte rotta si DICE, non si finge uno zero («non lo so» ≠ «nessuno»)', async () => {
    const { service, messaggioCreate } = make({
      escalation: { count: jest.fn().mockRejectedValue(new Error('boom')) },
    }, { daVerificare: 2 });
    await service.parla('nocanty', 'hai segnalazioni per me?');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('2 sostituzioni da verificare');
    expect(testo).toContain('Non sono riuscito a leggere');
  });
});

/**
 * «SPOSTA GIULIA SULLA KETO» — il cambio di dieta (azione 3, risposta di Simone del 14/8).
 * Decisione in progetto/NOTA_Vera_Variante_Piano.md: una strada sola (la porta della scheda),
 * la domanda «da quando?», e mai un menu toccato a mano da qui.
 */
describe('VeraChatService — il cambio di dieta (azione 3, 14/8)', () => {
  const DIETE = [
    { name: 'Keto', style: 'keto', regime: 'omnivore', approvedAt: new Date('2026-07-01') },
    { name: 'Mediterranea', style: 'mediterranean', regime: 'omnivore', approvedAt: new Date('2026-07-01') },
  ];
  const conDiete = (righe: unknown[] = DIETE) => ({
    diet: { findMany: jest.fn().mockResolvedValue(righe) },
  });

  async function finoAllaConferma(extra: Record<string, unknown> = {}) {
    const made = make({ ...conDiete(), ...extra });
    const { service, messaggioCreate } = made;
    await service.parla('lucia', 'sposta Giulia Rossi sulla keto');
    const daQuando = ultimoAgente(messaggioCreate);
    return { ...made, daQuando };
  }

  it('trova la dieta e chiede «da quando?» PRIMA di confermare', async () => {
    const { daQuando } = await finoAllaConferma();
    expect(daQuando.stato?.passo).toBe('da_quando');
    expect(daQuando.testo).toContain('da subito');
    expect(daQuando.testo).toContain('lascia i giorni già preparati');
  });

  it('«da subito» + sì: scrive TUTTI E TRE i campi dalla porta della scheda, con l\'attrice vera', async () => {
    const { service, daQuando, clienti, messaggioCreate, registro } = await finoAllaConferma();
    await service.parla('lucia', 'da subito');
    const conferma = ultimoAgente(messaggioCreate);
    expect(conferma.stato?.passo).toBe('conferma');
    await service.parla('lucia', 'sì');
    expect(clienti.updateClient).toHaveBeenCalledWith('c1', 'lucia', {
      regime: 'omnivore',
      dietStyle: 'keto',
      dietFamily: 'Keto',
    });
    // E la riga di registro c'è, con la frase originale.
    const scritta = (registro.scrivi as jest.Mock).mock.calls[0][0];
    expect(scritta.azione).toBe('variante_cliente');
    expect(scritta.frase).toBe('sposta Giulia Rossi sulla keto');
    expect(scritta.dettaglio.cambioDieta.daSubito).toBe(true);
  });

  it('«lascia i giorni già preparati» passa il flag che NON rifà i giorni erogati', async () => {
    const { service, clienti } = await finoAllaConferma();
    await service.parla('lucia', 'lascia i giorni già preparati');
    await service.parla('lucia', 'sì');
    const dto = (clienti.updateClient as jest.Mock).mock.calls[0][2];
    expect(dto.dietChangeKeepDeliveredDays).toBe(true);
  });

  it('⚠️ un «no» alla conferma NON scrive niente', async () => {
    const { service, clienti } = await finoAllaConferma();
    await service.parla('lucia', 'da subito');
    await service.parla('lucia', 'no');
    expect(clienti.updateClient).not.toHaveBeenCalled();
  });

  it('la dieta che non c\'è si dice, coi nomi disponibili — non si indovina', async () => {
    const { service, messaggioCreate, clienti } = make({ ...conDiete() });
    await service.parla('lucia', 'sposta Giulia Rossi sulla paleo');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('paleo');
    expect(testo).toContain('Keto');
    expect(stato?.passo).toBe('quale_dieta');
    expect(clienti.updateClient).not.toHaveBeenCalled();
  });

  it('⚠️ «da quando» non capito due volte: si ANNULLA senza scrivere (una data non si indovina)', async () => {
    const { service, clienti, messaggioCreate } = await finoAllaConferma();
    await service.parla('lucia', 'boh');
    await service.parla('lucia', 'mah vedi tu');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Non ho scritto niente');
    expect(clienti.updateClient).not.toHaveBeenCalled();
  });

  it('se la porta della scheda rifiuta (permesso), lo si dice e non si registra niente', async () => {
    const { service, registro, messaggioCreate } = await finoAllaConferma({
    });
    const made = await finoAllaConferma();
    (made.clienti.updateClient as jest.Mock).mockRejectedValue(new Error('Cambiare il tipo di dieta richiede il permesso'));
    await made.service.parla('lucia', 'da subito');
    await made.service.parla('lucia', 'sì');
    const { testo } = ultimoAgente(made.messaggioCreate);
    expect(testo).toContain('Non sono riuscita a scrivere');
    expect((made.registro.scrivi as jest.Mock)).not.toHaveBeenCalled();
    void service; void registro; void messaggioCreate;
  });
});

/**
 * I «GIRATI» DI GAIA DENTRO VERA (Simone, 14/8): «da una parte o dall'altra il nutrizionista
 * risponde». Decisione in progetto/NOTA_Vera_Porta_I_Girati_Di_Gaia.md.
 */
describe('VeraChatService — il nome quando ce l\'ho già', () => {
  const conNome = (nomeAgente: string | null) => ({
    staff: { findFirst: jest.fn().mockResolvedValue({ nomeAgente }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  });

  it('⛔ a nome fatto, «ti voglio chiamare Lucia» non riceve «non ci arrivo»', async () => {
    const { service, messaggioCreate } = make(conNome('Vera'));
    await service.parla('lucia', 'ti voglio chiamare Lucia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    // ← prima: «Non ci arrivo», a una frase chiarissima e nel primo incontro.
    expect(testo).not.toContain('Non ci arrivo');
    expect(testo).toContain('Vera');
    expect(testo).toContain('Lucia');
    expect(stato?.passo).toBe('cambio_nome');
  });

  it('e se confermo, il nome cambia davvero', async () => {
    const over = conNome('Vera');
    const { service } = make(over);
    await service.parla('lucia', 'ti voglio chiamare Lucia');
    await service.parla('lucia', 'sì');
    expect((over.staff.updateMany as jest.Mock).mock.calls[0][0].data.nomeAgente).toBe('Lucia');
  });

  it('«no» lascia le cose come stanno, e non è un fallimento', async () => {
    const over = conNome('Vera');
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'da oggi sei Lucia');
    await service.parla('lucia', 'no');
    expect(over.staff.updateMany).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('resto Vera');
  });

  it('⚠️ se il nome proposto è quello che ho già, non si chiede niente', async () => {
    const over = conNome('Vera');
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'ti chiamo Vera');
    expect(over.staff.updateMany).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('resto Vera');
  });

  it('⛔ «lascia stare, ti chiamo dopo» resta un «annulla», non una proposta di nome', async () => {
    // ← prima il ramo del nome passava davanti ad «annulla» e alla coda del capo: un
    //   riconoscimento che è un indovinello su una parola non deve battere una risposta certa.
    const { service, messaggioCreate } = make(conNome('Vera'));
    await service.parla('lucia', 'lascia stare, ti chiamo dopo');
    expect(ultimoAgente(messaggioCreate).stato?.passo).not.toBe('cambio_nome');
    // ⚠️ E anche con un nome PROPRIO dentro: è l'ordine dei rami che deve tenere, non il fatto che
    //    «dopo» sia minuscolo. Senza, questo test resterebbe verde spostando il ramo del nome.
    const secondo = make(conNome('Vera'));
    await secondo.service.parla('lucia', 'lascia stare, ti chiamo Lucia');
    expect(ultimoAgente(secondo.messaggioCreate).stato?.passo).not.toBe('cambio_nome');
  });

  it('dentro «cambio nome» una frase di lavoro esce e si esegue', async () => {
    const { service, messaggioCreate } = make(conNome('Vera'));
    await service.parla('lucia', 'ti voglio chiamare Lucia');
    await service.parla('lucia', 'a Giulia Rossi niente formaggi molli');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('formaggi molli');
  });

  it('e se non si capisce nemmeno la risposta, dopo due giri si lascia perdere il nome', async () => {
    const over = conNome('Vera');
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'ti voglio chiamare Lucia');
    await service.parla('lucia', 'boh');
    await service.parla('lucia', 'mah');
    // ← senza contatore: la stessa domanda all'infinito, come nello screenshot del 17/8.
    expect(ultimoAgente(messaggioCreate).testo).toContain('resto Vera');
    expect(over.staff.updateMany).not.toHaveBeenCalled();
  });

  it('⚠️ e una cortesia NON diventa una proposta di ribattezzarsi', async () => {
    const over = conNome('Vera');
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'grazie');
    // Col nome secco, «grazie» sarebbe stato letto come il nome nuovo.
    expect(ultimoAgente(messaggioCreate).stato?.passo).not.toBe('cambio_nome');
  });
});

describe('VeraChatService — le domande girate da Gaia', () => {
  const GIRATA = [{
    id: 'r-gaia', tipo: 'girata_da_gaia', clienteId: 'c1', clienteNome: 'Giulia Rossi',
    testo: 'Su «Miele» preferisco non decidere da sola: non ho un\'alternativa che mi convinca.',
    chiave: 'gaia:esc-1', origine: 'chat-gaia', createdAt: new Date('2026-08-14T09:01:00.000Z'),
  }];
  const conEscalation = (stato = 'open') => ({
    escalation: { findUnique: jest.fn().mockResolvedValue({ status: stato }), update: jest.fn().mockResolvedValue({}) },
    chatThread: { upsert: jest.fn().mockResolvedValue({ id: 'th-1' }), update: jest.fn().mockResolvedValue({}) },
    message: { create: jest.fn().mockResolvedValue({ id: 'm-1' }) },
  });

  it('la porta in chat con la SUA domanda: si risponde per la cliente, non con un elenco di alimenti', async () => {
    const { service, messaggioCreate } = make(conEscalation(), { richieste: GIRATA });
    await service.apri('lucia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Giulia Rossi');
    expect(testo).toContain('Miele');
    // ⚠️ NON la domanda delle allergie: lì si chiede un elenco, qui una risposta per la cliente.
    expect(testo).not.toContain('elencami gli alimenti');
    expect(testo).toContain('la vedo io');
    expect(stato?.passo).toBe('risposta_cliente');
  });

  it('la risposta dettata ARRIVA alla cliente e chiude anche la segnalazione', async () => {
    const over = conEscalation();
    const { service, messaggioCreate, prisma } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', 'Il miele va bene, tienilo: 10 g al mattino.');
    const messaggio = (over.message.create as jest.Mock).mock.calls[0][0].data;
    expect(messaggio.body).toContain('Il miele va bene');
    expect(messaggio.senderUserId).toBe('lucia');
    // L'altra metà: la segnalazione non resta aperta in pagina.
    expect((over.escalation.update as jest.Mock).mock.calls[0][0].data.status).toBe('resolved');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Giulia Rossi');
    void prisma;
  });

  /**
   * ⛔ **IL CASO DEL 31/8, ed è il difetto più grave del gruppo Vera.**
   *
   * La nutrizionista ha scritto, con una segnalazione aperta: «il merluzzo può essere sostituito
   * con orata, salmone o spigola estendi la regola a tutti». Vera ha risposto *«Fatto: l'ho
   * scritta a Dany nella vostra chat, e ho chiuso la segnalazione»* — e **non aveva creato nessuna
   * regola**: aveva inoltrato la frase alla cliente e chiuso l'escalation. *Fare la cosa sbagliata
   * con sicurezza è peggio che non farla: un «fatto» nessuno lo ricontrolla.*
   */
  const DETTATA = 'il merluzzo può essere sostituito con orata, salmone o spigola estendi la regola a tutti';

  it('⛔ una REGOLA dettata non viene inoltrata alla cliente: Vera chiede quale delle due cose vuole', async () => {
    const over = conEscalation();
    const { service, messaggioCreate } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', DETTATA);
    // ← prima: il messaggio partiva, l'escalation si chiudeva, e la risposta diceva «Fatto».
    expect(over.message.create).not.toHaveBeenCalled();
    expect(over.escalation.update).not.toHaveBeenCalled();
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('regola');
    expect(testo).not.toContain('Fatto');
    expect(stato?.passo).toBe('risposta_o_regola');
  });

  it('al bivio, «scrivila come regola» porta all\'anteprima della regola — e la segnalazione resta aperta', async () => {
    const over = conEscalation();
    const { service, messaggioCreate } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', DETTATA);
    await service.parla('lucia', 'scrivila come regola');
    expect(over.message.create).not.toHaveBeenCalled();
    // La cliente aspetta ancora una risposta: la regola è un'altra cosa.
    expect(over.escalation.update).not.toHaveBeenCalled();
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('merluzzo');
    expect(testo).toMatch(/orata|salmone|spigola/);
  });

  it('⛔ al bivio, se la frase nomina un\'ALTRA cliente non si scrive su quella della segnalazione', async () => {
    /**
     * ⚠️ Il doppio di serie trova SEMPRE la stessa cliente, qualunque cosa si cerchi: con quello
     * questo caso non si può misurare, perché «Marta» risulterebbe trovata e sarebbe Giulia. Qui la
     * ricerca non trova nessuno, che è la situazione vera di un nome sconosciuto.
     */
    const over = {
      ...conEscalation(),
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }), findMany: jest.fn().mockResolvedValue([]) },
    };
    const { service, messaggioCreate } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', 'a Marta il merluzzo può essere sostituito con orata o spigola');
    await service.parla('lucia', 'scrivila come regola');
    const { testo } = ultimoAgente(messaggioCreate);
    // ← prima: l'anteprima diceva «Per Giulia Rossi», cioè la regola sulla persona sbagliata, e il
    //   «non trovo nessuna cliente che si chiami Marta» non lo leggeva nessuno.
    expect(testo).not.toContain('Giulia Rossi');
    expect(testo).toContain('Marta');
  });

  it('dal bivio si esce: «la vedo io» funziona ancora, e al secondo «non ho capito» si manda', async () => {
    const over = conEscalation();
    const { service } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', DETTATA);
    await service.parla('lucia', 'la vedo io');
    // La via d'uscita del girato: nessun messaggio alla cliente, segnalazione non chiusa da noi.
    expect(over.message.create).not.toHaveBeenCalled();
    expect(over.escalation.update).not.toHaveBeenCalled();

    const over2 = conEscalation();
    const { service: s2 } = make(over2, { richieste: GIRATA });
    await s2.apri('lucia');
    await s2.parla('lucia', DETTATA);
    await s2.parla('lucia', 'boh');
    await s2.parla('lucia', 'mah');
    // ← senza il contatore: si resta nel bivio per sempre, come nello screenshot del 17/8.
    expect((over2.message.create as jest.Mock).mock.calls[0][0].data.body).toBe(DETTATA);
  });

  it('al bivio, «mandala così com\'è» fa quello che faceva prima: manda e chiude', async () => {
    const over = conEscalation();
    const { service } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', DETTATA);
    await service.parla('lucia', 'mandala così com\'è');
    expect((over.message.create as jest.Mock).mock.calls[0][0].data.body).toBe(DETTATA);
    expect((over.escalation.update as jest.Mock).mock.calls[0][0].data.status).toBe('resolved');
  });

  it('⚠️ una risposta NORMALE alla cliente non passa dal bivio: parte com\'è', async () => {
    // Il bivio non deve trasformare ogni risposta in una domanda: scatta solo dove la frase è
    // riconoscibile come un'azione.
    const over = conEscalation();
    const { service } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', 'Il miele va bene, tienilo: 10 g al mattino.');
    expect((over.message.create as jest.Mock).mock.calls[0][0].data.body).toContain('Il miele va bene');
    expect((over.escalation.update as jest.Mock).mock.calls[0][0].data.status).toBe('resolved');
  });

  it('«la vedo io» chiude la domanda SENZA scrivere alla cliente', async () => {
    const over = conEscalation();
    const { service } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    await service.parla('lucia', 'la vedo io');
    expect(over.message.create).not.toHaveBeenCalled();
    // La segnalazione resta aperta: se la vede lei, la chiude lei dalla pagina o dalla chat.
    expect(over.escalation.update).not.toHaveBeenCalled();
  });

  it('⚠️ se la segnalazione è già stata chiusa dalla pagina, la domanda NON si fa più', async () => {
    const over = conEscalation('resolved');
    const { service, messaggioCreate, richieste } = make(over, { richieste: GIRATA });
    await service.apri('lucia');
    // La richiesta si chiude da sola e l'agente non porta niente: a coda vuota tace.
    expect((richieste.chiudiSenzaRisposta as jest.Mock).mock.calls[0][0]).toBe('r-gaia');
    expect(messaggioCreate).not.toHaveBeenCalled();
    /**
     * ⚠️ E il FRENO tiene. Qui il finto restituisce sempre la stessa lista (in produzione la
     * richiesta chiusa sparisce da `aperte`): senza il contatore di giri questo sarebbe un ciclo
     * infinito dentro l'apertura della pagina.
     */
    expect((richieste.chiudiSenzaRisposta as jest.Mock).mock.calls.length).toBeLessThanOrEqual(12);
  });
});

/**
 * «RIDUCI LE KCAL DEL 10% A GIULIA PER 7 GIORNI» (Nocanty via Vera).
 * Decisione in progetto/NOTA_Vera_Detta_La_Correzione_Kcal.md.
 */
describe('VeraChatService — la correzione calorica dettata', () => {
  const kcalFinto = () => ({
    simulaKcal: jest.fn().mockResolvedValue({ prima: { target: 1620 }, dopo: { target: 1460 } }),
    impostaKcal: jest.fn().mockResolvedValue({ ok: true }),
  });

  it('l\'anteprima dice il NUMERO VERO, non la percentuale', async () => {
    const kcal = kcalFinto();
    const { service, messaggioCreate } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('1620');
    expect(testo).toContain('1460');
    expect(testo).toContain('7 giorni');
    expect(stato?.passo).toBe('conferma');
  });

  /**
   * ⛔ **`undefined` E NON `null` PER IL DEFICIT** (corretto il 28/8, trovato in revisione).
   *
   * `null` vuol dire «togli il deficit»; `undefined` vuol dire «non lo sto nominando». Con `null`
   * l'anteprima calcolava il «dopo» **senza il deficit imposto dal nutrizionista** — un numero più
   * alto del vero, mostrato proprio per farlo confermare, e proprio sulle clienti che un deficit
   * scritto a mano ce l'hanno. Qui si sta simulando solo la percentuale.
   */
  it('⛔ l\'anteprima non spegne il deficit imposto: non lo nomina nemmeno', async () => {
    const kcal = kcalFinto();
    const { service } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    const [, , deficit, pct] = (kcal.simulaKcal as jest.Mock).mock.calls[0];
    expect(deficit).toBeUndefined();
    expect(pct).toBe(-10);
  });

  /**
   * ⛔ **E se il fabbisogno è sospeso lo dice PRIMA di far confermare.** I due numeri si calcolano
   * lo stesso, ma oggi non sono quelli nel piatto: far confermare «passa da 1620 a 1460» senza
   * dirlo è far prendere una decisione su un numero che non esiste. ⚠️ La correzione si scrive
   * comunque — varrà quando le pesate saranno sistemate.
   */
  it('⛔ col fabbisogno sospeso avvisa, ma lascia confermare', async () => {
    const kcal = {
      simulaKcal: jest.fn().mockResolvedValue({
        prima: { target: 1620 },
        dopo: { target: 1460, pesoIncoerente: { frase: 'da 113 kg a 73 kg in 7 giorni' } },
      }),
      impostaKcal: jest.fn().mockResolvedValue({ ok: true }),
    };
    const { service, messaggioCreate } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('sospeso');
    expect(testo).toContain('113 kg');
    expect(testo).toContain('Confermi?');
    expect(stato?.passo).toBe('conferma');
  });

  /**
   * ⚠️ **E il negativo**: con l'avviso reso incondizionato comparirebbe su ogni anteprima, e *un
   * avviso che compare sempre non è un avviso*.
   */
  it('⚠️ col fabbisogno regolare l\'anteprima non parla di sospensione', async () => {
    const { service, messaggioCreate } = make({}, { kcal: kcalFinto() });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    expect(ultimoAgente(messaggioCreate).testo).not.toContain('sospeso');
  });

  /**
   * ⛔ **L'ULTIMA FRASE NON SMENTISCE LA PRIMA.** Dopo il sì Vera chiudeva con «Fatto: scende a 1460
   * kcal al giorno» anche quando trenta secondi prima aveva avvisato che quel numero non è nel
   * piatto. E il registro archiviava la stessa coppia prima/dopo senza marcatore, mentre lo storico
   * delle calorie la marcava: due archivi della stessa decisione, uno dei due falso.
   */
  it('⛔ dopo il sì lo ridice, e lo scrive anche nel registro', async () => {
    const kcal = {
      simulaKcal: jest.fn().mockResolvedValue({ prima: { target: 1620 }, dopo: { target: 1460 } }),
      impostaKcal: jest.fn().mockResolvedValue({ fabbisognoSospeso: 'da 113 kg a 73 kg in 7 giorni' }),
    };
    const { service, messaggioCreate, registro } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    await service.parla('lucia', 'sì');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('non si vede ancora nel piatto');
    expect(testo).toContain('113 kg');
    // ⛔ E dice che la scadenza parte da oggi: è la parte che rende la promessa vera invece che
    // consolatoria — una correzione a termine può scadere senza essere mai stata applicata.
    expect(testo).toContain('parte da oggi');
    const dettaglio = (registro.scrivi as jest.Mock).mock.calls[0][0].dettaglio;
    expect(dettaglio.correzioneKcal.sospeso).toContain('113 kg');
  });

  it('al sì scrive dalla PORTA della scheda, col motivo = la frase originale', async () => {
    const kcal = kcalFinto();
    const { service } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    await service.parla('lucia', 'sì');
    const [, clientId, input] = (kcal.impostaKcal as jest.Mock).mock.calls[0];
    expect(clientId).toBe('c1');
    expect(input.correzionePct).toBe(-10);
    expect(input.perGiorni).toBe(7);
    expect(input.motivo).toContain('riduci le kcal del 10%');
  });

  it('senza durata la CHIEDE: «per 7 giorni» e «per sempre» non sono la stessa cosa', async () => {
    const { service, messaggioCreate } = make({}, { kcal: kcalFinto() });
    await service.parla('lucia', 'riduci le kcal del 5% a Giulia Rossi');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('per quanto');
    expect(stato?.passo).toBe('quanti_giorni');
  });

  it('«per sempre» è una risposta esplicita, e scrive senza scadenza', async () => {
    const kcal = kcalFinto();
    const { service } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 5% a Giulia Rossi');
    await service.parla('lucia', 'per sempre');
    await service.parla('lucia', 'sì');
    expect((kcal.impostaKcal as jest.Mock).mock.calls[0][2].perGiorni).toBeUndefined();
  });

  it('⚠️ sotto la soglia di sicurezza Vera SI FERMA: quella conferma si dà dalla scheda', async () => {
    const kcal = kcalFinto();
    (kcal.impostaKcal as jest.Mock).mockRejectedValue(
      new Error('Con questi valori il menu scenderebbe a 980 kcal/giorno, sotto la soglia minima di sicurezza.'),
    );
    const { service, messaggioCreate } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 40% a Giulia Rossi per 7 giorni');
    await service.parla('lucia', 'sì');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('980');
    expect(testo).toContain('scheda');
  });

  it('⚠️ un «no» non scrive niente', async () => {
    const kcal = kcalFinto();
    const { service } = make({}, { kcal });
    await service.parla('lucia', 'riduci le kcal del 10% a Giulia Rossi per 7 giorni');
    await service.parla('lucia', 'no');
    expect(kcal.impostaKcal).not.toHaveBeenCalled();
  });
});

describe('VeraChatService — il capo vede chi ha già una sua versione della parola (14/8)', () => {
  const PROPOSTA = [{
    id: 'a1', frase: 'per tutte «formaggi molli» sono questi', nutrizionistaId: 'lucia',
    soggettoNome: 'Giulia', dettaglio: { famiglia: 'formaggi molli', membri: ['stracchino', 'crescenza'] },
    conflittoSanitario: false, createdAt: new Date('2026-08-14T08:00:00.000Z'),
  }];

  it('⚠️ prima del sì gli dice CHI ne ha una diversa, e che le loro restano', async () => {
    const made = make({
      staff: {
        updateMany: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ displayName: 'Lucia' }),
        findFirst: jest.fn().mockResolvedValue({ nomeAgente: 'Vera' }),
        findMany: jest.fn().mockResolvedValue([{ userId: 'anna', displayName: 'Anna' }]),
      },
    }, { coda: PROPOSTA });
    (made.dizionario as unknown as { altreVersioniPersonali: jest.Mock }).altreVersioniPersonali =
      jest.fn().mockResolvedValue([{ nutrizionistaId: 'anna', nome: 'formaggi molli', membri: ['stracchino', 'mozzarella'] }]);

    await made.service.apri('nocanty');
    const { testo } = ultimoAgente(made.messaggioCreate);
    expect(testo).toContain('Anna');
    expect(testo).toContain('crescenza');   // quello che la comune aggiungerebbe
    expect(testo).toContain('mozzarella');  // quello che ha lei e la comune non ha
    expect(testo).toContain('restano');     // e cosa NON succede
  });

  it('senza nessuno che la usi diversamente, nessuna riga in più', async () => {
    const made = make({}, { coda: PROPOSTA });
    (made.dizionario as unknown as { altreVersioniPersonali: jest.Mock }).altreVersioniPersonali =
      jest.fn().mockResolvedValue([]);
    await made.service.apri('nocanty');
    expect(ultimoAgente(made.messaggioCreate).testo).not.toContain('versione diversa');
  });

  it('⚠️ se la lettura dei conflitti si rompe, la coda funziona lo stesso', async () => {
    const made = make({}, { coda: PROPOSTA });
    (made.dizionario as unknown as { altreVersioniPersonali: jest.Mock }).altreVersioniPersonali =
      jest.fn().mockRejectedValue(new Error('boom'));
    await made.service.apri('nocanty');
    const { testo, stato } = ultimoAgente(made.messaggioCreate);
    expect(stato?.passo).toBe('revisione');
    expect(testo).toContain('formaggi molli');
  });
});

/**
 * «RIFAI CON PIÙ PROTEINE» (decisione A di Simone, 14/8; foglio in DECISIONE_Piu_Proteine.md).
 * La banda esisteva solo per DIETA: qui si scrive la quota minima di QUESTA cliente.
 */
describe('VeraChatService — «più proteine» per una cliente', () => {
  const conProfilo = (proteinMinPct: number | null, giorni: unknown[] = []) => ({
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        dislikedFoods: [], allergies: [], intolerances: [], name: 'Giulia', pastiEsclusi: [], proteinMinPct,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    menuDay: {
      findMany: jest.fn().mockResolvedValue(giorni),
      deleteMany: jest.fn().mockResolvedValue({ count: giorni.length }),
      count: jest.fn().mockResolvedValue(giorni.length),
    },
  });

  it('senza numero: +10 punti sul minimo della dieta, e l\'anteprima mostra le PERCENTUALI', async () => {
    const { service, messaggioCreate } = make(conProfilo(null));
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('20%');
    expect(testo).toContain('30%');
    expect(stato?.passo).toBe('conferma');
  });

  it('col numero detto vince quello: «portala al 35%»', async () => {
    const { service, messaggioCreate } = make(conProfilo(null));
    await service.parla('lucia', 'porta Giulia Rossi al 35% di proteine');
    expect(ultimoAgente(messaggioCreate).testo).toContain('35%');
  });

  it('al sì scrive la SUA quota e rifà i giorni non ancora aperti', async () => {
    // ⚠️ `giornoSalvato(0)` e non `new Date()`: la colonna è un giorno, non un istante — vedi il
    // commento sull'helper. Con l'istante questo test era verde di giorno e rosso alle 00:30.
    const over = conProfilo(null, [{ id: 'g1', clientId: 'c1', date: giornoSalvato(0), apertoDallaClienteIl: null, apertureTracciate: true, meals: [] }]);
    const made = make(over);
    const { service, messaggioCreate } = made;
    /**
     * ⚠️ **Il registro non c'entra più** (24/8): fino a ieri questo percorso chiedeva a
     * `registro.menuDaRifare` **se** c'erano giorni da rifare e poi cancellava per conto suo con un
     * `where` diverso — due domande diverse su due strade diverse. Adesso i giorni li guarda una
     * volta sola, e la coda la decide `codaDaRifare`. Il finto qui era rimasto a puntellare una
     * chiamata che non esiste più: un puntello così è un test che sembra dire qualcosa e non lo dice.
     */
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    await service.parla('lucia', 'sì');
    expect((over.clientProfile.update as jest.Mock).mock.calls[0][0].data.proteinMinPct).toBeCloseTo(0.3, 5);
    expect(over.menuDay.deleteMany).toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('30%');
  });

  /**
   * ⛔ **E SE DI QUEI GIORNI NON SAPPIAMO, L'ANTEPRIMA LO DICE** — 26/8.
   *
   * Cambiare le proteine tocca **ogni** giornata, quindi qui i colpiti sono tutti i giorni futuri:
   * il predicato è `() => true`, e se il calendario non si può toccare lo racconta `codaDaRifare`.
   * ⛔ Fino al 26/8 il predicato chiedeva anche «lo posso rifare?», e su una cliente di cui non
   * sappiamo niente i colpiti erano **zero**: l'anteprima prometteva «Nessuna giornata già preparata
   * da rifare» — un'affermazione sui suoi menu, falsa, letta da una professionista che sta per
   * firmare una modifica.
   */
  it('⛔ con le aperture non tracciate l\'anteprima dice «non lo so», non «niente da rifare»', async () => {
    const over = conProfilo(null, [
      { id: 'g1', clientId: 'c1', date: giornoSalvato(1), apertoDallaClienteIl: null, apertureTracciate: false, meals: [] },
    ]);
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('non so dirti se le ha già aperte');
    expect(testo).not.toContain('Nessuna giornata già preparata');
    await service.parla('lucia', 'sì');
    // ⚠️ E nel dubbio non si cancella: si rimanda una correzione, non si toglie un menu di mano.
    expect(over.menuDay.deleteMany).not.toHaveBeenCalled();
  });

  it('⚠️ se ce l\'ha già a quel valore non tocca niente', async () => {
    const over = conProfilo(0.3);
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'porta Giulia Rossi al 30% di proteine');
    expect(ultimoAgente(messaggioCreate).testo).toContain('già');
    expect(over.clientProfile.update).not.toHaveBeenCalled();
  });

  it('⚠️ un «no» non scrive niente', async () => {
    const over = conProfilo(null);
    const { service } = make(over);
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    await service.parla('lucia', 'no');
    expect(over.clientProfile.update).not.toHaveBeenCalled();
  });

  it('parte dal SUO valore quando ce l\'ha già: 30% → 40%, non 20% → 30%', async () => {
    const { service, messaggioCreate } = make(conProfilo(0.3));
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('30%');
    expect(testo).toContain('40%');
  });

  /**
   * ⛔ **IL PEGGIORE DEI TRE PUNTI, chiuso il 24/8** (voce `giorno-cancellato-che-non-torna`).
   *
   * Qui c'era `deleteMany({ viewedAt: null, date: { gte: oggi } })`: cancellava i giorni non aperti e
   * **lasciava in piedi quelli letti**. Se lei aveva già aperto un menu più avanti — basta un tocco
   * sul calendario — quel giorno restava l'ultimo, i giorni cancellati prima di lui non tornavano
   * **mai**, e l'erogazione restava ferma **del tutto** finché quella data non passava: nessun menu
   * nuovo per giorni, per una modifica fatta con tutt'altra intenzione.
   */
  const giorno = (id: string, fra: number, aperto: Date | null = null) => ({
    id, clientId: 'c1', date: giornoSalvato(fra), apertoDallaClienteIl: aperto, apertureTracciate: true, meals: [],
  });

  it('⛔ con un giorno già aperto DOPO, non cancella niente — e lo dice con la data', async () => {
    const over = conProfilo(null, [giorno('g1', 1), giorno('g-letto', 3, new Date())]);
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    await service.parla('lucia', 'sì');
    expect(over.menuDay.deleteMany).not.toHaveBeenCalled();
    const [a, m, g] = giornoSalvato(3).toISOString().slice(0, 10).split('-');
    expect(ultimoAgente(messaggioCreate).testo).toContain(`il menu del ${g}/${m}/${a} l'ha già aperto in app`);
  });

  /** ⚠️ E un giorno aperto PRIMA non ferma niente: non sta nella coda, quindi non c'entra. */
  it('⚠️ un giorno già aperto PRIMA di quelli da rifare non blocca la coda', async () => {
    const over = conProfilo(null, [giorno('g-letto', 0, new Date()), giorno('g1', 1), giorno('g2', 2)]);
    const { service } = make(over);
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    await service.parla('lucia', 'sì');
    expect(over.menuDay.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g1', 'g2'] } } });
  });

  /**
   * ⛔ **E se la cancellazione non riesce, NON si dice «ho rifatto»** (24/8, seconda revisione).
   * C'era un `.catch(() => undefined)` e il conteggio si prendeva dalla coda invece che dall'esito:
   * col database in difficoltà la nutrizionista leggeva «Ho rifatto 3 giornate», il registro scriveva
   * `giorniRifatti: 3`, e i menu con la quota vecchia restavano tutti lì.
   */
  it('⛔ se il database non cancella, non dice «ho rifatto» — e il registro lo scrive', async () => {
    const over = conProfilo(null, [giorno('g1', 1), giorno('g2', 2)]);
    (over.menuDay.deleteMany as jest.Mock).mockRejectedValue(new Error('database giù'));
    const made = make(over);
    await made.service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    await made.service.parla('lucia', 'sì');
    const { testo } = ultimoAgente(made.messaggioCreate);
    expect(testo).toContain('non sono riuscita a intervenire');
    expect(testo).not.toContain('Ho rifatto');
    const riga = (made.registro.scrivi as jest.Mock).mock.calls[0][0];
    expect(riga.dettaglio.proteine).toMatchObject({ giorniRifatti: 0, esitoGiorni: 'non_riuscita' });
  });

  /**
   * ⛔ **L'ANTEPRIMA DICE QUELLO CHE SUCCEDERÀ.** Prometteva «i giorni futuri che non ha ancora
   * aperto si rifanno con la nuova quota», sempre — anche quando poi non ne rifaceva nessuno. Una
   * conferma data su una promessa falsa è una firma su una cosa non letta.
   */
  it('⛔ l\'anteprima non promette di rifare i giorni se poi non li rifà', async () => {
    const over = conProfilo(null, [giorno('g1', 1), giorno('g-letto', 3, new Date())]);
    const { service, messaggioCreate } = make(over);
    await service.parla('lucia', 'a Giulia Rossi rifai con più proteine');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Rigenera menu');
    expect(testo).not.toMatch(/i giorni futuri che non ha ancora aperto si rifanno/);
  });
});

/**
 * LA GIORNATA DETTATA A PAROLE (voce 241, decisione B di Simone, 14/8).
 * Il punto: «pasta al pomodoro» sono due ricette con 90 kcal di differenza — e Vera CHIEDE.
 */
describe('VeraChatService — la giornata dettata', () => {
  const RICETTE = [
    { id: 'r-yog', name: 'Yogurt greco con frutta secca', kcal: 320, mealSlot: 'breakfast' },
    { id: 'r-p1', name: 'Pasta al pomodoro e basilico', kcal: 520, mealSlot: 'lunch' },
    { id: 'r-p2', name: 'Pasta al pomodoro integrale', kcal: 610, mealSlot: 'lunch' },
    { id: 'r-orata', name: 'Orata al forno con patate', kcal: 480, mealSlot: 'dinner' },
  ];
  const DETTATO = 'Per Giulia Rossi\nColazione: yogurt greco con frutta secca\nPranzo: pasta al pomodoro\nCena: orata al forno';

  /**
   * ⚠️ Il giorno di domani nasce **tracciato e non aperto**: è la premessa di quasi tutti i casi qui.
   * Gli altri due stati (aperto davvero, non sappiamo) hanno i loro test in fondo.
   */
  const conCatalogo = (giorno: unknown = { id: 'md-1', apertoDallaClienteIl: null, apertureTracciate: true }) => ({
    clientMenuPool: { findFirst: jest.fn().mockResolvedValue({ recipeIds: RICETTE.map((r) => r.id) }) },
    recipe: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue(RICETTE) },
    menuDay: {
      findFirst: jest.fn().mockResolvedValue(giorno),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
  });
  const kcalFinto = (target = 1400) => ({
    simulaKcal: jest.fn().mockResolvedValue({ prima: { target }, dopo: { target } }),
    impostaKcal: jest.fn().mockResolvedValue({}),
  });

  it('⚠️ sul pasto ambiguo CHIEDE, con le calorie accanto — non sceglie', async () => {
    const { service, messaggioCreate } = make(conCatalogo(), { kcal: kcalFinto() });
    await service.parla('lucia', DETTATO);
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('pasta al pomodoro');
    expect(testo).toContain('520');
    expect(testo).toContain('610');
    expect(stato?.passo).toBe('giornata_scelte');
  });

  it('scelto il numero, mostra il totale contro l\'obiettivo e chiede conferma', async () => {
    const { service, messaggioCreate } = make(conCatalogo(), { kcal: kcalFinto() });
    await service.parla('lucia', DETTATO);
    await service.parla('lucia', '1');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('1320');   // 320 + 520 + 480
    expect(testo).toContain('1400');
    expect(stato?.passo).toBe('conferma');
  });

  it('al sì scrive la giornata con lo snapshot del motore ({slot, recipeId, name, kcal})', async () => {
    const over = conCatalogo();
    const { service } = make(over, { kcal: kcalFinto() });
    await service.parla('lucia', DETTATO);
    await service.parla('lucia', '1');
    await service.parla('lucia', 'sì');
    const dati = (over.menuDay.update as jest.Mock).mock.calls[0][0].data.meals;
    expect(dati).toHaveLength(3);
    expect(dati[0]).toMatchObject({ slot: 'breakfast', recipeId: 'r-yog', name: expect.any(String), kcal: 320 });
  });

  /**
   * ⛔ **IL FABBISOGNO SOSPESO NON È UN OBIETTIVO** (28/8, voce `target-sospeso-chi-non-lo-sa`).
   *
   * Quando le pesate di una cliente non stanno in piedi fra loro il fabbisogno personalizzato non
   * viene usato: i menu tornano al livello della dieta. ⚠️ Il numero però **esce lo stesso** dal
   * calcolo, e prima Vera lo prendeva e ci misurava contro la giornata dettata — cioè rispondeva «ci
   * sta dentro» usando un metro che non è quello nel piatto.
   *
   * ⛔ Non scrive, e **dice quali pesate** non tornano: un «non posso» senza il come è un vicolo
   * cieco per chi quella pesata la potrebbe correggere in trenta secondi.
   */
  it('⛔ col fabbisogno sospeso NON giudica la giornata e non la scrive', async () => {
    const over = conCatalogo();
    const sospeso = {
      simulaKcal: jest.fn().mockResolvedValue({
        prima: { target: 1400, pesoIncoerente: { frase: 'da 113 kg del 14/08/2026 a 73 kg del 21/08/2026' } },
        dopo: { target: 1400 },
      }),
      impostaKcal: jest.fn().mockResolvedValue({}),
    };
    const { service, messaggioCreate } = make(over, { kcal: sospeso });
    await service.parla('lucia', DETTATO);
    await service.parla('lucia', '1');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('sospeso');
    expect(testo).toContain('113 kg');
    expect(testo).toContain('livello della dieta');
    // ⛔ E non la scrive: il controllo che non si è potuto fare non vale come controllo passato.
    expect(over.menuDay.update).not.toHaveBeenCalled();
    /**
     * ⛔ **E la conversazione NON resta al passo «conferma»**, che è la cosa che il testo da solo non
     * dice. Con lo stato lasciato aperto, un «sì» successivo entrerebbe in `confermaOAnnulla` e
     * scriverebbe **esattamente la giornata** che questo ramo esiste per non scrivere: il test sul
     * solo testo restava verde.
     */
    expect(stato?.passo).not.toBe('conferma');
    await service.parla('lucia', 'sì');
    expect(over.menuDay.update).not.toHaveBeenCalled();
  });

  it('⚠️ fuori dal ±15% NON scrive e dice di quanto sfora (decisione di Simone)', async () => {
    const over = conCatalogo();
    const { service, messaggioCreate } = make(over, { kcal: kcalFinto(900) });
    await service.parla('lucia', DETTATO);
    await service.parla('lucia', '1');
    const { testo } = ultimoAgente(messaggioCreate);
    // Il numero e lo scostamento devono esserci: «sfora» senza dire di quanto non serve a decidere.
    expect(testo).toContain('Non la scrivo');
    expect(testo).toContain('+46.7%');
    expect(over.menuDay.update).not.toHaveBeenCalled();
  });

  it('⚠️ un piatto che non esiste nel suo ricettario ferma tutto: non si ripiega su un simile', async () => {
    const over = conCatalogo();
    const { service, messaggioCreate } = make(over, { kcal: kcalFinto() });
    await service.parla('lucia', 'Per Giulia Rossi\nColazione: sushi\nCena: orata al forno');
    expect(ultimoAgente(messaggioCreate).testo).toContain('non trovo');
    expect(over.menuDay.update).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **TRE MOTIVI PER NON SCRIVERE, E OGNUNO DICE IL SUO** — 26/8, trovato in revisione.
   *
   * Prima il `where` filtrava «non ancora aperta» e i tre casi collassavano in un `null` solo,
   * raccontato con «potrebbe averla già vista, o non essere ancora stata preparata». ⛔ Il giorno del
   * rilascio il terzo caso è **tutti** — nessuna riga è tracciata — quindi la nutrizionista che ha
   * appena composto la giornata pasto per pasto leggeva una ragione inventata.
   */
  const arrivaFinoAlSi = async (over: ReturnType<typeof conCatalogo>) => {
    const { service, messaggioCreate } = make(over, { kcal: kcalFinto() });
    await service.parla('lucia', DETTATO);
    await service.parla('lucia', '1');
    await service.parla('lucia', 'sì');
    return ultimoAgente(messaggioCreate).testo;
  };

  it('⚠️ se la giornata di domani è già stata aperta, non si tocca — e lo dice così', async () => {
    const over = conCatalogo({ id: 'md-1', apertoDallaClienteIl: new Date('2026-08-26'), apertureTracciate: true });
    const testo = await arrivaFinoAlSi(over);
    expect(over.menuDay.update).not.toHaveBeenCalled();
    expect(testo).toContain('lo ha già aperto in app');
  });

  it('⛔ se non sappiamo se l\'ha aperta, si dice «non lo so» — non «potrebbe averla vista»', async () => {
    const over = conCatalogo({ id: 'md-1', apertoDallaClienteIl: null, apertureTracciate: false });
    const testo = await arrivaFinoAlSi(over);
    expect(over.menuDay.update).not.toHaveBeenCalled();
    expect(testo).toContain('Non so dirti se ha già aperto');
    expect(testo).toContain('Rigenera menu');
  });

  it('⚠️ e se domani non è ancora stato preparato, il motivo è quello', async () => {
    const over = conCatalogo(null);
    const testo = await arrivaFinoAlSi(over);
    expect(over.menuDay.update).not.toHaveBeenCalled();
    expect(testo).toContain('non è ancora stata preparata');
  });
});

/**
 * VERIFICARE A VOCE I CAMBI CONCORDATI IN CHAT — voce 245, lettura **A** di Simone (14/8).
 * Foglio: `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`.
 *
 * A voce passano solo ✓ e ✗. I grammi restano in scheda, perché 70 ml di panna sono ~200 kcal e
 * 70 g di olio ~630: quel numero si scrive guardando il campo.
 */
describe('VeraChatService — i cambi concordati in chat, verificati a voce (voce 245)', () => {
  const CAMBIO = {
    id: 's1',
    clientId: 'c1',
    cliente: 'Giulia Rossi',
    dishName: 'Pasta al pesto',
    fromFood: 'panna',
    toFood: 'olio',
    fromQty: 70,
    toQty: 70,
    unit: 'g',
    volte: 3,
  };

  it('«verifichiamo i cambi» porta la sostituzione in chat, con quanto serve per decidere', async () => {
    const { service, messaggioCreate } = make({}, { cambio: CAMBIO, daVerificare: 3 });
    await service.parla('lucia', 'verifichiamo i cambi');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Giulia Rossi');
    expect(testo).toContain('panna');
    expect(testo).toContain('olio');
    expect(testo).toContain('3 volte');
    expect(stato?.passo).toBe('verifica_cambio');
  });

  it('«va bene» valida la riga, e passa dalla PORTA UNICA (la stessa del pulsante in scheda)', async () => {
    const { service, sostituzioni } = make({}, { cambio: CAMBIO, daVerificare: 1 });
    await service.parla('lucia', 'verifichiamo i cambi');
    await service.parla('lucia', 'va bene');
    expect(sostituzioni.aggiorna).toHaveBeenCalledWith('lucia', 's1', { stato: 'verificata' });
  });

  it('«no, è troppo grassa» annulla e tiene il motivo che ha detto lei', async () => {
    const { service, sostituzioni } = make({}, { cambio: CAMBIO, daVerificare: 1 });
    await service.parla('lucia', 'verifichiamo i cambi');
    await service.parla('lucia', 'no, è troppo grassa');
    expect(sostituzioni.aggiorna).toHaveBeenCalledWith('lucia', 's1', { stato: 'annullata', nota: 'è troppo grassa' });
  });

  it('⚠️ un «no» secco non fa nascere un motivo inventato, e Vera non lo chiede', async () => {
    const { service, sostituzioni, messaggioCreate } = make({}, { cambio: CAMBIO, daVerificare: 1 });
    await service.parla('lucia', 'verifichiamo i cambi');
    await service.parla('lucia', 'no');
    expect(sostituzioni.aggiorna).toHaveBeenCalledWith('lucia', 's1', { stato: 'annullata' });
    expect(ultimoAgente(messaggioCreate).testo.toLowerCase()).not.toContain('perché');
  });

  it('⚠️ IL CASO CHE CONTA: «sì, ma metti 30 g» NON scrive niente e manda in scheda', async () => {
    // Se passasse per una conferma, la riga verrebbe validata con la grammatura VECCHIA — e
    // sembrerebbe approvata da lei. 70 ml di panna ~200 kcal, 70 g di olio ~630.
    const { service, sostituzioni, messaggioCreate } = make({}, { cambio: CAMBIO, daVerificare: 1 });
    await service.parla('lucia', 'verifichiamo i cambi');
    await service.parla('lucia', 'sì, ma metti 30 g');
    expect(sostituzioni.aggiorna).not.toHaveBeenCalled();
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo.toLowerCase()).toContain('scheda');
    expect(testo).toContain('Giulia Rossi');
  });

  it('⚠️ una riga che intanto ha guardato una collega non si sovrascrive: si dice', async () => {
    const { service, sostituzioni, messaggioCreate, prisma } = make({}, { cambio: CAMBIO, daVerificare: 1 });
    await service.parla('lucia', 'verifichiamo i cambi');
    (prisma.foodSwap as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue({ stato: 'verificata' });
    await service.parla('lucia', 'no');
    expect(sostituzioni.aggiorna).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('già');
  });

  it('finita una, porta subito la prossima: è una coda, non una richiesta per volta', async () => {
    const { service, messaggioCreate } = make({}, { cambio: CAMBIO, daVerificare: 2 });
    await service.parla('lucia', 'verifichiamo i cambi');
    await service.parla('lucia', 'va bene');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Confermata');
    expect(testo).toContain('panna');
    expect(stato?.passo).toBe('verifica_cambio');
  });

  it('la coda vuota lo dice, invece di rispondere «non ci arrivo»', async () => {
    const { service, messaggioCreate } = make({}, { cambio: null, daVerificare: 0 });
    await service.parla('lucia', 'verifichiamo i cambi');
    expect(ultimoAgente(messaggioCreate).testo).toContain('nessun cambio');
  });

  it('⚠️ una lettura rotta non blocca la chat: la coda non si vede, l\'assistente parla', async () => {
    const { service, messaggioCreate, registro } = make({}, { cambio: CAMBIO });
    (registro.prossimaDaVerificare as jest.Mock).mockRejectedValue(new Error('db giù'));
    await service.parla('lucia', 'verifichiamo i cambi');
    expect(ultimoAgente(messaggioCreate).testo).toContain('nessun cambio');
  });
});

/**
 * GLI ALLERGENI DELLA RICETTA APPENA APPROVATA — voce 227.
 * Foglio: `progetto/NOTA_Vera_Allergeni_Ricetta_Nuova.md`.
 *
 * Approvare accende la ricetta ma non conferma gli allergeni, e `collegaRicetta` si rifiuta di
 * metterla in una giornata finché restano da confermare: senza questa domanda il capo lo scopre
 * dal fatto che la ricetta non compare da nessuna parte.
 */
describe('VeraChatService — gli allergeni della ricetta approvata (voce 227)', () => {
  const CODA = [{ id: 'a1', frase: 'inseriamo una ricetta', nutrizionistaId: 'lucia', soggettoNome: null, dettaglio: {}, conflittoSanitario: false, createdAt: new Date() }];
  const RICETTA = { id: 'r1', name: 'Orata al forno con patate', ingredients: [{ name: 'orata' }, { name: 'pangrattato' }] };

  /** Il capo con una ricetta in coda, e `approva` che dice «mancano gli allergeni di r1». */
  const conRicetta = () => {
    const esito = make(
      { recipe: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(RICETTA) } },
      { coda: CODA },
    );
    (esito.registro.approva as jest.Mock).mockResolvedValue({ toccate: 1, riepilogo: 'Ricetta attivata.', allergeniDaConfermare: 'r1' });
    return esito;
  };

  it('dopo il sì chiede gli allergeni, e dice PERCHÉ li propone', async () => {
    const { service, messaggioCreate } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Orata al forno con patate');
    expect(testo).toContain('Pesce');
    expect(testo).toContain('orata'); // la parola che l'ha fatto scattare
    expect(testo).toContain('Glutine');
    expect(stato?.passo).toBe('allergeni_ricetta');
  });

  it('«sì» scrive quelli mostrati, dalla porta della scheda', async () => {
    const { service, ricette } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    await service.parla('nocanty', 'sì');
    expect(ricette.setRecipeAllergens).toHaveBeenCalledWith('nocanty', 'r1', ['glutine', 'pesce']);
  });

  it('⚠️ un elenco DETTATO non si scrive subito: si rilegge e si chiede conferma', async () => {
    // Il «sì» conferma una lista già letta. Un elenco dettato è contenuto nuovo, e questa lista
    // decide se una cliente allergica riceve quel piatto.
    const { service, ricette, messaggioCreate } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    await service.parla('nocanty', 'solo latte e uova');
    expect(ricette.setRecipeAllergens).not.toHaveBeenCalled();
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Uova');
    expect(testo).toContain('Latte e derivati');
    expect(stato?.passo).toBe('allergeni_conferma');
    await service.parla('nocanty', 'sì');
    expect(ricette.setRecipeAllergens).toHaveBeenCalledWith('nocanty', 'r1', ['uova', 'latte']);
  });

  it('⚠️ «sì, aggiungi anche il sesamo» AGGIUNGE ai suggeriti, non li sostituisce', async () => {
    const { service, ricette, messaggioCreate } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    await service.parla('nocanty', 'sì, aggiungi anche il sesamo');
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('allergeni_conferma');
    await service.parla('nocanty', 'sì');
    expect(ricette.setRecipeAllergens).toHaveBeenCalledWith('nocanty', 'r1', ['glutine', 'pesce', 'sesamo']);
  });

  it('⚠️ «nessuno» è la risposta più impegnativa: si rilegge prima di scriverla', async () => {
    const { service, ricette, messaggioCreate } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    await service.parla('nocanty', 'nessuno');
    expect(ricette.setRecipeAllergens).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('allergeni_conferma');
    await service.parla('nocanty', 'sì');
    expect(ricette.setRecipeAllergens).toHaveBeenCalledWith('nocanty', 'r1', []);
  });

  it('⚠️ non capito: si richiede, non si indovina', async () => {
    const { service, ricette, messaggioCreate } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    await service.parla('nocanty', 'quelli soliti');
    expect(ricette.setRecipeAllergens).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).stato?.passo).toBe('allergeni_ricetta');
  });

  it('«lascia stare» non scrive, e dice che la ricetta resta invisibile finché non li conferma', async () => {
    const { service, ricette, messaggioCreate } = conRicetta();
    await service.apri('nocanty');
    await service.parla('nocanty', 'sì');
    await service.parla('nocanty', 'lascia stare');
    expect(ricette.setRecipeAllergens).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('non entrerà in nessuna giornata');
  });
});

/**
 * NON SI RESTA INCASTRATI SU «SU QUALE CLIENTE?» — screenshot di Simone, 17/8.
 *
 * Alle 11:02 scrive «Jolanda Todde non darle più i ceci» e Vera chiede su quale cliente. Da quel
 * momento **ogni** messaggio successivo viene cercato come se fosse un nome di persona: alle 11:07
 * riscrive l'istruzione intera e si sente rispondere «non trovo nessuna cliente che si chiami "a
 * Jolanda Todde non darle più i ceci"»; alle 11:52, quarantacinque minuti dopo, chiede «quale
 * sostituzione devo verificare?» e si sente rispondere la stessa cosa con la sua domanda dentro.
 *
 * ⚠️ Il difetto non è il riconoscimento del nome: è che dal passo non si esce. Una domanda chiusa
 * che non ammette nessun'altra risposta trasforma un fraintendimento di un minuto in una chat
 * inutilizzabile per sempre — e chi ci sta dentro non ha nessun modo di capire cosa fare.
 *
 * La via d'uscita è la stessa porta dell'inizio: se quello che ha scritto non è una cliente ma è
 * una frase che SO leggere, riparto da lì.
 */
describe('VeraChatService — la via d\'uscita da «su quale cliente?»', () => {
  it('⚠️ l\'istruzione riscritta per intero non viene cercata come NOME', async () => {
    // Il finto non trova nessuno: quello che conta è COSA è stato cercato. Prima si cercava la
    // frase intera — «non trovo nessuna cliente che si chiami "a Jolanda Todde non darle più i
    // ceci"» — adesso si rilegge e si cerca il nome che c'è dentro.
    const { service, messaggioCreate } = make(
      { user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }), findMany: jest.fn().mockResolvedValue([]) } },
      { statoAperto: { passo: 'quale_cliente', frase: 'niente ceci', intento: null } as unknown as StatoVera },
    );
    await service.parla('n1', 'a Giulia Rossi non dare più i ceci');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('«Giulia Rossi»');
    expect(testo).not.toContain('non dare più');
  });

  it('⚠️ e una DOMANDA sblocca il passo invece di essere cercata fra le clienti', async () => {
    // È il caso delle 11:52: la pastiglia dice «1 sostituzioni da verificare», lui lo chiede, e la
    // sua domanda gli torna indietro dentro «non trovo nessuna cliente che si chiami…».
    const { service, messaggioCreate } = make(
      { user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }), findMany: jest.fn().mockResolvedValue([]) } },
      { statoAperto: { passo: 'quale_cliente', frase: 'niente ceci', intento: null } as unknown as StatoVera, cambio: null },
    );
    await service.parla('n1', 'quale sostituzione devo verificare?');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).not.toMatch(/nessuna cliente che si chiami/i);
  });

  it('un nome che non esiste continua a dire che non esiste: non si indovina', async () => {
    const { service, messaggioCreate } = make(
      { user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }), findMany: jest.fn().mockResolvedValue([]) } },
      { statoAperto: { passo: 'quale_cliente', frase: 'niente ceci', intento: null } as unknown as StatoVera },
    );
    await service.parla('n1', 'Ludovica Sconosciuta');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toMatch(/non trovo nessuna cliente/i);
    expect(stato?.passo).toBe('quale_cliente');
  });
});

/**
 * LA SECONDA LETTURA (17/8, decisa da Simone). Il modello traduce, `capisci` decide, la riscrittura
 * si mostra. Qui si collauda l'INNESTO: quando il modello viene chiamato, quando no, e cosa legge
 * la nutrizionista quando è servito.
 *
 * La guardia sull'output del modello — che è la parte pericolosa — sta in `seconda-lettura.spec.ts`.
 */
describe('VeraChatService — la seconda lettura', () => {
  const capoNutrizionista = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  it('⚠️ NON si chiama il modello se `capisci` la frase la capisce già', async () => {
    // Il costo è una chiamata sul giro che era comunque perso: su un giro che funziona, zero.
    const { service, ai } = make(capoNutrizionista, { riscritturaModello: 'a Giulia niente ceci' });
    await service.parla('n1', 'a Giulia Rossi niente formaggi molli');
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it('spenta (come prima del 17/8): il modello non si chiama e la risposta è «non ci arrivo»', async () => {
    // `riscritturaModello` assente = interruttore `vera_seconda_lettura` a false.
    const { service, messaggioCreate, ai } = make(capoNutrizionista, {});
    await service.parla('n1', 'mah la jolanda i ceci insomma');
    expect(ai.generateJson).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toMatch(/non ci arrivo/i);
  });

  it('accesa: la frase riscritta viene MOSTRATA prima di procedere', async () => {
    const { service, messaggioCreate, ai } = make(capoNutrizionista, {
      riscritturaModello: 'a jolanda niente ceci',
    });
    await service.parla('n1', 'mah la jolanda i ceci insomma');
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
    const { testo } = ultimoAgente(messaggioCreate);
    // ⚠️ Si mostra LA FRASE: è l'unica forma in cui si vede se il traduttore ha aggiunto qualcosa.
    expect(testo).toContain('a jolanda niente ceci');
    expect(testo).toMatch(/riletta/i);
    // E non si finge di aver capito al primo colpo.
    expect(testo).not.toMatch(/^Per /);
  });

  it('⚠️ una DOMANDA non arriva al modello nemmeno da qui', async () => {
    // La difesa vive in `daScartare`, dentro `capisci`, e questo test guarda che sia davvero sulla
    // strada: una domanda che diventa un ordine è il modo peggiore di sbagliare.
    const { service, ai } = make(capoNutrizionista, { riscritturaModello: 'togli il pesce a Giulia' });
    await service.parla('n1', 'posso togliere il pesce a Giulia?');
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it('il modello non risponde: si dice «non ci arrivo», come sempre', async () => {
    const { service, messaggioCreate, ai } = make(capoNutrizionista, { riscritturaModello: null });
    await service.parla('n1', 'mah la jolanda i ceci insomma');
    // L'interruttore è acceso (la chiave c'è), ma il modello torna null: credito, 503, timeout.
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
    expect(ultimoAgente(messaggioCreate).testo).toMatch(/non ci arrivo/i);
  });

  it('⚠️ una riscrittura che AGGIUNGE un alimento viene rifiutata: «non ci arrivo»', async () => {
    // La guardia ha i suoi test a parte; questo verifica che sia sulla strada e che il rifiuto
    // arrivi alla nutrizionista come un «non ci arrivo», non come una regola in più.
    const { service, messaggioCreate } = make(capoNutrizionista, {
      riscritturaModello: 'a jolanda niente ceci e crostacei',
    });
    await service.parla('n1', 'mah la jolanda i ceci insomma');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toMatch(/non ci arrivo/i);
    expect(testo).not.toContain('crostacei');
  });

  it('il modello si chiama UNA volta per giro: nessun rimbalzo', async () => {
    // Se la riscrittura passa `capisci` ma il giro rientra qui, la seconda lettura non riparte —
    // altrimenti un rimbalzo costerebbe una chiamata a ogni giro.
    const { service, ai } = make(capoNutrizionista, { riscritturaModello: 'a jolanda niente ceci' });
    await service.parla('n1', 'mah la jolanda i ceci insomma');
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
  });
});

/**
 * LE TRE CODE DEL CATALOGO, UNA PER VOLTA (18/8).
 *
 * ⚠️ Il collaudo che conta qui non è la fila (ce l'ha il suo file, senza banca dati): è che il sì
 * passi dalla **porta di sempre** — `updateRecipe` di `CatalogService`, `approve` di
 * `EquivalenceService` — e che una ricetta con gli allergeni aperti non arrivi mai alla domanda
 * «la accendo?».
 */
describe('la coda delle approvazioni', () => {
  const catalogo = (
    ricette: { id: string; name: string; active: boolean; allergensReviewed: boolean }[],
    gruppi: { id: string; name: string; status: string }[] = [],
  ) => ({
    diet: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'd1', name: 'Mediterranea', dayTemplates: [{ meals: ricette.map((r) => ({ slot: 'lunch', recipeId: r.id })) }] },
      ]),
    },
    recipe: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue(
        ricette.map((r) => ({ ...r, mealSlot: 'lunch', kcal: 500, ingredients: [{ name: 'pollo' }] })),
      ),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(ricette.find((r) => r.id === where.id) ?? null),
      ),
    },
    equivalenceGroup: {
      findMany: jest.fn().mockResolvedValue(gruppi.map((g) => ({ ...g, productId: 'd1', members: { items: ['riso', 'farro'] } }))),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(gruppi.find((g) => g.id === where.id) ?? null),
      ),
    },
  });

  it('«cosa c\'è da approvare?» apre la coda e porta la prima ricetta', async () => {
    const { service, messaggioCreate } = make(catalogo([{ id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: true }]));
    await service.parla('lucia', 'cosa c\'è da approvare?');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Pollo alle erbe');
    expect(testo).toContain('pollo'); // gli ingredienti: si approva guardando, non a memoria
    expect(stato?.passo).toBe('approvazione');
    expect(stato?.approvazioneTipo).toBe('ricetta');
  });

  it('il sì accende la ricetta dalla porta del catalogo, non con una update a mano', async () => {
    const { service, ricette } = make(catalogo([{ id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: true }]));
    await service.parla('lucia', 'approvazioni');
    await service.parla('lucia', 'sì');
    expect(ricette.updateRecipe).toHaveBeenCalledWith('lucia', 'r1', { active: true });
  });

  it('il NO non scrive niente, e dice dove si cambia davvero', async () => {
    const { service, ricette, messaggioCreate } = make(catalogo([{ id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: true }]));
    await service.parla('lucia', 'approvazioni');
    await service.parla('lucia', 'no');
    // ⚠️ Il punto: nessuna cancellazione inventata. La ricetta era spenta e resta spenta.
    expect(ricette.updateRecipe).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toContain('in Ricette');
  });

  it('«non lo so» mette da parte e passa alla prossima, senza decidere niente', async () => {
    const { service, ricette, messaggioCreate } = make(
      catalogo([
        { id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: true },
        { id: 'r2', name: 'Orata al forno', active: false, allergensReviewed: true },
      ]),
    );
    await service.parla('lucia', 'approvazioni');
    await service.parla('lucia', 'non lo so');
    expect(ricette.updateRecipe).not.toHaveBeenCalled();
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Orata al forno');
    expect(stato?.saltate).toEqual(['ricetta:r1']);
  });

  it('⚠️ una ricetta con gli allergeni aperti non arriva mai alla domanda «la accendo?»', async () => {
    const { service, messaggioCreate, ricette } = make(catalogo([{ id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: false }]));
    await service.parla('lucia', 'approvazioni');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    // Si consegna al giro degli allergeni (voce 227), marcato perché alla fine torni in coda.
    expect(stato?.passo).toBe('allergeni_ricetta');
    expect(stato?.daCoda).toBe(true);
    expect(testo).not.toMatch(/La accendo/);
    expect(ricette.updateRecipe).not.toHaveBeenCalled();
  });

  it('confermati gli allergeni, si torna in coda invece di finire in un\'altra', async () => {
    const { service, messaggioCreate, ricette } = make(
      catalogo([
        { id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: false },
        { id: 'r2', name: 'Orata al forno', active: false, allergensReviewed: true },
      ]),
    );
    await service.parla('lucia', 'approvazioni');
    await service.parla('lucia', 'sì');
    expect(ricette.setRecipeAllergens).toHaveBeenCalled();
    // ⚠️ Senza il marcatore `daCoda` qui ripartiva `cosaTiPorto` e le altre ricette da approvare
    // sparivano dalla conversazione senza che nessuno lo dicesse.
    expect(ultimoAgente(messaggioCreate).testo).toContain('Orata al forno');
  });

  it('la combinazione si approva da EquivalenceService, con gli alimenti sotto gli occhi', async () => {
    const { service, combinazioni, messaggioCreate } = make(
      catalogo([{ id: 'r1', name: 'Pollo', active: true, allergensReviewed: true }], [{ id: 'g1', name: 'Cereali', status: 'draft' }]),
    );
    await service.parla('lucia', 'approvazioni');
    expect(ultimoAgente(messaggioCreate).testo).toContain('riso, farro');
    await service.parla('lucia', 'sì');
    expect(combinazioni.approve).toHaveBeenCalledWith('lucia', 'g1');
  });

  it('⚠️ se nel frattempo l\'ha accesa un\'altra, non si riscrive sopra: lo si dice e si va avanti', async () => {
    const dati = catalogo([{ id: 'r1', name: 'Pollo alle erbe', active: false, allergensReviewed: true }]);
    const { service, ricette, messaggioCreate } = make(dati);
    await service.parla('lucia', 'approvazioni');
    // Fra la domanda e la risposta passa una collega dalla scheda.
    dati.recipe.findUnique.mockResolvedValue({ active: true, allergensReviewed: true });
    await service.parla('lucia', 'sì');
    expect(ricette.updateRecipe).not.toHaveBeenCalled();
    expect(ultimoAgente(messaggioCreate).testo).toMatch(/nel frattempo è cambiata/);
  });

  it('«basta» si ferma e dice quanto resta', async () => {
    const { service, messaggioCreate } = make(
      catalogo([
        { id: 'r1', name: 'Pollo', active: false, allergensReviewed: true },
        { id: 'r2', name: 'Orata', active: false, allergensReviewed: true },
      ]),
    );
    await service.parla('lucia', 'approvazioni');
    await service.parla('lucia', 'basta');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toMatch(/Restano 2 cose/);
    expect(stato).toBeUndefined();
  });

  it('niente da approvare: lo dice, invece di aprire una coda vuota', async () => {
    const { service, messaggioCreate } = make(catalogo([{ id: 'r1', name: 'Pollo', active: true, allergensReviewed: true }]));
    await service.parla('lucia', 'approvazioni');
    expect(ultimoAgente(messaggioCreate).testo).toMatch(/niente da approvare/i);
  });

  it('il quadro della giornata invita alla coda quando c\'è qualcosa', async () => {
    const { service, messaggioCreate } = make(catalogo([{ id: 'r1', name: 'Pollo', active: false, allergensReviewed: false }]));
    await service.parla('lucia', 'hai segnalazioni per me?');
    expect(ultimoAgente(messaggioCreate).testo).toMatch(/aspettano la tua approvazione/);
  });
});

/**
 * «AGGIUNGI UN'EQUIVALENZA» — il giro intero, dallo screenshot del 19/8 in cui Vera rispondeva due
 * volte «non ci arrivo nemmeno adesso» a una frase chiarissima.
 */
describe('VeraChatService — l\'equivalenza dettata', () => {
  /**
   * ⚠️ IL CASO DELLO SCREENSHOT. «aggiungi equivalenza» secco è una richiesta **capita**: si
   * riconosce e si chiedono gli alimenti. Prima finiva in `daScartare` — la funzione che butta via
   * le frasi senza una cliente — perché un gruppo di equivalenza una cliente non ce l'ha.
   */
  it('⚠️ «aggiungi equivalenza» non è più «non ci arrivo»: chiede quali alimenti', async () => {
    const { service, messaggioCreate } = make();
    await service.parla('lucia', 'aggiungi equivalenza');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).not.toContain('Non ci arrivo');
    expect(testo).toContain('Quali alimenti');
    expect(stato?.passo).toBe('equivalenza_alimenti');
  });

  /** Gli alimenti detti tutti insieme saltano il primo passo e si va al nome. */
  it('con gli alimenti nella frase, chiede subito il nome', async () => {
    const { service, messaggioCreate } = make();
    await service.parla('lucia', 'aggiungi equivalenza: petto di pollo, tacchino, coniglio');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBe('equivalenza_nome');
    expect(stato?.equivalenzaAlimenti).toEqual(['petto di pollo', 'tacchino', 'coniglio']);
    expect(testo).toContain('Come lo chiamiamo');
  });

  /** ⚠️ Gli alimenti del secondo giro si UNISCONO ai primi: chi dice «pollo» e poi «tacchino» ne vuole due. */
  it('⚠️ gli alimenti detti dopo si aggiungono, non sostituiscono', async () => {
    const { service, messaggioCreate } = make(
      {},
      { statoAperto: { passo: 'equivalenza_alimenti', frase: '', equivalenzaAlimenti: ['pollo'] } },
    );
    await service.parla('lucia', 'tacchino e coniglio');
    const { stato } = ultimoAgente(messaggioCreate);
    expect(stato?.equivalenzaAlimenti).toEqual(['pollo', 'tacchino', 'coniglio']);
    expect(stato?.passo).toBe('equivalenza_nome');
  });

  /**
   * ⚠️ L'ANTEPRIMA DICE CHE È UNA REGOLA DEL MOTORE E CHE NASCE COME PROPOSTA. Una regola che si
   * crede locale e agisce su trecento persone è il difetto peggiore che questa chat possa fare.
   */
  it('⚠️ prima di scrivere dice cosa comporta, e chiede conferma', async () => {
    const { service, messaggioCreate } = make(
      {},
      { statoAperto: { passo: 'equivalenza_nome', frase: '', equivalenzaAlimenti: ['pollo', 'tacchino'] } },
    );
    await service.parla('lucia', 'carni bianche');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('scambiarli');
    expect(testo).toContain('proposta');
    expect(stato?.passo).toBe('equivalenza_conferma');
  });

  /** ⚠️ Al sì si scrive, e passa dalla porta di Equivalenze: nasce bozza e avvisa il capo. */
  it('⚠️ al sì crea il gruppo da EquivalenceService, non scrivendo a mano', async () => {
    const { service, combinazioni } = make(
      {},
      { statoAperto: { passo: 'equivalenza_conferma', frase: '', equivalenzaAlimenti: ['pollo', 'tacchino'], equivalenzaNome: 'carni bianche' } },
    );
    await service.parla('lucia', 'sì');
    expect(combinazioni.create).toHaveBeenCalledWith('lucia', { name: 'carni bianche', items: ['pollo', 'tacchino'] });
  });

  /** ⚠️ E al no non si scrive niente: la conferma è una conferma. */
  it('⚠️ al no non scrive niente', async () => {
    const { service, combinazioni } = make(
      {},
      { statoAperto: { passo: 'equivalenza_conferma', frase: '', equivalenzaAlimenti: ['pollo', 'tacchino'], equivalenzaNome: 'carni bianche' } },
    );
    await service.parla('lucia', 'no');
    expect(combinazioni.create).not.toHaveBeenCalled();
  });
});

/**
 * LA LISTA DELLA MATTINA — «Vera gli sottopone tutte le cose che deve fare, numerate» (Simone, 19/8).
 *
 * ⚠️ Sostituisce il **quadro in conteggi** su «cosa devo fare oggi?»: «3 segnalazioni, 2 proposte»
 * dice quanto lavoro c'è, non *quale*. Con la lista si può dire «faccio la 3», si vede il nome di chi
 * aspetta, e si depenna.
 */
describe('VeraChatService — la lista della mattina', () => {
  const segnalazione = (i: number, clinica = false) => ({
    id: `e${i}`,
    category: clinica ? 'clinical' : 'other',
    reason: `motivo ${i}`,
    client: { clientProfile: { name: `Cliente ${i}` } },
  });

  it('numera le voci e ci mette dentro il nome di chi aspetta', async () => {
    const { service, messaggioCreate } = make({
      escalation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([segnalazione(1, true), segnalazione(2)]) },
    });
    await service.parla('lucia', 'cosa devo fare oggi?');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('1.');
    expect(testo).toContain('Cliente 1');
    expect(testo).toContain('2.');
  });

  /**
   * ⚠️ IL CASO CHE VALE IL TETTO. Cinquanta segnalazioni non si numerano: si portano le prime e **si
   * dice quante restano**. Un elenco troncato in silenzio si legge come «è tutto qui», ed è il modo
   * più efficace per far smettere di guardare altrove.
   */
  it('⚠️ oltre il tetto dice quante ne restano, invece di troncare in silenzio', async () => {
    const molte = Array.from({ length: 14 }, (_, i) => segnalazione(i + 1));
    const { service, messaggioCreate } = make({
      escalation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue(molte) },
    });
    await service.parla('lucia', 'fammi la lista');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('altre 4');
  });

  /**
   * ⚠️ «NON LO SO» ≠ «NESSUNO». Se una fonte si rompe, la lista dice quale colonna è cieca invece di
   * fingere uno zero: una lista che si presenta come «tutto quello che devi fare» e tace su una
   * fonte rotta insegna a fidarsi di un elenco incompleto.
   */
  it('⚠️ una fonte rotta si dice: la lista è cieca, non vuota', async () => {
    const { service, messaggioCreate } = make({
      escalation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockRejectedValue(new Error('boom')) },
    });
    await service.parla('lucia', 'fammi la lista');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('cieca');
    expect(testo).toContain('le segnalazioni');
  });
});

/**
 * «LA 3» — aprire una voce della lista e farci qualcosa (19/8, la seconda metà della richiesta di
 * Simone: la lista serve a **depennare**, non solo a leggere).
 */
describe('VeraChatService — «la 3»: aprire una voce della lista', () => {
  const decisione = (i: number) => ({
    id: `d${i}`,
    reasonKey: 'calo_rapido_energia',
    client: { clientProfile: { name: `Cliente ${i}` } },
  });

  const conLista = (extra: Record<string, unknown> = {}) =>
    make(
      {
        escalation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'c1' }, { userId: 'c2' }]), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
        engineDecision: { findMany: jest.fn().mockResolvedValue([decisione(1), decisione(2)]) },
      },
      extra,
    );

  it('la lista lascia lo stato aperto, e il numero apre la voce giusta', async () => {
    const { service, messaggioCreate } = conLista();
    await service.parla('lucia', 'fammi la lista');
    const primo = ultimoAgente(messaggioCreate);
    expect(primo.stato?.passo).toBe('lista_aperta');
    expect(primo.stato?.listaVoci).toHaveLength(2);
  });

  /**
   * ⚠️ IL NUMERO VALE SU QUELLO CHE HA LETTO. Le voci si conservano nello stato invece di
   * rileggerle: fra la lista e «la 2» una collega può chiudere una segnalazione, e la seconda riga
   * diventerebbe un'altra cosa — si aprirebbe qualcosa di diverso da quello che ha sullo schermo.
   */
  it('⚠️ «la 2» apre la seconda della lista che ha davanti, e offre le azioni della sua causa', async () => {
    const { service, messaggioCreate } = conLista({
      statoAperto: {
        passo: 'lista_aperta',
        frase: '',
        listaVoci: [
          { tipo: 'da_validare', id: 'd1', titolo: 'Cliente 1: Calo troppo rapido', causa: 'calo_rapido_energia', n: 1 },
          { tipo: 'da_validare', id: 'd2', titolo: 'Cliente 2: Calo troppo rapido', causa: 'calo_rapido_energia', n: 2 },
        ],
      },
    });
    await service.parla('lucia', 'la 2');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Cliente 2');
    expect(stato?.passo).toBe('lista_voce');
    expect(stato?.listaVoceScelta?.id).toBe('d2');
  });

  /** ⚠️ Un numero che non c'è non si indovina: si ripresenta l'elenco invece di aprire «la prima». */
  it('⚠️ «la 12» su una lista di due non apre niente', async () => {
    const { service, messaggioCreate } = conLista({
      statoAperto: { passo: 'lista_aperta', frase: '', listaVoci: [{ tipo: 'da_validare', id: 'd1', titolo: 'x', causa: 'calo_rapido_energia', n: 1 }] },
    });
    await service.parla('lucia', 'la 12');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('Non ho capito quale');
    expect(stato?.passo).toBe('lista_aperta');
  });

  /**
   * ⚠️ L'AZIONE PASSA DALLA STESSA PORTA DEI PULSANTI. Le regole — quali azioni per quale causa, il
   * perimetro, «una decisione si lavora una volta sola» — stanno in `NutritionistService` e non si
   * duplicano qui: se stessero in due posti, il giorno che Nocanty ne cambia una la coda e la chat
   * farebbero due cose diverse sulla stessa riga.
   */
  it('⚠️ l\'azione si esegue da NutritionistService, e la voce si depenna', async () => {
    const { service, messaggioCreate, decisioni } = conLista({
      statoAperto: {
        passo: 'lista_voce',
        frase: '',
        listaVoci: [
          { tipo: 'da_validare', id: 'd1', titolo: 'Cliente 1', causa: 'calo_rapido_energia', n: 1 },
          { tipo: 'da_validare', id: 'd2', titolo: 'Cliente 2', causa: 'calo_rapido_energia', n: 2 },
        ],
        listaVoceScelta: { tipo: 'da_validare', id: 'd1', titolo: 'Cliente 1', causa: 'calo_rapido_energia', n: 1 },
      },
    });
    await service.parla('lucia', '1');
    expect(decisioni.eseguiAzione).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'lucia' }),
      'd1',
      'autorizza_proseguire',
    );
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(stato?.listaVoci).toHaveLength(1);
    /**
     * ⚠️ IL DIFETTO PEGGIORE TROVATO DALLA REVISIONE DEL 19/8 SERA. Prima la lista si **rinumerava
     * in silenzio**: sullo schermo restavano i numeri vecchi, in memoria c'erano i nuovi. Dopo aver
     * chiuso la 1, «la 3» apriva la **quarta** — e su una coda «Da validare» quella è una scrittura
     * clinica sul piano di un'altra cliente. Adesso l'elenco si **ristampa**: i numeri che legge
     * sono quelli che valgono.
     */
    expect(stato?.listaVoci?.[0].n).toBe(1);
    expect(testo).toContain('Cliente 2');
    expect(testo).toContain('1. ');
  });

  /**
   * ⚠️ L'ERRORE DEL SERVIZIO SI RIPORTA, NON SI RISCRIVE. «Questa decisione è già stata lavorata» è
   * una frase che dice cosa fare; sostituirla con «non è riuscito» toglie l'unica cosa utile.
   */
  it('⚠️ se il servizio rifiuta, si riporta la sua frase', async () => {
    const { service, messaggioCreate } = conLista({
      decisioneErrore: 'Questa decisione è già stata lavorata: ricarica la coda.',
      statoAperto: {
        passo: 'lista_voce',
        frase: '',
        listaVoci: [{ tipo: 'da_validare', id: 'd1', titolo: 'Cliente 1', causa: 'calo_rapido_energia', n: 1 }],
        listaVoceScelta: { tipo: 'da_validare', id: 'd1', titolo: 'Cliente 1', causa: 'calo_rapido_energia', n: 1 },
      },
    });
    await service.parla('lucia', '1');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('già stata lavorata');
  });

  /**
   * ⚠️ QUELLO CHE NON SI ESEGUE DA QUI SI DICE DOVE SI FA. Fingere di averlo fatto — o aprire una
   * scorciatoia che salta i permessi della pagina vera — è il modo in cui nascono due strade per la
   * stessa modifica, con controlli diversi.
   */
  it('⚠️ un\'azione che non si esegue da qui lo dichiara, invece di fingere', async () => {
    const { service, messaggioCreate, decisioni } = conLista({
      statoAperto: {
        passo: 'lista_voce',
        frase: '',
        listaVoci: [{ tipo: 'segnalazione_clinica', id: 'e1', titolo: 'Cliente 1: calo', n: 1 }],
        listaVoceScelta: { tipo: 'segnalazione_clinica', id: 'e1', titolo: 'Cliente 1: calo', n: 1 },
      },
    });
    await service.parla('lucia', '1');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('non la faccio io da qui');
    expect(decisioni.eseguiAzione).not.toHaveBeenCalled();
    /**
     * ⚠️ E NON SI DEPENNA. Prima la voce spariva dalla lista e il testo chiudeva con «Fatto», dopo
     * aver detto una riga sopra che non era stato fatto niente: la segnalazione restava aperta e
     * usciva dall'elenco con la parola «fatto» accanto.
     */
    expect(stato?.listaVoci).toHaveLength(1);
    expect(testo).not.toContain('Fatto');
  });

  /**
   * ⚠️ IL PERIMETRO NON PUÒ FALLIRE APERTO — il difetto più grave dei nove trovati dalla revisione
   * del 19/8 sera.
   *
   * `perimetroClienti` che torna `null` vuol dire «nessun filtro», ed è giusto per il capo. Ma un
   * `catch(() => null)` trasformava un **errore di lettura** nella stessa risposta: la lista mostrava
   * numerate e azionabili le clienti di un'altra nutrizionista — dati sanitari, e senza dirlo. Era
   * l'unica fonte che rompendosi **allargava** invece di restringere.
   */
  it('⚠️ se il perimetro non si legge, la lista non si fa: si dichiara cieca', async () => {
    const { service, messaggioCreate } = make({
      user: { findUnique: jest.fn().mockRejectedValue(new Error('boom')) },
      escalation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([{ id: 'e1', category: 'clinical', reason: 'x', client: { clientProfile: { name: 'Cliente di un\'altra' } } }]) },
    });
    await service.parla('lucia', 'fammi la lista');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('cieca');
    expect(testo).toContain('di quali clienti ti occupi');
    // ⚠️ E soprattutto: NON compare nessuna cliente.
    expect(testo).not.toContain('Cliente di un\'altra');
  });

  /**
   * ⚠️ SI DEVE POTER USCIRE. Il passo era un vicolo cieco lungo due ore: qualunque cosa non fosse un
   * numero riceveva «non ho capito quale», e nemmeno «annulla» ne usciva — chi chiedeva la lista al
   * mattino non poteva più fare niente altro con Vera.
   */
  it('⚠️ «basta» chiude la lista invece di tenere in ostaggio la conversazione', async () => {
    const { service, messaggioCreate } = conLista({
      statoAperto: { passo: 'lista_aperta', frase: '', listaVoci: [{ tipo: 'da_validare', id: 'd1', titolo: 'x', causa: 'calo_rapido_energia', n: 1 }] },
    });
    await service.parla('lucia', 'basta');
    const { stato } = ultimoAgente(messaggioCreate);
    expect(stato?.passo).toBeUndefined();
  });

  /** ⚠️ E un comando vero non si ingoia: si esce dalla lista e lo si esegue. */
  it('⚠️ un comando scritto mentre la lista è aperta non viene ingoiato', async () => {
    const { service, messaggioCreate } = conLista({
      statoAperto: { passo: 'lista_aperta', frase: '', listaVoci: [{ tipo: 'da_validare', id: 'd1', titolo: 'x', causa: 'calo_rapido_energia', n: 1 }] },
    });
    await service.parla('lucia', 'a Giulia niente pollo');
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).not.toContain('Non ho capito quale');
  });
});

/**
 * ⛔ **LA NUTRIZIONISTA CAMBIA LE ORE DEL DIGIUNO — la porta che la regola della cliente promette.**
 *
 * Dal 25/8 la cliente può cambiare le ore una volta a settimana, e la frase che legge quando non può
 * le dice: *«se ti serve prima, scrivilo alla tua nutrizionista: lo cambia lei»*. ⛔ Quella porta non
 * esisteva — dal 21/8 la tendina della finestra è fuori dalla scheda staff, e in tutto il backend
 * nessuno poteva cambiare il protocollo di qualcun altro. Un limite senza la sua porta è un cancello
 * chiuso, con in più una frase che fa credere il contrario.
 */
describe('⛔ VeraChatService — le ore del digiuno', () => {
  const IN_DIGIUNO = {
    dislikedFoods: [], allergies: [], intolerances: [], name: 'Giulia', pastiEsclusi: [],
    pathType: 'intermittent_fasting', fastingProtocol: '16:8', fastingStartMin: 12 * 60,
  };

  it('⛔ «metti Giulia a 18:6»: anteprima con le ore in chiaro e i pasti, poi conferma', async () => {
    const { service, messaggioCreate, digiuno } = make({}, { profilo: IN_DIGIUNO });
    await service.parla('lucia', 'metti Giulia a 18:6');
    const aperto = ultimoAgente(messaggioCreate);
    expect(aperto.testo).toContain('18:6');
    // ⛔ Le ore, non il codice: chi conferma una scrittura sul piano di una persona deve leggere
    // quante ore digiuna e quanti pasti avrà.
    expect(aperto.testo).toContain('18 ore di digiuno');
    expect(aperto.testo).toContain('pasti');
    expect(aperto.stato?.passo).toBe('conferma');

    await service.parla('lucia', 'sì');
    expect(digiuno.impostaPerStaff).toHaveBeenCalledWith('c1', { protocollo: '18:6' }, 'lucia');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Fatto');
  });

  /**
   * ⛔ **I GIORNI GIÀ PREPARATI SI RIFANNO, E LA FRASE DICE QUANTI.**
   *
   * La prima stesura scriveva *«I pasti della sua giornata li ho già rifatti su queste ore»* e non
   * rifaceva niente: la struttura dei pasti la usa il compositore **al momento di comporre**, quindi
   * i giorni già in calendario restavano con i pasti vecchi. Passando 16:8 → 23:1 la cliente
   * continuava a vedere tre pasti mentre l'orologio ne diceva uno, e la nutrizionista leggeva che
   * erano stati rifatti. È il caso Lorena, e il progetto ha già la sua sentinella.
   */
  it('⛔ le giornate future non aperte si rifanno davvero, e il numero si dice', async () => {
    const oggi = new Date();
    const domani = new Date(oggi.getTime() + 86_400_000);
    const dopodomani = new Date(oggi.getTime() + 2 * 86_400_000);
    const { service, messaggioCreate, prisma } = make(
      {},
      {
        profilo: IN_DIGIUNO,
        giorniMenu: [
          { id: 'g1', date: domani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [] },
          { id: 'g2', date: dopodomani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [] },
        ],
      },
    );
    await service.parla('lucia', 'metti Giulia a 23:1');
    const anteprima = ultimoAgente(messaggioCreate);
    expect(anteprima.testo).toContain('2');
    expect(anteprima.stato?.passo).toBe('conferma');

    await service.parla('lucia', 'sì');
    expect(prisma.menuDay.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g1', 'g2'] } } });
    expect(ultimoAgente(messaggioCreate).testo).toContain('Ho rifatto 2 giornate');
  });

  /** ⚠️ E senza giornate da rifare lo dice lo stesso: «niente» è un esito, non un silenzio. */
  it('⚠️ senza giornate future la frase non promette niente', async () => {
    const { service, messaggioCreate } = make({}, { profilo: IN_DIGIUNO, giorniMenu: [] });
    await service.parla('lucia', 'metti Giulia a 18:6');
    await service.parla('lucia', 'sì');
    expect(ultimoAgente(messaggioCreate).testo).toContain('Nessuna giornata già preparata era da rifare');
  });

  /**
   * ⛔ **IL CASO LORENA, IL GIORNO DEL RILASCIO** — 26/8, trovato in revisione.
   *
   * Questo percorso riduceva la coda a un **numero** (`quanteDaRifare`), e un numero non sa dire
   * «non lo so»: con le aperture non ancora tracciate — cioè per **tutte**, il giorno del rilascio —
   * `0` faceva sparire la riga dall'anteprima e faceva scrivere «non c'erano giornate future da
   * rifare». La nutrizionista metteva Lorena a OMAD, confermava credendo che non ci fosse niente da
   * rifare, e Lorena restava con **tre pasti** in calendario e **un'ora** di finestra. Adesso questo
   * percorso racconta la coda con la stessa funzione degli altri due.
   */
  it('⛔ con le aperture non tracciate dice «non lo so», in anteprima e dopo', async () => {
    const { service, prisma, messaggioCreate } = make({}, {
      profilo: IN_DIGIUNO,
      giorniMenu: [
        { id: 'g1', clientId: 'c1', date: giornoSalvato(1), apertoDallaClienteIl: null, apertureTracciate: false, meals: [] },
      ],
    });
    await service.parla('lucia', 'metti Giulia a 23:1');
    expect(ultimoAgente(messaggioCreate).testo).toContain('non so dirti se le ha già aperte');
    await service.parla('lucia', 'sì');
    // ⚠️ Nel dubbio non si cancella, e soprattutto non si dice «non c'erano».
    expect(prisma.menuDay.deleteMany).not.toHaveBeenCalled();
    const { testo } = ultimoAgente(messaggioCreate);
    expect(testo).toContain('non so dirti se le ha già aperte');
    expect(testo).not.toContain('Nessuna giornata già preparata era da rifare');
  });

  /**
   * ⛔ **Chi non è in digiuno non ci si mette da qui.** Passare una cliente al digiuno intermittente
   * è un cambio di **percorso** — tocca dieta, pasti e catalogo — e ha la sua strada. Scrivere un
   * protocollo su un profilo senza orologio le lascerebbe uno schermo che dice una cosa e un piatto
   * che ne dice un'altra.
   */
  it('⛔ su chi non è in digiuno non si scrive niente, e si dice perché', async () => {
    const { service, messaggioCreate, digiuno } = make(
      {},
      { profilo: { ...IN_DIGIUNO, pathType: 'standard', fastingProtocol: null, fastingStartMin: null } },
    );
    await service.parla('lucia', 'metti Giulia a 18:6');
    expect(ultimoAgente(messaggioCreate).testo).toContain('percorso');
    expect(digiuno.impostaPerStaff).not.toHaveBeenCalled();
  });

  /**
   * ⛔ E se non ha detto a quale, si chiede: non si indovina un numero da mettere in un piano. ⚠️ **E
   * la domanda si può rispondere**: la prima stesura lasciava lo stato invariato (`quale_cliente`),
   * quindi «18:6» finiva in `risolviCliente` e Vera diceva «non trovo nessuna cliente che si chiami
   * 18:6». Una domanda a cui non si può rispondere è peggio di una domanda non fatta.
   */
  it('⛔ «cambia il digiuno di Giulia» senza dire a cosa: si chiede, e la risposta arriva', async () => {
    const { service, messaggioCreate, digiuno } = make({}, { profilo: IN_DIGIUNO });
    await service.parla('lucia', 'cambia il digiuno di Giulia');
    const domanda = ultimoAgente(messaggioCreate);
    expect(domanda.testo).toContain('A quale?');
    expect(domanda.testo).toContain('16:8');
    expect(domanda.stato?.passo).toBe('quale_digiuno');
    expect(digiuno.impostaPerStaff).not.toHaveBeenCalled();

    // ⛔ La risposta secca: niente verbo, niente parola «digiuno» — è il contesto a dire cos'è.
    await service.parla('lucia', '18:6');
    const anteprima = ultimoAgente(messaggioCreate);
    expect(anteprima.testo).toContain('18 ore di digiuno');
    expect(anteprima.stato?.passo).toBe('conferma');

    await service.parla('lucia', 'sì');
    expect(digiuno.impostaPerStaff).toHaveBeenCalledWith('c1', { protocollo: '18:6' }, 'lucia');
  });

  it('⚠️ e se la risposta non si capisce, si dice cosa scrivere invece di ripetere la domanda', async () => {
    const { service, messaggioCreate } = make({}, { profilo: IN_DIGIUNO });
    await service.parla('lucia', 'cambia il digiuno di Giulia');
    await service.parla('lucia', 'boh');
    const testo = ultimoAgente(messaggioCreate).testo;
    expect(testo).toContain('Non ho capito quali ore');
    expect(testo).toContain('Standard');
  });

  it('⚠️ e se è già a quelle ore non si tocca niente', async () => {
    const { service, messaggioCreate, digiuno } = make({}, { profilo: IN_DIGIUNO });
    await service.parla('lucia', 'metti Giulia a 16:8');
    expect(ultimoAgente(messaggioCreate).testo).toContain('già');
    expect(digiuno.impostaPerStaff).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **Se la scrittura non riesce, NON si dice «fatto».** È la stessa lezione delle proteine
   * (24/8): un `catch` silenzioso faceva leggere alla nutrizionista un successo che non c'era.
   */
  it('⛔ se la porta rifiuta, si dice perché e non si scrive nel registro', async () => {
    const { service, messaggioCreate, digiuno } = make(
      {},
      {
        profilo: IN_DIGIUNO,
        digiunoEsito: { ok: false, perche: 'non riesco a calcolare i pasti di quella finestra.', daQuando: 'oggi' },
      },
    );
    await service.parla('lucia', 'metti Giulia a 18:6');
    await service.parla('lucia', 'sì');
    expect(digiuno.impostaPerStaff).toHaveBeenCalled();
    // ⚠️ E lo stato si chiude: non resta un dialogo appeso su una scrittura che non c'è stata.
    const finale = ultimoAgente(messaggioCreate);
    expect(finale.testo).toContain('Non sono riuscita');
    expect(finale.stato).toBeUndefined();
  });
});
