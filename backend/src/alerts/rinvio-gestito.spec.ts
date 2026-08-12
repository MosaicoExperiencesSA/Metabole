/**
 * «Gestito» è un rinvio, non una chiusura (Simone, 12/8).
 *
 * Il test che conta è il secondo: senza, una cliente che smette del tutto sparisce da ogni lista e
 * non ricompare mai — che è il contrario di quello per cui gli alert esistono.
 */
import { SOGLIA_GIORNI_DEFAULT, daRiaprire, type AlertRinviabile } from './rinvio-gestito';

const ADESSO = new Date('2026-08-12T10:00:00Z');
const giorniFa = (g: number) => new Date(ADESSO.getTime() - g * 86_400_000);

const alert = (a: Partial<AlertRinviabile> = {}): AlertRinviabile => ({
  id: 'a-1',
  type: 'checkin_skipped',
  status: 'handled',
  handledAt: giorniFa(10),
  ...a,
});

const VALE_ANCORA = new Set(['checkin_skipped']);

describe('il rinvio di «gestito»', () => {
  it('sono sette giorni, deciso da Simone il 12/8', () => {
    expect(SOGLIA_GIORNI_DEFAULT).toBe(7);
  });

  it('⚠️ dopo la soglia, un gestito che non ha risolto niente torna in lista', () => {
    // Senza questa riga la coach non lo rivede MAI più: sparisce dalla sua lista, da quella del
    // manager, e resta lì.
    expect(daRiaprire([alert()], VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual(['a-1']);
  });

  it('prima della soglia non torna: sta ancora lavorandoci', () => {
    expect(daRiaprire([alert({ handledAt: giorniFa(3) })], VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual([]);
  });

  it('esattamente a sette giorni torna: la soglia è inclusa', () => {
    expect(daRiaprire([alert({ handledAt: giorniFa(7) })], VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual(['a-1']);
  });

  it('⚠️ se la condizione è passata NON torna: sarebbe una persecuzione', () => {
    // La cliente ha ripreso a fare i check-in: l'alert non è più fra i desiderati e lo chiude la
    // via normale. Riaprirlo insegnerebbe alla coach che quella lista si può ignorare.
    expect(daRiaprire([alert()], new Set(), SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual([]);
  });

  it('⚠️ «inoltrato» non si tocca: è sulla lista di qualcun altro', () => {
    // Rimandarlo alla coach mentre il manager ci lavora vuol dire due persone sullo stesso
    // problema, ognuna convinta che sia dell'altra.
    const righe = [alert({ status: 'escalated' }), alert({ id: 'a-2', status: 'open' }), alert({ id: 'a-3', status: 'resolved' })];
    expect(daRiaprire(righe, VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual([]);
  });

  it('⚠️ senza `handledAt` non si riapre subito', () => {
    // Sono le righe gestite prima che la colonna esistesse: riaprirle tutte insieme riverserebbe
    // in lista l'arretrato di mesi il giorno del rilascio. La migrazione le valorizza; questa è la
    // difesa per quelle che sfuggissero.
    expect(daRiaprire([alert({ handledAt: null })], VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual([]);
  });

  it('una soglia storta torna a quella decisa, non azzera il pulsante', () => {
    // `0` vorrebbe dire «riapri subito», cioè un «gestito» che non gestisce niente.
    expect(daRiaprire([alert({ handledAt: giorniFa(8) })], VALE_ANCORA, 0, ADESSO)).toEqual(['a-1']);
    expect(daRiaprire([alert({ handledAt: giorniFa(3) })], VALE_ANCORA, -5, ADESSO)).toEqual([]);
    expect(daRiaprire([alert({ handledAt: giorniFa(8) })], VALE_ANCORA, NaN, ADESSO)).toEqual(['a-1']);
  });

  it('una soglia più lunga si rispetta', () => {
    expect(daRiaprire([alert({ handledAt: giorniFa(10) })], VALE_ANCORA, 14, ADESSO)).toEqual([]);
    expect(daRiaprire([alert({ handledAt: giorniFa(20) })], VALE_ANCORA, 14, ADESSO)).toEqual(['a-1']);
  });

  it('elenco vuoto, nessuna sorpresa', () => {
    expect(daRiaprire([], VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual([]);
  });

  it('più alert insieme: torna solo quello che deve', () => {
    const righe = [
      alert({ id: 'vecchio', type: 'checkin_skipped', handledAt: giorniFa(9) }),
      alert({ id: 'recente', type: 'checkin_skipped', handledAt: giorniFa(1) }),
      alert({ id: 'passato', type: 'weight_gain', handledAt: giorniFa(9) }),
    ];
    expect(daRiaprire(righe, VALE_ANCORA, SOGLIA_GIORNI_DEFAULT, ADESSO)).toEqual(['vecchio']);
  });
});
