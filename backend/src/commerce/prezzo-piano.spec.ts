import type { PrismaService } from '../prisma/prisma.service';
import { aPrezzoAlMese, euro, prezzoPiano } from './prezzo-piano';

/**
 * IL PREZZO SI LEGGE DAL NEGOZIO (11/8).
 *
 * Il difetto che questi test bloccano: la notifica di fine monitoraggio diceva «mantenimento a
 * €29/mese» quando il Mantenimento costava già €49, perché il numero era scritto a mano nel codice.
 * Il test che conta più di tutti è l'ultimo: **senza piano non si inventa un prezzo**.
 */
const finto = (piano: unknown, cattura?: { where?: unknown }) => (({
  plan: {
    findFirst: (args: { where?: unknown }) => {
      if (cattura) cattura.where = args.where;
      return Promise.resolve(piano);
    },
  },
}) as unknown as PrismaService);

describe('euro — come si scrive un prezzo a una cliente', () => {
  it('gli euro tondi restano tondi: «€49», non «€49,00»', () => {
    expect(euro(4900)).toBe('€49');
    expect(euro(1900)).toBe('€19');
  });

  it('con i centesimi la virgola, non il punto: è un prezzo in italiano', () => {
    expect(euro(4950)).toBe('€49,50');
    expect(euro(999)).toBe('€9,99');
  });
});

describe('prezzoPiano — dal Negozio', () => {
  it('legge il prezzo del piano attivo che combacia', async () => {
    const p = await prezzoPiano(finto({ name: 'Mantenimento Metabole', priceCents: 4900 }), { period: 'maintenance' });
    expect(p).toEqual({ cents: 4900, testo: '€49', nome: 'Mantenimento Metabole' });
  });

  it('cerca solo fra i piani ATTIVI: un piano spento non è il prezzo di niente', async () => {
    const cattura: { where?: Record<string, unknown> } = {};
    await prezzoPiano(finto({ name: 'X', priceCents: 100 }, cattura), { period: 'maintenance' });
    expect(cattura.where).toEqual({ active: true, period: 'maintenance' });
  });

  it('piano assente → null, e NON un prezzo di riserva scritto nel codice', async () => {
    expect(await prezzoPiano(finto(null), { period: 'maintenance' })).toBeNull();
  });

  it('prezzo a zero o non numerico → null: uno «a €0/mese» in una notifica è peggio del silenzio', async () => {
    expect(await prezzoPiano(finto({ name: 'X', priceCents: 0 }), { period: 'maintenance' })).toBeNull();
    expect(await prezzoPiano(finto({ name: 'X', priceCents: null }), { period: 'maintenance' })).toBeNull();
  });

  it('se la query esplode non porta giù la notifica: null e la frase esce senza cifra', async () => {
    const rotto = { plan: { findFirst: () => Promise.reject(new Error('db giù')) } } as unknown as PrismaService;
    await expect(prezzoPiano(rotto, { period: 'maintenance' })).resolves.toBeNull();
  });
});

describe('aPrezzoAlMese — la concatenazione è il punto delicato', () => {
  it('col prezzo aggiunge il pezzo di frase', () => {
    expect(`col mantenimento${aPrezzoAlMese({ cents: 4900, testo: '€49', nome: 'M' })}`)
      .toBe('col mantenimento a €49/mese');
  });

  it('senza prezzo la frase resta corretta in italiano', () => {
    // È la ragione per cui questa funzione esiste: chi scrive il messaggio non deve scegliere fra un
    // numero inventato e una frase sgrammaticata.
    expect(`col mantenimento${aPrezzoAlMese(null)}`).toBe('col mantenimento');
  });
});
