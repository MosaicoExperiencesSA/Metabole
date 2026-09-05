/**
 * A CHI SI CHIEDE LA FINESTRA — i test.
 *
 * Il caso che conta di più è quello che **non** propone niente: la cliente la cui finestra storica
 * l'orologio non sa riprodurre. È lì che il difetto di Sonia potrebbe rifarsi da davanti —
 * proponendole i pasti «più vicini» ai suoi, che sono comunque pasti che non ha chiesto.
 */
import {
  PROPOSTE_DA_FINESTRA_STORICA,
  atterraggioOrologio,
  motivoPerLaNutrizionista,
  proposteIncoerenti,
} from './chiedi-la-finestra';
import { VALORI_FINESTRA_DIGIUNO, VALORI_FINESTRA_SELEZIONABILI } from './finestre-digiuno';
import { finestreRaggiungibili, derivaDaOrologio, type SogliaPasti } from './orologio-digiuno';

describe('⚠️ ogni proposta produce DAVVERO la finestra a cui è appesa', () => {
  /**
   * È il test che tiene onesta la tabella scritta a mano. Senza, il giorno che qualcuno cambia una
   * soglia da `config_param` la pagina si aprirebbe proponendo a una cliente una finestra che le
   * cambia i pasti — e nessuno se ne accorgerebbe finché non lo dice lei.
   */
  it('nessuna proposta incoerente', () => {
    expect(proposteIncoerenti()).toEqual([]);
  });

  /**
   * ⛔ E il test che tiene onesto il controllo stesso. Senza questo, `proposteIncoerenti()` poteva
   * restituire sempre `[]` — un allarme che non suona mai — e il test qui sopra sarebbe rimasto
   * verde per il motivo sbagliato. *Un dato che agisce e non si vede.*
   *
   * Qui le soglie sono manomesse apposta (una finestra qualsiasi dà un pasto solo): tre proposte su
   * quattro smettono di riprodurre la loro finestra, e il controllo le deve nominare tutte e tre.
   */
  it('⛔ e se le soglie cambiano, il controllo suona: le righe rotte si dicono per nome', () => {
    // Una tabella con una riga sola: qualunque finestra, un pasto solo.
    const soglieRotte: SogliaPasti[] = [{ oreMin: 0, slots: ['dinner'] }];
    const rotte = proposteIncoerenti(soglieRotte);

    // Tre proposte su quattro smettono di riprodurre la loro finestra. La quarta —
    // «solo cena» — con queste soglie resta vera per caso, e infatti non compare.
    expect(rotte).toHaveLength(3);
    const nominate = rotte.map((r) => r.split(':')[0]).sort();
    expect(nominate).toEqual(['skip_breakfast', 'skip_breakfast_and_snacks', 'skip_morning_snack']);

    // ⚠️ Non basta nominarle: il messaggio deve dire anche COSA danno al posto giusto, altrimenti
    // chi lo legge deve rifare a mano il conto che la funzione ha già fatto.
    expect(rotte.find((r) => r.startsWith('skip_breakfast:'))).toContain('dà skip_all_but_dinner');
  });

  it.each(Object.entries(PROPOSTE_DA_FINESTRA_STORICA))('«%s» si riapre identica', (finestra, riga) => {
    expect(derivaDaOrologio(riga.inizioMin, riga.protocollo)?.fastingWindow).toBe(finestra);
    expect(riga.perche.length).toBeGreaterThan(10);
  });

  /**
   * ⚠️ La tabella delle proposte non può essere più larga di quello che l'orologio sa fare: una
   * riga in più qui sarebbe una promessa che la derivazione non mantiene.
   */
  it('le proposte sono un sottoinsieme delle finestre raggiungibili', () => {
    const raggiungibili = new Set(finestreRaggiungibili());
    for (const finestra of Object.keys(PROPOSTE_DA_FINESTRA_STORICA)) {
      expect(raggiungibili.has(finestra)).toBe(true);
    }
  });

  /**
   * ⛔ E l'elenco di chi resta senza proposta, dichiarato per nome. Sono quattro: tre finestre di
   * digiuno che l'orologio non sa riprodurre — e una di loro ha una cliente vera sopra — più
   * `skip_lunch`, che non è nemmeno una finestra di digiuno (due pause corte, non una lunga) ed è
   * per questo che è stata ritirata.
   */
  it('⛔ le finestre SENZA proposta sono quattro, e si dicono per nome', () => {
    const senza = VALORI_FINESTRA_DIGIUNO.filter((v) => !PROPOSTE_DA_FINESTRA_STORICA[v]);
    expect(senza.sort()).toEqual(
      ['skip_breakfast_lunch', 'skip_dinner', 'skip_dinner_breakfast', 'skip_lunch'],
    );
  });

  /**
   * ⛔ **LA DOMANDA APERTA, tenuta in vista invece che scoperta fra un mese** (revisione del 21/8).
   *
   * Tre finestre si possono **ancora scegliere** — dal questionario e dalla scheda staff — e
   * l'orologio **non** sa riprodurle. Conseguenza concreta: una cliente nuova sceglie oggi «Cena»,
   * e al primo avvio la pagina dell'orologio le si apre vuota e parte una segnalazione alla
   * nutrizionista per una scelta fatta cinque minuti prima. Vale anche quando è la coach a
   * scriverla: il sistema segnala alla nutrizionista quello che la nutrizionista ha appena deciso.
   *
   * ⚠️ Non è un difetto di `atterraggioOrologio`, che fa quello che deve. È una **decisione da
   * prendere**, e ha peso clinico: o quelle tre escono dalle tendine come `skip_lunch` — e allora la
   * nutrizionista non può più prescrivere «salta la cena» — oppure la segnalazione va ristretta.
   * Fino ad allora questo test tiene il numero **scritto**: *niente tagli silenziosi, se si scarta
   * qualcosa si dice quanto.* Il giorno che qualcuno cambia le tendine, qui si deve passare.
   */
  it('✅ quante finestre ancora scegliibili l\'orologio non sa riprodurre: ZERO, dal 5/9', () => {
    /**
     * ⛔ **La decisione è stata presa, e il numero l'ha resa facile.** Le tre — «salta la cena»,
     * «salta colazione e pranzo», «salta cena e colazione» — sono uscite dalle tendine il 5/9,
     * perché `diag:digiuni` su TUTTI i percorsi ha detto **zero profili** su tutte e tre: toglierle
     * non toglie niente a nessuna, e chiude la segnalazione che partiva a Lucia per una scelta
     * fatta cinque minuti prima. ⚠️ Restano leggibili in tabella: `selezionabile: false`, non
     * cancellate.
     */
    const scegliibiliSenzaProposta = VALORI_FINESTRA_SELEZIONABILI
      .filter((v) => !PROPOSTE_DA_FINESTRA_STORICA[v])
      .sort();
    expect(scegliibiliSenzaProposta).toEqual([]);
    // E l'unica che l'orologio riproduce fra quelle scegliibili è il 16:8 classico.
    expect(VALORI_FINESTRA_SELEZIONABILI.filter((v) => PROPOSTE_DA_FINESTRA_STORICA[v])).toEqual(['skip_breakfast']);
  });
});

describe('a chi si apre la pagina', () => {
  it('chi non digiuna non la vede mai', () => {
    const a = atterraggioOrologio({ pathType: 'five', fastingWindow: 'skip_breakfast' });
    expect(a.daChiedere).toBe(false);
    expect(a.motivo).toBe('non_digiuna');
  });

  it('chi ha già scelto non la rivede: un avviso che compare sempre non è un avviso', () => {
    const a = atterraggioOrologio({
      pathType: 'intermittent_fasting',
      fastingWindow: 'skip_breakfast',
      fastingSceltoIl: new Date('2026-08-22T10:00:00Z'),
    });
    expect(a.daChiedere).toBe(false);
    expect(a.motivo).toBe('ha_gia_scelto');
  });

  /**
   * ⚠️ Il caso delle **cinque clienti** su «salta la colazione» (`diag:digiuni`, 21/8): la pagina si
   * apre su quello che già ricevono, e confermare non cambia niente per loro.
   */
  it('le cinque su «salta la colazione»: si apre precompilata su 16:8 alle 12:00', () => {
    const a = atterraggioOrologio({ pathType: 'intermittent_fasting', fastingWindow: 'skip_breakfast' });
    expect(a.daChiedere).toBe(true);
    expect(a.motivo).toBe('mai_chiesta');
    expect(a.proposta).toEqual({ protocollo: '16:8', inizioMin: 720 });
    expect(a.finestraNonTraducibile).toBe(false);
    // E quella proposta le dà esattamente i pasti che riceve oggi.
    expect(derivaDaOrologio(720, '16:8')?.pasti.map((p) => p.slot)).toEqual([
      'lunch', 'afternoon_snack', 'dinner',
    ]);
  });

  /**
   * ⛔ **Il caso di Sonia**, e il test che impedisce di rifare il suo difetto da davanti: la sua
   * finestra non è riproducibile, quindi la pagina si apre **vuota**. Proporle la «più vicina»
   * vorrebbe dire servirle pasti che non ha chiesto perché somigliano ai suoi.
   */
  it('⛔ «salta la cena»: nessuna proposta, e la nutrizionista lo deve sapere', () => {
    const a = atterraggioOrologio({ pathType: 'intermittent_fasting', fastingWindow: 'skip_dinner' });
    expect(a.daChiedere).toBe(true);
    expect(a.proposta).toBeUndefined();
    expect(a.finestraNonTraducibile).toBe(true);
  });

  it('e vale per tutte le finestre non traducibili, non solo per la sua', () => {
    for (const v of ['skip_lunch', 'skip_breakfast_lunch', 'skip_dinner_breakfast']) {
      const a = atterraggioOrologio({ pathType: 'intermittent_fasting', fastingWindow: v });
      expect(a.proposta).toBeUndefined();
      expect(a.finestraNonTraducibile).toBe(true);
    }
  });

  /**
   * ⚠️ Chi non ha MAI avuto una finestra (il caso di Maria, voce 256) non è un caso da segnalare:
   * è una a cui la domanda non è mai stata fatta. La pagina si apre vuota, ma senza allarme.
   */
  it('digiuno senza finestra: pagina vuota, ma NON è una segnalazione', () => {
    const a = atterraggioOrologio({ pathType: 'intermittent_fasting', fastingWindow: null });
    expect(a.daChiedere).toBe(true);
    expect(a.proposta).toBeUndefined();
    expect(a.finestraNonTraducibile).toBe(false);
  });

  /**
   * ⚠️ La regola non guarda il calendario. È quello che le fa servire tutte e tre le porte del §14
   * con una riga sola: chi digiuna da prima del rilascio, chi ci passa domani, e chi ci mette lo
   * staff fra sei mesi sono lo stesso caso — manca il dato, si chiede.
   */
  it('nessuna data di rilascio nel mezzo: conta solo se il dato c\'è', () => {
    const nuova = atterraggioOrologio({ pathType: 'intermittent_fasting' });
    const storica = atterraggioOrologio({ pathType: 'intermittent_fasting', fastingWindow: null });
    expect(nuova.daChiedere).toBe(storica.daChiedere);
    expect(nuova.motivo).toBe(storica.motivo);
  });
});

describe('quello che legge la nutrizionista', () => {
  /**
   * ⛔ Il test di prima passava il testo già tradotto (`'salta la cena'`) e poi verificava che nel
   * messaggio non ci fossero codici: vincolava la stringa scritta nel test, non la funzione. Non
   * esisteva modo di romperla. Adesso entra il **valore vero**, quello che il chiamante avrà in
   * mano, e la traduzione è un lavoro della funzione.
   */
  it('⛔ prende il valore della finestra e ne tira fuori una frase', () => {
    const m = motivoPerLaNutrizionista('skip_dinner', '16:8 dalle 08:00');
    expect(m).toContain('Salta la cena');
    expect(m).toContain('16:8 dalle 08:00');
    expect(m.length).toBeGreaterThan(80);
    // Nessun identificativo interno buttato in faccia a una persona.
    expect(m).not.toMatch(/skip_|fasting[A-Z]|null|undefined/);
  });

  it('nessuna finestra della tabella arriva alla nutrizionista come codice', () => {
    for (const v of VALORI_FINESTRA_DIGIUNO) {
      expect(motivoPerLaNutrizionista(v, '16:8 dalle 12:00')).not.toMatch(/skip_/);
    }
  });

  /**
   * ⚠️ E il caso che non si può tradurre: un valore scritto a mano, o rimasto da una versione
   * vecchia. Nasconderlo lascerebbe la nutrizionista senza niente da cercare — si dice, e si dice
   * **che è un codice**, così non lo legge come il nome di un pasto.
   */
  it('un valore che la tabella non conosce si dice, dichiarandolo come codice', () => {
    const m = motivoPerLaNutrizionista('skip_qualcosa_di_vecchio', '18:6 dalle 13:00');
    expect(m).toContain('codice interno: skip_qualcosa_di_vecchio');
    expect(m).toContain('non riconosce');
  });

  /**
   * ⚠️ **Non dice «che aveva».** Al momento della segnalazione quella finestra può essere di sei
   * mesi fa o averla scritta la coach cinque minuti prima dalla scheda: una frase al passato
   * racconterebbe una storia che non sappiamo.
   */
  it('non racconta quando è stata scritta, perché non lo sa', () => {
    const m = motivoPerLaNutrizionista('skip_dinner', '16:8 dalle 08:00');
    expect(m).not.toMatch(/che aveva|aveva scelto|in passato/);
  });
});
