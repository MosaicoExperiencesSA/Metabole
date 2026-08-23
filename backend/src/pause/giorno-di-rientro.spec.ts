import {
  giorniSospesi,
  giornoDiRientro,
  rientroInArrivo,
  ultimoGiornoSospeso,
} from './giorno-di-rientro';

/** Un giorno come lo scrive `toDateOnly`: mezzanotte UTC. */
const g = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('giorno-di-rientro — «quando riprende la dieta»', () => {
  it('la sospensione scritta «al 23» riprende il 24', () => {
    expect(giornoDiRientro({ startDate: g('2026-08-10'), endDate: g('2026-08-23') })).toEqual(
      g('2026-08-24'),
    );
  });

  it('«riprende il 24» si salva come «al 23» — e le due funzioni si annullano', () => {
    expect(ultimoGiornoSospeso(g('2026-08-24'))).toEqual(g('2026-08-23'));
    const periodo = { startDate: g('2026-08-10'), endDate: ultimoGiornoSospeso(g('2026-08-24')) };
    expect(giornoDiRientro(periodo)).toEqual(g('2026-08-24'));
  });

  it('scavalca il confine di mese senza sbagliare', () => {
    expect(giornoDiRientro({ startDate: g('2026-08-25'), endDate: g('2026-08-31') })).toEqual(
      g('2026-09-01'),
    );
    expect(ultimoGiornoSospeso(g('2026-09-01'))).toEqual(g('2026-08-31'));
  });

  /**
   * ⚠️ Il cambio dell'ora legale (25 ottobre 2026) è il giorno in cui un `+ 86_400_000` su un
   * orario locale sbaglia. Qui le date sono mezzanotte UTC, quindi non deve succedere niente — ed
   * è esattamente il motivo per cui questa è l'unica porta.
   */
  it('regge il cambio dell\'ora legale', () => {
    expect(giornoDiRientro({ startDate: g('2026-10-20'), endDate: g('2026-10-24') })).toEqual(
      g('2026-10-25'),
    );
    expect(giornoDiRientro({ startDate: g('2026-10-20'), endDate: g('2026-10-25') })).toEqual(
      g('2026-10-26'),
    );
  });

  it('conta i giorni sospesi in modo inclusivo, come `pause.service`', () => {
    expect(giorniSospesi({ startDate: g('2026-08-10'), endDate: g('2026-08-10') })).toBe(1);
    expect(giorniSospesi({ startDate: g('2026-08-10'), endDate: g('2026-08-23') })).toBe(14);
  });

  describe('la finestra di rientro', () => {
    const periodo = { startDate: g('2026-08-10'), endDate: g('2026-08-23') }; // riprende il 24

    it('con un giorno d\'anticipo si apre il 23 e restituisce il giorno DA EROGARE', () => {
      expect(rientroInArrivo(periodo, g('2026-08-22'), 1)).toBeNull();
      expect(rientroInArrivo(periodo, g('2026-08-23'), 1)).toEqual(g('2026-08-24'));
    });

    it('resta aperta anche dopo il rientro: chi non apre l\'app il 23 deve trovare il menu il 24', () => {
      expect(rientroInArrivo(periodo, g('2026-08-24'), 1)).toEqual(g('2026-08-24'));
      expect(rientroInArrivo(periodo, g('2026-08-30'), 1)).toEqual(g('2026-08-24'));
    });

    it('senza anticipo si apre il giorno stesso del rientro', () => {
      expect(rientroInArrivo(periodo, g('2026-08-23'), 0)).toBeNull();
      expect(rientroInArrivo(periodo, g('2026-08-24'), 0)).toEqual(g('2026-08-24'));
    });

    it('un anticipo negativo o scritto male vale zero, non apre la finestra in anticipo', () => {
      expect(rientroInArrivo(periodo, g('2026-08-23'), -5)).toBeNull();
      expect(rientroInArrivo(periodo, g('2026-08-24'), -5)).toEqual(g('2026-08-24'));
    });

    /**
     * ⚠️ Il caso che il fuso rompe: le 00:30 di Roma del 23 agosto sono le 22:30 UTC del 22. Se
     * «oggi» si leggesse in UTC la finestra si aprirebbe un giorno dopo, e il menu del rientro
     * arriverebbe il giorno stesso invece che in anticipo — cioè la richiesta di Simone non
     * sarebbe soddisfatta proprio nelle ore in cui gira il cron notturno.
     */
    it('alle 00:30 di Roma del 23 la finestra è già aperta', () => {
      expect(rientroInArrivo(periodo, new Date('2026-08-22T22:30:00.000Z'), 1)).toEqual(
        g('2026-08-24'),
      );
    });
  });
});
