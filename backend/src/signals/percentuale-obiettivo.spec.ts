import { avanzamentoPeso, FINESTRA_MASSIMA } from './percentuale-obiettivo';

/**
 * LA PERCENTUALE VERSO L'OBIETTIVO — una domanda, una risposta (19/8).
 *
 * Quattro punti la calcolavano, tre sull'ultima pesata e uno sulla media mobile. Questi test tengono
 * ferma la regola scelta: **la tendenza, non il singolo dato**.
 */
describe('avanzamentoPeso', () => {
  it('da 80 a 75 con traguardo 70: metà strada', () => {
    // Media mobile a 1 = l'ultima pesata: qui si guarda solo il conto della percentuale.
    expect(avanzamentoPeso([80, 75], 80, 70, 1).percento).toBe(50);
  });

  /**
   * ⚠️ IL CASO CHE VALE IL MODULO. Due etti di ritenzione l'ultimo giorno: sull'ultima pesata la
   * barra torna indietro in una giornata in cui non è successo niente, sulla media mobile no. È
   * quello che vedeva la cliente, e la ragione per cui il numero era diverso da quello del motore.
   */
  it('⚠️ l\'acqua di un giorno non fa tornare indietro la barra', () => {
    const pesate = [80, 78, 77, 76, 76.2];
    const conUltima = ((80 - 76.2) / (80 - 70)) * 100; // 38%
    const conMedia = avanzamentoPeso(pesate, 80, 70, 3).percento!;
    expect(Math.round(conUltima)).toBe(38);
    // La media delle ultime tre (77, 76, 76.2) è 76,4: la barra si muove meno, e non all'indietro.
    expect(conMedia).toBeGreaterThan(35);
    expect(conMedia).toBeLessThan(38);
  });

  /**
   * ⚠️ La partenza è quella del PROFILO quando c'è: è il peso con cui è cominciato il percorso, e
   * non deve cambiare se la prima pesata viene corretta. Senza, correggere un refuso di tre mesi fa
   * sposterebbe la percentuale di oggi.
   */
  it('⚠️ il punto di partenza è quello del profilo, non la prima pesata', () => {
    expect(avanzamentoPeso([78, 75], 80, 70, 1).percento).toBe(50);
    // Senza il campo del profilo si ripiega sulla prima pesata: è il caso delle clienti di prima.
    expect(avanzamentoPeso([78, 75], null, 70, 1).percento).toBe(37.5);
  });

  /**
   * ⚠️ QUANTA STORIA PASSA IL CHIAMANTE NON DEVE CAMBIARE IL NUMERO. `progress.service` si ferma
   * alle ultime 120 pesate, il widget e la lista della coach le prendono tutte: con una finestra
   * grande, senza il taglio qui dentro, la stessa cliente tornerebbe ad avere due percentuali —
   * cioè il difetto che questo file esiste per chiudere, rientrato dalla porta di servizio.
   */
  it('⚠️ con la stessa finestra il risultato non dipende da quante pesate vecchie si passano', () => {
    const tante = Array.from({ length: 200 }, (_v, i) => 90 - i * 0.05); // dalla più vecchia
    const poche = tante.slice(-120); // quante ne vede `progress.service`
    // Anche con una finestra scritta grande nei Parametri: il tetto la riporta a un numero sensato,
    // e sotto il tetto tutti e tre i chiamanti hanno abbastanza pesate per rispondere uguale.
    const a = avanzamentoPeso(tante, 90, 75, 150);
    const b = avanzamentoPeso(poche, 90, 75, 150);
    expect(a.percento).toBe(b.percento);
    expect(a.pesoDiAdesso).toBe(b.pesoDiAdesso);
  });

  /**
   * ⚠️ E il tetto è quello: una «media mobile» su centocinquanta pesate è la media di tutto, e
   * soprattutto riaprirebbe le due risposte, perché un chiamante non arriva così indietro.
   */
  it('⚠️ una finestra assurda nei Parametri viene riportata al tetto', () => {
    expect(FINESTRA_MASSIMA).toBe(30);
    const pesi = Array.from({ length: 100 }, (_v, i) => 90 - i * 0.1);
    expect(avanzamentoPeso(pesi, 90, 75, 150)).toEqual(avanzamentoPeso(pesi, 90, 75, FINESTRA_MASSIMA));
    // E una finestra sotto zero o illeggibile non fa esplodere niente: vale una pesata.
    expect(avanzamentoPeso([80, 76], 80, 70, 0).pesoDiAdesso).toBe(76);
    expect(avanzamentoPeso([80, 76], 80, 70, NaN).pesoDiAdesso).toBe(76);
  });

  it('senza traguardo non si dice una percentuale, ma i chili persi sì', () => {
    const a = avanzamentoPeso([80, 76], 80, null, 1);
    expect(a.percento).toBeNull();
    expect(a.persiKg).toBe(4);
  });

  it('senza nessuna pesata non si inventa niente', () => {
    expect(avanzamentoPeso([], 80, 70, 3)).toEqual({ percento: null, persiKg: null, pesoDiAdesso: null });
  });

  /** ⚠️ La barra non va sotto zero né sopra cento: chi è ingrassata vede 0, non un numero negativo. */
  it('⚠️ resta fra 0 e 100 anche quando il peso va dall\'altra parte', () => {
    expect(avanzamentoPeso([80, 83], 80, 70, 1).percento).toBe(0);
    expect(avanzamentoPeso([80, 65], 80, 70, 1).percento).toBe(100);
  });

  /** Un traguardo uguale (o sopra) alla partenza non è una strada da percorrere: non si finge. */
  it('con traguardo uguale alla partenza non c\'è una percentuale', () => {
    expect(avanzamentoPeso([80, 79], 80, 80, 1).percento).toBeNull();
  });

  it('i valori illeggibili si saltano invece di far esplodere il conto', () => {
    expect(avanzamentoPeso([80, NaN as number, 76], 80, 70, 1).percento).toBe(40);
  });
});
