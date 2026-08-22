/**
 * ⛔ **IL NUMERO «COPERTE» È IL MOTIVO PER CUI LA PAGINA ESISTE, quindi si prova.**
 *
 * La tabella «Descrizioni diete» mostra, per ogni famiglia, quante varianti su quante hanno la
 * descrizione. È l'unico numero che risponde a «una mia cliente sta leggendo la spiegazione di
 * un'altra dieta?» — perché quando la sua manca, `profile.service.ts` ripiega su quella dell'ultimo
 * menu consegnato. ⚠️ Non il vuoto: **peggio del vuoto**, perché sembra una risposta.
 *
 * ⚠️ Se conta male, sbaglia **nel verso peggiore**: dice «tutto a posto» e nessuno va a guardare. E
 * il difetto non si vedrebbe da nessuna parte, perché in registrazione e sul sito il codice tappa i
 * buchi — basta *una* variante compilata perché la card sia piena. Solo nel profilo la cliente legge
 * la **sua** variante.
 */
import { describe, expect, it } from 'vitest';
import { raggruppaFamiglie, type DietRow } from './famiglieDiete';

const dieta = (p: Partial<DietRow>): DietRow => ({
  id: Math.random().toString(36).slice(2),
  name: 'Mediterranea',
  style: 'mediterranean',
  regime: 'onnivora',
  mealsPerDay: 3,
  status: 'approved',
  ...p,
});

describe('⛔ una riga per famiglia, non per variante', () => {
  it('⛔ diciotto varianti diventano UNA famiglia', () => {
    const righe = Array.from({ length: 18 }, (_, i) => dieta({ mealsPerDay: (i % 3) + 3 }));
    const f = raggruppaFamiglie(righe);
    expect(f).toHaveLength(1);
    expect(f[0].varianti).toHaveLength(18);
  });

  /**
   * ⛔ **La chiave è nome + stile, con lo stesso separatore della registrazione** — `onboarding.service.ts`
   * e `catalog.service.publicPaths` compongono `nome` e `stile` con un `\u0000` in mezzo, e questo
   * file fa lo stesso. Raggruppare per il solo nome unirebbe due prodotti diversi che per caso si
   * chiamano uguale, e il testo dell'uno finirebbe sull'altro.
   */
  it('⛔ stesso nome, stile diverso: due famiglie', () => {
    const f = raggruppaFamiglie([
      dieta({ style: 'mediterranean' }),
      dieta({ style: 'keto' }),
    ]);
    expect(f).toHaveLength(2);
  });

  it('⚠️ nomi diversi: due famiglie', () => {
    expect(raggruppaFamiglie([dieta({}), dieta({ name: 'Flexitariana' })])).toHaveLength(2);
  });

  it('⚠️ nessuna dieta: nessuna famiglia, non un errore', () => {
    expect(raggruppaFamiglie([])).toEqual([]);
  });
});

describe('⛔ «coperte»: quante varianti hanno davvero la descrizione', () => {
  it('⛔ una compilata su tre: 1 su 3, non 3 su 3', () => {
    const f = raggruppaFamiglie([
      dieta({ clientDescription: 'Un testo.' }),
      dieta({ clientDescription: null }),
      dieta({}),
    ])[0];
    expect(f.coperte).toBe(1);
    expect(f.varianti).toHaveLength(3);
  });

  /**
   * ⛔ **Gli spazi non sono un testo.** Una `textarea` salvata con una battuta di spazio produce una
   * stringa non vuota che non dice niente alla cliente: contarla come coperta è il modo esatto in
   * cui questo numero mentirebbe.
   */
  it('⛔ una descrizione fatta di spazi NON conta come coperta', () => {
    expect(raggruppaFamiglie([dieta({ clientDescription: '   ' })])[0].coperte).toBe(0);
    expect(raggruppaFamiglie([dieta({ clientDescription: '' })])[0].coperte).toBe(0);
  });

  it('⚠️ tutte compilate: coperte = varianti', () => {
    const f = raggruppaFamiglie([dieta({ clientDescription: 'a' }), dieta({ clientDescription: 'b' })])[0];
    expect(f.coperte).toBe(2);
  });
});

describe('⚠️ cosa si mostra nella riga', () => {
  it('la descrizione mostrata è la prima COMPILATA, non la prima riga', () => {
    const f = raggruppaFamiglie([
      dieta({ clientDescription: null }),
      dieta({ clientDescription: 'questa si vede' }),
    ])[0];
    expect(f.descrizione).toBe('questa si vede');
  });

  it('e il nome per la cliente idem', () => {
    const f = raggruppaFamiglie([dieta({ clientName: '' }), dieta({ clientName: 'Mediterranea leggera' })])[0];
    expect(f.clientName).toBe('Mediterranea leggera');
  });

  /**
   * ⛔ **Se le varianti dicono cose DIVERSE va detto prima di salvare**, perché salvare le uniforma:
   * sovrascriverebbe anche il testo che qualcuno aveva scritto apposta per la vegana. Senza questo
   * segnale, la tabella mostrerebbe una descrizione sola e la scritta «tutto a posto».
   */
  it('⛔ due testi diversi nella stessa famiglia: si segnala', () => {
    const f = raggruppaFamiglie([
      dieta({ clientDescription: 'per onnivori' }),
      dieta({ clientDescription: 'per vegani' }),
    ])[0];
    expect(f.testiDiversi).toBe(true);
  });

  it('⚠️ lo stesso testo su tutte non è «diverso»', () => {
    const f = raggruppaFamiglie([
      dieta({ clientDescription: 'uguale' }),
      dieta({ clientDescription: '  uguale  ' }),
    ])[0];
    expect(f.testiDiversi).toBe(false);
  });

  /** ⚠️ Una famiglia spenta non la legge nessuna cliente: il numero serve a non perderci tempo. */
  it('⚠️ conta quante varianti sono accese alle clienti', () => {
    const f = raggruppaFamiglie([
      dieta({ clientVisible: true }),
      dieta({ clientVisible: false }),
      dieta({}),
    ])[0];
    expect(f.accese).toBe(1);
  });
});

describe('⛔ le archiviate non contano', () => {
  /**
   * ⛔ **`archiveDiet` archivia mettendo `status: 'rejected'`**, e quelle righe restano in
   * `GET /diets`. Contandole, una famiglia con sei varianti archiviate resterebbe in rosso per
   * sempre e il filtro «solo quelle incomplete» non si svuoterebbe mai — un allarme che non si
   * spegne, su una copertura che per le clienti è completa.
   */
  it('⛔ una variante archiviata non fa scendere «coperte»', () => {
    const f = raggruppaFamiglie([
      dieta({ clientDescription: 'c\'è', status: 'approved' }),
      dieta({ clientDescription: null, status: 'rejected' }),
    ])[0];
    expect(f.coperte).toBe(1);
    expect(f.varianti).toHaveLength(1);
    expect(f.archiviate).toBe(1);
  });

  /** ⚠️ E quante sono state escluse si dice: niente tagli silenziosi. */
  it('⚠️ le archiviate si contano a parte', () => {
    const f = raggruppaFamiglie([
      dieta({ status: 'rejected' }),
      dieta({ status: 'rejected' }),
      dieta({ status: 'draft' }),
    ])[0];
    expect(f.archiviate).toBe(2);
    expect(f.varianti).toHaveLength(1);
  });

  /** ⛔ Una famiglia fatta di sole archiviate non è una riga da compilare: sparisce. */
  it('⛔ una famiglia tutta archiviata non compare', () => {
    expect(raggruppaFamiglie([dieta({ status: 'rejected' })])).toEqual([]);
  });

  /**
   * ⚠️ **«Accesa» vuol dire visibile E approvata.** Una bozza con la spunta `clientVisible` non la
   * vede nessuna cliente: contarla come attiva direbbe che una famiglia è in vetrina quando non c'è.
   */
  it('⚠️ una bozza spuntata non è «accesa»', () => {
    const f = raggruppaFamiglie([
      dieta({ clientVisible: true, status: 'draft' }),
      dieta({ clientVisible: true, status: 'approved' }),
    ])[0];
    expect(f.accese).toBe(1);
  });
});

describe('⛔ l\'ordine: prima quelle con dei buchi', () => {
  /**
   * ⛔ **In fondo all'elenco non guarda nessuno.** La pagina esiste per le famiglie incomplete:
   * ordinarle per nome le seppellirebbe fra quelle a posto, ed è il modo in cui uno strumento nato
   * per far vedere una cosa la nasconde.
   */
  it('⛔ la famiglia con più varianti scoperte viene prima', () => {
    const f = raggruppaFamiglie([
      dieta({ name: 'AaaCompleta', clientDescription: 'c\'è' }),
      dieta({ name: 'ZzzBucata' }),
      dieta({ name: 'ZzzBucata', mealsPerDay: 5 }),
    ]);
    expect(f[0].nome).toBe('ZzzBucata');
    expect(f[0].coperte).toBe(0);
  });

  it('⚠️ a parità di buchi, in ordine alfabetico', () => {
    const f = raggruppaFamiglie([dieta({ name: 'Beta' }), dieta({ name: 'Alfa' })]);
    expect(f.map((x) => x.nome)).toEqual(['Alfa', 'Beta']);
  });
});
