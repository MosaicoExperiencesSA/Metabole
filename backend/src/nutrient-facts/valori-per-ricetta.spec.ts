/**
 * `cercaPerIngrediente` — LA PORTA DEGLI INGREDIENTI DI RICETTA, e la convenzione «a crudo».
 *
 * ⚠️ Nasce dalla revisione avversariale del 19/8 sera, che ha trovato **il difetto peggiore della
 * giornata sui dati**: la convenzione si aggirava con un aggettivo. «lenticchie» (in tabella solo
 * bollite) veniva bloccata giustamente; **«lenticchie bio» no** — l'abbinamento trovava la riga
 * bollita e la contava su una grammatura a crudo, scrivendo 93 kcal dove ce ne sono ~282, dentro
 * `Recipe.kcal`. Il controllo saltava **esattamente** nei casi per cui l'abbinamento esiste.
 */
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ValoriNutrizionaliService } from './valori-nutrizionali.service';

describe('ValoriNutrizionaliService.cercaPerIngrediente', () => {
  let service: ValoriNutrizionaliService;
  let prisma: any;

  const tabella = (righe: unknown[]) => {
    prisma.nutrientFact.findMany.mockResolvedValue(righe);
  };

  beforeEach(async () => {
    prisma = { nutrientFact: { findMany: jest.fn().mockResolvedValue([]) } };
    const moduleRef = await Test.createTestingModule({
      providers: [ValoriNutrizionaliService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ValoriNutrizionaliService);
  });

  /** Il nome esatto: la convenzione si applica, e una riga solo bollita non si usa. */
  it('⚠️ «lenticchie» con la sola riga bollita: solo_cotto', async () => {
    tabella([{ name: 'lenticchie', synonyms: [], state: 'bollite', kcal: 116 }]);
    expect((await service.cercaPerIngrediente('lenticchie')).tipo).toBe('solo_cotto');
  });

  /**
   * ⚠️ IL CASO CHE VALE LA CORREZIONE. Prima questo tornava la riga bollita — e la ricetta si
   * scriveva, con le calorie a un terzo del vero.
   */
  it('⚠️ «lenticchie bio» NON deve aggirare la convenzione', async () => {
    tabella([{ name: 'lenticchie', synonyms: [], state: 'bollite', kcal: 116 }]);
    expect((await service.cercaPerIngrediente('lenticchie bio')).tipo).toBe('solo_cotto');
  });

  /** ⚠️ E nemmeno la differenza di sole paroline: «d'oliva» contro «di oliva». */
  it('⚠️ «olio extravergine d oliva» passa dalla stessa convenzione', async () => {
    tabella([{ name: 'olio extravergine di oliva', synonyms: [], state: 'cotto', kcal: 899 }]);
    expect((await service.cercaPerIngrediente('olio extravergine d oliva')).tipo).toBe('solo_cotto');
  });

  it('quando la riga è a crudo si usa, e si dice quale', async () => {
    tabella([{ name: 'spinaci', synonyms: [], state: 'crudo', kcal: 31 }]);
    const e = await service.cercaPerIngrediente('spinaci freschi');
    expect(e.tipo).toBe('va_bene');
    expect(e.tipo === 'va_bene' && e.riga.name).toBe('spinaci');
  });

  /**
   * ⚠️ E LA RIGA NON LA SCEGLIE L'ORDINE DEL DATABASE. Con due righe «riso» (crudo e bollito),
   * `esatti[0]` faceva decidere alla lettura di Postgres fra 332 e 120 kcal — la voce 228 rimasta
   * viva su questa porta.
   */
  it('⚠️ con crudo e bollito insieme vince il crudo, non il primo che arriva', async () => {
    tabella([
      { name: 'riso', synonyms: [], state: 'bollito', kcal: 120 },
      { name: 'riso', synonyms: [], state: 'crudo', kcal: 332 },
    ]);
    const e = await service.cercaPerIngrediente('riso');
    expect(e.tipo).toBe('va_bene');
    expect(e.tipo === 'va_bene' && e.riga.kcal).toBe(332);
  });

  it('quello che non c\'è resta «niente»', async () => {
    tabella([{ name: 'spinaci', synonyms: [], state: 'crudo', kcal: 31 }]);
    expect((await service.cercaPerIngrediente('grano saraceno')).tipo).toBe('niente');
  });
});
