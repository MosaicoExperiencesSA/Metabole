import type { PrismaService } from '../prisma/prisma.service';
import { aPrezzoAlMese, euro, frasePrezziPercorso, prezzoEffettivo, prezzoPiano } from './prezzo-piano';

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

/**
 * ⚠️ La stessa REGOLA scritta due volte — non un prezzo scritto a mano, ma il calcolo dello sconto:
 * `commerce.service.planPricing` e `plan-report.service.pricing` davano risposte diverse.
 */
const ADESSO = new Date('2026-08-12T10:00:00Z');
const fra = (giorni: number) => new Date(ADESSO.getTime() + giorni * 86_400_000);

describe('prezzoEffettivo — lo sconto, in un posto solo', () => {
  it('senza listino si paga il prezzo', () => {
    expect(prezzoEffettivo({ priceCents: 29700 }, ADESSO)).toEqual({ effectivePriceCents: 29700, promoActive: false });
  });

  it('promo attiva: si paga lo scontato e il listino si barra', () => {
    expect(prezzoEffettivo({ priceCents: 24900, listPriceCents: 29700, promoEndsAt: fra(10) }, ADESSO))
      .toEqual({ effectivePriceCents: 24900, promoActive: true });
  });

  it('promo senza scadenza: resta attiva', () => {
    expect(prezzoEffettivo({ priceCents: 24900, listPriceCents: 29700 }, ADESSO).promoActive).toBe(true);
  });

  it('promo scaduta: si torna al listino da sé, senza toccare il database', () => {
    expect(prezzoEffettivo({ priceCents: 24900, listPriceCents: 29700, promoEndsAt: fra(-1) }, ADESSO))
      .toEqual({ effectivePriceCents: 29700, promoActive: false });
  });

  it('⚠️ un listino NON maggiore del prezzo non è una promo: vale quello che chiede il checkout', () => {
    // È il caso in cui le due copie divergevano: il report mostrava il numero più basso mentre il
    // carrello chiedeva l'altro — un report che prometteva meno di quanto la cliente avrebbe pagato.
    expect(prezzoEffettivo({ priceCents: 29700, listPriceCents: 19900 }, ADESSO).effectivePriceCents).toBe(29700);
    expect(prezzoEffettivo({ priceCents: 29700, listPriceCents: 29700 }, ADESSO).effectivePriceCents).toBe(29700);
  });

  it('esattamente allo scadere la promo è finita', () => {
    expect(prezzoEffettivo({ priceCents: 24900, listPriceCents: 29700, promoEndsAt: ADESSO }, ADESSO).promoActive).toBe(false);
  });
});

describe('frasePrezziPercorso — i prezzi dentro il testo alla coach', () => {
  const UNO = { id: 'p1', period: '1m', priceCents: 9900 };
  const TRE = { id: 'p3', period: '3m', priceCents: 29700 };

  it('in fila dal più corto al più lungo, comunque arrivino', () => {
    expect(frasePrezziPercorso([TRE, UNO], null, ADESSO)).toBe('1 mese €99 · 3 mesi €297');
  });

  it('⚠️ col codice personale dice il prezzo che pagherà DAVVERO', () => {
    // Dirle 297 quando col suo codice paga 249 la manda a scoprire da sola che costava meno, e le
    // fa credere che il codice non valga niente.
    expect(frasePrezziPercorso([UNO, TRE], { p3: 24900 }, ADESSO)).toBe('1 mese €99 · 3 mesi €249');
  });

  it('un target più ALTO si ignora: uno sconto non alza il prezzo', () => {
    expect(frasePrezziPercorso([TRE], { p3: 39900 }, ADESSO)).toBe('3 mesi €297');
  });

  it('la promo scaduta si riflette nella frase', () => {
    const promo = { id: 'p3', period: '3m', priceCents: 24900, listPriceCents: 29700, promoEndsAt: fra(-1) };
    expect(frasePrezziPercorso([promo], null, ADESSO)).toBe('3 mesi €297');
  });

  it('⚠️ se non si sa, non si scrive — come tutto il resto di questo file', () => {
    expect(frasePrezziPercorso([], null, ADESSO)).toBeNull();
    expect(frasePrezziPercorso([{ id: 'x', period: 'maintenance', priceCents: 4900 }], null, ADESSO)).toBeNull();
  });

  it('i piani che non sono un percorso restano fuori', () => {
    expect(frasePrezziPercorso([UNO, { id: 'm', period: 'monitoring', priceCents: 1900 }], null, ADESSO)).toBe('1 mese €99');
  });
});
