/**
 * ⛔ **«RICETTA NON TROVATA» SU UNA RICETTA CHE È LÌ IN ELENCO — Simone, 4/9.**
 *
 * Pagina Panieri, filtro «Mostra solo in bozza» acceso: l'elenco mostra i piatti, si preme
 * «Modifica» e la pagina risponde **«Ricetta non trovata»**. Sono proprio le ricette che quella
 * pagina esiste per far validare.
 *
 * ⚠️ **La causa era un cancello giusto messo in un punto solo.** `GET /recipes/:id` è aperto a ogni
 * utente autenticato — cliente compresa, e senza `@RequirePage`, altrimenti la scheda si apre vuota
 * nell'app — quindi rifiutava le ricette `active: false`: una bozza dell'agente notturno non deve
 * comparire nell'app di nessuno. Ma il backoffice passa **di lì** per aprire «Modifica ricetta».
 *
 * ⛔ Il cancello non si toglie, si **restringe a chi lo riguarda**: la cliente continua a non
 * vederle, lo staff sì. Togliere il controllo del tutto avrebbe messo le bozze nell'app.
 */
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService — aprire la scheda di una ricetta in bozza', () => {
  let service: CatalogService;
  let prisma: any;

  const bozza = { id: 'r1', name: 'Frittata di ceci al forno', active: false, tags: [], ingredients: [] };

  beforeEach(async () => {
    prisma = {
      recipe: { findUnique: jest.fn().mockResolvedValue(bozza) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      dietDay: { findMany: jest.fn().mockResolvedValue([]) },
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
  });

  /** ⛔ I tre ruoli che la possono già modificare: la bozza è roba loro finché non la validano. */
  it.each([['nutritionist'], ['head_nutritionist'], ['admin']])(
    '⛔ %s la apre: è la ricetta che deve validare',
    async (ruolo) => {
      const r = await service.getRecipe('r1', { ruolo }) as { id: string };
      expect(r.id).toBe('r1');
    },
  );

  /** ⛔ E la cliente no: una bozza che nessuno ha guardato non compare nell'app. */
  it('⛔ la cliente continua a non vederla', async () => {
    await expect(service.getRecipe('r1', { clientId: 'c1', ruolo: 'client' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  /** ⚠️ E senza ruolo — una chiamata che non lo passa — vale la regola stretta, non quella larga. */
  it('⚠️ senza ruolo resta chiusa: il ripiego va verso il più stretto', async () => {
    await expect(service.getRecipe('r1')).rejects.toBeInstanceOf(NotFoundException);
  });

  /** ⚠️ Una ricetta ATTIVA la apre chiunque, come prima: qui non è cambiato niente. */
  it('⚠️ una ricetta attiva la apre chiunque, come prima', async () => {
    prisma.recipe.findUnique.mockResolvedValue({ ...bozza, active: true });
    const r = await service.getRecipe('r1', { clientId: 'c1', ruolo: 'client' }) as { id: string };
    expect(r.id).toBe('r1');
  });

  /** ⛔ E una ricetta che davvero non esiste resta un 404 per tutti. */
  it('⛔ una ricetta inesistente resta non trovata anche per lo staff', async () => {
    prisma.recipe.findUnique.mockResolvedValue(null);
    await expect(service.getRecipe('boh', { ruolo: 'admin' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
