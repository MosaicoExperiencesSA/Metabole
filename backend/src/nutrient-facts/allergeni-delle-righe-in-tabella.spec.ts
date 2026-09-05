import { AgenteAlimentiService } from './agente-alimenti.service';
import { AZIONE_ALLERGENI, SCRITTO_DA } from './agente-alimenti';
import { RIGHE_GUARDATE_PER_NOTTE } from './agente-alimenti.service';

/**
 * ⛔ **IL SECONDO GIRO DELL'AGENTE, COL PRISMA FINTO: gli allergeni delle righe che in tabella ci
 * sono già.**
 *
 * Il limite era dichiarato nel foglio del 31/8: *«essere in tabella non vuol dire conoscerne gli
 * allergeni — su un pesto pronto che avesse la sua riga la deduzione direbbe nessun allergene con la
 * stessa faccia»*. Queste prove tengono ferme le tre cose che rendono quel giro **sicuro**:
 *
 * · non scrive **mai** sopra a un elenco che qualcuno ha già dichiarato;
 * · non tocca i **valori**, che li ha messi una persona;
 * · guarda **prima** le righe che più ricette nominano, perché è il numero di piatti che cambiano.
 */

const rispostaBuona = {
  e_un_alimento: true,
  allergeni: ['latte', 'frutta_a_guscio'],
  fonte: { nome: 'Etichetta produttore', url: 'https://esempio.it/pesto' },
  affidabilita: 'media',
};

function monta(opzioni: {
  acceso?: boolean;
  max?: number;
  righe?: { id: string; name: string; category?: string | null; synonyms?: string[] }[];
  ricette?: { ingredients: unknown }[];
  giaProvate?: string[];
  risposte?: (unknown | null)[];
  fatale?: boolean;
} = {}) {
  const risposte = [...(opzioni.risposte ?? [rispostaBuona, rispostaBuona, rispostaBuona, rispostaBuona])];
  const ai = {
    lastError: null as string | null, lastErrorFatale: false, lastRicerche: 0,
    generateJsonConRicerca: jest.fn(async () => {
      const r = risposte.length ? risposte.shift() : null;
      ai.lastRicerche = 2;
      if (r === null || r === undefined) {
        ai.lastError = opzioni.fatale ? 'il credito dell\'AI è esaurito' : 'timeout';
        ai.lastErrorFatale = !!opzioni.fatale;
        return null;
      }
      ai.lastErrorFatale = false;
      return r;
    }),
  };
  const prisma = {
    nutrientFact: {
      findMany: jest.fn().mockResolvedValue(
        (opzioni.righe ?? []).map((r) => ({ category: null, synonyms: [], ...r })),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    recipe: { findMany: jest.fn().mockResolvedValue(opzioni.ricette ?? []) },
    auditLog: {
      findMany: jest.fn().mockResolvedValue((opzioni.giaProvate ?? []).map((id) => ({ entityId: id }))),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined), logMany: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getBool: jest.fn().mockResolvedValue(opzioni.acceso ?? true),
    getNumber: jest.fn().mockResolvedValue(opzioni.max ?? 20),
  };
  return { ai, prisma, audit, config, service: new AgenteAlimentiService(prisma as never, ai as never, config as never, audit as never) };
}

const pesto = { id: 'nf-pesto', name: 'pesto pronto', category: 'sughi' };
const usaIlPesto = [{ ingredients: [{ name: 'Pesto pronto' }] }];

describe('compilaAllergeniMancanti', () => {
  it('⚠️ spento: non legge la tabella e non chiama l\'AI', async () => {
    const { ai, prisma, service } = monta({ acceso: false, righe: [pesto], ricette: usaIlPesto });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ acceso: false, guardate: 0, scritte: 0 });
    expect(prisma.nutrientFact.findMany).not.toHaveBeenCalled();
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
  });

  it('⛔ acceso: chiede solo alle righe che nessuno ha guardato, e scrive solo la colonna allergeni', async () => {
    const { prisma, audit, service } = monta({ righe: [pesto], ricette: usaIlPesto });
    const out = await service.compilaAllergeniMancanti();
    expect(out).toMatchObject({ acceso: true, guardate: 1, scritte: 1, ricerche: 2 });

    /**
     * ⛔ **Le due condizioni sono tutte e due necessarie.** `isEmpty` da sola non basta: una
     * nutrizionista che apre la riga e dichiara «li ho guardati, non ne ha» lascia sul database un
     * elenco vuoto identico a quello di partenza, e l'agente ci scriverebbe sopra la sua ipotesi.
     * `allergensFilledBy` è quello che glielo impedisce — e impedisce anche di ripagare ogni mese
     * le stesse ricerche su una riga a cui aveva già risposto lui.
     */
    expect(prisma.nutrientFact.findMany.mock.calls[0][0].where).toMatchObject({
      allergens: { isEmpty: true },
      allergensFilledBy: null,
    });
    /** ⚠️ L'ordine è dichiarato: «le più usate» va scelto fra righe che ruotano, non fra le stesse 500. */
    expect(prisma.nutrientFact.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: { updatedAt: 'asc' },
      take: RIGHE_GUARDATE_PER_NOTTE,
    });

    const scritta = prisma.nutrientFact.update.mock.calls[0][0];
    expect(scritta).toMatchObject({
      where: { id: 'nf-pesto' },
      data: { allergens: ['latte', 'frutta_a_guscio'], allergensFilledBy: SCRITTO_DA },
    });
    // ⛔ I valori non si toccano: li ha messi una persona.
    expect(Object.keys(scritta.data).sort()).toEqual(['allergens', 'allergensFilledBy', 'allergensSource']);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AZIONE_ALLERGENI, entityId: 'nf-pesto' }));
  });

  /**
   * ⛔ **UNA RIGA CHE NESSUNA RICETTA NOMINA NON SI CHIEDE.** Ogni domanda costa due ricerche in rete,
   * e una riga che nessun piatto usa non cambia niente in nessuna base personale: spenderci sopra il
   * tetto della notte vorrebbe dire lasciare fuori le righe che invece contano.
   */
  it('⛔ salta le righe che nessuna ricetta nomina', async () => {
    const { ai, service } = monta({ righe: [pesto], ricette: [{ ingredients: [{ name: 'Mela' }] }] });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ guardate: 0, scritte: 0 });
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
  });

  it('⚠️ il sinonimo vale come il nome: la riga «pesto» che le ricette chiamano «pesto genovese» si chiede lo stesso', async () => {
    const { ai, service } = monta({
      righe: [{ id: 'nf-p', name: 'pesto', synonyms: ['pesto genovese'] }],
      ricette: [{ ingredients: [{ name: 'Pesto genovese' }] }],
    });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ guardate: 1, scritte: 1 });
    expect(ai.generateJsonConRicerca).toHaveBeenCalledTimes(1);
  });

  it('⛔ prima le righe che più ricette nominano, e il tetto della notte taglia le altre', async () => {
    const { ai, prisma, service } = monta({
      max: 1,
      righe: [{ id: 'nf-raro', name: 'taleggio' }, { id: 'nf-usato', name: 'pesto pronto' }],
      ricette: [
        { ingredients: [{ name: 'Pesto pronto' }] },
        { ingredients: [{ name: 'Pesto pronto' }] },
        { ingredients: [{ name: 'Taleggio' }] },
      ],
    });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ guardate: 1, scritte: 1 });
    expect(ai.generateJsonConRicerca).toHaveBeenCalledTimes(1);
    expect(prisma.nutrientFact.update.mock.calls[0][0].where.id).toBe('nf-usato');
  });

  /**
   * ⛔ **L'ELENCO VUOTO SI SCRIVE, ed è metà del valore del giro.** `[]` con `allergensFilledBy` vuol dire «ha
   * cercato e non ne ha»; il vuoto di partenza vuol dire «non lo sa nessuno». Senza questa scrittura
   * una mela resterebbe indistinguibile da un pesto pronto mai guardato, per sempre.
   */
  it('⛔ «nessun allergene» si scrive, e la riga risulta compilata', async () => {
    const { prisma, service } = monta({
      righe: [{ id: 'nf-mela', name: 'mela' }],
      ricette: [{ ingredients: [{ name: 'Mela' }] }],
      risposte: [{ ...rispostaBuona, allergeni: [], affidabilita: 'solida' }],
    });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ scritte: 1 });
    expect(prisma.nutrientFact.update.mock.calls[0][0].data).toMatchObject({ allergens: [], allergensFilledBy: SCRITTO_DA });
  });

  it('⚠️ una riga bocciata non si riscrive, resta registrata col motivo, e non ferma le altre', async () => {
    const { prisma, audit, service } = monta({
      righe: [{ id: 'nf-1', name: 'pesto pronto' }, { id: 'nf-2', name: 'taleggio' }],
      ricette: [{ ingredients: [{ name: 'Pesto pronto' }] }, { ingredients: [{ name: 'Taleggio' }] }],
      risposte: [{ ...rispostaBuona, allergeni: ['nichel'] }, rispostaBuona],
    });
    const out = await service.compilaAllergeniMancanti();
    expect(out).toMatchObject({ guardate: 2, scritte: 1, scartate: { allergene_sconosciuto: 1 } });
    expect(prisma.nutrientFact.update).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AZIONE_ALLERGENI, entityId: 'nf-1',
      metadata: expect.objectContaining({ motivo: 'allergene_sconosciuto' }),
    }));
  });

  it('⚠️ una riga già provata di recente non si richiede: la memoria degli scarti vale anche qui', async () => {
    const { prisma, service } = monta({ righe: [pesto], ricette: usaIlPesto, giaProvate: ['nf-pesto'] });
    await service.compilaAllergeniMancanti();
    expect(prisma.nutrientFact.findMany.mock.calls[0][0].where).toMatchObject({ id: { notIn: ['nf-pesto'] } });
  });

  it('⛔ un errore fatale dell\'AI ferma il giro al primo colpo, e lo dice', async () => {
    const { ai, prisma, service } = monta({
      fatale: true,
      righe: [{ id: 'nf-1', name: 'pesto pronto' }, { id: 'nf-2', name: 'taleggio' }],
      ricette: [{ ingredients: [{ name: 'Pesto pronto' }] }, { ingredients: [{ name: 'Taleggio' }] }],
      risposte: [null],
    });
    const out = await service.compilaAllergeniMancanti();
    expect(out.fermatoPer).toMatch(/credito/);
    expect(ai.generateJsonConRicerca).toHaveBeenCalledTimes(1);
    expect(prisma.nutrientFact.update).not.toHaveBeenCalled();
  });

  it('⚠️ tetto a zero: non chiede niente, e non è un errore', async () => {
    const { ai, service } = monta({ max: 0, righe: [pesto], ricette: usaIlPesto });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ acceso: true, guardate: 0, scritte: 0 });
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **UN TIMEOUT NON METTE UN ALIMENTO IN FRIGO PER UN MESE** (revisione del 5/9). La riga di
   * registro è quello che fa saltare l'alimento per trenta giorni: scriverla per un blip di rete
   * vorrebbe dire che «pesto pronto» non si riprova fino al mese dopo, e nessuno lo saprebbe.
   */
  it('⛔ una risposta mancata per un errore passeggero non lascia traccia nel registro', async () => {
    const { audit, service } = monta({
      righe: [{ id: 'nf-1', name: 'pesto pronto' }, { id: 'nf-2', name: 'taleggio' }],
      ricette: [{ ingredients: [{ name: 'Pesto pronto' }] }, { ingredients: [{ name: 'Taleggio' }] }],
      risposte: [null, rispostaBuona],
    });
    const out = await service.compilaAllergeniMancanti();
    expect(out).toMatchObject({ guardate: 2, scritte: 1, scartate: { risposta_vuota: 1 } });
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ entityId: 'nf-1' }));
  });

  /**
   * ⛔ **IL FRENO DELLE RISPOSTE A VUOTO.** Se l'AI risponde male tre volte di fila non è un caso: è
   * il modello o la rete che non stanno funzionando, e senza freno le venti domande della notte —
   * che si pagano — se ne andrebbero tutte a vuoto.
   */
  it('⛔ tre risposte a vuoto di fila fermano il giro', async () => {
    const righe = Array.from({ length: 8 }, (_, i) => ({ id: `nf-${i}`, name: `alimento ${i}` }));
    const { ai, service } = monta({
      righe,
      ricette: righe.map((r) => ({ ingredients: [{ name: r.name }] })),
      risposte: [null, null, null, rispostaBuona],
    });
    const out = await service.compilaAllergeniMancanti();
    expect(out.fermatoPer).toMatch(/a vuoto/);
    expect(ai.generateJsonConRicerca).toHaveBeenCalledTimes(3);
  });

  /**
   * ⛔ **LE PAROLE DEL VOCABOLARIO ENTRANO NELLA DOMANDA.** «Taleggio» è latte per la deduzione: se
   * l'AI risponde «nessun allergene», scrivere quella risposta chiuderebbe la riga con un allergene
   * in meno addosso a chi è allergico — e la riga risulterebbe pure «già guardata».
   */
  it('⛔ se l\'AI perde un allergene che le parole conoscono, la riga non si scrive', async () => {
    const { prisma, audit, service } = monta({
      righe: [{ id: 'nf-tal', name: 'taleggio' }],
      ricette: [{ ingredients: [{ name: 'Taleggio' }] }],
      risposte: [{ ...rispostaBuona, allergeni: [], affidabilita: 'solida' }],
    });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ scritte: 0, scartate: { allergene_perso: 1 } });
    expect(prisma.nutrientFact.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ motivo: 'allergene_perso' }),
    }));
  });

  /**
   * ⛔ **L'ORDINE DEI TRE GIRI È IL PUNTO**: gli allergeni scritti stanotte devono arrivare alle
   * ricette **stanotte**. Invertendo, la propagazione girerebbe prima e i tag aspetterebbero il
   * giorno dopo — in silenzio, senza che niente sembri rotto.
   */
  it('⛔ nel passo notturno gli allergeni si chiedono PRIMA che i tag partano', async () => {
    const { service } = monta({ righe: [], ricette: [] });
    const ordine: string[] = [];
    jest.spyOn(service, 'compila').mockImplementation(async () => { ordine.push('compila'); return {} as never; });
    jest.spyOn(service, 'compilaAllergeniMancanti').mockImplementation(async () => { ordine.push('allergeni'); return {} as never; });
    jest.spyOn(service, 'propagaTag').mockImplementation(async () => { ordine.push('tag'); return {} as never; });
    await service.passoNotturno();
    expect(ordine).toEqual(['compila', 'allergeni', 'tag']);
  });

  it('⚠️ nessuna riga con la colonna vuota: il giro non costa niente', async () => {
    const { ai, prisma, service } = monta({ righe: [], ricette: usaIlPesto });
    expect(await service.compilaAllergeniMancanti()).toMatchObject({ guardate: 0 });
    expect(prisma.recipe.findMany).not.toHaveBeenCalled();
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
  });
});
