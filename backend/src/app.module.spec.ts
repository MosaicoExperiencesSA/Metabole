/**
 * L'APPLICAZIONE SI AVVIA. Un test solo, e vale per tutti i moduli.
 *
 * ## Perché esiste
 *
 * Il 12/8 il deploy su Render è fallito due volte con «Exited with status 1». La causa era una
 * riga mancante: `FoodSwapsModule` non importava `NotificationsModule`, e `FoodSwapsService` si
 * faceva iniettare `NotificationsService`.
 *
 * La cosa che conta è **cosa NON l'ha visto**: il type-check era verde (TypeScript non guarda il
 * cablaggio dei moduli, guarda i tipi), e 1794 test erano verdi (gli spec costruiscono i servizi a
 * mano, passando i finti direttamente — che è giusto per testare la logica, e cieco per il
 * cablaggio). Nest risolve le dipendenze **all'avvio**: il primo posto in cui quell'errore poteva
 * comparire era il boot in produzione.
 *
 * Questo test è quel boot, fatto qui. Non verifica niente di funzionale: compila il grafo delle
 * dipendenze dell'`AppModule` vero e basta. Se un modulo dimentica un `imports`, se due moduli si
 * chiudono in un anello, se un provider sparisce da un `exports`, cade qui invece che su Render.
 *
 * ⚠️ `PrismaService` è sostituito da un oggetto vuoto: senza, il costruttore proverebbe ad aprire
 * una connessione a un database che in CI non c'è. Tutto il resto è quello vero — deve esserlo, o
 * il test smetterebbe di misurare la cosa per cui è nato.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

describe('AppModule', () => {
  let moduleRef: TestingModule | null = null;

  /**
   * Le variabili senza le quali un modulo si RIFIUTA di costruirsi (`auth.module.ts` alza
   * un'eccezione se manca il segreto JWT). Sono valori finti di proposito: qui non si autentica
   * niente, serve solo che la fabbrica arrivi in fondo. Su Render sono vere e generate.
   */
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET ??= 'test-solo-per-il-boot';
    process.env.JWT_REFRESH_SECRET ??= 'test-solo-per-il-boot';
    process.env.DATABASE_URL ??= 'postgresql://test/test';
    process.env.FILE_ENCRYPTION_KEY ??= 'test-solo-per-il-boot';
  });

  afterEach(async () => {
    // Diversi servizi avviano timer nel costruttore (lifecycle, marketing, agenti): senza la
    // chiusura, Jest resta appeso su handle aperti e il fallimento sembra un timeout.
    await moduleRef?.close().catch(() => undefined);
    moduleRef = null;
  });

  it('si avvia: ogni dipendenza di ogni modulo è risolvibile', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => undefined,
        $disconnect: async () => undefined,
        $on: () => undefined,
      })
      .compile();

    expect(moduleRef).toBeDefined();
  }, 60_000);
});
