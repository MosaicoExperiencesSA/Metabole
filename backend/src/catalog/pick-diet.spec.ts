import { pickDietFor, stileDellaFamiglia, type DietMatchProfile } from './pick-diet';

/**
 * Segnalazione di Simone (6/8): «i percorsi che la cliente vede in registrazione non
 * corrispondono alle diete del backoffice». Il backoffice ne mostrava 18, l'app 8.
 *
 * La causa vera non era la vetrina ma l'abbinamento: la registrazione salvava solo lo STILE, e
 * lo stile non identifica un prodotto — Vegana, Vegetariana, Flexitariana e Flessibile hanno
 * tutte `style = flexible`. Mostrarle tutte senza cambiare l'abbinamento avrebbe peggiorato le
 * cose: la cliente ne sceglieva una e il motore poteva servirle l'altra.
 *
 * Questi test guardano l'ORDINE dei ripieghi, che è il punto: quando la famiglia c'è vince, e
 * quando non c'è (o non trova niente) si scende ai criteri di prima senza lasciare nessuna
 * cliente senza menu.
 */

type Dieta = { id: string; name: string; style: string; regime: string; objective: string; mealsPerDay: number; fasting: boolean };

const CATALOGO: Dieta[] = [
  { id: 'veg', name: 'Vegana', style: 'flexible', regime: 'onnivoro', objective: 'dimagrimento', mealsPerDay: 5, fasting: false },
  { id: 'vgt', name: 'Vegetariana', style: 'flexible', regime: 'onnivoro', objective: 'dimagrimento', mealsPerDay: 5, fasting: false },
  { id: 'vgt-mant', name: 'Vegetariana', style: 'flexible', regime: 'onnivoro', objective: 'mantenimento', mealsPerDay: 5, fasting: false },
  { id: 'med', name: 'Mediterranea', style: 'mediterranean', regime: 'onnivoro', objective: 'dimagrimento', mealsPerDay: 5, fasting: false },
];

/** Finto catalogo: applica il `where` che `pickDietFor` costruisce, e basta. */
function trovatore(diete: Dieta[] = CATALOGO) {
  const chiamate: Record<string, unknown>[] = [];
  const trova = async (where: Record<string, unknown>) => {
    chiamate.push(where);
    const found = diete.find((d) =>
      Object.entries(where).every(([k, v]) => {
        if (k === 'status') return true; // tutte le diete di prova sono approvate
        return (d as unknown as Record<string, unknown>)[k] === v;
      }),
    );
    return found ?? null;
  };
  return { trova, chiamate };
}

const BASE: DietMatchProfile = {
  regime: 'onnivoro', dietStyle: 'flexible', mealsPerDay: 5, objective: 'dimagrimento', pathType: 'five',
};

describe('pickDietFor — la famiglia identifica il prodotto, lo stile no', () => {
  it('con la famiglia serve QUEL prodotto, non il primo dello stesso stile', async () => {
    const { trova } = trovatore();
    // Senza famiglia il primo `flexible` del catalogo è la Vegana: è esattamente la confusione
    // che la cliente vedeva.
    expect((await pickDietFor(trova, BASE))?.id).toBe('veg');
    expect((await pickDietFor(trova, { ...BASE, dietFamily: 'Vegetariana' }))?.id).toBe('vgt');
  });

  it('la famiglia rispetta comunque la fase: mantenimento prende la variante giusta', async () => {
    const { trova } = trovatore();
    const d = await pickDietFor(trova, { ...BASE, dietFamily: 'Vegetariana', objective: 'mantenimento' });
    expect(d?.id).toBe('vgt-mant');
  });

  it('famiglia senza la variante della fase: ripiega sulla stessa famiglia, non su un altro prodotto', async () => {
    const { trova } = trovatore();
    // La Vegana esiste solo in dimagrimento: chi è in mantenimento resta sulla Vegana.
    const d = await pickDietFor(trova, { ...BASE, dietFamily: 'Vegana', objective: 'mantenimento' });
    expect(d?.id).toBe('veg');
  });

  it('famiglia che non esiste più (rinominata in backoffice): si scende allo stile, niente buco', async () => {
    const { trova } = trovatore();
    const d = await pickDietFor(trova, { ...BASE, dietFamily: 'Nome Sparito' });
    expect(d?.id).toBe('veg');
  });

  it('lo staff cambia lo STILE dal backoffice: la vecchia famiglia smette di valere da sola', async () => {
    // È il motivo per cui il filtro famiglia è sempre combinato con lo stile: senza, una
    // correzione del nutrizionista non avrebbe alcun effetto.
    const { trova } = trovatore();
    const d = await pickDietFor(trova, { ...BASE, dietStyle: 'mediterranean', dietFamily: 'Vegetariana' });
    expect(d?.id).toBe('med');
  });

  it('clienti registrate prima del 7/8 (famiglia nulla): abbinamento identico a prima', async () => {
    const { trova, chiamate } = trovatore();
    const d = await pickDietFor(trova, { ...BASE, dietFamily: null });
    expect(d?.id).toBe('veg');
    // Nessuna query in più: senza famiglia i tentativi partono dallo stile, come sempre.
    expect(chiamate[0]).not.toHaveProperty('name');
  });

  it('senza regime o senza numero di pasti non sceglie niente (e non interroga il catalogo)', async () => {
    const { trova, chiamate } = trovatore();
    expect(await pickDietFor(trova, { ...BASE, regime: null })).toBeNull();
    expect(await pickDietFor(trova, { ...BASE, mealsPerDay: null })).toBeNull();
    expect(chiamate).toHaveLength(0);
  });

  it('digiuno intermittente: cerca le varianti fasting, non il numero di pasti', async () => {
    const { trova, chiamate } = trovatore([]);
    await pickDietFor(trova, { ...BASE, pathType: 'intermittent_fasting' });
    expect(chiamate[0]).toMatchObject({ fasting: true });
    expect(chiamate[0]).not.toHaveProperty('mealsPerDay');
  });

  /**
   * IL CASO SONIA (17/8). `s.sandri66@libero.it`, finestra «salto la cena»: riceveva **un pasto al
   * giorno**. Il catalogo `fasting` ha tre slot fissi (pranzo, merenda, cena) e la finestra togliendo
   * cena e merenda le lasciava il solo pranzo — con la rete di `dayComboPools` che ferma la giornata
   * vuota, non quella monca. La regola sta in `struttura-per-digiuno.ts`; qui si guarda che arrivi
   * davvero al catalogo.
   */
  it('⚠️ digiuno «salto la cena»: cerca il catalogo a 5 PASTI, l\'unico che ha colazione e spuntino', async () => {
    const { trova, chiamate } = trovatore([]);
    await pickDietFor(trova, { ...BASE, pathType: 'intermittent_fasting', fastingWindow: 'skip_dinner' });
    expect(chiamate[0]).toMatchObject({ mealsPerDay: 5, fasting: false });
  });

  it('⚠️ digiuno «salto la colazione»: NON si muove dal catalogo digiuno', async () => {
    // Le cinque clienti che oggi stanno bene. Nel digiuno i loro tre pasti valgono il 100% della
    // giornata, nel 5 pasti il 70%: spostarle sarebbe un peggioramento silenzioso.
    const { trova, chiamate } = trovatore([]);
    await pickDietFor(trova, { ...BASE, pathType: 'intermittent_fasting', fastingWindow: 'skip_breakfast' });
    expect(chiamate[0]).toMatchObject({ fasting: true });
    expect(chiamate[0]).not.toHaveProperty('mealsPerDay');
  });

  it('la finestra non tocca chi non è in digiuno', async () => {
    // Un dato rimasto sul profilo dopo un cambio di percorso non deve cambiare la dieta di nessuno:
    // comanda `pathType`.
    const { trova, chiamate } = trovatore([]);
    await pickDietFor(trova, { ...BASE, pathType: 'five', fastingWindow: 'skip_dinner' });
    expect(chiamate[0]).toMatchObject({ mealsPerDay: 5, fasting: false });
    const primaDelSecondoGiro = chiamate.length;
    await pickDietFor(trova, { ...BASE, mealsPerDay: 3, pathType: 'three', fastingWindow: 'skip_dinner' });
    expect(chiamate[primaDelSecondoGiro]).toMatchObject({ mealsPerDay: 3, fasting: false });
  });

  it('digiuno «salto la cena» senza la variante a 5 pasti: si serve comunque un menu', async () => {
    // L'ultimo ripiego lascia cadere il filtro sui pasti: meglio una dieta vicina che nessun menu.
    // ⚠️ Ma allora la cliente torna a ricevere meno pasti di quelli promessi, e `menu.service` lo
    // dice (`pastiPromessiCheMancano`): prima succedeva in silenzio.
    const soloDigiuno: Dieta[] = [
      { id: 'dig', name: 'Vegetariana', style: 'flexible', regime: 'onnivoro', objective: 'dimagrimento', mealsPerDay: 3, fasting: true },
    ];
    const { trova } = trovatore(soloDigiuno);
    const d = await pickDietFor(trova, {
      ...BASE, dietFamily: 'Vegetariana', pathType: 'intermittent_fasting', fastingWindow: 'skip_dinner',
    });
    expect(d?.id).toBe('dig');
  });

  it('ultimo ripiego: nessuna variante col piano pasti richiesto → una dieta dello stesso regime', async () => {
    // Solo diete a 3 pasti in catalogo: una cliente a 5 pasti non deve restare senza menu.
    const solo3 = CATALOGO.map((d) => ({ ...d, mealsPerDay: 3 }));
    const { trova } = trovatore(solo3);
    const d = await pickDietFor(trova, { ...BASE, dietFamily: 'Vegetariana' });
    expect(d?.id).toBe('vgt');
  });
});

/**
 * §16.10 — «lo STILE sparisce dall'interfaccia» (Simone). La cliente sceglie un prodotto; lo stile
 * è una proprietà di quel prodotto, e lo sa il catalogo.
 */
describe('stileDellaFamiglia', () => {
  it('la famiglia scelta porta con sé il suo stile', async () => {
    const trova = jest.fn().mockResolvedValue({ style: 'flexible' });
    expect(await stileDellaFamiglia(trova, 'Mediterranea senza glutine')).toBe('flexible');
  });

  it('⚠️ solo fra le diete APPROVATE', async () => {
    // Una bozza non è un prodotto acquistabile: prenderne lo stile vorrebbe dire assegnare una
    // cliente a qualcosa che nel Negozio non esiste.
    const trova = jest.fn().mockResolvedValue({ style: 'flexible' });
    await stileDellaFamiglia(trova, 'Mediterranea');
    expect(trova.mock.calls[0][0]).toEqual({ status: 'approved', name: 'Mediterranea' });
  });

  it('famiglia sconosciuta o assente: null, e non si interroga nemmeno', async () => {
    const trova = jest.fn().mockResolvedValue(null);
    expect(await stileDellaFamiglia(trova, 'Non esiste')).toBeNull();
    expect(await stileDellaFamiglia(trova, null)).toBeNull();
    expect(await stileDellaFamiglia(trova, undefined)).toBeNull();
    expect(await stileDellaFamiglia(trova, '')).toBeNull();
    expect(trova).toHaveBeenCalledTimes(1);
  });
});
