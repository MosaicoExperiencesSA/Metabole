import { avvisaConflittoSanitario, avvisaPropostaInCoda, testoAvvisoConflitto } from './avvisa-capo';
import { PrismaService } from '../prisma/prisma.service';

const RIGA = {
  id: 'a1',
  frase: 'a Mariastella dai comunque il pane, il glutine lo tollera',
  azione: 'restrizione_cliente',
  ambito: 'cliente',
  soggettoNome: 'Mariastella Conti',
  nutrizionistaId: 'lucia',
  vincolo: 'celiachia',
};

const make = (capi: { id: string }[], over: Record<string, unknown> = {}) => {
  const createMany = jest.fn().mockResolvedValue({ count: capi.length });
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(capi),
      findUnique: jest.fn().mockResolvedValue({ firstName: 'Lucia', lastName: 'Verdi' }),
    },
    notification: { createMany },
    ...over,
  } as unknown as PrismaService;
  return { prisma, createMany };
};

describe('testoAvvisoConflitto', () => {
  it('⚠️ dice chi, su chi e cosa: le tre cose che servono per decidere se alzarsi', () => {
    // Una notifica che dice «conflitto sanitario» e basta obbliga ad aprire la pagina per sapere se
    // vale la pena aprirla.
    const { corpo } = testoAvvisoConflitto(RIGA, 'Lucia Verdi');
    expect(corpo).toContain('Lucia Verdi');
    expect(corpo).toContain('Mariastella Conti');
    expect(corpo).toContain('celiachia');
    expect(corpo).toContain('il glutine lo tollera');
  });

  it('senza nome dell’autrice resta una frase leggibile', () => {
    expect(testoAvvisoConflitto(RIGA, null).corpo.startsWith('Una nutrizionista')).toBe(true);
  });

  it('una frase lunghissima non diventa la notifica intera', () => {
    const { corpo } = testoAvvisoConflitto({ ...RIGA, frase: 'x'.repeat(400) }, 'Lucia');
    expect(corpo.length).toBeLessThan(300);
  });
});

describe('avvisaConflittoSanitario', () => {
  it('avvisa i capi nutrizionisti', async () => {
    const { prisma, createMany } = make([{ id: 'capo1' }, { id: 'capo2' }]);
    expect(await avvisaConflittoSanitario(prisma, RIGA)).toBe(2);
    const dati = createMany.mock.calls[0][0].data;
    expect(dati.map((d: { userId: string }) => d.userId)).toEqual(['capo1', 'capo2']);
    // ⚠️ `title` e `body` vivono dentro `payload`: la tabella non ha quelle colonne, e scriverle
    // come campi fa esplodere Prisma a runtime (è già successo con l'avviso senza glutine).
    expect(dati[0].payload.title).toContain('vincolo sanitario');
    expect(dati[0].payload.azioneId).toBe('a1');
  });

  it('⚠️ NON avvisa chi ha appena confermato la regola', async () => {
    // Lo sa già — l'ha confermata rispondendo a una domanda che le diceva esattamente questo — e una
    // notifica per una cosa appena fatta da soli insegna a chiudere le notifiche senza leggerle.
    const { prisma, createMany } = make([{ id: 'lucia' }, { id: 'capo2' }]);
    expect(await avvisaConflittoSanitario(prisma, RIGA)).toBe(1);
    expect(createMany.mock.calls[0][0].data.map((d: { userId: string }) => d.userId)).toEqual(['capo2']);
  });

  it('se non c’è nessun capo non scrive niente e non è un errore', async () => {
    const { prisma, createMany } = make([]);
    expect(await avvisaConflittoSanitario(prisma, RIGA)).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('⚠️ NON lancia mai: la regola è già scritta', async () => {
    // Perdere la scrittura perché non si è riusciti a mandare una notifica sarebbe un guasto
    // peggiore del guasto.
    const { prisma } = make([{ id: 'capo1' }], {
      notification: { createMany: jest.fn().mockRejectedValue(new Error('database giù')) },
    });
    await expect(avvisaConflittoSanitario(prisma, RIGA)).resolves.toBe(0);
  });
});

describe('avvisaConflittoSanitario — anche via EMAIL (decisione di Simone, 13/8 sera)', () => {
  it('con il postino: una mail a ogni capo, con oggetto e corpo veri', async () => {
    const { prisma } = make([
      { id: 'capo-1', email: 'capo1@metabole.eu' },
      { id: 'capo-2', email: 'capo2@metabole.eu' },
    ] as never);
    const send = jest.fn().mockResolvedValue(true);
    const quanti = await avvisaConflittoSanitario(prisma, RIGA, { send });
    expect(quanti).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    const prima = send.mock.calls[0][0];
    expect(prima.to).toBe('capo1@metabole.eu');
    expect(prima.subject).toContain('conflitto');
    expect(prima.html).toContain('Mariastella Conti');
  });

  it('senza postino tutto funziona come prima: solo la notifica in app', async () => {
    const { prisma, createMany } = make([{ id: 'capo-1', email: 'capo1@metabole.eu' }] as never);
    const quanti = await avvisaConflittoSanitario(prisma, RIGA);
    expect(quanti).toBe(1);
    expect(createMany).toHaveBeenCalled();
  });

  it('una mail che fallisce non ferma le altre, e la notifica in app resta', async () => {
    const { prisma, createMany } = make([
      { id: 'capo-1', email: 'capo1@metabole.eu' },
      { id: 'capo-2', email: 'capo2@metabole.eu' },
    ] as never);
    const send = jest.fn().mockRejectedValueOnce(new Error('brevo giù')).mockResolvedValue(true);
    const quanti = await avvisaConflittoSanitario(prisma, RIGA, { send });
    expect(quanti).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalled();
  });
});

describe('avvisaPropostaInCoda — «avvisa il capo quando il team gli mette qualcosa in coda» (Simone, 14/8)', () => {
  const PROPOSTA = {
    id: 'a9',
    frase: 'nella mediterranea niente tonno',
    nutrizionistaId: 'lucia',
    soggettoNome: 'Mediterranea',
  };

  it('avvisa i capi, escluso chi ha proposto', async () => {
    const { prisma, createMany } = make([{ id: 'capo1' }, { id: 'lucia' }]);
    expect(await avvisaPropostaInCoda(prisma, PROPOSTA)).toBe(1);
    const dati = createMany.mock.calls[0][0].data;
    expect(dati.map((d: { userId: string }) => d.userId)).toEqual(['capo1']);
  });

  it('⚠️ title e body vivono dentro payload, con l\'azioneId per arrivarci', async () => {
    const { prisma, createMany } = make([{ id: 'capo1' }]);
    await avvisaPropostaInCoda(prisma, PROPOSTA);
    const dati = createMany.mock.calls[0][0].data;
    expect(dati[0].payload.title).toContain('proposta');
    expect(dati[0].payload.body).toContain('Lucia Verdi');
    expect(dati[0].payload.body).toContain('nella mediterranea niente tonno');
    expect(dati[0].payload.azioneId).toBe('a9');
    expect(dati[0].type).toBe('vera_proposta_in_coda');
  });

  it('⚠️ non lancia mai: la proposta resta scritta anche se l\'avviso muore', async () => {
    const prisma = {
      user: { findMany: jest.fn().mockRejectedValue(new Error('boom')) },
    } as unknown as PrismaService;
    expect(await avvisaPropostaInCoda(prisma, PROPOSTA)).toBe(0);
  });

  it('senza capi da avvisare non scrive niente', async () => {
    const { prisma, createMany } = make([{ id: 'lucia' }]);
    expect(await avvisaPropostaInCoda(prisma, PROPOSTA)).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});
