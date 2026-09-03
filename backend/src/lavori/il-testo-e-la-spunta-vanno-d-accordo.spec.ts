/**
 * ⛔ **UNA VOCE CHE SI RACCONTA CHIUSA DEVE ESSERE SPUNTATA.**
 *
 * Nasce da un errore vero, il 3/9. La chiusura di `togliere-una-chiave-non-basta-se-c-e-un-hub` è
 * stata scritta in uno script lanciato con `cd backend && python3 …`: il `cd` è fallito — la shell
 * era **già** in `backend` — e con `&&` lo script **non è mai partito**. Nessun errore visibile:
 * subito sotto girava `jest`, che passava sul file **non modificato**, e la consegna è andata al
 * Mac con il messaggio di commit e il registro che dicevano «chiusa» e la voce ancora aperta.
 *
 * ⛔ Il danno non è la spunta mancante: è che **il registro comincia a mentire**, ed è la sola cosa
 * che dice cosa è stato fatto. Un errore che si vede subito costa un minuto; questo era già uscito
 * dalla porta.
 *
 * ⚠️ Questa prova guarda la sola incoerenza che si può controllare a macchina: il **testo** e la
 * **spunta**. Non può sapere se una voce chiusa è davvero chiusa — quello lo dicono le prove del
 * lavoro — ma prende esattamente il caso in cui qualcuno (o qualche script) scrive la storia e
 * dimentica l'interruttore, o al contrario spunta una voce lasciandone il testo al passato.
 */
import { VOCI_INIZIALI } from './voci-iniziali';

/**
 * ⛔ **QUELLO CHE QUESTA PROVA NON PUÒ FARE, e va detto subito.**
 *
 * La prima stesura cercava «✅ CHIUSA» anche nel **dettaglio**. È subito diventata rossa su
 * `la-e-nel-nome-tronca-in-silenzio`, e aveva torto lei: quella voce ha chiuso **due difetti su
 * tre** e dice «✅ CHIUSA il 2/9 con la strada 1» parlando di uno di quelli. ⚠️ Un dettaglio
 * racconta anche le chiusure **parziali**, e pretendere la spunta lì dentro avrebbe costretto a
 * scrivere peggio per far tacere una prova — che è il modo in cui una rete comincia a fare danno.
 *
 * ⛔ E soprattutto: **l'errore del 3/9 questa prova NON lo avrebbe preso.** Lo script non è partito
 * affatto, quindi la voce è rimasta coerente con se stessa — vecchio titolo, `fatta: false` — e a
 * mentire erano il messaggio di commit e il registro, che nessun test legge. Il rimedio per quello
 * sta in `CLAUDE.md` ed è procedurale: *una modifica si verifica rileggendo il file, non fidandosi
 * dell'uscita del comando*. Questa prova prende il caso vicino e più comune — il titolo scritto e
 * l'interruttore dimenticato — e non promette di prendere l'altro.
 */

describe('il testo di una voce e la sua spunta dicono la stessa cosa', () => {
  /** ⛔ A elenco vuoto tutto il resto sarebbe verde sul nulla. */
  it('⛔ le voci si leggono davvero', () => {
    expect(VOCI_INIZIALI.length).toBeGreaterThan(100);
  });

  it('⛔ una voce che nel TITOLO comincia con ✅ è spuntata', () => {
    const bugiarde = VOCI_INIZIALI
      .filter((v) => /^✅/.test(v.titolo) && !v.fatta)
      .map((v) => v.chiave);
    expect(bugiarde).toEqual([]);
  });

  /**
   * ⚠️ **E il verso opposto NON si controlla**, per la stessa ragione. Tre voci chiuse hanno un
   * titolo che comincia con ⛔ — «173 righe su 245 del foglio alimenti hanno i valori copiati» — e
   * hanno ragione: il titolo **nomina il difetto**, il dettaglio dice che è stato corretto. Una
   * prova che pretendesse il ✅ su tutte avrebbe fatto riscrivere tre titoli buoni.
   */

  /**
   * ⛔ **E i rimandi fra voci esistono.** `[[chiave]]` è il modo in cui una voce ne nomina un'altra:
   * un rimando a una chiave che non c'è manda il prossimo a cercare una voce inventata — e succede
   * proprio quando si scrive «ha una voce sua» prima di averla creata.
   */
  it('⛔ ogni rimando [[chiave]] punta a una voce che esiste', () => {
    const chiavi = new Set(VOCI_INIZIALI.map((v) => v.chiave));
    const rotti: string[] = [];
    for (const v of VOCI_INIZIALI) {
      for (const m of v.dettaglio.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) {
        if (!chiavi.has(m[1])) rotti.push(`${v.chiave} → ${m[1]}`);
      }
    }
    expect(rotti).toEqual([]);
  });
});
