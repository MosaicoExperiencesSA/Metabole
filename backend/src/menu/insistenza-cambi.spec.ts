/**
 * «Se la cliente insiste coi cambiamenti — cambia tutti i giorni — Gaia dovrebbe invitarla a
 * riflettere» (Simone, 12/8).
 *
 * I due test che contano di più sono quelli che dicono quando NON deve partire: sulle sostituzioni
 * decise dal motore per sicurezza, e su una richiesta sola che ne scrive trenta giornate.
 */
import { MealSnapshot } from './pasto-giornata';
import {
  FINESTRA_GIORNI,
  SOGLIA_GIORNI_DEFAULT,
  giorniConCambioDellaCliente,
  testoAvvisoCoach,
  testoInvitoARiflettere,
} from './insistenza-cambi';

const giorno = (iso: string, pasti: Partial<MealSnapshot>[]) => ({
  date: new Date(`${iso}T00:00:00.000Z`),
  meals: pasti as MealSnapshot[],
});

const conSostituzione = (origine?: 'chat' | 'app') => ({
  slot: 'lunch',
  recipeId: 'r1',
  name: 'Insalata di farro',
  kcal: 500,
  substitutions: [{ from: 'carote', to: 'zucchine', reason: 'gusto', ...(origine ? { origine } : {}) }],
});

// Il cambio di PIATTO nasce solo dalla chat: `CambioPiatto.origine` è `'chat'` e basta (il
// pulsante dell'app cambia ingredienti, non piatti). Il caso «deciso dal motore» qui non esiste —
// le sostituzioni di piatto dell'erogazione non scrivono nessun `cambioPiatto`.
const conCambioPiatto = () => ({
  slot: 'dinner',
  recipeId: 'r2',
  name: 'Minestrone',
  kcal: 400,
  cambioPiatto: {
    daRecipeId: 'r0',
    daNome: 'Zuppa',
    daKcal: 390,
    origine: 'chat' as const,
    stato: 'da_verificare' as const,
    concordataIl: '2026-08-12T10:00:00.000Z',
  },
});

describe('quando i cambi diventano un segnale', () => {
  describe('cosa si conta', () => {
    it('i GIORNI diversi, non il numero di cambi', () => {
      // Tre cambi in un giorno solo sono un martedì storto, non un'abitudine.
      const unGiornoSolo = [
        giorno('2026-08-10', [conSostituzione('chat'), conSostituzione('chat'), conSostituzione('app')]),
      ];
      expect(giorniConCambioDellaCliente(unGiornoSolo)).toBe(1);
    });

    it('conta sia la chat sia il pulsante dell\'app: è la stessa richiesta', () => {
      const giorni = [
        giorno('2026-08-10', [conSostituzione('chat')]),
        giorno('2026-08-11', [conSostituzione('app')]),
        giorno('2026-08-12', [conCambioPiatto()]),
      ];
      expect(giorniConCambioDellaCliente(giorni)).toBe(3);
    });

    it('⚠️ NON conta le sostituzioni del motore: quelle non le ha chieste lei', () => {
      // Sono i cambi di sicurezza per allergeni ed esclusioni. Contarli vorrebbe dire invitare a
      // riflettere una cliente allergica proprio sulle sostituzioni che la tengono al sicuro.
      const giorni = [
        giorno('2026-08-10', [conSostituzione(undefined)]),
        giorno('2026-08-11', [conSostituzione(undefined)]),
        giorno('2026-08-12', [conSostituzione(undefined)]),
      ];
      expect(giorniConCambioDellaCliente(giorni)).toBe(0);
    });

    it('una giornata senza cambi non conta, e i pasti vuoti non fanno cadere niente', () => {
      const giorni = [
        giorno('2026-08-10', [{ slot: 'lunch', recipeId: 'r1', name: 'x', kcal: 1 }]),
        { date: new Date('2026-08-11T00:00:00.000Z'), meals: null },
        { date: new Date('2026-08-12T00:00:00.000Z'), meals: [null, undefined] },
      ];
      expect(giorniConCambioDellaCliente(giorni as never)).toBe(0);
    });

    it('lo stesso giorno passato due volte resta un giorno', () => {
      const giorni = [giorno('2026-08-10', [conSostituzione('chat')]), giorno('2026-08-10', [conSostituzione('app')])];
      expect(giorniConCambioDellaCliente(giorni)).toBe(1);
    });
  });

  describe('la soglia', () => {
    it('è tre giorni su sette, deciso da Simone il 12/8', () => {
      expect(SOGLIA_GIORNI_DEFAULT).toBe(3);
      expect(FINESTRA_GIORNI).toBe(7);
    });
  });

  describe('il testo', () => {
    it('dice esplicitamente che i cambi NON la allontanano dall\'obiettivo', () => {
      // È la riga che sostituisce «ogni cambio ti allontana dal tuo obiettivo»: quella non era
      // vera per i cambi dentro gli equivalenti approvati, e il rischio non era che smettesse di
      // cambiare — era che smettesse di dircelo.
      const t = testoInvitoARiflettere('Patrizia', 3);
      expect(t).toContain('non ti allontanano dal tuo obiettivo');
      expect(t).not.toContain('ti allontana dal tuo obiettivo.');
    });

    it('invita a parlarne con la coach, e nomina la cliente', () => {
      const t = testoInvitoARiflettere('Patrizia', 4);
      expect(t).toContain('Patrizia');
      expect(t).toContain('confrontarti con la tua coach');
      expect(t).toContain('4 giorni di questa settimana');
    });

    it('senza nome resta una frase corretta', () => {
      expect(testoInvitoARiflettere(null, 3)).toContain('Una domanda, se posso.');
    });

    it('a sette giorni su sette non dice «7 giorni»: dice «ogni giorno»', () => {
      expect(testoInvitoARiflettere('Patrizia', 7)).toContain('ogni giorno di questa settimana');
    });

    it('l\'avviso alla coach dice il numero: senza, non sa di cosa parlerà', () => {
      const t = testoAvvisoCoach('Patrizia', 5);
      expect(t).toContain('Patrizia');
      expect(t).toContain('5 giorni su 7');
      expect(t).toContain('Gaia le ha proposto di parlarne con te');
    });
  });
});
