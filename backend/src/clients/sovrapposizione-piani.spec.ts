import {
  fraseSovrapposizione,
  pianiSovrapposti,
  siSovrappongono,
  type PianoDatato,
} from './sovrapposizione-piani';

const OGGI = new Date('2026-08-17T10:00:00Z');
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const piano = (o: Partial<PianoDatato> & { id: string }): PianoDatato => ({
  status: 'active',
  startDate: null,
  endDate: null,
  nome: 'Piano',
  ...o,
});

describe('siSovrappongono', () => {
  it('due periodi lontani non si toccano', () => {
    expect(siSovrappongono(d('2026-08-01'), d('2026-08-10'), d('2026-08-11'), d('2026-08-20'))).toBe(false);
    expect(siSovrappongono(d('2026-08-11'), d('2026-08-20'), d('2026-08-01'), d('2026-08-10'))).toBe(false);
  });

  it('⚠️ il giorno del passaggio di testimone È una sovrapposizione: è il giorno in cui arrivano due menu', () => {
    expect(siSovrappongono(d('2026-08-01'), d('2026-08-10'), d('2026-08-10'), d('2026-08-20'))).toBe(true);
  });

  it('⚠️ una fine assente è un piano APERTO: si sovrappone a tutto quello che viene dopo il suo inizio', () => {
    expect(siSovrappongono(d('2026-09-01'), d('2026-12-01'), d('2026-08-01'), null)).toBe(true);
    // Ma non a quello che finisce prima che cominci.
    expect(siSovrappongono(d('2026-06-01'), d('2026-07-01'), d('2026-08-01'), null)).toBe(false);
  });

  it('un inizio assente vale «già cominciato», come in `staErogando`', () => {
    expect(siSovrappongono(d('2026-08-15'), d('2026-08-20'), null, d('2026-08-18'))).toBe(true);
    expect(siSovrappongono(d('2026-08-19'), d('2026-08-20'), null, d('2026-08-18'))).toBe(false);
  });
});

describe('pianiSovrapposti', () => {
  const inCorso = piano({ id: 'corso', nome: 'Conosciamoci', startDate: d('2026-08-09'), endDate: d('2026-08-25') });
  const inCoda = piano({ id: 'coda', nome: '3 mesi', startDate: d('2026-08-25'), endDate: d('2026-11-25') });

  it('⚠️ IL CASO LORENA: portare il piano in coda al 17/08 lo fa sbattere su quello in corso', () => {
    const s = pianiSovrapposti([inCorso], d('2026-08-17'), d('2026-11-17'), OGGI);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: 'corso', nome: 'Conosciamoci', quando: 'in_corso' });
  });

  it('e al contrario: allungare il piano in corso fin dentro la coda si vede allo stesso modo', () => {
    const s = pianiSovrapposti([inCoda], d('2026-08-20'), d('2026-09-20'), OGGI);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: 'coda', quando: 'in_coda' });
  });

  it('spostare senza toccare nessuno non avvisa: la matita resta muta quando non c\'è niente da dire', () => {
    expect(pianiSovrapposti([inCorso], d('2026-08-26'), d('2026-11-26'), OGGI)).toEqual([]);
  });

  it('⚠️ un annullato, uno scaduto e un carrello NON contano: sovrapporsi a loro non produce due menu', () => {
    const altri = [
      piano({ id: 'ann', status: 'cancelled', startDate: d('2026-08-01'), endDate: d('2026-12-01') }),
      piano({ id: 'sca', status: 'expired', startDate: d('2026-08-01'), endDate: d('2026-12-01') }),
      piano({ id: 'car', status: 'pending', startDate: d('2026-08-01'), endDate: d('2026-12-01') }),
    ];
    expect(pianiSovrapposti(altri, d('2026-08-17'), d('2026-11-17'), OGGI)).toEqual([]);
  });

  it('⚠️ un `active` con la fine GIÀ PASSATA non conta: è il cron di scadenza in ritardo, non eroga niente', () => {
    const vecchio = piano({ id: 'vecchio', startDate: d('2026-06-01'), endDate: d('2026-08-10') });
    expect(pianiSovrapposti([vecchio], d('2026-08-01'), d('2026-11-01'), OGGI)).toEqual([]);
  });

  it('più piani addosso: li torna tutti, in ordine di lista', () => {
    const s = pianiSovrapposti([inCorso, inCoda], d('2026-08-17'), d('2026-11-17'), OGGI);
    expect(s.map((x) => x.id)).toEqual(['corso', 'coda']);
  });

  it('un piano senza nome non fa sparire l\'avviso: si dice «un altro piano»', () => {
    const senzaNome = piano({ id: 'x', nome: null, startDate: d('2026-08-09'), endDate: d('2026-08-25') });
    expect(pianiSovrapposti([senzaNome], d('2026-08-17'), d('2026-09-17'), OGGI)[0].nome).toBe('un altro piano');
  });
});

describe('fraseSovrapposizione — deve dire contro cosa, quando, e cosa succede alla cliente', () => {
  it('la frase del caso Lorena, per intero', () => {
    const s = pianiSovrapposti(
      [piano({ id: 'corso', nome: 'Conosciamoci', startDate: d('2026-08-09'), endDate: d('2026-08-25') })],
      d('2026-08-17'),
      d('2026-11-17'),
      OGGI,
    );
    const frase = fraseSovrapposizione(s, '3 mesi', d('2026-08-17'), d('2026-11-17'));
    expect(frase).toContain('«Conosciamoci» sta erogando fino al 25/08/2026');
    expect(frase).toContain('Portando «3 mesi» dal 17/08/2026 al 17/11/2026');
    expect(frase).toContain('due piani attivi insieme');
    // ⚠️ La conseguenza vera, non «attenzione, sovrapposizione»: chi legge deve poter decidere.
    expect(frase).toContain('i giorni dell\'altro scorreranno senza che riceva niente');
    // ⚠️ E si chiude come l'altro avviso della stessa matita: è una domanda, non un divieto.
    expect(frase).toContain('Se è quello che vuoi, conferma');
  });

  it('quando quello addosso è la coda, la frase dice DA QUANDO e non fino a quando', () => {
    const s = pianiSovrapposti(
      [piano({ id: 'coda', nome: '3 mesi', startDate: d('2026-08-25'), endDate: d('2026-11-25') })],
      d('2026-08-20'),
      d('2026-09-20'),
      OGGI,
    );
    expect(fraseSovrapposizione(s, 'Conosciamoci', d('2026-08-20'), d('2026-09-20'))).toContain(
      '«3 mesi» è in coda dal 25/08/2026',
    );
  });

  it('un piano aperto lo dice invece di inventare una fine', () => {
    const s = pianiSovrapposti([piano({ id: 'aperto', nome: 'Mantenimento', startDate: d('2026-08-01'), endDate: null })], d('2026-09-01'), d('2026-12-01'), OGGI);
    expect(fraseSovrapposizione(s, '3 mesi', d('2026-09-01'), d('2026-12-01'))).toContain('non ha una scadenza');
  });

  it('con più piani addosso lo dice: «(e altri 1)»', () => {
    const s = pianiSovrapposti(
      [
        piano({ id: 'a', nome: 'Conosciamoci', startDate: d('2026-08-09'), endDate: d('2026-08-25') }),
        piano({ id: 'b', nome: 'Mantenimento', startDate: d('2026-08-20'), endDate: d('2026-09-20') }),
      ],
      d('2026-08-17'),
      d('2026-11-17'),
      OGGI,
    );
    expect(fraseSovrapposizione(s, '3 mesi', d('2026-08-17'), d('2026-11-17'))).toContain('(e altri 1)');
  });
});
