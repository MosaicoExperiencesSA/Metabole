/**
 * ⛔ **CHI MOSTRA I MESSAGGI DI UNA CONVERSAZIONE, OFFRE LA ✕ PER CANCELLARE I PROPRI.**
 *
 * Questa regola nasce due volte, ed è il motivo per cui c'è un test.
 *
 * L'**11/8** Simone ha chiesto: *«chi scrive il messaggio deve poterlo cancellare»*. È stata scritta
 * nella scheda cliente, dov'era nata la richiesta.
 *
 * Il **21/8** l'ha richiesta di nuovo — *«metti la x piccola per cancellare i messaggi»* — e non
 * perché se ne fosse dimenticato: perché la **stessa conversazione** si legge da **due schermate**, e
 * la ✕ ce l'aveva una sola. Chi lavora dalla pagina Chat non poteva cancellare niente, e non aveva
 * modo di sapere che da un'altra parte si poteva. Dieci giorni, e nessuno se n'era accorto: non c'è
 * nessuna schermata da cui si vedano tutte e due.
 *
 * ⚠️ Il difetto non è la ✕ mancante: è che una regola sul comportamento del prodotto viveva in **un
 * punto solo di due**. Rifarla a mano nella seconda schermata l'avrebbe rimessa nella stessa
 * situazione, con una copia in più da tenere allineata. Perciò il gesto è estratto, e questo test
 * tiene fermo che chi mostra i messaggi lo usi.
 *
 * ## Cosa guarda
 *
 * Il **sorgente**, come `pages/frecce-anche-in-cima.spec.ts`: «questa schermata offre la ✕» è una
 * riga di JSX, non un comportamento provabile senza montare due schermate intere con i loro dati
 * finti — e due finti sarebbero due occasioni di provare qualcosa che non è la schermata vera.
 */
import { describe, expect, it } from 'vitest';

const SORGENTI: Record<string, string> = {
  ...import.meta.glob('../pages/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }),
};

/** ⚠️ Via i commenti: questo file e le note delle due schermate **nominano** tutto quello che cerco. */
const senzaCommenti = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');

/** Chi legge i messaggi di un thread: `/threads/<qualcosa>/messages`. */
const MOSTRA_MESSAGGI = /\/threads\/[^`'"]*\/messages/;
/** Chi definisce il gesto — l'attrezzo, non una schermata. */
const ATTREZZO = /export\s+function\s+useCancellaMessaggio\b/;

const FILE = Object.entries(SORGENTI);
const schermate = FILE.filter(([, s]) => {
  const t = senzaCommenti(s);
  return MOSTRA_MESSAGGI.test(t) && !ATTREZZO.test(t);
});

describe('⛔ la ✕ per cancellare un proprio messaggio: in tutte le schermate che li mostrano', () => {
  it('i sorgenti ci sono, e le schermate che mostrano i messaggi sono più di una', () => {
    expect(FILE.length).toBeGreaterThan(20);
    // ⚠️ Più di una: se fosse una sola, questa regola non avrebbe motivo di esistere — e il giorno
    // che ne nasce una seconda, chi la scrive deve trovare questo test già acceso.
    expect(schermate.length).toBeGreaterThanOrEqual(2);
  });

  it('⛔ ognuna usa il gesto condiviso, invece di riscriverselo', () => {
    const senza = schermate
      .filter(([, s]) => !/useCancellaMessaggio\s*\(/.test(senzaCommenti(s)))
      .map(([nome]) => nome);
    expect(senza).toEqual([]);
  });

  /**
   * ⛔ E nessuna se lo riscrive di fianco. Si cerca la **chiamata di cancellazione a mano**: se
   * ricompare in una schermata, vuol dire che qualcuno ha rifatto il giro — e con lui la conferma,
   * il messaggio d'errore e la regola su chi può cancellare, che a quel punto sono due.
   */
  it('⛔ nessuna schermata chiama la DELETE dei messaggi per conto suo', () => {
    /**
     * ⚠️ **La DELETE dei MESSAGGI, non una DELETE qualsiasi.** La prima stesura cercava
     * `method: 'DELETE'` e basta: si accendeva su «elimina cliente» e «elimina nota», che sono altre
     * due cose legittime nella stessa schermata. Un test che grida al lupo su codice giusto insegna a
     * ignorarlo — e questo doveva proteggere proprio dal «tanto lo so io com'è».
     */
    const CANCELLA_MESSAGGIO = /\/threads\/[^`'"\n]*\/messages\/[^)]{0,160}method:\s*'DELETE'/;
    const fatte = schermate
      .filter(([, s]) => CANCELLA_MESSAGGIO.test(senzaCommenti(s)))
      .map(([nome]) => nome);
    expect(fatte).toEqual([]);
  });
});

/**
 * ⛔ **IL CAMPO DI SCRITTURA DELLA CHAT: QUATTRO RIGHE, E L'INVIO VA A CAPO.**
 *
 * Simone, 21/8: *«il campo di scrittura fallo di 4 righe»*. Era un `<input>` a riga singola, e chi
 * risponde a una domanda clinica scrive dieci righe: le rileggeva due parole alla volta dentro una
 * feritoia che scorre. Un campo che non fa vedere quello che si è scritto è un campo che fa mandare
 * messaggi non riletti.
 *
 * ⛔ **E con quattro righe l'Invio non può più spedire**, che è la metà che si dimentica. Prima
 * `Enter` mandava, ed era coerente con una riga sola. Su un campo che serve ad andare a capo,
 * mandare a capo spedirebbe il messaggio **a metà** — e in una conversazione con una paziente il
 * mezzo messaggio resta lì, letto. Le due cose vanno insieme o la seconda fa danno.
 */
describe('⛔ la chat si scrive su quattro righe, e l\'Invio va a capo', () => {
  const chat = senzaCommenti(SORGENTI['../pages/Chat.tsx'] ?? '');

  it('il file c\'è', () => {
    expect(chat).not.toBe('');
  });

  it('⛔ è una `textarea` di quattro righe, non un campo a riga singola', () => {
    expect(chat).toMatch(/<textarea/);
    expect(chat).toMatch(/rows=\{4\}/);
  });

  /**
   * ⚠️ Si guarda che l'`Enter` **nudo** non spedisca: quello con ⌘/Ctrl sì, ed è la scorciatoia di
   * chi scrive molto. La forma cercata è quella che distingue i due — se sparisse il modificatore,
   * si tornerebbe a spedire a ogni a capo.
   */
  it('⛔ l\'Invio nudo NON spedisce: serve ⌘/Ctrl + Invio', () => {
    const conModificatore = /e\.key === 'Enter' && \(e\.(metaKey|ctrlKey) \|\| e\.(metaKey|ctrlKey)\)/.test(chat);
    expect(conModificatore, 'l\'Invio è tornato a spedire da solo').toBe(true);
  });

  /** ⚠️ E il bottone resta: la scorciatoia è una scorciatoia, non l'unico modo di mandare. */
  it('⚠️ il bottone «Invia» c\'è ancora', () => {
    expect(chat).toMatch(/Invia/);
  });
});
