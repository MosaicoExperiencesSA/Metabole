import {
  pastiPromessiCheMancano,
  pastiPromessiDallaFinestra,
  strutturaPerFinestra,
} from './struttura-per-digiuno';
import { FINESTRE_DIGIUNO } from '../menu/finestre-digiuno';
import { pastiAttesi } from './giornate-complete';

/**
 * Il caso vero: Sonia, finestra «salto la cena», riceveva **un pasto al
 * giorno**. Il catalogo digiuno ha tre slot fissi — pranzo, merenda, cena — e la finestra togliendo
 * cena e merenda le lasciava il solo pranzo.
 *
 * Questi test guardano la REGOLA, non l'elenco delle finestre: «si serve un catalogo che abbia i
 * pasti che la finestra promette». È il motivo per cui le tre finestre che oggi funzionano non si
 * spostano — e non si spostano perché la regola lo dice, non perché le ho elencate a mano.
 */
describe('strutturaPerFinestra — il catalogo lo decide la finestra', () => {
  it('⚠️ «salto la cena» (il caso Sonia): non basta il digiuno, serve il catalogo a 5 pasti', () => {
    // Promette colazione, spuntino e pranzo. Il catalogo digiuno non ha né colazione né spuntino:
    // le restava il solo pranzo, il 45% delle kcal, e non lo segnalava niente.
    expect(pastiPromessiDallaFinestra('skip_dinner')).toEqual(['breakfast', 'morning_snack', 'lunch']);
    expect(strutturaPerFinestra('skip_dinner')).toEqual({ mealsPerDay: 5, fasting: false });
  });

  it('«salto il pranzo»: colazione e spuntino non sono nel digiuno → 5 pasti', () => {
    expect(strutturaPerFinestra('skip_lunch')).toEqual({ mealsPerDay: 5, fasting: false });
  });

  it('⚠️ «salto la colazione» NON si muove: le sue kcal sono giuste solo nel catalogo digiuno', () => {
    // È la finestra delle cinque clienti che oggi stanno bene. Nel digiuno pranzo, merenda e cena
    // valgono il 100% della giornata; nel 5 pasti lo stesso pasto vale il 70%. Spostarle vorrebbe
    // dire togliere un terzo delle calorie a chi non ha nessun problema, in silenzio.
    expect(strutturaPerFinestra('skip_breakfast')).toEqual({ fasting: true });
    expect(strutturaPerFinestra('skip_breakfast')).not.toHaveProperty('mealsPerDay');
  });

  it('le altre due finestre strette restano sul digiuno: i pasti che promettono ci sono già', () => {
    // «solo cena» → merenda e cena; «finestra al mattino» → pranzo. Tutti dentro il catalogo digiuno.
    expect(strutturaPerFinestra('skip_breakfast_lunch')).toEqual({ fasting: true });
    expect(strutturaPerFinestra('skip_dinner_breakfast')).toEqual({ fasting: true });
  });

  it('⚠️ finestra non impostata o sconosciuta: si resta sul digiuno, come oggi', () => {
    // Maria è in digiuno senza finestra: nessuno gliel'ha chiesta. Darle la giornata intera a 5
    // pasti vorrebbe dire toglierle il digiuno senza dirglielo, per una domanda mancata.
    expect(strutturaPerFinestra(null)).toEqual({ fasting: true });
    expect(strutturaPerFinestra(undefined)).toEqual({ fasting: true });
    expect(strutturaPerFinestra('')).toEqual({ fasting: true });
    expect(strutturaPerFinestra('finestra_inventata')).toEqual({ fasting: true });
  });

  it('la scelta non è un elenco di finestre: si decide contando i pasti', () => {
    // Prova generale della regola su tutte le finestre in tabella: il catalogo scelto contiene
    // sempre tutti i pasti promessi. Se domani si aggiunge una riga a `FINESTRE_DIGIUNO`, questo
    // test la copre da solo — ed è il punto.
    for (const f of FINESTRE_DIGIUNO) {
      const scelta = strutturaPerFinestra(f.valore) as { mealsPerDay?: number; fasting?: boolean };
      const inCatalogo = pastiAttesi({ mealsPerDay: scelta.mealsPerDay ?? 3, fasting: !!scelta.fasting });
      for (const promesso of pastiPromessiDallaFinestra(f.valore)) {
        expect(inCatalogo).toContain(promesso);
      }
    }
  });
});

/**
 * La rete che rende visibile quello che resta aperto: se in catalogo la variante a 5 pasti di quella
 * famiglia non c'è, l'ultimo ripiego di `pickDietFor` serve comunque una dieta digiuno e la cliente
 * torna a un pasto al giorno. Prima non lo diceva nessuno.
 */
describe('pastiPromessiCheMancano — il buco che resta, detto ad alta voce', () => {
  const DIGIUNO = { mealsPerDay: 3, fasting: true };
  const CINQUE = { mealsPerDay: 5, fasting: false };

  it('⚠️ «salto la cena» servita con una dieta digiuno: mancano colazione e spuntino', () => {
    expect(pastiPromessiCheMancano('intermittent_fasting', 'skip_dinner', DIGIUNO)).toEqual([
      'breakfast',
      'morning_snack',
    ]);
  });

  it('la stessa cliente sul catalogo a 5 pasti: non manca niente', () => {
    expect(pastiPromessiCheMancano('intermittent_fasting', 'skip_dinner', CINQUE)).toEqual([]);
  });

  it('chi non digiuna non riguarda questo controllo', () => {
    // Un percorso normale non promette niente sui pasti: quelli li decide la dieta, e una dieta a
    // 3 pasti non è un difetto.
    expect(pastiPromessiCheMancano('five', 'skip_dinner', { mealsPerDay: 3, fasting: false })).toEqual([]);
    expect(pastiPromessiCheMancano(null, null, DIGIUNO)).toEqual([]);
  });

  it('digiuno senza finestra: nessuna promessa, quindi niente da segnalare', () => {
    // ⚠️ Questa riga difende Maria da un falso allarme: «dovrebbe ricevere tutti e cinque i pasti»
    // è una frase che nessuno le ha detto.
    expect(pastiPromessiCheMancano('intermittent_fasting', null, DIGIUNO)).toEqual([]);
  });
});
