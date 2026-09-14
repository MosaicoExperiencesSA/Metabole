/**
 * ⛔ **IL GIORNO CHE C'È GIÀ, RIMESSO NELLA SCHERMATA CHE LO RISCRIVE.**
 *
 * Qui si prova la regola pura: cosa torna dentro i pasti e **cosa no, col perché**. Il criterio
 * non è «cosa c'era» ma «cosa il salvataggio accetterebbe»: una riga riproposta che il `POST` poi
 * rifiuta è peggio di una riga mancante, perché non l'ha scelta nessuno e chi salva scopre di
 * doverla togliere senza sapere da dove arrivava.
 */
import { pastiGiaScritti, riproponiGiornata, type VerdettoRicetta } from './giornata-gia-scritta';

const verdetto = (over: Partial<VerdettoRicetta> & { recipeId: string }): VerdettoRicetta => ({
  nome: 'Piatto',
  kcal: 400,
  slot: 'breakfast',
  bloccata: false,
  motivoBlocco: null,
  nelPool: true,
  regimeAmmesso: true,
  ...over,
});

const mappa = (...v: VerdettoRicetta[]) => new Map(v.map((x) => [x.recipeId, x]));

describe('leggere i pasti di un giorno già scritto', () => {
  it('⛔ legge i giorni del MOTORE, non solo quelli scritti a mano', () => {
    /** ⚠️ Un giorno erogato non ha `scrittaAMano`: è il caso normale della richiesta di Simone. */
    const p = pastiGiaScritti([
      { slot: 'breakfast', recipeId: 'c1', name: 'Porridge', kcal: 400 },
      { slot: 'lunch', recipeId: 'p1', name: 'Insalata', kcal: 700 },
    ]);
    expect(p.map((x) => x.recipeId)).toEqual(['c1', 'p1']);
    expect(p[0].forzatoPerche).toBeUndefined();
  });

  it('⚠️ riporta il motivo della forzatura scritto la volta scorsa', () => {
    const p = pastiGiaScritti([
      { slot: 'lunch', recipeId: 'p1', name: 'Insalata', scrittaAMano: { origine: 'nutrizionista', forzatoPerche: 'concordato con la cliente' } },
    ]);
    expect(p[0].forzatoPerche).toBe('concordato con la cliente');
  });

  /** ⛔ Non è un piatto che si è perso: è una riga che non ha mai indicato una ricetta. */
  it('⛔ un pasto senza recipeId non si legge e non si nomina', () => {
    expect(pastiGiaScritti([{ slot: 'lunch', name: 'Pasto libero' }, { recipeId: 'x' }])).toEqual([]);
  });

  it('⚠️ meals che non è un elenco non fa esplodere niente', () => {
    expect(pastiGiaScritti(null)).toEqual([]);
    expect(pastiGiaScritti({ meals: 'boh' })).toEqual([]);
  });
});

describe('riproporre la giornata', () => {
  const ATTESI = ['breakfast', 'lunch', 'dinner'];

  it('⛔ le righe portano il nome, le kcal e il verdetto di OGGI, non quelli scritti nel menu', () => {
    const esistenti = pastiGiaScritti([{ slot: 'breakfast', recipeId: 'c1', name: 'Come si chiamava allora', kcal: 1 }]);
    const { righe } = riproponiGiornata(
      esistenti,
      mappa(verdetto({ recipeId: 'c1', nome: 'Porridge', kcal: 420 })),
      ATTESI,
    );
    expect(righe).toEqual([expect.objectContaining({ slot: 'breakfast', recipeId: 'c1', nome: 'Porridge', kcal: 420 })]);
  });

  /**
   * ⛔ **È la conseguenza voluta della rilettura**: fra la scrittura e oggi la cliente può aver
   * dichiarato un'allergia. Il piatto torna barrato e il salvataggio resta fermo finché non c'è il
   * motivo — esattamente come se lo si fosse appena scelto.
   */
  it('⛔ un piatto diventato incompatibile torna BARRATO, col motivo di oggi', () => {
    const { righe } = riproponiGiornata(
      pastiGiaScritti([{ slot: 'lunch', recipeId: 'p1', name: 'Insalata di gamberi' }]),
      mappa(verdetto({ recipeId: 'p1', nome: 'Insalata di gamberi', slot: 'lunch', bloccata: true, motivoBlocco: 'contiene Crostacei (allergene dichiarato)' })),
      ATTESI,
    );
    expect(righe[0].bloccata).toBe(true);
    expect(righe[0].motivoBlocco).toBe('contiene Crostacei (allergene dichiarato)');
  });

  /**
   * ⛔ **Un motivo sotto un piatto che oggi non ha più niente contro sarebbe una forzatura
   * raccontata e mai avvenuta**, e finirebbe nel registro come tale.
   */
  it('⛔ il motivo torna solo se il piatto è ANCORA bloccato', () => {
    const esistenti = pastiGiaScritti([
      { slot: 'lunch', recipeId: 'p1', name: 'Insalata', scrittaAMano: { forzatoPerche: 'concordato con la cliente' } },
      { slot: 'dinner', recipeId: 'd1', name: 'Pollo', scrittaAMano: { forzatoPerche: 'lo mangia volentieri' } },
    ]);
    const { righe } = riproponiGiornata(
      esistenti,
      mappa(
        verdetto({ recipeId: 'p1', slot: 'lunch', bloccata: true, motivoBlocco: 'contiene Crostacei' }),
        verdetto({ recipeId: 'd1', slot: 'dinner', bloccata: false }),
      ),
      ATTESI,
    );
    expect(righe[0].forzatoPerche).toBe('concordato con la cliente');
    expect(righe[1].forzatoPerche).toBeUndefined();
  });

  it('⛔ la ricetta sparita dal catalogo si DICE, col nome che aveva', () => {
    const { righe, nonRiproposti } = riproponiGiornata(
      pastiGiaScritti([{ slot: 'dinner', recipeId: 'sparita', name: 'Vecchio pollo' }]),
      mappa(),
      ATTESI,
    );
    expect(righe).toEqual([]);
    expect(nonRiproposti).toEqual([{ slot: 'dinner', nome: 'Vecchio pollo', perche: 'non è più in catalogo' }]);
  });

  /** ⚠️ Un digiuno acceso, una dieta cambiata, uno spuntino tolto: `controllaGiornata` rifiuterebbe. */
  it('⚠️ un pasto che la sua giornata non ha più non si ripropone', () => {
    const { righe, nonRiproposti } = riproponiGiornata(
      pastiGiaScritti([{ slot: 'morning_snack', recipeId: 's1', name: 'Frutta secca' }]),
      mappa(verdetto({ recipeId: 's1', nome: 'Frutta secca', slot: 'morning_snack' })),
      ATTESI,
    );
    expect(righe).toEqual([]);
    expect(nonRiproposti[0].perche).toContain('non ha più questo pasto');
  });

  it('⚠️ la ricetta spostata di pasto in catalogo non si ripropone', () => {
    const { righe, nonRiproposti } = riproponiGiornata(
      pastiGiaScritti([{ slot: 'lunch', recipeId: 'p1', name: 'Insalata' }]),
      mappa(verdetto({ recipeId: 'p1', nome: 'Insalata', slot: 'dinner' })),
      ATTESI,
    );
    expect(righe).toEqual([]);
    expect(nonRiproposti[0].perche).toBe('in catalogo adesso è un piatto da dinner');
  });

  /**
   * ⛔ **Lo stesso cancello di `scrivi`, con la stessa eccezione**: dentro al pool il regime non si
   * richiede. Ripeterlo più stretto farebbe sparire dalla riproposta un piatto che il salvataggio
   * accetterebbe.
   */
  it('⛔ fuori dal paniere il regime non ammesso ferma; dentro al paniere no', () => {
    const { righe, nonRiproposti } = riproponiGiornata(
      pastiGiaScritti([
        { slot: 'dinner', recipeId: 'carne', name: 'Spezzatino' },
        { slot: 'lunch', recipeId: 'p1', name: 'Insalata' },
      ]),
      mappa(
        verdetto({ recipeId: 'carne', nome: 'Spezzatino', slot: 'dinner', nelPool: false, regimeAmmesso: false }),
        /** ⚠️ Nel pool e con il regime NON ammesso: si ripropone lo stesso, come la scrive `scrivi`. */
        verdetto({ recipeId: 'p1', nome: 'Insalata', slot: 'lunch', nelPool: true, regimeAmmesso: false }),
      ),
      ATTESI,
    );
    expect(righe.map((r) => r.recipeId)).toEqual(['p1']);
    expect(nonRiproposti[0].perche).toContain('regime');
  });

  it('⚠️ il piatto fuori dal paniere torna MARCHIATO fuori dal paniere', () => {
    const { righe } = riproponiGiornata(
      pastiGiaScritti([{ slot: 'breakfast', recipeId: 'fuori', name: 'Pancake' }]),
      mappa(verdetto({ recipeId: 'fuori', nome: 'Pancake', slot: 'breakfast', nelPool: false, regimeAmmesso: true })),
      ATTESI,
    );
    expect(righe[0].fuoriDalPaniere).toBe(true);
  });

  /**
   * ⛔ Riproposti tali e quali darebbero una schermata che **non si può salvare** («uno per pasto»,
   * «compare due volte») senza che si capisca da dove arriva.
   */
  it('⛔ due piatti sullo stesso pasto: si tiene il primo e si dice del secondo', () => {
    const { righe, nonRiproposti } = riproponiGiornata(
      pastiGiaScritti([
        { slot: 'lunch', recipeId: 'p1', name: 'Insalata' },
        { slot: 'lunch', recipeId: 'x1', name: 'Insalata due' },
      ]),
      mappa(
        verdetto({ recipeId: 'p1', nome: 'Insalata', slot: 'lunch' }),
        verdetto({ recipeId: 'x1', nome: 'Insalata due', slot: 'lunch' }),
      ),
      ATTESI,
    );
    expect(righe.map((r) => r.recipeId)).toEqual(['p1']);
    expect(nonRiproposti[0].perche).toContain('si tiene il primo');
  });

  /**
   * ⛔ **L'altro doppione di `controllaGiornata` non arriva mai fin qui**, e questa prova serve a
   * dirlo: in catalogo una ricetta ha un solo `mealSlot`, quindi la seconda comparsa la ferma il
   * controllo dello **slot**, non un controllo sui doppioni. Un ramo in più sarebbe codice morto.
   */
  it('⛔ lo stesso piatto su due pasti lo ferma il controllo dello slot', () => {
    const { righe, nonRiproposti } = riproponiGiornata(
      pastiGiaScritti([
        { slot: 'lunch', recipeId: 'p1', name: 'Insalata' },
        { slot: 'dinner', recipeId: 'p1', name: 'Insalata' },
      ]),
      mappa(verdetto({ recipeId: 'p1', nome: 'Insalata', slot: 'lunch' })),
      ATTESI,
    );
    expect(righe.map((r) => r.slot)).toEqual(['lunch']);
    expect(nonRiproposti).toEqual([{ slot: 'dinner', nome: 'Insalata', perche: 'in catalogo adesso è un piatto da lunch' }]);
  });
});
