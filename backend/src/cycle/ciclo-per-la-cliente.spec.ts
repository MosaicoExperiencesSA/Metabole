import { cottureDelCiclo, esitoPrecedenteInItaliano } from './ciclo-per-la-cliente';

describe('esitoPrecedenteInItaliano', () => {
  it('dice com\'è andata, in italiano e non con l\'enum', () => {
    const e = esitoPrecedenteInItaliano({ esitoPeso: 'perso', esitoCm: 'perso', followed: true });
    expect(e?.riga).toBe('Nei due giorni precedenti il peso è sceso e i centimetri sono calati.');
    expect(e?.seguito).toBe(true);
  });

  /**
   * ⚠️ IL PESO CHE SALE SI DICE. Nascondere una settimana storta vuol dire che la schermata parla
   * solo quando le cose vanno bene: a quel punto non è più un'informazione, è un applauso — e chi
   * la legge se ne accorge, e smette di crederle anche quando la lode è meritata.
   */
  it('⚠️ anche quando è andata male, senza girarci intorno', () => {
    expect(esitoPrecedenteInItaliano({ esitoPeso: 'preso', esitoCm: 'stabile', followed: false })?.riga).toBe(
      'Nei due giorni precedenti il peso è salito e i centimetri sono rimasti stabili.',
    );
  });

  /**
   * ⚠️ «n.d.» NON DIVENTA UNA FRASE. Vuol dire che non c'erano misure per dirlo: scriverlo come
   * «non disponibile» è un modo tecnico di dire una cosa che non si sa, e occupa lo spazio di
   * un'informazione senza esserlo.
   */
  it('⚠️ senza misure non si dice niente: `null`, non una frase di circostanza', () => {
    expect(esitoPrecedenteInItaliano({ esitoPeso: 'n.d.', esitoCm: 'n.d.', followed: false })).toBeNull();
    expect(esitoPrecedenteInItaliano(null)).toBeNull();
    expect(esitoPrecedenteInItaliano(undefined)).toBeNull();
  });

  it('se si sa solo del peso, si parla solo del peso', () => {
    expect(esitoPrecedenteInItaliano({ esitoPeso: 'stabile', esitoCm: 'n.d.', followed: true })?.riga).toBe(
      'Nei due giorni precedenti il peso è rimasto stabile.',
    );
  });
});

/**
 * ⚠️ «PRECEDENTE» VUOL DIRE PRECEDENTE — 19/8, dalla revisione.
 *
 * Il feedback del ciclo si scrive quando la cliente si pesa al secondo giorno, cioè **prima** che
 * arrivi l'erogazione successiva: fra la pesata e i menu nuovi, il feedback più recente parla dei
 * giorni che sta guardando adesso.
 */
describe('esitoPrecedenteInItaliano — e la data che dice di quale ciclo parla', () => {
  const g = (n: number) => new Date(Date.UTC(2026, 6, n));

  it('⚠️ l\'esito che finisce dentro il ciclo attuale non si mostra', () => {
    const esito = { esitoPeso: 'perso', esitoCm: 'perso', followed: true, cycleEnd: g(10) };
    expect(esitoPrecedenteInItaliano(esito, g(9))).toBeNull(); // il ciclo attuale è 9→10
  });

  it('quello del ciclo prima sì', () => {
    const esito = { esitoPeso: 'perso', esitoCm: 'perso', followed: true, cycleEnd: g(8) };
    expect(esitoPrecedenteInItaliano(esito, g(9))?.riga).toContain('il peso è sceso');
  });

  /** ⚠️ E se non si sa di quale ciclo parla, si tace: una riga ambigua non è un'informazione. */
  it('⚠️ senza la data dell\'esito non si dice niente', () => {
    expect(esitoPrecedenteInItaliano({ esitoPeso: 'perso', esitoCm: 'perso', followed: true }, g(9))).toBeNull();
  });

  /** ⚠️ «Nei 2 giorni» è il modo in cui parla un programma: il numero si scrive in lettere. */
  it('⚠️ la finestra viene dai Parametri, e si legge in italiano', () => {
    const esito = { esitoPeso: 'stabile', esitoCm: 'n.d.', followed: false, cycleEnd: g(8) };
    expect(esitoPrecedenteInItaliano(esito, g(9), 3)?.riga).toBe('Nei tre giorni precedenti il peso è rimasto stabile.');
    expect(esitoPrecedenteInItaliano(esito, g(9), 1)?.riga).toBe('Nel giorno precedente il peso è rimasto stabile.');
  });
});

describe('cottureDelCiclo', () => {
  it('le due cotture con l\'etichetta che si legge', () => {
    expect(cottureDelCiclo('forno', 'padella')).toEqual([
      { tipo: 'forno', etichetta: 'Al forno' },
      { tipo: 'padella', etichetta: 'In padella' },
    ]);
  });

  /** ⚠️ «Al forno · Al forno» non è una varietà: è una riga che non ha controllato niente. */
  it('⚠️ la stessa cottura due volte si dice una volta sola', () => {
    expect(cottureDelCiclo('forno', 'forno')).toEqual([{ tipo: 'forno', etichetta: 'Al forno' }]);
  });

  it('i buchi si saltano, e senza cotture non c\'è niente da mostrare', () => {
    expect(cottureDelCiclo(null, 'vapore')).toEqual([{ tipo: 'vapore', etichetta: 'Al vapore' }]);
    expect(cottureDelCiclo(null, null)).toEqual([]);
  });

  /** L'etichetta di un metodo che questa versione non conosce resta leggibile, non un codice. */
  it('un metodo nuovo non arriva come codice grezzo', () => {
    expect(cottureDelCiclo('piatto_freddo', null)).toEqual([{ tipo: 'piatto_freddo', etichetta: 'Piatto freddo' }]);
  });
});
