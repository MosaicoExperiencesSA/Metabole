/**
 * Il caricamento delle voci — con l'AGGIORNAMENTO DELLO STATO (richiesta di Simone, 13/8 sera):
 * «quando carica le voci nuove, in quelle vecchie se aggiorna lo stato è molto meglio».
 *
 * La regola è a SENSO UNICO: il file può CHIUDERE una voce ancora aperta in pagina, mai riaprirne
 * una spuntata. La pagina resta lo stato vivo; il file porta solo la notizia «questa è finita».
 */
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LavoriService } from './lavori.service';

jest.mock('./voci-iniziali', () => ({
  VOCI_INIZIALI: [
    { chiave: 'aperta-e-finita', titolo: 'Lavoro finito nel file', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 1, fatta: true },
    { chiave: 'gia-spuntata', titolo: 'Già chiusa in pagina', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 2 },
    { chiave: 'nuova-gia-chiusa', titolo: 'Nasce già spuntata', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 3, fatta: true },
    { chiave: 'nuova-aperta', titolo: 'Nasce aperta', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 4, nata: '2026-08-19T10:07', priorita: 'bassa' },
    // ⚠️ Il file sa da quando esiste questa voce; in pagina la data manca perché il campo è nato dopo.
    { chiave: 'gia-in-pagina-senza-data', titolo: 'Vecchia, senza data', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 5, nata: '2026-08-16T09:30' },
    // ⚠️ Questa la data ce l'ha già: il file NON la deve riscrivere.
    { chiave: 'gia-in-pagina-con-data', titolo: 'Vecchia, con data', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 6, nata: '2026-08-16T09:30' },
    // Una data che non si legge non si scrive: meglio «non lo so» che un 1970 in pagina.
    { chiave: 'data-illeggibile', titolo: 'Data storta', dettaglio: 'x', categoria: 'Da fare — codice', ordine: 7, nata: 'non una data' },
    // ⚠️ Le due righe di chiusura dei doppioni (voce 224): una c'è in pagina, l'altra no.
    { chiave: 'doppione-in-pagina', titolo: 'Doppione da chiudere', dettaglio: 'x', categoria: 'Manutenzione', ordine: 900, fatta: true, soloSeEsiste: true },
    { chiave: 'doppione-inesistente', titolo: 'Doppione che non c\'è', dettaglio: 'x', categoria: 'Manutenzione', ordine: 901, fatta: true, soloSeEsiste: true },
  ],
}));

describe('LavoriService.caricaVociIniziali — lo stato viaggia col file', () => {
  let service: LavoriService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lavoro: {
        // In pagina esistono le prime due: una aperta (che il file dichiara finita) e una già spuntata.
        findMany: jest.fn().mockResolvedValue([
          // Identica al file: niente da segnalare.
          { id: 'l1', chiave: 'aperta-e-finita', fatto: false, titolo: 'Lavoro finito nel file', dettaglio: 'x', testoAMano: false },
          // ⚠️ In pagina c'è il DETTAGLIO VECCHIO: il file l'ha riscritto e la pagina non lo sa.
          { id: 'l2', chiave: 'gia-spuntata', fatto: true, titolo: 'Già chiusa in pagina', dettaglio: 'testo vecchio', testoAMano: false },
          // Il doppione rimasto in pagina il 13/8: aperto, con un testo suo che non interessa a nessuno.
          { id: 'l3', chiave: 'doppione-in-pagina', fatto: false, titolo: 'tutt\'altro titolo', dettaglio: 'tutt\'altro', testoAMano: false },
          // ⚠️ Nate prima del campo: la data non ce l'hanno, e il file la sa.
          { id: 'l4', chiave: 'gia-in-pagina-senza-data', fatto: false, titolo: 'Vecchia, senza data', dettaglio: 'x', testoAMano: false, nataIl: null },
          { id: 'l5', chiave: 'gia-in-pagina-con-data', fatto: false, titolo: 'Vecchia, con data', dettaglio: 'x', testoAMano: false, nataIl: new Date('2026-08-11T08:00:00Z') },
          { id: 'l6', chiave: 'data-illeggibile', fatto: false, titolo: 'Data storta', dettaglio: 'x', testoAMano: false, nataIl: null },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'nuovo' }),
        update: jest.fn().mockResolvedValue({ id: 'l1' }),
        // ⚠️ Il doppio finto deve rispondere come l'originale: `count` esiste, e un doppio che si
        // comporta diversamente non verifica niente (lezione del 19/8 su `audit.log`).
        count: jest.fn().mockResolvedValue(0),
      },
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [LavoriService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LavoriService);
  });

  /**
   * ⚠️ IL TESTO NON SI RISCRIVE, MA SI DICE (18/8, dalla domanda di Simone «la lista lavori la stai
   * tenendo allineata?»). Il file è allineato, la pagina no: una voce riscritta nel file — succede a
   * ogni volta che si scopre la causa vera — in pagina resta com'era, e chi legge crede di leggere
   * l'ultima parola.
   */
  /**
   * ⚠️ DAL 18/8 IL TESTO SI RISCRIVE (voce 275). Prima non si riscriveva mai e la pagina restava
   * alla versione del primo caricamento: una voce corretta nel file — succede a ogni giro, perché
   * una voce si riscrive quando si scopre la causa vera — in pagina raccontava ancora la
   * ricostruzione sbagliata. Il caso che l'ha deciso: la bonifica delle email ha ripulito il file,
   * e in pagina l'indirizzo di una cliente è rimasto lì.
   */
  it('⚠️ riscrive il testo delle voci che nessuno ha corretto a mano', async () => {
    const esito = await service.caricaVociIniziali(true);
    expect(esito.riscritte.map((r) => r.titolo)).toEqual(['Già chiusa in pagina']);
    const scritta = (prisma.lavoro.update as jest.Mock).mock.calls
      .map((c) => c[0])
      .find((s) => s.where.id === 'l2');
    expect(scritta.data).toEqual({ titolo: 'Già chiusa in pagina', dettaglio: 'x' });
  });

  /**
   * ⚠️ Ma NON quelle scritte da una persona dal backoffice. Una correzione fatta a mano che
   * sparisce al rilascio dopo, in silenzio, sarebbe lo stesso difetto spostato di un metro — e
   * questa è la pagina che serve a non farlo succedere altrove.
   */
  it('⚠️ NON riscrive quelle corrette a mano, e le dice a parte', async () => {
    prisma.lavoro.findMany.mockResolvedValue([
      { id: 'l1', chiave: 'aperta-e-finita', fatto: false, titolo: 'Lavoro finito nel file', dettaglio: 'x', testoAMano: false },
      { id: 'l2', chiave: 'gia-spuntata', fatto: true, titolo: 'Riscritta da una persona', dettaglio: 'quello che ha scritto lei', testoAMano: true },
    ]);
    const esito = await service.caricaVociIniziali(true);
    expect(esito.testiCambiati.map((x) => x.titolo)).toEqual(['Già chiusa in pagina']);
    expect(esito.riscritte).toEqual([]);
    const scritture = (prisma.lavoro.update as jest.Mock).mock.calls.map((c) => c[0]);
    for (const s of scritture) {
      expect(s.data.titolo).toBeUndefined();
      expect(s.data.dettaglio).toBeUndefined();
    }
  });

  /**
   * ⚠️ `categoria` e `ordine` restano dove qualcuno li ha messi in pagina: riscriverli
   * sposterebbe le voci sotto gli occhi di chi le sta guardando, e non è quello che si chiede a un
   * pulsante che dice «aggiorna dal rilascio».
   */
  it('⚠️ riscrive SOLO titolo e dettaglio, non categoria e ordine', async () => {
    await service.caricaVociIniziali(true);
    const scritta = (prisma.lavoro.update as jest.Mock).mock.calls
      .map((c) => c[0])
      .find((s) => s.where.id === 'l2');
    expect(Object.keys(scritta.data).sort()).toEqual(['dettaglio', 'titolo']);
  });

  it('una voce identica fra file e pagina non compare fra i testi cambiati', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.testiCambiati.map((t) => t.titolo)).not.toContain('Lavoro finito nel file');
  });

  it('spunta le voci esistenti che il file dichiara finite', async () => {
    const esito = await service.caricaVociIniziali(true);
    expect(prisma.lavoro.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ fatto: true }) }),
    );
    // 2 e non 1: dal 18/8 il file porta anche le righe che chiudono i doppioni (`soloSeEsiste`),
    // e anche quelle sono spunte — solo su voci che in pagina ci sono già.
    expect(esito.spuntate).toBe(2);
  });

  it('MAI riaprire: una voce spuntata in pagina resta spuntata anche se il file la dà aperta', async () => {
    await service.caricaVociIniziali(true);
    const riaperture = (prisma.lavoro.update as jest.Mock).mock.calls.filter(
      (c: any[]) => c[0]?.data?.fatto === false,
    );
    expect(riaperture).toHaveLength(0);
  });

  it('una voce nuova con fatta:true nasce già spuntata; `fatta` non finisce in banca dati', async () => {
    await service.caricaVociIniziali(true);
    const create = (prisma.lavoro.create as jest.Mock).mock.calls.map((c: any[]) => c[0].data);
    const chiusa = create.find((d: any) => d.chiave === 'nuova-gia-chiusa');
    const aperta = create.find((d: any) => d.chiave === 'nuova-aperta');
    expect(chiusa.fatto).toBe(true);
    expect(chiusa.fatta).toBeUndefined(); // il campo del file non è una colonna
    expect(aperta.fatto ?? false).toBe(false);
  });

  /**
   * ⚠️ Il difetto trovato il 14/8 sera: la pagina mostrava il pulsante «Conferma» solo se c'era
   * qualcosa da AGGIUNGERE. Nella serata delle tre consegne non c'era niente di nuovo e c'erano
   * tre voci da spuntare: il pulsante non compariva, e la spunta si è dovuta fare dalla shell di
   * Render. Perché la pagina possa dire COSA spunterebbe, qui devono uscire i titoli, non le chiavi.
   */
  it('dice quali voci spunterebbe, col titolo che si legge in pagina', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.chiuse).toEqual([
      { titolo: 'Lavoro finito nel file', categoria: 'Da fare — codice' },
      { titolo: 'Doppione da chiudere', categoria: 'Manutenzione' },
    ]);
  });

  it('in prova non scrive niente, ma dice cosa spunterebbe', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(prisma.lavoro.update).not.toHaveBeenCalled();
    expect(prisma.lavoro.create).not.toHaveBeenCalled();
    expect(esito.spuntate).toBe(2);
    // ⚠️ 2 e non 3: il doppione che in pagina non c'è NON viene contato fra le aggiunte, perché
    // non verrebbe creato.
    expect(esito.aggiunte).toBe(2);
  });

  /**
   * ⚠️ LE RIGHE `soloSeEsiste` (voce 224). Il 13/8 le voci di Vera sono finite due volte nel file,
   * con chiavi diverse per le stesse cose. Il doppione è stato tolto dal file, ma se il caricamento
   * era già girato in mezzo quelle righe sono rimaste in PAGINA, aperte.
   *
   * Marcarle `fatta: true` e basta non bastava: se in pagina non ci fossero, il caricamento le
   * **creerebbe** — tre voci nuove già spuntate, cioè spazzatura scritta per pulire spazzatura.
   */
  describe('⚠️ le righe che chiudono un doppione: spuntano se c\'è, non creano se non c\'è', () => {
    it('quella presente in pagina viene spuntata', async () => {
      const esito = await service.caricaVociIniziali(false);
      expect(esito.chiuse.map((c) => c.titolo)).toContain('Doppione da chiudere');
    });

    it('⚠️ quella che in pagina non c\'è NON viene creata', async () => {
      const esito = await service.caricaVociIniziali(false);
      expect(esito.titoli.map((c) => c.titolo)).not.toContain('Doppione che non c\'è');
    });

    it('⚠️ e nemmeno scrivendo davvero: nessun `create` con quella chiave', async () => {
      await service.caricaVociIniziali(true);
      const chiaviCreate = prisma.lavoro.create.mock.calls.map((c: any) => c[0].data.chiave);
      expect(chiaviCreate).not.toContain('doppione-inesistente');
      expect(chiaviCreate).toContain('nuova-aperta');
    });

    /** Il loro testo non è una voce di lavoro: elencarlo fra «i testi cambiati» sarebbe rumore. */
    it('non compaiono fra i testi da allineare, anche se in pagina dicono tutt\'altro', async () => {
      const esito = await service.caricaVociIniziali(false);
      expect(esito.testiCambiati.map((x) => x.titolo)).not.toContain('Doppione da chiudere');
    });
  });
});

/**
 * LA DATA DI NASCITA E LA PRIORITÀ — i due campi del 19/8, che si comportano in modo opposto.
 *
 * Richiesta di Simone: «voglio che mi segni nell'elenco lavori la data e ora di creazione di quel
 * punto altrimenti non capisco nulla» e «aggiungi alla lista lavori la possibilità per me di darti
 * le priorità Alta Bassa Neutra».
 */
describe('LavoriService.caricaVociIniziali — la data di nascita e la priorità', () => {
  let service: LavoriService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lavoro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'l1', chiave: 'aperta-e-finita', fatto: false, titolo: 'Lavoro finito nel file', dettaglio: 'x', testoAMano: false, nataIl: null },
          { id: 'l2', chiave: 'gia-spuntata', fatto: true, titolo: 'Già chiusa in pagina', dettaglio: 'x', testoAMano: false, nataIl: null },
          { id: 'l4', chiave: 'gia-in-pagina-senza-data', fatto: false, titolo: 'Vecchia, senza data', dettaglio: 'x', testoAMano: false, nataIl: null },
          { id: 'l5', chiave: 'gia-in-pagina-con-data', fatto: false, titolo: 'Vecchia, con data', dettaglio: 'x', testoAMano: false, nataIl: new Date('2026-08-11T08:00:00Z') },
          { id: 'l6', chiave: 'data-illeggibile', fatto: false, titolo: 'Data storta', dettaglio: 'x', testoAMano: false, nataIl: null },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'nuovo' }),
        update: jest.fn().mockResolvedValue({ id: 'x' }),
        count: jest.fn().mockResolvedValue(0),
      },
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [LavoriService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LavoriService);
  });

  const dataScritta = (id: string) =>
    (prisma.lavoro.update as jest.Mock).mock.calls.map((c) => c[0]).find((u) => u.where.id === id && u.data.nataIl);

  /**
   * ⚠️ IL CASO CHE VALE IL CAMPO. Le cento voci già in pagina sono nate prima che il campo
   * esistesse: se il rilascio non gliela aggiungesse, la data ce l'avrebbero solo le voci future — e
   * la colonna che Simone ha chiesto per capire l'elenco non direbbe niente proprio sull'elenco di
   * adesso.
   */
  it('⚠️ aggiunge la data alle voci che non ce l\'hanno', async () => {
    const esito = await service.caricaVociIniziali(true);
    expect(esito.datate).toBe(1);
    expect(dataScritta('l4').data.nataIl).toEqual(new Date('2026-08-16T09:30'));
  });

  /**
   * ⚠️ MA NON LA RISCRIVE MAI. Una data in pagina che cambia da sola a ogni rilascio non è più una
   * data: è un numero che si muove, e su un numero che si muove non si ragiona.
   */
  it('⚠️ non tocca la data di chi ce l\'ha già, nemmeno se il file ne dice un\'altra', async () => {
    await service.caricaVociIniziali(true);
    expect(dataScritta('l5')).toBeUndefined();
  });

  /** ⚠️ Una data che non si legge non si scrive: meglio «non lo so» che un 1970 in pagina. */
  it('⚠️ una data illeggibile non diventa una data sbagliata', async () => {
    await service.caricaVociIniziali(true);
    expect(dataScritta('l6')).toBeUndefined();
  });

  /** Prima si guarda e poi si scrive: senza conferma non parte nemmeno una update. */
  it('senza conferma dice quante ne daterebbe e non scrive', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.datate).toBe(1);
    expect(prisma.lavoro.update).not.toHaveBeenCalled();
  });

  /** La voce che nasce adesso porta con sé data e priorità dichiarate dal file. */
  it('una voce nuova nasce con la sua data e la sua priorità', async () => {
    await service.caricaVociIniziali(true);
    const creata = (prisma.lavoro.create as jest.Mock).mock.calls
      .map((c) => c[0].data)
      .find((d) => d.chiave === 'nuova-aperta');
    expect(creata.nataIl).toEqual(new Date('2026-08-19T10:07'));
    expect(creata.priorita).toBe('bassa');
    // ⚠️ `nata` e `priorita` sono campi del FILE: `nata` non è una colonna e non deve finire in banca dati.
    expect(creata.nata).toBeUndefined();
  });

  /**
   * ⚠️ LA PRIORITÀ DI UNA VOCE GIÀ IN ELENCO NON SI TOCCA — è l'opposto della data, e di proposito.
   *
   * La data è un fatto che il file ha scoperto dopo; la priorità è un giudizio, e lo dà Simone dalla
   * pagina. Un file che gliela riscrive a ogni rilascio gli toglierebbe di mano l'unica leva che ha
   * chiesto, in silenzio — che è la parte peggiore.
   */
  it('⚠️ non riscrive MAI la priorità di una voce già in elenco', async () => {
    await service.caricaVociIniziali(true);
    const conPriorita = (prisma.lavoro.update as jest.Mock).mock.calls
      .map((c) => c[0])
      .filter((u) => u.data.priorita !== undefined);
    expect(conPriorita).toEqual([]);
  });
});

/**
 * ⚠️ LA DIVERGENZA FRA IL FILE E LA PAGINA SI DICE (19/8, dalla voce `lista-lavori-file-e-pagina`).
 *
 * Il file può solo *chiudere* una voce, mai riaprirla: quando qualcosa si chiude fuori da una
 * consegna — Simone lancia uno script sulla shell, una decisione arriva in chat — la pagina lo sa e
 * il file no. E chi legge il file crede di leggere l'elenco vero: il 19/8 gli ho ripresentato come
 * aperte la tabella IG e la conta allergie, che aveva già lanciato lui.
 */
describe('LavoriService.caricaVociIniziali — il file e la pagina che divergono', () => {
  let service: LavoriService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lavoro: {
        findMany: jest.fn().mockResolvedValue([
          // ⚠️ Il file la dà per aperta (non ha `fatta: true`), la pagina l'ha spuntata: file indietro.
          { id: 'l2', chiave: 'gia-spuntata', fatto: true, titolo: 'Già chiusa in pagina', dettaglio: 'x', testoAMano: false, nataIl: null },
          // Questa il file la sa già chiusa: non è una divergenza, è il funzionamento normale.
          { id: 'l1', chiave: 'aperta-e-finita', fatto: true, titolo: 'Lavoro finito nel file', dettaglio: 'x', testoAMano: false, nataIl: null },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'nuovo' }),
        update: jest.fn().mockResolvedValue({ id: 'x' }),
        count: jest.fn().mockResolvedValue(3),
      },
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [LavoriService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LavoriService);
  });

  /** ⚠️ IL CASO CHE VALE LA VOCE: il file la crede aperta, in pagina è spuntata. */
  it('⚠️ dice quali voci il file crede aperte e la pagina ha già chiuso', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.fileIndietro.map((v) => v.chiave)).toEqual(['gia-spuntata']);
  });

  /**
   * ⚠️ Una voce che il file dichiara **finita** e la pagina ha spuntato non è una divergenza: è il
   * caso normale, e metterla nell'elenco lo riempirebbe di righe che non dicono niente — un avviso
   * che compare sempre non è un avviso.
   */
  it('⚠️ una voce che il file sa già chiusa non è una divergenza', async () => {
    const esito = await service.caricaVociIniziali(false);
    expect(esito.fileIndietro.map((v) => v.chiave)).not.toContain('aperta-e-finita');
  });

  /** L'altra direzione: le voci scritte a mano dalla pagina, che nel file non esistono. */
  it('conta le voci che vivono solo in pagina', async () => {
    expect((await service.caricaVociIniziali(false)).soloInPagina).toBe(3);
    expect((prisma.lavoro.count as jest.Mock).mock.calls[0][0].where).toEqual({ chiave: null, fatto: false });
  });

  /** ⚠️ È una lettura: dirlo non deve scrivere niente, nemmeno col secondo clic. */
  it('⚠️ non corregge niente: quale versione vinca è una decisione, non un automatismo', async () => {
    await service.caricaVociIniziali(true);
    const spunteTolte = (prisma.lavoro.update as jest.Mock).mock.calls
      .map((c) => c[0])
      .filter((u) => u.data.fatto === false);
    expect(spunteTolte).toEqual([]);
  });
});
