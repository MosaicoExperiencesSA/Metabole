import {
  RIFERIMENTO_UNICO,
  serveChiedereLaFinestra,
  testoFinestraMaiChiesta,
} from './finestra-mai-chiesta';

describe('serveChiedereLaFinestra', () => {
  it('in digiuno e senza finestra: sì, la domanda non è mai stata fatta', () => {
    expect(serveChiedereLaFinestra('intermittent_fasting', null)).toBe(true);
    expect(serveChiedereLaFinestra('intermittent_fasting', undefined)).toBe(true);
    expect(serveChiedereLaFinestra('intermittent_fasting', '')).toBe(true);
    expect(serveChiedereLaFinestra('intermittent_fasting', '   ')).toBe(true);
  });

  it('⚠️ una finestra impostata è una scelta già fatta: non si richiede', () => {
    expect(serveChiedereLaFinestra('intermittent_fasting', 'skip_dinner')).toBe(false);
  });

  it('⚠️ chi non è in digiuno non ha nessuna finestra da scegliere', () => {
    expect(serveChiedereLaFinestra('classic3', null)).toBe(false);
    expect(serveChiedereLaFinestra('five', null)).toBe(false);
    expect(serveChiedereLaFinestra(null, null)).toBe(false);
    expect(serveChiedereLaFinestra(undefined, undefined)).toBe(false);
  });
});

describe('testoFinestraMaiChiesta — deve dire anche cosa succede INTANTO', () => {
  it('nel titolo c\'è il nome, perché la coach lo legge in un elenco', () => {
    expect(testoFinestraMaiChiesta('Maria').title).toBe('Chiedi a Maria quali pasti salta nel digiuno');
  });

  it('senza nome resta una frase, non un buco', () => {
    expect(testoFinestraMaiChiesta(null).title).toBe('Chiedi a la cliente quali pasti salta nel digiuno');
    expect(testoFinestraMaiChiesta('  ').title).toContain('la cliente');
  });

  /**
   * ⚠️ È la riga che impedisce alla correzione di diventare il danno: «manca la finestra» letto da
   * solo suona come un guasto, e una coach che chiama allarmata una cliente che sta bene ha fatto
   * più danno del dato mancante.
   */
  it('⚠️ dice che NON è ferma e NON è rotta: il difetto è una domanda mancata', () => {
    const d = testoFinestraMaiChiesta('Maria').description;
    expect(d).toContain('NON è ferma e non è rotta');
    expect(d).toContain('riceve tutti i pasti della sua dieta');
  });

  it('dice le due strade per impostarla, e che si può anche lasciare com\'è', () => {
    const d = testoFinestraMaiChiesta('Maria').description;
    expect(d).toContain('«Pasti che salta»');
    expect(d).toContain('Profilo dell\'app');
    expect(d).toContain('segna l\'attività fatta');
  });
});

describe('il riferimento dell\'attività', () => {
  /**
   * ⚠️ La chiave di unicità è `clientId + kind + refId`: se il riferimento fosse la data o l'id del
   * piano, l'attività rinascerebbe — ogni notte, o a ogni rinnovo — su una domanda già fatta.
   */
  it('⚠️ è fisso: la domanda si fa una volta sola', () => {
    expect(RIFERIMENTO_UNICO).toBe('unica');
  });
});
