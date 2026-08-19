import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ValoriNutrizionaliService, normalizzaNome } from './valori-nutrizionali.service';

/**
 * LA BANCA DATI CHE GAIA CONSULTA PRIMA DI DIRE UN NUMERO (11/8).
 *
 * I due gruppi di test che contano sono: **quale** alimento trova (sbagliare qui vuol dire dare a una
 * cliente i valori di un altro cibo) e **come** dice il dato (dire «82» quando la fonte va da 73 a
 * 111 è la falsa precisione che ha causato tutto).
 */
const riga = (over: Record<string, unknown>) => ({
  id: 'x',
  name: 'x',
  synonyms: [],
  category: 'cereali',
  state: null,
  glycemicIndex: null,
  glycemicIndexMin: null,
  glycemicIndexMax: null,
  glycemicIndexSource: null,
  glycemicIndexReliability: null,
  kcal: null,
  protein: null,
  carbs: null,
  sugars: null,
  fat: null,
  fiber: null,
  source: null,
  sourceRef: null,
  note: null,
  verifiedAt: null,
  ...over,
});

const TABELLA = [
  riga({
    id: 'basmati', name: 'riso basmati', synonyms: ['basmati'],
    glycemicIndex: 62, glycemicIndexMin: 57, glycemicIndexMax: 67,
    glycemicIndexSource: 'International Tables 2008', glycemicIndexReliability: 'debole',
    kcal: 367, protein: 9, carbs: 82.9, fat: 1.9, fiber: 1.3, state: 'crudo', source: 'CREA',
  }),
  riga({
    id: 'integrale', name: 'riso integrale',
    glycemicIndex: 65, glycemicIndexMin: 50, glycemicIndexMax: 68,
    glycemicIndexSource: 'International Tables 2021', glycemicIndexReliability: 'media',
    kcal: 341, protein: 7.5, carbs: 77.4, fat: 1.9, fiber: 1.9, state: 'crudo', source: 'CREA',
  }),
  riga({ id: 'bianco', name: 'riso bianco', synonyms: ['riso brillato'], glycemicIndex: 73, glycemicIndexMin: 66, glycemicIndexMax: 89, glycemicIndexReliability: 'debole', kcal: 334 }),
  riga({ id: 'mela', name: 'mela', category: 'frutta', glycemicIndex: 39, glycemicIndexMin: 36, glycemicIndexMax: 39, glycemicIndexReliability: 'solida', kcal: 44, glycemicIndexSource: 'LPI' }),
  riga({ id: 'borlotti', name: 'fagioli borlotti', synonyms: ['borlotti'], category: 'legumi', kcal: 312, protein: 20.2, state: 'secchi', source: 'CREA', note: 'Nessun IG affidabile per i borlotti.' }),
  riga({ id: 'gallette', name: 'gallette di riso', glycemicIndex: 82, glycemicIndexReliability: 'solida', glycemicIndexSource: 'IT2008' }),
  /**
   * ⚠️ Le DUE righe senza numero, che prima erano indistinguibili (18/8):
   *  - il salmone un indice glicemico **non ce l'ha**, e il capo l'ha dichiarato;
   *  - del sedano non lo sappiamo, e basta.
   * Il collaudo qui sotto è che non ricevano la stessa risposta.
   */
  riga({ id: 'salmone', name: 'salmone', category: 'proteici', state: 'crudo', kcal: 185, protein: 18.4, glycemicIndexReliability: 'non_applicabile', glycemicIndexSource: 'Tabella del capo nutrizionista (18/8/2026)' }),
  riga({ id: 'sedano', name: 'sedano', category: 'verdura', kcal: 20 }),
];

describe('ValoriNutrizionaliService — quale alimento trova', () => {
  let service: ValoriNutrizionaliService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      nutrientFact: { findMany: jest.fn().mockResolvedValue(TABELLA) },
      nutrientLookupMiss: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn(), create: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ValoriNutrizionaliService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ValoriNutrizionaliService);
  });

  it('per nome esatto e per sinonimo', async () => {
    expect((await service.cerca('riso basmati'))?.id).toBe('basmati');
    expect((await service.cerca('basmati'))?.id).toBe('basmati');
    expect((await service.cerca('riso brillato'))?.id).toBe('bianco');
  });

  it('dentro una frase, e maiuscole e accenti non contano', async () => {
    expect((await service.cerca('vorrei sapere del Riso Basmati per stasera'))?.id).toBe('basmati');
  });

  /**
   * Il test che vale più di tutti: «riso integrale» CONTIENE «riso», e prendendo il primo che
   * combacia una domanda sull'integrale riceverebbe i valori del riso bianco — lo stesso genere di
   * scambio da cui è nata questa storia.
   */
  it('vince il nome più LUNGO: «riso integrale» non diventa «riso bianco»', async () => {
    expect((await service.cerca('quante calorie ha il riso integrale?'))?.id).toBe('integrale');
    expect((await service.cerca('e le gallette di riso?'))?.id).toBe('gallette');
  });

  it('quello che non c\'è resta non trovato: non si stima e non si prende un cibo simile', async () => {
    expect(await service.cerca('tempeh')).toBeNull();
    expect(await service.cerca('riso venere')).toBeNull();
  });

  /**
   * ⚠️ IL DIFETTO DEL PEZZO DI PAROLA, MESSO NERO SU BIANCO (19/8). «Melanzane» contiene «mela», e
   * `cercaTutti` — che è la strada vera di ogni risposta di Gaia sui numeri — trova la mela.
   *
   * ⛔ Il test dice che **oggi succede**: non è un test di ciò che vorrei, è la fotografia di com'è.
   * Il giorno che Simone sceglie le parole intere, questo test diventa rosso ed è **giusto** che lo
   * diventi — si cambia l'aspettativa insieme al comportamento, in un posto solo.
   */
  it('⚠️ oggi «le melanzane» trovano la MELA: il difetto del pezzo di parola', async () => {
    const trovati = await service.cercaTutti('quante calorie hanno le melanzane?');
    expect(trovati.map((t) => t.id)).toEqual(['mela']);
  });

  /**
   * ⚠️ E QUESTO È IL TEST CHE TIENE IN PIEDI LA MISURA. `npm run diag:ricerca` prova il cambio vero
   * passando `parole_intere` al codice di produzione; se il parametro non arrivasse fin dentro il
   * confronto, la diagnostica misurerebbe **due volte la stessa cosa** e direbbe «non cambia
   * niente» — la più tranquillizzante delle risposte sbagliate.
   */
  it('⚠️ a «parole intere» la melanzana non trova più la mela, e la mela vera sì', async () => {
    expect((await service.cercaTutti('quante calorie hanno le melanzane?', 3, 'parole_intere')).map((t) => t.id)).toEqual([]);
    expect((await service.cercaTutti('quante calorie ha la mela?', 3, 'parole_intere')).map((t) => t.id)).toEqual(['mela']);
  });

  /** Lo stesso sul parametro di `cerca`, che ce l'ha per la stessa ragione. */
  it('⚠️ anche «cerca» accetta il modo, e cambia risposta', async () => {
    expect((await service.cerca('quante calorie hanno le melanzane?'))?.id).toBe('mela');
    expect(await service.cerca('quante calorie hanno le melanzane?', 'parole_intere')).toBeNull();
  });

  it('due alimenti in un confronto, nell\'ordine in cui li ha scritti', async () => {
    const trovati = await service.cercaTutti('meglio il riso basmati o il riso integrale?');
    expect(trovati.map((t) => t.id)).toEqual(['basmati', 'integrale']);
  });

  it('nel confronto il «riso» dentro «riso integrale» non conta come terzo alimento', async () => {
    const trovati = await service.cercaTutti('differenza fra riso integrale e mela');
    expect(trovati.map((t) => t.id)).toEqual(['integrale', 'mela']);
  });

  it('normalizzaNome: apostrofi, accenti e spazi doppi non fanno differenza', () => {
    expect(normalizzaNome("  L'Olio   d'Oliva ")).toBe('l olio d oliva');
    expect(normalizzaNome('Perù')).toBe('peru');
  });
});

describe('ValoriNutrizionaliService — COME si dice il dato', () => {
  let service: ValoriNutrizionaliService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ValoriNutrizionaliService,
        { provide: PrismaService, useValue: { nutrientFact: { findMany: jest.fn().mockResolvedValue(TABELLA) } } },
      ],
    }).compile();
    service = moduleRef.get(ValoriNutrizionaliService);
  });

  it('affidabilità DEBOLE → si dice il range, non il numero', async () => {
    const basmati = (await service.cerca('basmati'))!;
    const d = service.indiceGlicemicoDaDire(basmati)!;
    expect(d.testo).toContain('fra 57 e 67');
    expect(d.testo).not.toContain('62');
    expect(d.numeri).toEqual([57, 67]);
  });

  it('range LARGO anche con affidabilità media → range: 50-68 non si riassume in 65', async () => {
    const integrale = (await service.cerca('riso integrale'))!;
    expect(service.indiceGlicemicoDaDire(integrale)!.testo).toContain('fra 50 e 68');
  });

  it('affidabilità SOLIDA e range stretto → il numero', async () => {
    const mela = (await service.cerca('mela'))!;
    const d = service.indiceGlicemicoDaDire(mela)!;
    expect(d.testo).toContain('39');
    expect(d.numeri).toEqual([39]);
  });

  it('nessun indice glicemico → niente da dire, e non si inventa', async () => {
    const sedano = (await service.cerca('sedano'))!;
    expect(service.indiceGlicemicoDaDire(sedano)).toBeNull();
  });

  it('⚠️ «non si applica» non è «non lo so»: l\'alimento senza carboidrati riceve una risposta', async () => {
    // Prima queste due righe finivano tutte e due su `null`, cioè: niente da passare al modello.
    // A «qual è l'indice glicemico del salmone?» Gaia rispondeva tacendo sull'unica cosa chiesta.
    const salmone = (await service.cerca('salmone'))!;
    const d = service.indiceGlicemicoDaDire(salmone)!;
    expect(d).not.toBeNull();
    expect(d.testo).toContain('non si applica');
    // ⚠️ E nessun numero autorizzato: non c'è nessuna cifra da dire, e la guardia in uscita
    // continua a rifiutare qualunque numero il modello si inventi.
    expect(d.numeri).toEqual([]);
  });

  it('la scheda porta la frase del «non si applica» senza aggiungere numeri ammessi', async () => {
    const scheda = await service.schedaPerRisposta('qual è l\'indice glicemico del salmone?');
    expect(scheda.righe.some((r) => r.includes('non si applica'))).toBe(true);
    // I numeri ammessi sono solo quelli dei valori per 100 g, non un indice inventato.
    expect(scheda.numeriAmmessi).not.toContain(0);
  });

  it('i valori per 100 g portano lo STATO con sé: crudo e cotto non sono lo stesso alimento', async () => {
    const basmati = (await service.cerca('basmati'))!;
    const d = service.valoriDaDire(basmati)!;
    expect(d.testo).toContain('100 g di riso basmati (crudo)');
    expect(d.testo).toContain('367 kcal');
    expect(d.numeri).toContain(367);
    expect(d.numeri).toContain(9);
  });

  it('senza calorie non si compone una riga di valori a metà', async () => {
    const gallette = (await service.cerca('gallette di riso'))!;
    expect(service.valoriDaDire(gallette)).toBeNull();
  });
});

describe('ValoriNutrizionaliService — la scheda per la risposta', () => {
  let service: ValoriNutrizionaliService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      nutrientFact: { findMany: jest.fn().mockResolvedValue(TABELLA) },
      nutrientLookupMiss: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ValoriNutrizionaliService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ValoriNutrizionaliService);
  });

  it('la domanda del basmati produce righe, numeri ammessi e fonti', async () => {
    const s = await service.schedaPerRisposta('posso sostituire il riso integrale con basmati?');
    expect(s.trovati.map((t) => t.id).sort()).toEqual(['basmati', 'integrale']);
    expect(s.righe.join(' ')).toContain('fra 57 e 67');
    expect(s.righe.join(' ')).toContain('fra 50 e 68');
    // I numeri ammessi sono quelli e basta: la guardia in uscita rifiuterà qualunque altro.
    expect(s.numeriAmmessi).toContain(57);
    expect(s.numeriAmmessi).toContain(367);
    expect(s.numeriAmmessi).not.toContain(58);
    expect(s.fonti.length).toBeGreaterThan(0);
  });

  it('la nota della riga entra nella scheda: è dove sta scritto quanto è solido il dato', async () => {
    const s = await service.schedaPerRisposta('quante proteine hanno i borlotti?');
    expect(s.righe.join(' ')).toContain('Nessun IG affidabile');
  });

  it('nessun alimento riconosciuto: scheda vuota, così chi chiama sa di non avere dati', async () => {
    const s = await service.schedaPerRisposta('quante calorie ha il tempeh?');
    expect(s.trovati).toEqual([]);
    expect(s.righe).toEqual([]);
    expect(s.numeriAmmessi).toEqual([]);
  });

  it('un alimento mancante si registra col conteggio: è così che la tabella cresce', async () => {
    await service.registraMancante('Tempeh');
    expect(prisma.nutrientLookupMiss.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { term: 'tempeh' } }),
    );
  });

  it('già chiesto: il contatore sale, non nasce una seconda riga', async () => {
    prisma.nutrientLookupMiss.findUnique.mockResolvedValue({ id: 'm1', times: 7 });
    await service.registraMancante('tempeh');
    expect(prisma.nutrientLookupMiss.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: expect.objectContaining({ times: 8 }) }),
    );
    expect(prisma.nutrientLookupMiss.create).not.toHaveBeenCalled();
  });

  it('registrare un mancante non esplode mai: sta rispondendo a una cliente', async () => {
    prisma.nutrientLookupMiss.findUnique.mockRejectedValue(new Error('database muto'));
    await expect(service.registraMancante('tempeh')).resolves.toBeUndefined();
  });
});
