/**
 * ⛔ **IN TUTTE LE CHAT LA ✕: CHI SCRIVE PUÒ CANCELLARE.**
 *
 * Simone, 21/8. È la **terza** volta che questa regola viene chiesta, e le tre volte raccontano il
 * difetto meglio di qualunque spiegazione:
 *
 *  - **11/8** — «chi scrive il messaggio deve poterlo cancellare». Scritta nella scheda cliente del
 *    backoffice, dov'era nata la richiesta.
 *  - **21/8, mattina** — «metti la x piccola per cancellare i messaggi». Perché la stessa
 *    conversazione si legge **anche** dalla pagina Chat, e là non c'era.
 *  - **21/8, poco dopo** — «allora in tutte le chat mettiamo la x». Perché di chat, in questo
 *    prodotto, ce ne sono **quattro**: due nel backoffice e due nell'app.
 *
 * ⚠️ Nessuna delle tre volte Simone aveva cambiato idea: la regola era sempre la stessa, e ogni volta
 * era stata scritta **solo dove era stata chiesta**. Il difetto non è la ✕ mancante — è che una
 * regola sul prodotto viveva in un pezzo di prodotto solo, e non c'era nessuna schermata da cui si
 * vedessero tutte e quattro.
 *
 * Questo test è la risposta a quel difetto: non «c'è la ✕ qui», ma **«chi mostra dei messaggi la
 * offre»**, verificato su tutte le schermate insieme. Il gemello per il backoffice sta in
 * `backoffice/src/components/cancellaMessaggio.spec.ts`.
 */
import { describe, expect, it } from 'vitest';

const SORGENTI: Record<string, string> = {
  ...import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../pages/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../staff/**/*.tsx', { query: '?raw', import: 'default', eager: true }),
};

/** ⚠️ Via i commenti: questo file e le note delle chat **nominano** tutto quello che cerco. */
const senzaCommenti = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

/** Chi legge i messaggi di un thread. */
const MOSTRA_MESSAGGI = /\/threads\/[^`'"]*\/messages/;
/** L'attrezzo che definisce il gesto: non è una schermata. */
const ATTREZZO = /export\s+function\s+useCancellaMessaggio\b/;
/** ⚠️ Chi **scrive** e basta non mostra niente: la ✕ riguarda chi disegna delle bolle. */
const DISEGNA_BOLLE = /\.map\(\s*\(?\s*m\b/;

const FILE = Object.entries(SORGENTI);
const chat = FILE.filter(([, s]) => {
  const t = senzaCommenti(s);
  return MOSTRA_MESSAGGI.test(t) && DISEGNA_BOLLE.test(t) && !ATTREZZO.test(t);
});

describe('⛔ la ✕ in tutte le chat dell\'app', () => {
  it('i sorgenti ci sono, e le chat che mostrano messaggi sono più di una', () => {
    expect(FILE.length).toBeGreaterThan(20);
    expect(chat.length).toBeGreaterThanOrEqual(2);
  });

  it('⛔ ognuna offre la ✕ per cancellare i propri', () => {
    const senza = chat
      .filter(([, s]) => !/<CancellaMessaggio\b/.test(senzaCommenti(s)))
      .map(([nome]) => nome);
    expect(senza).toEqual([]);
  });

  it('⛔ e ognuna usa il gancio condiviso, invece di riscriverselo', () => {
    const senza = chat
      .filter(([, s]) => !/useCancellaMessaggio\s*\(/.test(senzaCommenti(s)))
      .map(([nome]) => nome);
    expect(senza).toEqual([]);
  });

  /**
   * ⛔ Nessuna se lo riscrive di fianco: se la chiamata di cancellazione ricompare in una schermata,
   * con lei tornano la conferma, il messaggio d'errore e la regola su chi può cancellare — che a
   * quel punto sono due, e divergono.
   */
  it('⛔ nessuna chiama la DELETE dei messaggi per conto suo', () => {
    const CANCELLA = /\/threads\/[^`'"\n]*\/messages\/[^)]{0,160}method:\s*'DELETE'/;
    const fatte = chat.filter(([, s]) => CANCELLA.test(senzaCommenti(s))).map(([nome]) => nome);
    expect(fatte).toEqual([]);
  });

  /**
   * ⛔ **La ✕ ha bisogno di `position: relative` sulla bolla**, o si posiziona sull'angolo della
   * pagina invece che su quello del messaggio: un pulsante rosso che galleggia in alto a destra
   * sopra tutta la chat, e che cancella un messaggio a caso. È il tipo di difetto che non dà nessun
   * errore — disegna, e basta.
   */
  it('⛔ le bolle sono `relative`, o la ✕ finisce fuori dal messaggio', () => {
    const senza = chat
      .filter(([, s]) => !/position:\s*'relative'/.test(senzaCommenti(s)))
      .map(([nome]) => nome);
    expect(senza).toEqual([]);
  });
});

/**
 * ⛔ **CHI NON HA SCRITTO NIENTE NON CANCELLA NIENTE.**
 *
 * La regola vera sta nel backend (`chat.service.eliminaMessaggio`: solo l'autore, 403 per tutti gli
 * altri) e questa è la sua faccia. ⚠️ Ma la faccia conta: una ✕ che compare su un messaggio altrui
 * promette una cosa che poi non succede, e chi ci clicca riceve un errore per un gesto che gli era
 * stato offerto.
 *
 * ⚠️ **Gaia** non ha un `senderUserId`: i suoi messaggi non sono di nessuno, e non si cancellano.
 * Cade da sé dalla stessa condizione, ed è giusto — toglierli dalla conversazione toglierebbe metà
 * del filo del discorso.
 */
describe('⛔ la ✕ compare solo sui propri messaggi', () => {
  const attrezzo = senzaCommenti(SORGENTI['./cancellaMessaggio.tsx'] ?? '');

  it('l\'attrezzo c\'è', () => {
    expect(attrezzo).not.toBe('');
  });

  it('⛔ «è mio» confronta l\'autore del messaggio con chi sta guardando', () => {
    expect(attrezzo).toMatch(/m\.senderUserId\s*===\s*user\.id/);
  });

  /**
   * ⛔ **Senza `senderUserId` la risposta è NO.** Se quel campo mancasse dalla risposta del server —
   * per un `select` aggiunto domani — un confronto scritto male (`undefined === undefined`) direbbe
   * «è tuo» su **ogni** messaggio, Gaia compresa. Nel dubbio non si offre di cancellare.
   */
  it('⛔ senza l\'autore non si offre di cancellare', () => {
    expect(attrezzo).toMatch(/!!m\.senderUserId/);
  });
});
