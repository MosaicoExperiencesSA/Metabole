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
  } = {},
) {
  const messaggioCreate = jest.fn().mockResolvedValue({ id: 'm1' });
  const profileUpdate = jest.fn().mockResolvedValue({});
  const prisma = {
    messaggioVera: {
      create: messaggioCreate,
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(
        opzioni.statoAperto ? { meta: { stato: opzioni.statoAperto }, createdAt: new Date() } : null,
      ),
    },
    // `head_nutritionist` → `perimetroClienti` ritorna null: nessun filtro, il test resta sul dialogo.
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'head_nutritionist' }), findMany: jest.fn().mockResolvedValue([CLIENTE]) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(opzioni.profilo ?? { dislikedFoods: [], allergies: [], intolerances: [], name: 'Giulia' }),
      update: profileUpdate,
    },
    recipe: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
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
  } as unknown as RegistroVeraService;

  const richieste = {
    // Nessuna domanda aperta se il test non dice altro.
    aperte: jest.fn().mockResolvedValue(opzioni.richieste ?? []),
    rispondi: jest.fn().mockResolvedValue({ aggiunti: ['fave', 'legumi'], clienteNome: 'Mariastella' }),
    collega: jest.fn().mockResolvedValue(undefined),
  } as unknown as RichiesteVeraService;

  /**
   * La tabella nutrienti finta. ⚠️ Di default NON conosce niente: così un test che scrive una
   * ricetta deve dire quali valori esistono, e non può passare per caso su numeri inventati.
   */
  const valori = {
    cerca: jest.fn().mockImplementation(async (nome: string) => (opzioni.valori ?? {})[nome] ?? null),
    registraMancante: jest.fn().mockResolvedValue(undefined),
  } as unknown as ValoriNutrizionaliService;
  const ricette = {
    createRecipe: jest.fn().mockResolvedValue({ id: 'r-nuova' }),
    updateRecipe: jest.fn().mockResolvedValue({ id: 'r1' }),
  } as unknown as ScritturaRicetta;

  return {
    service: new VeraChatService(prisma, dizionario, pool, registro, richieste, valori, ricette),
    valori,
    ricette,
    richieste,
    messaggioCreate,
    profileUpdate,
    dizionario,
    registro,
    prisma,
  };
}

describe('VeraChatService — il primo incontro', () => {
  it('si presenta e chiede di essere battezzato', async () => {
    const { service, messaggioCreate, prisma } = make();
    (prisma.messaggioVera.count as jest.Mock).mockResolvedValue(0);
    await service.apri('lucia');
    const { testo, stato } = ultimoAgente(messaggioCreate);
    // ⚠️ Agganciato a una parola che resta, non a mezza frase: così il prossimo ritocco di stile
    // non fa rosso un test.
    expect(testo).toContain('battezzarmi');
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
