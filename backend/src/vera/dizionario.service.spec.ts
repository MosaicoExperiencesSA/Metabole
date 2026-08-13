import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DizionarioService } from './dizionario.service';

const makeAudit = () => ({ log: jest.fn().mockResolvedValue(undefined) }) as unknown as AuditService;
const make = (prisma: Record<string, unknown>) =>
  new DizionarioService(prisma as unknown as PrismaService, makeAudit());

const voce = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  nutrizionistaId: 'lucia',
  nome: 'formaggi molli',
  chiave: 'formagg moll',
  membri: ['mozzarella', 'stracchino'],
  comune: false,
  ...over,
});

describe('DizionarioService.risolvi', () => {
  it('non conosce una parola mai insegnata, e lo dice con null', async () => {
    // È la risposta che fa scattare la domanda «quali sono?»: se restituisse qualcosa di
    // approssimativo, l'agente indovinerebbe — che è esattamente ciò che non deve fare.
    const service = make({ famigliaAlimento: { findMany: jest.fn().mockResolvedValue([]) } });
    expect(await service.risolvi('lucia', 'formaggi molli')).toBeNull();
  });

  it('LA SUA batte la comune', async () => {
    // «Pasto leggero» non vuol dire la stessa cosa per due nutrizioniste. Far vincere la comune
    // applicherebbe a una il significato dell'altra senza che nessuna delle due lo sappia.
    const service = make({
      famigliaAlimento: {
        findMany: jest.fn().mockResolvedValue([
          voce({ id: 'comune', nutrizionistaId: 'nocanty', comune: true, membri: ['ricotta'] }),
          voce({ id: 'sua', nutrizionistaId: 'lucia', membri: ['mozzarella'] }),
        ]),
      },
    });
    const trovata = await service.risolvi('lucia', 'formaggi molli');
    expect(trovata?.id).toBe('sua');
  });

  it('se ha solo la comune, usa quella', async () => {
    const service = make({
      famigliaAlimento: {
        findMany: jest.fn().mockResolvedValue([voce({ id: 'comune', nutrizionistaId: 'nocanty', comune: true })]),
      },
    });
    expect((await service.risolvi('lucia', 'formaggi molli'))?.id).toBe('comune');
  });

  it('riconosce la famiglia anche scritta al SINGOLARE — la seconda passata', async () => {
    /**
     * ⚠️ Il caso che ha fatto nascere `chiaveLarga`. `chiaveAlimento` toglie una sola vocale
     * finale: «formaggi molli» dà `formagg moll`, «formaggio molle» dà `formaggi moll`. Senza la
     * seconda passata l'agente richiederebbe una famiglia che ha già imparato — e se lei
     * rispondesse, nascerebbe una seconda voce per la stessa parola.
     */
    const findMany = jest
      .fn()
      // 1ª chiamata: ricerca per chiave esatta → non trova niente.
      .mockResolvedValueOnce([])
      // 2ª: l'elenco completo, su cui si confronta la chiave larga.
      .mockResolvedValueOnce([voce()]);
    const service = make({ famigliaAlimento: { findMany } });
    const trovata = await service.risolvi('lucia', 'Formaggio Molle');
    expect(trovata?.id).toBe('v1');
    expect(findMany.mock.calls[0][0].where.chiave).toBe('formaggi moll');
  });

  it('la chiave esatta vince: la seconda passata non parte nemmeno', async () => {
    const findMany = jest.fn().mockResolvedValue([voce()]);
    const service = make({ famigliaAlimento: { findMany } });
    await service.risolvi('lucia', 'formaggi molli');
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe('DizionarioService.insegna', () => {
  it('rifiuta una famiglia senza alimenti', async () => {
    // Una famiglia vuota applicata a una regola non toglie niente: la nutrizionista leggerebbe
    // «fatto» su una cosa che non fa nulla.
    const service = make({ famigliaAlimento: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } });
    await expect(service.insegna('lucia', { nome: 'formaggi molli', membri: [] })).rejects.toThrow(
      /almeno un alimento/,
    );
  });

  it('rifiuta un nome vuoto', async () => {
    const service = make({ famigliaAlimento: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } });
    await expect(service.insegna('lucia', { nome: '   ', membri: ['mozzarella'] })).rejects.toThrow();
  });

  it('toglie i doppioni e gli spazi, e salva sulla chiave stabile', async () => {
    const upsert = jest.fn().mockResolvedValue(voce());
    const service = make({ famigliaAlimento: { upsert, findMany: jest.fn().mockResolvedValue([]) } });
    await service.insegna('lucia', { nome: '  Formaggi molli ', membri: ['mozzarella', ' mozzarella ', 'stracchino'] });
    const arg = upsert.mock.calls[0][0];
    expect(arg.where.nutrizionistaId_chiave.chiave).toBe('formagg moll');
    expect(arg.create.membri).toEqual(['mozzarella', 'stracchino']);
    expect(arg.create.nome).toBe('Formaggi molli');
  });

  it('non crea un DOPPIONE se insegna la stessa famiglia scritta diversamente', async () => {
    // Due righe per la stessa parola vorrebbero dire due significati, di cui uno vecchio — e le
    // regole scritte prima continuerebbero a usare quello, senza dirlo a nessuno.
    const upsert = jest.fn().mockResolvedValue(voce());
    const service = make({
      famigliaAlimento: { upsert, findMany: jest.fn().mockResolvedValue([voce()]) },
    });
    await service.insegna('lucia', { nome: 'formaggio molle', membri: ['ricotta'] });
    // Riusa la chiave della voce che c'era già: aggiorna invece di aggiungere.
    expect(upsert.mock.calls[0][0].where.nutrizionistaId_chiave.chiave).toBe('formagg moll');
  });
});

describe('DizionarioService.promuovi', () => {
  it('una nutrizionista non può rendere comune la propria voce', async () => {
    const service = make({ famigliaAlimento: { findUnique: jest.fn().mockResolvedValue(voce()) } });
    await expect(service.promuovi({ id: 'lucia', role: 'nutritionist' }, 'v1')).rejects.toThrow(ForbiddenException);
  });

  it('il capo sì, e resta scritto chi era l’autrice', async () => {
    const update = jest.fn().mockResolvedValue(voce({ comune: true }));
    const service = make({ famigliaAlimento: { findUnique: jest.fn().mockResolvedValue(voce()), update } });
    await service.promuovi({ id: 'nocanty', role: 'head_nutritionist' }, 'v1');
    expect(update.mock.calls[0][0].data.comune).toBe(true);
    expect(update.mock.calls[0][0].data.promossaDaId).toBe('nocanty');
  });

  it('promuovere due volte non fa niente', async () => {
    const update = jest.fn();
    const service = make({
      famigliaAlimento: { findUnique: jest.fn().mockResolvedValue(voce({ comune: true })), update },
    });
    await service.promuovi({ id: 'nocanty', role: 'head_nutritionist' }, 'v1');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('DizionarioService.dimentica', () => {
  it('non si cancella la voce di un’altra', async () => {
    const service = make({ famigliaAlimento: { findUnique: jest.fn().mockResolvedValue(voce({ nutrizionistaId: 'altra' })), delete: jest.fn() } });
    await expect(service.dimentica('lucia', 'v1')).rejects.toThrow(ForbiddenException);
  });
});

describe('DizionarioService.famiglieCheForsePrendono', () => {
  it('propone la famiglia a cui un alimento nuovo somiglia, e non quella dove è già dentro', async () => {
    // È il buco che rende il dizionario un guasto silenzioso: nove nomi congelati, entra un
    // alimento nuovo, la regola continua a funzionare su un elenco vecchio senza nessun errore.
    const service = make({
      famigliaAlimento: {
        findMany: jest.fn().mockResolvedValue([
          voce({ id: 'molli', nome: 'formaggi molli', membri: ['yogurt'] }),
          voce({ id: 'gia', nome: 'latticini', membri: ['yogurt greco'] }),
        ]),
      },
    });
    const candidate = await service.famiglieCheForsePrendono('yogurt greco');
    // «yogurt greco» è già dentro `latticini` → niente da chiedere; somiglia a `formaggi molli`
    // (che contiene «yogurt») → si chiede.
    expect(candidate.map((c) => c.id)).toEqual(['molli']);
  });

  it('non propone niente per un nome vuoto', async () => {
    const service = make({ famigliaAlimento: { findMany: jest.fn() } });
    expect(await service.famiglieCheForsePrendono('  ')).toEqual([]);
  });
});

describe('DizionarioService.famiglieDaAggiornare', () => {
  const D = (iso: string) => new Date(iso);

  const make2 = (voci: unknown[], ricette: unknown[]) => ({
    service: make({
      famigliaAlimento: { findMany: jest.fn().mockResolvedValue(voci) },
      recipe: { findMany: jest.fn().mockResolvedValue(ricette) },
    }),
    letture: { voci, ricette },
  });

  it('propone quello che è entrato in catalogo dopo', async () => {
    const { service } = make2(
      [voce({ membri: ['yogurt greco'], updatedAt: D('2026-07-01') })],
      [{ id: 'r1', createdAt: D('2026-08-01'), ingredients: [{ name: 'yogurt magro' }] }],
    );
    const fuori = await service.famiglieDaAggiornare('lucia');
    expect(fuori[0].candidati).toEqual(['yogurt magro']);
  });

  it('⚠️ NON tocca le voci comuni, nemmeno per proporre', async () => {
    // Allargare una famiglia comune tocca il piatto delle clienti di tutte: una cosa che vale per
    // tutti si cambia dalla coda delle approvazioni, come «promuovi a comune».
    const service = make({
      famigliaAlimento: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: { findMany: jest.fn() },
    });
    await service.famiglieDaAggiornare('lucia');
    expect((service as unknown as { prisma: { famigliaAlimento: { findMany: jest.Mock } } }).prisma.famigliaAlimento.findMany.mock.calls[0][0].where)
      .toEqual({ nutrizionistaId: 'lucia', comune: false });
  });

  it('senza voci sue non legge nemmeno il catalogo', async () => {
    const recipeFindMany = jest.fn();
    const service = make({
      famigliaAlimento: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: { findMany: recipeFindMany },
    });
    expect(await service.famiglieDaAggiornare('lucia')).toEqual([]);
    expect(recipeFindMany).not.toHaveBeenCalled();
  });

  it('⚠️ legge solo le ricette entrate dopo la più VECCHIA delle sue voci', async () => {
    // Leggere tutto il catalogo a ogni apertura di pagina per scartarlo subito dopo è il modo di
    // rendere lenta proprio la schermata su cui si lavora.
    const recipeFindMany = jest.fn().mockResolvedValue([]);
    const service = make({
      famigliaAlimento: {
        findMany: jest.fn().mockResolvedValue([
          voce({ id: 'a', updatedAt: D('2026-07-01') }),
          voce({ id: 'b', updatedAt: D('2026-08-01') }),
        ]),
      },
      recipe: { findMany: recipeFindMany },
    });
    await service.famiglieDaAggiornare('lucia');
    expect(recipeFindMany.mock.calls[0][0].where.createdAt.gt).toEqual(D('2026-07-01'));
  });
});
