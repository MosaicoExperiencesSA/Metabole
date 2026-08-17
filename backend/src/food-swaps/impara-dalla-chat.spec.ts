/**
 * «Gaia dovrebbe leggere anche le chat del nutrizionista ed apprendere anche da lì le
 * sostituzioni» (Simone, 12/8).
 *
 * Il primo blocco è quello che conta: in italiano le due forme dicono la stessa cosa con i pezzi
 * invertiti, e capirla al contrario produce una regola perfettamente formata e rovesciata.
 */
import { daScartare, nomeAlimento, sostituzioniNelMessaggio } from './impara-dalla-chat';

const una = (t: string) => {
  const r = sostituzioniNelMessaggio(t);
  expect(r).toHaveLength(1);
  return r[0];
};
const nessuna = (t: string) => expect(sostituzioniNelMessaggio(t)).toEqual([]);

describe('⚠️ la direzione', () => {
  it('«sostituisci il pollo con il tacchino» → esce il pollo, entra il tacchino', () => {
    const s = una('Sostituisci il pollo con il tacchino.');
    expect(s.from).toMatch(/pollo/i);
    expect(s.to).toMatch(/tacchino/i);
  });

  it('⚠️ «il tacchino al posto del pollo» dice la STESSA cosa, coi pezzi invertiti', () => {
    // Se questo test cade al contrario, la regola imparata è rovesciata — e una regola rovesciata
    // non sembra sbagliata a nessuno finché non arriva nel piatto di qualcuno.
    const s = una('Puoi mangiare il tacchino al posto del pollo.');
    expect(s.from).toMatch(/pollo/i);
    expect(s.to).toMatch(/tacchino/i);
  });

  it('«invece di» si comporta come «al posto di»', () => {
    const s = una('Prendi le gallette invece del pane.');
    expect(s.from).toMatch(/pane/i);
    expect(s.to).toMatch(/gallette/i);
  });

  it('«in alternativa a» pure', () => {
    const s = una('Il tofu in alternativa alla ricotta.');
    expect(s.from).toMatch(/ricotta/i);
    expect(s.to).toMatch(/tofu/i);
  });

  it('«sostituire X con Y» all\'infinito', () => {
    const s = una('Puoi sostituire il latte vaccino con la bevanda di soia.');
    expect(s.from).toMatch(/latte/i);
    expect(s.to).toMatch(/soia/i);
  });

  it('«cambia X con Y»', () => {
    const s = una('Cambia la pasta con il riso.');
    expect(s.from).toMatch(/pasta/i);
    expect(s.to).toMatch(/riso/i);
  });
});

describe('⚠️ quello che NON si impara', () => {
  it('una domanda non è un\'istruzione', () => {
    // La stessa frase, col punto di domanda, vuol dire il contrario: è la CLIENTE che chiede.
    nessuna('Posso sostituire il pane con le gallette?');
    nessuna('Vuoi il tacchino al posto del pollo?');
  });

  it('⚠️ una negazione è l\'esatto rovescio', () => {
    nessuna('Non sostituire il pane con le gallette.');
    nessuna('Mai il tacchino al posto del pollo.');
    nessuna('Evita di sostituire il riso con la pasta.');
  });

  it('un\'ipotesi non è una decisione', () => {
    nessuna('Se volessi potresti sostituire il pane con le gallette.');
    nessuna('Magari il tofu al posto della ricotta, ne parliamo.');
  });

  it('⚠️ i pasti e i giorni non sono alimenti', () => {
    // «Al posto della cena mangia solo frutta» parla di come organizzare la giornata.
    nessuna('Al posto della cena prendi solo frutta.');
    nessuna('Facciamo la visita giovedì al posto di domani.');
  });

  it('⚠️ un pronome non dice niente a chi legge dopo', () => {
    nessuna('Puoi usare il tacchino al posto di quello.');
    nessuna('Sostituisci quella con questa.');
  });

  it('lo stesso alimento da tutte e due le parti non è una sostituzione', () => {
    nessuna('Sostituisci le carote con le carote.');
    // Anche al singolare/plurale: la chiave è la stessa.
    nessuna('La carota al posto delle carote.');
  });

  it('un messaggio normale non contiene sostituzioni', () => {
    nessuna('Ciao Patrizia, ho visto le misure di questa settimana: stai andando bene. Continua così! 💚');
    nessuna('Ci vediamo martedì alle 10 per la visita di controllo.');
  });

  it('il messaggio vuoto non fa cadere niente', () => {
    nessuna('');
    expect(sostituzioniNelMessaggio(undefined as never)).toEqual([]);
  });
});

describe('il nome dell\'alimento', () => {
  it('perde l\'articolo e tiene il resto', () => {
    expect(nomeAlimento('  il pollo ')).toBe('pollo');
    expect(nomeAlimento("l'olio di oliva")).toBe('olio di oliva');
  });

  it('⚠️ si ferma alla prima congiunzione: dopo comincia un\'altra frase', () => {
    // «...con le gallette e bevi più acqua» non è un alimento che si chiama «gallette e bevi
    // più acqua».
    expect(nomeAlimento('le gallette e bevi più acqua')).toBe('gallette');
  });

  it('non si allunga oltre quattro parole', () => {
    expect(nomeAlimento('petto di pollo alla piastra ben cotto senza pelle')!.split(' ')).toHaveLength(4);
  });

  it('quello che resta troppo corto o vuoto non è un nome', () => {
    expect(nomeAlimento('')).toBeNull();
    expect(nomeAlimento('il')).toBeNull();
    expect(nomeAlimento('lo x')).toBeNull();
  });
});

describe('dentro un messaggio vero', () => {
  it('⚠️ prende la frase giusta e lascia stare il resto', () => {
    const s = una(
      'Ciao Patrizia! Ho guardato il diario di questa settimana. ' +
        'Sostituisci il latte con la bevanda di soia, che ti resta più leggera. ' +
        'Per il resto va benissimo così, ci sentiamo martedì.',
    );
    expect(s.from).toMatch(/latte/i);
    expect(s.to).toMatch(/soia/i);
    // ⚠️ La frase esatta si conserva: è quello che permette di confermare senza aprire la chat.
    expect(s.frase).toContain('Sostituisci il latte');
  });

  it('due sostituzioni in due frasi diventano due righe', () => {
    const r = sostituzioniNelMessaggio(
      'Sostituisci il pollo con il tacchino. E prendi le gallette invece del pane.',
    );
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.from.toLowerCase())).toEqual(expect.arrayContaining([
      expect.stringContaining('pollo'),
      expect.stringContaining('pane'),
    ]));
  });

  it('la stessa sostituzione ripetuta due volte resta una', () => {
    const r = sostituzioniNelMessaggio('Sostituisci il pollo con il tacchino. Ricorda: tacchino al posto del pollo.');
    expect(r).toHaveLength(1);
  });

  it('⚠️ una frase mista non contagia le altre', () => {
    // La negazione vale per la SUA frase, non per tutto il messaggio: altrimenti un «non
    // preoccuparti» in apertura cancellerebbe l'istruzione che viene dopo.
    const s = una('Non preoccuparti per il peso. Sostituisci il pollo con il tacchino.');
    expect(s.from).toMatch(/pollo/i);
  });

  it('la coda della frase rovesciata non si porta dietro il verbo', () => {
    const s = una('Ti consiglio il tacchino al posto del pollo.');
    expect(s.to.toLowerCase()).toBe('tacchino');
  });
});

describe('daScartare', () => {
  it('riconosce domande, negazioni e ipotesi', () => {
    expect(daScartare('Posso sostituire il pane?')).toBe(true);
    expect(daScartare('Non sostituire il pane con altro')).toBe(true);
    expect(daScartare('Potresti sostituire il pane')).toBe(true);
    expect(daScartare('Sostituisci il pane con le gallette')).toBe(false);
  });

  it('⚠️ «non» dentro un\'altra parola non conta', () => {
    // «nonna», «annona»: senza il confine di parola, mezza lingua italiana diventa una negazione.
    expect(daScartare('Sostituisci il pane della nonna con le gallette')).toBe(false);
  });
});

/**
 * I REFUSI SUL VERBO — segnalazione di Simone, 17/8.
 *
 * Ha scritto «a jolanda **sostitusci** ceci con fagioli» e Vera ha risposto «non ci arrivo». Con la
 * parola scritta giusta la stessa frase veniva capita: a farla cadere è stata **una lettera**.
 *
 * ⚠️ Chi detta a un assistente scrive di corsa. Un riconoscitore che pretende l'ortografia perfetta
 * del verbo non sta chiedendo precisione: sta chiedendo di essere trattato come un modulo, e la
 * persona dall'altra parte impara che «non funziona» invece che «ho sbagliato a scrivere».
 *
 * ⚠️ Ma la radice si ferma prima di `sostituzione`: «la sostituzione di X con Y» è un RESOCONTO, non
 * un ordine, e leggerlo come istruzione vorrebbe dire scrivere nel piatto di qualcuno una cosa che
 * nessuno ha chiesto adesso.
 */
describe('sostituzioniNelMessaggio — i refusi sul verbo', () => {
  it('«sostitusci» (la i mangiata) si capisce', () => {
    expect(sostituzioniNelMessaggio('sostitusci i ceci con i fagioli')).toMatchObject([{ from: 'ceci', to: 'fagioli' }]);
  });

  it('«sostituisi» (la c mangiata) si capisce', () => {
    expect(sostituzioniNelMessaggio('sostituisi i ceci con i fagioli')).toMatchObject([{ from: 'ceci', to: 'fagioli' }]);
  });

  it('le forme giuste continuano a valere', () => {
    for (const v of ['sostituisci', 'sostituire', 'sostituiscilo']) {
      expect(sostituzioniNelMessaggio(`${v} i ceci con i fagioli`)).toMatchObject([{ from: 'ceci', to: 'fagioli' }]);
    }
  });

  it('⚠️ «la sostituzione di X con Y» NON è un ordine: è un resoconto', () => {
    expect(sostituzioniNelMessaggio('la sostituzione dei ceci con i fagioli è andata bene')).toEqual([]);
  });
});
