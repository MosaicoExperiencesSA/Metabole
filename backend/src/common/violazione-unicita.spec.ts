import { eViolazioneUnicita } from './violazione-unicita';

/**
 * L'IDEMPOTENZA DEL RINNOVO SI APPOGGIA A QUESTA FUNZIONE (12/8).
 *
 * Se un giorno smettesse di riconoscere il codice giusto, il difetto non si vedrebbe: il duplicato
 * passerebbe e nessuno se ne accorgerebbe finché qualcuno non confronta i compensi con gli incassi.
 * Per questo il caso «errore diverso» è importante quanto quello positivo — inghiottire un errore
 * vero credendolo un duplicato è il modo peggiore di sbagliare qui.
 */
describe('eViolazioneUnicita', () => {
  it('riconosce il codice di Prisma', () => {
    expect(eViolazioneUnicita({ code: 'P2002' })).toBe(true);
  });

  it('riconosce anche il codice nativo di PostgreSQL (query raw, errori non tradotti)', () => {
    expect(eViolazioneUnicita({ code: '23505' })).toBe(true);
  });

  it('un errore QUALSIASI non è un duplicato: deve risalire, non essere scambiato per «già fatto»', () => {
    expect(eViolazioneUnicita({ code: 'P2025' })).toBe(false); // riga non trovata
    expect(eViolazioneUnicita({ code: '23503' })).toBe(false); // chiave esterna
    expect(eViolazioneUnicita(new Error('connessione caduta'))).toBe(false);
    expect(eViolazioneUnicita('P2002')).toBe(false); // una stringa non è un errore
  });

  it('niente e valori strani non fanno cadere il controllo', () => {
    expect(eViolazioneUnicita(null)).toBe(false);
    expect(eViolazioneUnicita(undefined)).toBe(false);
    expect(eViolazioneUnicita({})).toBe(false);
    expect(eViolazioneUnicita({ code: 2002 })).toBe(false); // numero, non stringa
  });
});
