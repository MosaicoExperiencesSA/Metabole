import { controllaRicettaDaScrivere } from './ricetta-che-si-puo-scrivere';

/**
 * ⛔ **I DUE CANCELLI DI SIMONE (4/9), e non fanno la stessa cosa apposta.**
 *
 * *«1 deve essere bloccante, non fa salvare la ricetta»* · *«2 chiede doppia conferma»*.
 *
 * ⚠️ La differenza è la sola cosa che queste prove devono tenere ferma: chi un giorno le
 * uniformasse — bloccando anche il regime, o chiedendo conferma anche sull'elenco vuoto — romperebbe
 * due cose diverse. Bloccare il regime vuol dire non poter più scrivere «Polpo di ceci»; chiedere
 * conferma sull'elenco vuoto vuol dire farsi confermare una dimenticanza.
 */

const CON_POLLO = [{ name: 'farro perlato' }, { name: 'petto di pollo' }];

describe('l\'elenco ingredienti FERMA', () => {
  it('⛔ senza elenco non si salva, e il motivo dice che senza non funziona nessun controllo', () => {
    const v = controllaRicettaDaScrivere({ nome: 'Insalata di farro', regime: 'vegan', ingredienti: undefined });
    expect(v.esito).toBe('ferma');
    expect((v as { problema: string }).problema).toContain('non ha un elenco ingredienti');
    expect((v as { problema: string }).problema).toContain('esclusioni delle clienti');
  });

  it('⛔ l\'elenco vuoto lo dice con parole sue', () => {
    const v = controllaRicettaDaScrivere({ nome: 'Insalata di farro', regime: 'vegan', ingredienti: [] });
    expect(v.esito).toBe('ferma');
    expect((v as { problema: string }).problema).toContain('è vuoto');
  });

  /**
   * ⚠️ **Il caso che inganna, e per questo ha una frase sua**: da fuori la ricetta sembra compilata
   * e `ingredients.length` risponde 1. Chi legge «l'elenco è vuoto» va a cercare un elenco che c'è.
   * ⛔ Ed è il caso che il `@ArrayMinSize` del DTO **non** prende: le righe ci sono, i nomi no.
   */
  it('⛔ le righe senza nome dentro si fermano, e non si chiamano «vuoto»', () => {
    const v = controllaRicettaDaScrivere({ nome: 'Insalata', regime: 'vegan', ingredienti: [{ qty: 100, unit: 'g' }] });
    expect(v.esito).toBe('ferma');
    expect((v as { problema: string }).problema).toContain('nessun nome dentro');
    expect((v as { problema: string }).problema).not.toContain('è vuoto');
  });

  /** ⚠️ In catalogo l'elenco esiste anche come lista di stringhe: lì non si ferma niente. */
  it('⚠️ l\'elenco scritto come lista di stringhe va bene, che in catalogo esiste', () => {
    expect(controllaRicettaDaScrivere({ nome: 'Insalata di ceci', regime: 'vegan', ingredienti: ['ceci', 'rucola'] }).esito).toBe('ok');
  });
});

describe('il regime contro il contenuto CHIEDE', () => {
  /**
   * ⛔ **Il difetto dei 175 piatti dell'1/9, chiuso alla porta.** Il generatore scriveva il regime
   * **della richiesta** invece che del piatto, e ne sono usciti 175 con carne o pesce dentro i
   * panieri vegani. Questa porta ha la stessa forma: una persona che scrive «pollo» e lascia
   * l'etichetta dov'era.
   */
  it('⚠️ la carne in un piatto dichiarato vegetariano chiede conferma, e NOMINA l\'ingrediente', () => {
    const v = controllaRicettaDaScrivere({ nome: 'Insalata tiepida', regime: 'vegetarian', ingredienti: CON_POLLO });
    expect(v.esito).toBe('conferma');
    expect((v as { problema: string }).problema).toContain('petto di pollo');
    expect((v as { problema: string }).problema).toContain('omnivore');
  });

  /**
   * ⛔ **CHIEDE, non ferma — ed è la decisione di Simone, non una sfumatura.** In questo catalogo
   * esistono «Polpo di ceci», «Branzino di melanzane», «Pollo di Tempeh»: bloccare vorrebbe dire non
   * poter più scrivere metà delle imitazioni. La differenza fra i due cancelli è quello che queste
   * due righe tengono fermo.
   */
  it('⛔ chiede e non ferma: è la differenza fra i due cancelli', () => {
    expect(controllaRicettaDaScrivere({ nome: 'Insalata tiepida', regime: 'vegetarian', ingredienti: CON_POLLO }).esito)
      .not.toBe('ferma');
  });

  it('⚠️ la stessa carne dichiarata onnivora non chiede niente', () => {
    expect(controllaRicettaDaScrivere({ nome: 'Insalata tiepida', regime: 'omnivore', ingredienti: CON_POLLO }).esito).toBe('ok');
  });

  it('⚠️ il pesce in un piatto vegetariano propone il PESCETARIANO, non l\'onnivoro', () => {
    const v = controllaRicettaDaScrivere({
      nome: 'Insalata di farro',
      regime: 'vegetarian',
      ingredienti: [{ name: 'farro' }, { name: 'filetto di branzino' }],
    });
    expect(v.esito).toBe('conferma');
    expect((v as { problema: string }).problema).toContain('pescetarian');
  });

  /** ⚠️ L'onnivoro contiene il pescetariano: un'etichetta più larga del necessario non è una bugia. */
  it('⚠️ il pesce dichiarato onnivoro passa senza chiedere', () => {
    expect(controllaRicettaDaScrivere({
      nome: 'Insalata di farro',
      regime: 'omnivore',
      ingredienti: [{ name: 'farro' }, { name: 'filetto di branzino' }],
    }).esito).toBe('ok');
  });

  /**
   * ⛔ **L'imitazione dichiarata nel nome non chiede NIENTE**, ed è il caso che una regola più
   * semplice avrebbe rotto: «Polpo di ceci» è un piatto vegano vero di questo catalogo, e
   * `senzaImitazioni` lo legge. Una conferma su una cosa che va bene insegna a confermare senza
   * leggere.
   */
  it('⛔ «Polpo di ceci» non chiede niente: l\'imitazione la dichiara il nome', () => {
    expect(controllaRicettaDaScrivere({
      nome: 'Polpo di ceci con alghe nori',
      regime: 'vegan',
      ingredienti: [{ name: 'ceci lessi' }, { name: 'alghe nori' }],
    }).esito).toBe('ok');
  });

  /**
   * ⛔ **E nemmeno il nome che dice pesce con l'elenco che non ce l'ha.** `classifica` lo chiama
   * «dubbia», e qui non si chiede niente di proposito: sarebbe una conferma su ogni piatto vegetale
   * che si chiama come un animale.
   */
  it('⛔ un nome che dice pesce, senza pesce in elenco, non chiede conferma', () => {
    expect(controllaRicettaDaScrivere({
      nome: 'Polpo croccante con paprika',
      regime: 'vegan',
      ingredienti: [{ name: 'ceci lessi' }, { name: 'paprika' }],
    }).esito).toBe('ok');
  });
});

/**
 * ⛔ **PRIMA L'ELENCO, POI L'ETICHETTA — e questa prova è il motivo per cui l'ordine è scritto.**
 *
 * Senza ingredienti `classifica` non ha niente da leggere e risponderebbe «ok» su un piatto di cui
 * non si sa niente: un via libera dato al buio è peggio di nessun controllo, perché **sembra** un
 * controllo.
 */
it('⛔ su una ricetta senza elenco si ferma, invece di dare l\'ok sul regime', () => {
  const v = controllaRicettaDaScrivere({ nome: 'Spezzatino di manzo', regime: 'vegan', ingredienti: [] });
  expect(v.esito).toBe('ferma');
});

/**
 * ⚠️ **QUELLO CHE QUESTO CONTROLLO NON GUARDA, tenuto fermo da una prova invece che da un commento.**
 *
 * Le uova e i latticini dentro un piatto dichiarato vegano passano: `classifica` conosce carne e
 * pesce e basta. ⛔ Non si chiude di qui **oggi** perché la deduzione che servirebbe chiederebbe
 * conferma su «ricotta di mandorla» e «uova di lino» — nomi di imitazione che `senzaImitazioni` non
 * conosce. ⚠️ La ragione più grossa («melagrana» e «piselli sgranati») è caduta con questa stessa
 * consegna, chiudendo la porta unica delle chiavi: quello che resta si chiude allungando i segni
 * vegetali, con la cautela di sempre.
 *
 * ⛔ Il giorno che qualcuno lo chiude, questa prova diventa **rossa**: è il segnale che il buco è
 * chiuso, non che qualcosa si è rotto.
 */
it('⛔ una frittata dichiarata vegana oggi passa — il buco è dichiarato, non dimenticato', () => {
  expect(controllaRicettaDaScrivere({
    nome: 'Frittata di zucchine',
    regime: 'vegan',
    ingredienti: [{ name: 'uova' }, { name: 'zucchine' }],
  }).esito).toBe('ok');
});
