/**
 * ⛔ **CHI HA VERIFICATO QUESTA RICETTA — il nome, e da quale tabella arriva.**
 *
 * Simone, 4/9: la spunta serve perché *«resta tutto registrato»* — registrato **per essere letto**.
 * Una spunta che dice «verificata da 3f7a-…» non la legge nessuno, e una che dice solo «verificata
 * il 04/09» non dice chi, che è metà della domanda.
 *
 * ⛔ **E il nome dello staff NON sta in `User.firstName`.** Trovato da una revisione avversariale il
 * 4/9 prima della consegna: gli account di staff nascono senza nome e cognome (sono facoltativi) e
 * il nome vive in `Staff.displayName`, che è la porta usata da coach, chat e prenotazioni. Leggendo
 * `User` il tooltip diceva «Verificata il 04/09/2026» e basta per **quasi tutte** le nutrizioniste —
 * un ripiego silenzioso, senza log, indistinguibile da un utente cancellato.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService — il nome di chi ha verificato', () => {
  let service: CatalogService;
  let prisma: any;

  const ricetta = { id: 'r1', name: 'Porridge', verifiedById: 'u-nutri', verifiedAt: new Date('2026-09-04') };

  const monta = async (utente: unknown, staff: unknown[]) => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue([ricetta]),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { findMany: jest.fn().mockResolvedValue(utente ? [utente] : []) },
      staff: { findMany: jest.fn().mockResolvedValue(staff) },
      dietDay: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
    const r = await service.listRecipes({ includeInactive: true });
    return (r.items as { verifiedByName?: string | null }[])[0];
  };

  /**
   * ⛔ **IL CASO VERO**: la nutrizionista creata dall'admin. `firstName` e `lastName` sono nulli,
   * il nome sta solo su `Staff`. È lo scenario in cui la funzione o dice chi, o non serve a niente.
   */
  it('⛔ lo legge da Staff.displayName quando User non ha nome e cognome', async () => {
    const riga = await monta(
      { id: 'u-nutri', firstName: null, lastName: null },
      [{ userId: 'u-nutri', displayName: 'Vera Bianchi' }],
    );
    expect(riga.verifiedByName).toBe('Vera Bianchi');
  });

  /** ⚠️ `Staff` vince quando c'è: è il nome con cui quella persona compare in tutto il resto del prodotto. */
  it('⚠️ Staff vince su nome e cognome dell\'utente', async () => {
    const riga = await monta(
      { id: 'u-nutri', firstName: 'Veronica', lastName: 'B.' },
      [{ userId: 'u-nutri', displayName: 'Vera Bianchi' }],
    );
    expect(riga.verifiedByName).toBe('Vera Bianchi');
  });

  /** ⚠️ E `User` resta il ripiego: un giorno potrebbe verificare qualcuno che non è staff. */
  it('⚠️ senza riga Staff ripiega su nome e cognome', async () => {
    const riga = await monta({ id: 'u-nutri', firstName: 'Veronica', lastName: 'Bianchi' }, []);
    expect(riga.verifiedByName).toBe('Veronica Bianchi');
  });

  /**
   * ⚠️ Nessun nome da nessuna parte → `null`, non una stringa vuota: la schermata deve poter
   * distinguere «non lo so» da un nome che c'è ed è vuoto.
   */
  it('⚠️ se non c\'è nome da nessuna parte, resta null', async () => {
    const riga = await monta({ id: 'u-nutri', firstName: null, lastName: null }, [{ userId: 'u-nutri', displayName: '  ' }]);
    expect(riga.verifiedByName).toBeNull();
  });
});
