/**
 * «QUAL È LA DIETA ASSEGNATA?» — la stessa risposta allo staff e alla cliente.
 *
 * Il test che conta è il primo: con la famiglia «Mediterranea» in catalogo tre volte, la vecchia
 * ricerca `where: { name }` restituiva la prima riga che capitava, e da lì uscivano nome, stile e
 * descrizione mostrati **alla cliente** nel suo Profilo. Il test passa la variante giusta come
 * seconda riga apposta: una ricerca per solo nome prenderebbe la prima e fallirebbe.
 */
import { dietaMostrataPer, nomePerLaCliente } from './dieta-mostrata';
import type { PrismaService } from '../prisma/prisma.service';

type RigaDieta = {
  id: string; name: string; clientName: string | null; clientDescription: string | null;
  style: string | null; status: string; regime: string | null; mealsPerDay: number | null;
  /**
   * ⚠️ **Mancava, e non era un dettaglio della finzione** (21/8). In banca dati `Diet.fasting` è
   * `Boolean @default(false)`: **non è mai null**. Le righe finte senza quel campo hanno fatto
   * fallire i test nel momento in cui la ricerca ha cominciato a filtrarci sopra — che è il modo
   * giusto in cui una finzione incompleta si fa notare, ma solo se qualcuno guarda perché.
   */
  fasting: boolean;
};

const dieta = (over: Partial<RigaDieta>): RigaDieta => ({
  id: 'd', name: 'Mediterranea', clientName: null, clientDescription: null,
  style: 'mediterranean', status: 'approved', regime: 'onnivoro', mealsPerDay: 5,
  fasting: false, ...over,
});

/**
 * Un catalogo finto che filtra sul serio: `findFirst` applica i campi scalari del `where` e
 * restituisce la prima riga che li soddisfa tutti. Serve proprio a distinguere «cerca per nome» da
 * «cerca per nome + stile + regime + pasti».
 */
function catalogo(righe: RigaDieta[]) {
  const findFirst = jest.fn(async (args: { where?: Record<string, unknown> }) => {
    const w = (args?.where ?? {}) as Record<string, unknown>;
    return righe.find((r) => Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)) ?? null;
  });
  return { finto: { diet: { findFirst } } as unknown as PrismaService, findFirst };
}

const PROFILO = {
  regime: 'onnivoro', dietStyle: 'mediterranean', dietFamily: 'Mediterranea',
  mealsPerDay: 5, objective: 'dimagrimento', pathType: null,
};

describe('la variante esatta', () => {
  it('⚠️ NON è la prima dieta con quel nome: è quella con stile, regime e pasti della cliente', () => {
    // Il caso Cristina Urbani, spostato dal backoffice all'app: la cliente è onnivora a 5 pasti e
    // in catalogo la prima «Mediterranea» è vegana a 3. Con la vecchia riga leggeva la descrizione
    // — e apriva la scheda dello stile — di una dieta che non ha mai visto.
    const { finto } = catalogo([
      dieta({ id: 'sbagliata', style: 'vegan', regime: 'vegano', mealsPerDay: 3, clientDescription: 'Vegana, 3 pasti' }),
      dieta({ id: 'giusta', clientDescription: 'Mediterranea onnivora, 5 pasti' }),
    ]);
    return dietaMostrataPer(finto, PROFILO).then((esito) => {
      expect(esito.varianteEsatta?.id).toBe('giusta');
      expect(esito.dietaMostrata?.clientDescription).toBe('Mediterranea onnivora, 5 pasti');
      expect(esito.dietaMostrata?.style).toBe('mediterranean');
    });
  });

  it('la variante approvata batte la bozza con lo stesso nome', async () => {
    // `orderBy: { status: 'asc' }` — 'approved' < 'draft'. Qui si verifica che l'ordinamento sia
    // chiesto: è quello che decide, non l'ordine delle righe.
    const { finto, findFirst } = catalogo([dieta({ id: 'x' })]);
    await dietaMostrataPer(finto, PROFILO);
    expect(findFirst.mock.calls[0][0]).toMatchObject({ orderBy: { status: 'asc' } });
  });

  it('⚠️ una bozza va bene: la cliente deve vedere il nome della dieta che le è stata assegnata', async () => {
    // La variante esatta si cerca **senza** filtro sullo stato. Se il nutrizionista l'ha appena
    // creata e non l'ha ancora approvata, il Profilo dice comunque com'è chiamata invece di
    // ripiegare in silenzio su un'altra dieta.
    const { finto } = catalogo([dieta({ id: 'bozza', status: 'draft', clientName: 'La tua Mediterranea' })]);
    const esito = await dietaMostrataPer(finto, PROFILO);
    expect(esito.varianteEsatta?.id).toBe('bozza');
    expect(esito.nome).toBe('La tua Mediterranea');
  });

  it('senza famiglia sul profilo non si cerca nessuna variante', async () => {
    // Le clienti registrate prima del 7/8: `dietFamily` è null e si va direttamente sul motore.
    const { finto } = catalogo([dieta({ id: 'unica' })]);
    const esito = await dietaMostrataPer(finto, { ...PROFILO, dietFamily: null });
    expect(esito.varianteEsatta).toBeNull();
    expect(esito.dietaServita?.id).toBe('unica');
  });
});

describe('quando la variante esatta non esiste', () => {
  it('⚠️ si mostra la dieta che il motore SERVE davvero, non niente e non una a caso', async () => {
    // È l'unica che spiega i piatti che ha nel piatto. `pickDietFor` ripiega sullo stile.
    const { finto } = catalogo([
      dieta({ id: 'altra-famiglia', name: 'Mediterranea leggera', clientName: 'Mediterranea leggera' }),
    ]);
    const esito = await dietaMostrataPer(finto, PROFILO);
    expect(esito.varianteEsatta).toBeNull();
    expect(esito.dietaMostrata?.id).toBe('altra-famiglia');
    expect(esito.nome).toBe('Mediterranea leggera');
  });

  it('⚠️ il motore guarda SOLO le approvate: una bozza di un\'altra famiglia non si serve', async () => {
    // Differenza voluta con la variante esatta: lì il nome è una decisione già presa sul profilo,
    // qui si sta indovinando un ripiego — e su un ripiego si prende solo quello che è pronto.
    const { finto } = catalogo([dieta({ id: 'bozza-altrui', name: 'Altra', status: 'draft' })]);
    const esito = await dietaMostrataPer(finto, PROFILO);
    expect(esito.dietaServita).toBeNull();
  });

  it('catalogo vuoto: resta il nome scritto sul profilo, che va detto e non nascosto', async () => {
    // Dieta rinominata o cancellata. Il motore cercherà quel nome e non lo troverà: tacere qui
    // vorrebbe dire far sparire il problema dalla schermata e lasciarlo nei menu.
    const { finto } = catalogo([]);
    const esito = await dietaMostrataPer(finto, PROFILO);
    expect(esito.dietaMostrata).toBeNull();
    expect(esito.nome).toBe('Mediterranea');
  });
});

describe('nomePerLaCliente', () => {
  it('il nome scritto per lei vince su quello interno', () => {
    expect(nomePerLaCliente(dieta({ clientName: 'La tua Mediterranea' }))).toBe('La tua Mediterranea');
    expect(nomePerLaCliente(dieta({ clientName: null }))).toBe('Mediterranea');
    // ⚠️ Stringa vuota = non compilato: si mostra il nome interno, non una riga bianca.
    expect(nomePerLaCliente(dieta({ clientName: '' }))).toBe('Mediterranea');
    expect(nomePerLaCliente(null)).toBeNull();
  });
});


/**
 * ⛔ **LA VARIANTE DIGIUNO NON È LA VARIANTE ESATTA DI CHI NON DIGIUNA — e viceversa.**
 *
 * Trovato correggendo il caso di Antonella (21/8). La ricerca della «variante esatta» filtrava su
 * `name + regime + mealsPerDay + style` e **non su `fasting`**. In una famiglia che ha sia la
 * variante a 3 pasti sia quella da digiuno — che a catalogo è pure lei `mealsPerDay: 3` — le due
 * righe sono indistinguibili da quella query: vince chi capita prima.
 *
 * ⚠️ E l'errore va nei due sensi, con due danni diversi:
 *  - a una cliente **a 3 pasti** si poteva mostrare la variante **digiuno** («Dieta assegnata») —
 *    una dieta senza colazione, a una che la colazione la fa;
 *  - a una cliente **in digiuno** si mostrava sempre la variante digiuno della sua famiglia, anche
 *    quando il suo orologio ne chiedeva un'altra e il motore ne stava servendo **un'altra ancora**.
 *    Ed è il caso peggiore, perché spegneva anche `scostamentoDieta`: la scheda non aveva più
 *    nessun modo di dire che quella cliente stava mangiando la dieta di un'altra famiglia.
 */
describe('⛔ digiuno e non-digiuno non si confondono', () => {
  const TRE_PASTI = { ...PROFILO, mealsPerDay: 3, pathType: 'classic3' };

  it('⛔ a chi NON digiuna non si mostra la variante digiuno, anche se i pasti coincidono', async () => {
    const { finto } = catalogo([
      dieta({ id: 'digiuno', mealsPerDay: 3, fasting: true, clientName: 'Mediterranea digiuno' }),
      dieta({ id: 'classica', mealsPerDay: 3, fasting: false, clientName: 'Mediterranea 3 pasti' }),
    ]);
    const esito = await dietaMostrataPer(finto, TRE_PASTI);
    expect(esito.varianteEsatta?.id).toBe('classica');
  });

  /** ⚠️ E il contrario: chi digiuna vede la sua, non quella a tre pasti che le sta accanto. */
  it('⛔ a chi digiuna si mostra la variante digiuno', async () => {
    const { finto } = catalogo([
      dieta({ id: 'classica', mealsPerDay: 3, fasting: false }),
      dieta({ id: 'digiuno', mealsPerDay: 3, fasting: true }),
    ]);
    const esito = await dietaMostrataPer(finto, {
      ...PROFILO, mealsPerDay: 3, pathType: 'intermittent_fasting', fastingWindow: 'skip_breakfast',
    });
    expect(esito.varianteEsatta?.id).toBe('digiuno');
  });

  /**
   * ⛔ **IL CASO ANTONELLA.** La 14:10 promette quattro pasti — colazione, pranzo, merenda, cena —
   * che il catalogo digiuno (pranzo, merenda, cena) non ha: serve la variante a **5 pasti**. Se
   * quella variante non esiste, «la variante esatta» **non esiste**, e dirlo è tutto il punto:
   * è quello che accende `scostamentoDieta` e toglie dalla scheda la frase che non è vera.
   */
  it('⛔ 14:10 senza la variante a 5 pasti: la variante esatta NON esiste, e si vede', async () => {
    const { finto } = catalogo([
      dieta({ id: 'digiuno', mealsPerDay: 3, fasting: true }),
    ]);
    const esito = await dietaMostrataPer(finto, {
      ...PROFILO, mealsPerDay: 3, pathType: 'intermittent_fasting', fastingWindow: 'skip_morning_snack',
    });
    expect(esito.varianteEsatta).toBeNull();
  });

  /** ⚠️ E con la variante a 5 pasti in catalogo, la stessa cliente è servita: nessuno scostamento. */
  it('⚠️ con la variante a 5 pasti in catalogo, la 14:10 è coperta', async () => {
    const { finto } = catalogo([
      dieta({ id: 'digiuno', mealsPerDay: 3, fasting: true }),
      dieta({ id: 'cinque', mealsPerDay: 5, fasting: false }),
    ]);
    const esito = await dietaMostrataPer(finto, {
      ...PROFILO, mealsPerDay: 3, pathType: 'intermittent_fasting', fastingWindow: 'skip_morning_snack',
    });
    expect(esito.varianteEsatta?.id).toBe('cinque');
  });
});
