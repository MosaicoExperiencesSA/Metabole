import { describe, expect, it } from 'vitest';

const sorgenti = import.meta.glob('./MenuAMano.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const menu = sorgenti['./MenuAMano.tsx'] ?? '';

/**
 * ⚠️ **Il testo SENZA i commenti.** Le note di questo progetto citano le frasi vecchie per
 * spiegare perché sono state cambiate — «diceva "quello resta suo, non si riscrive"» — quindi un
 * `not.toContain` sul sorgente grezzo direbbe che la frase c'è ancora e sarebbe rosso su una prova
 * giusta. Qui si guarda quello che la persona legge, non quello che leggiamo noi.
 */
const senzaCommenti = menu
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((r) => !/^\s*(\/\/|\*)/.test(r))
  .join('\n');

/**
 * ⛔ **IL GIORNO CHE LA CLIENTE HA GIÀ APERTO SI RISCRIVE** — decisione di Simone, 8/9: *«il
 * nutrizionista sostituisce anche se il cliente ha già visto. vince su tutto»*.
 *
 * Fino all'8/9 la schermata faceva due cose, e tutte e due sbagliate rispetto a questa decisione:
 * **spegneva il pulsante** «Salva la giornata», e scriveva «quello resta suo, **non si riscrive**».
 *
 * ⚠️ La frase e il pulsante sono la stessa correzione, non due. Una schermata che riscrive ma dice
 * «non si riscrive» è peggio di una che blocca: chi legge decide di non provarci, e quello che il
 * prodotto sa fare glielo nasconde la sua stessa schermata.
 */
describe('il giorno già aperto non ferma più chi scrive il menu', () => {
  it('⛔ il pulsante non si spegne più su «già aperto»', () => {
    expect(senzaCommenti).toMatch(/disabled=\{[^}]*salvando[^}]*\}/);
    expect(senzaCommenti).not.toMatch(/disabled=\{[^}]*giaAperto[^}]*\}/);
  });

  /**
   * ⛔ **IL BLOCCO NON DEVE POTER RIENTRARE DA UN'ALTRA PORTA** — la prima stesura di questa prova
   * guardava solo `disabled={…}`, e una revisione avversariale l'ha smontata: bastava rimettere il
   * blocco **dentro l'`onClick`** (`if (giaAperto) return;`) e le prove restavano tutte verdi. Una
   * prova che sorveglia una riga invece di una regola non sorveglia niente.
   *
   * ⚠️ Quindi si conta: `giaAperto` può comparire in **tre** posti soli — il tipo della cornice, il
   * banner che lo dice, e il ramo «né aperto né sconosciuto» del banner informativo. Un quarto uso
   * è un cancello rientrato, e questa prova va letta prima di aggiungerlo.
   */
  it('⛔ `giaAperto` non compare da nessuna altra parte: niente cancelli rientrati', () => {
    expect(senzaCommenti.match(/giaAperto/g) ?? []).toHaveLength(3);
  });

  /**
   * ⛔ **E il banner non è spento.** L'altra mutazione sopravvissuta era `{false && …}`: la riga
   * spariva per sempre e le prove sulle parole restavano verdi, perché le parole erano ancora
   * scritte nel file.
   */
  it('⛔ il banner è appeso alla condizione vera, non a un falso', () => {
    expect(senzaCommenti).toMatch(/\{cornice\?\.esistente\?\.giaAperto && \(/);
  });

  /**
   * ⚠️ **La riga dice la conseguenza, non il divieto**: quello che la cliente ha in mano cambia. È
   * la sola cosa su cui chi salva deve decidere — e «magari ci aveva già fatto la spesa» è il
   * motivo per cui la regola esisteva, che resta vero anche adesso che non ferma.
   */
  it('⛔ e la frase non promette più che il menu resta com\'è', () => {
    expect(senzaCommenti).toMatch(/quello che ha in mano\s*\n?\s*cambia/);
    expect(senzaCommenti).not.toContain('non si riscrive');
    expect(senzaCommenti).not.toContain('quello resta suo');
  });

  /** ⚠️ E si dice che la cosa resta scritta: una forzatura senza traccia è un pulsante «ignora». */
  it('⚠️ la riga dice che resta nel registro', () => {
    expect(senzaCommenti).toContain('resta scritto nel registro');
  });

  /**
   * ⛔ **Il percorso della conferma esisteva già e non è stato duplicato**: il server risponde «Da
   * confermare: …» e il pulsante diventa «Ho letto, salva lo stesso». Aggiungere una seconda strada
   * per lo stesso avviso vorrebbe dire due posti da correggere il giorno che cambia.
   */
  it('⛔ passa dalla conferma che c\'era già, non da una nuova', () => {
    expect(menu).toMatch(/Ho letto, salva lo stesso/);
    expect(menu).toMatch(/onClick=\{\(\) => void salva\(true\)\}/);
  });
});
