import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chiRestaSenzaScheda, schedeDelloStile } from './scheda-stile';

/**
 * ⛔ **IL TABULATO SI PROVA SUI DATI VERI DEL REPO, non solo sui finti.**
 *
 * `chi-resta-senza-scheda.spec.ts` prova il giudizio su schede inventate: è lì che si decide cosa
 * vuol dire «senza scheda». Questa prova fa l'altra metà — la sola che si può fare senza la banca
 * dati — e cioè che il lettore, puntato sul **file vero dell'app**, ne ricavi davvero delle schede
 * piene. Senza, `npm run diag:schede-stile` in produzione direbbe «tutti gli stili sono scoperti»
 * per un regex rotto, e quello è il modo più veloce di far smettere di leggere un tabulato.
 */
describe('la diagnostica, puntata sul file vero', () => {
  const sorgente = readFileSync(
    join(__dirname, '..', '..', '..', 'app', 'src', 'onboarding', 'dietInfo.ts'), 'utf8',
  );
  const schede = schedeDelloStile(sorgente);

  it('⛔ il lettore ricava delle schede dal file vero: a mappa vuota il tabulato griderebbe al lupo', () => {
    expect(schede.size).toBeGreaterThan(5);
  });

  /**
   * ⛔ **Le schede che ci sono devono risultare PIENE.** È il verso che protegge dal falso allarme:
   * se domani il lettore dei campi smettesse di leggerli, ogni stile finirebbe fra i «a metà» e chi
   * legge andrebbe a riscrivere schede già scritte.
   */
  it('⛔ e quelle che ci sono risultano piene: nessun falso «a metà» sui dati veri', () => {
    const finti = [...schede.keys()].map((style) => ({ style, diete: [style], clienti: 0 }));
    const esito = chiRestaSenzaScheda(finti, schede);
    expect(esito.aMeta).toEqual([]);
    expect(esito.senzaScheda).toEqual([]);
    expect(esito.piene).toHaveLength(schede.size);
  });

  /**
   * ⚠️ **E il verso opposto, sui dati veri**: uno stile che nel file non c'è deve uscire come
   * scoperto. `vegan` è il caso della sentinella — un'etichetta in `Onboarding.tsx` senza scheda —
   * e finché resta scoperto questa prova lo dimostra sul file vero, non su uno finto.
   */
  it('⛔ uno stile pubblicato che nel file non c\'è esce come «senza scheda»', () => {
    const esito = chiRestaSenzaScheda([{ style: 'vegan', diete: ['Vegana'], clienti: 3 }], schede);
    expect(esito.senzaScheda.map((s) => s.style)).toEqual(['vegan']);
    expect(esito.clientiToccate).toBe(3);
  });
});

/**
 * ⛔ **LE TRE RIGHE DELLO SCRIPT DA CUI DIPENDE SE IL NUMERO È VERO.**
 *
 * Il giudizio sta nel modulo e si prova lì; ma la parte che può mentire di più non è il giudizio —
 * è **che cosa gli viene dato in pasto**. Tre righe di query decidono se «clienti su uno stile
 * scoperto» è un numero su cui si può decidere o un numero gonfio: e uno script non lo prova
 * nessuno. Quindi si leggono i sorgenti, come fa già `chiavi-senza-guardia.spec.ts` con i
 * decoratori — non è elegante, ed è l'unica rete che quelle righe possono avere.
 */
describe('⛔ la diagnostica chiede alla banca dati le cose giuste', () => {
  const script = readFileSync(join(__dirname, '..', '..', 'prisma', 'diag-schede-stile.ts'), 'utf8');

  /**
   * ⛔ **Solo clienti vive.** L'archiviazione e la cancellazione self-service scrivono `deletedAt`
   * sull'utente e lasciano il profilo dov'è, `dietStyle` compreso; e `dietStyle` si scrive alla
   * consegna del questionario, cioè prima del pagamento. Senza filtro, il numero da cui dipende se
   * vale un rilascio dell'app è gonfio di account cancellati e di lead mai convertiti.
   */
  it('⛔ i profili si contano solo per le clienti vive', () => {
    expect(script).toMatch(/role: 'client', deletedAt: null/);
  });

  /** ⚠️ E il totale grezzo si stampa accanto: un salto fra i due numeri non deve sembrare un difetto. */
  it('⚠️ e dice quanti profili ha guardato sul totale', () => {
    expect(script).toMatch(/profiliTotali/);
  });

  /**
   * ⛔ **Gli stili pubblicati sono quelli che l'app mostra**, cioè la stessa coppia di condizioni di
   * `dietProducts()`. Se una delle due sparisse, il tabulato risponderebbe a una domanda diversa da
   * quella scritta in cima — e nessuno se ne accorgerebbe leggendolo.
   */
  it('⛔ le diete sono quelle visibili e approvate, come nella rotta che le mostra alla cliente', () => {
    expect(script).toMatch(/clientVisible: true, status: 'approved'/);
    const rotta = readFileSync(join(__dirname, '..', 'onboarding', 'onboarding.service.ts'), 'utf8');
    expect(rotta).toMatch(/clientVisible: true, status: 'approved'/);
  });
});
