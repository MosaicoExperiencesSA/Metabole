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

/**
 * ⛔ **I CINQUE PROTOCOLLI CONTRO IL CATALOGO — la tabella che dice chi è servibile e chi no.**
 *
 * Da quando c'è l'orologio la finestra la sposta la cliente, con un tocco, dall'app. Quindi «questa
 * cliente è a posto» non è più una proprietà del suo profilo: è una proprietà di **tutti e cinque i
 * protocolli** che può scegliere domattina.
 *
 * ⚠️ Questa tabella è anche la prova che il ramo «finestra» di `scostamento-dieta.ts` non è un falso
 * allarme: la prima stesura confrontava *quanti* pasti la finestra promette con la *struttura* del
 * catalogo servito — due scale diverse — e si accendeva su quattro protocolli su cinque. Qui si
 * verifica quello che conta davvero: **quali** pasti mancano.
 */
describe('⛔ i cinque protocolli contro le due strutture di catalogo', () => {
  const DIGIUNO = { mealsPerDay: 3, fasting: true };
  const CINQUE = { mealsPerDay: 5, fasting: false };
  const mancanti = (finestra: string, dieta: { mealsPerDay: number; fasting: boolean }) =>
    pastiPromessiCheMancano('intermittent_fasting', finestra, dieta);

  /**
   * ⛔ La sola 14:10 esce dal catalogo digiuno, e le manca **la colazione**. È il buco di Antonella:
   * la sua famiglia ha solo la variante `fasting`, e la variante a 5 pasti non è nemmeno generabile
   * dal backoffice.
   */
  it('⛔ 14:10 sul catalogo digiuno: manca la colazione', () => {
    expect(mancanti('skip_morning_snack', DIGIUNO)).toEqual(['breakfast']);
  });

  it('⚠️ e con la variante a 5 pasti la 14:10 è servita: non manca niente', () => {
    expect(mancanti('skip_morning_snack', CINQUE)).toEqual([]);
  });

  /**
   * ⛔ **Gli altri tre protocolli NON hanno buchi di pasti**, ed è la cosa che la prima stesura del
   * confronto sbagliava: 18:6 e 20:4 promettono pranzo e cena, 23:1 la sola cena — e il catalogo
   * digiuno (pranzo, merenda, cena) le contiene tutte. Che poi il motore ne tolga qualcuna è il suo
   * mestiere, non una mancanza. ⚠️ Restano corte di **calorie**, che è un'altra domanda e ha un'altra
   * diagnostica (`diag:kcal`).
   */
  it.each([
    ['16:8', 'skip_breakfast'],
    ['18:6 e 20:4', 'skip_breakfast_and_snacks'],
    ['23:1', 'skip_all_but_dinner'],
  ])('⚠️ %s sul catalogo digiuno: nessun pasto mancante', (_titolo, finestra) => {
    expect(mancanti(finestra, DIGIUNO)).toEqual([]);
  });

  /**
   * ⛔ **Chi non digiuna, e chi la finestra non l'ha impostata, non ha niente che manchi.** Sono i
   * due `[]` che tolgono di mezzo i falsi allarmi a monte, senza bisogno di guardie sparse nei
   * chiamanti — una guardia in più è una seconda regola da tenere allineata.
   */
  it.each([
    ['non digiuna', 'classic3', 'skip_breakfast'],
    ['digiuna ma non ha mai impostato la finestra', 'intermittent_fasting', null],
    ['finestra sconosciuta', 'intermittent_fasting', 'skip_qualcosa'],
  ])('⚠️ %s: elenco vuoto', (_titolo, pathType, finestra) => {
    expect(pastiPromessiCheMancano(pathType, finestra, DIGIUNO)).toEqual([]);
  });
});
