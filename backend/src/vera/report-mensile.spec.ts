import { componiReport, intervalloMese, RigaReport } from './report-mensile';

const D = (iso: string) => new Date(iso);
const NOMI = new Map([['n1', 'Lucia Verdi'], ['n2', 'Anna Neri']]);

const riga = (over: Partial<RigaReport> = {}): RigaReport => ({
  id: 'a1',
  nutrizionistaId: 'n1',
  frase: 'a Giulia Rossi niente formaggi molli',
  azione: 'restrizione_cliente',
  ambito: 'cliente',
  stato: 'attiva',
  conflittoSanitario: false,
  soggettoNome: 'Giulia Rossi',
  createdAt: D('2026-07-10T09:00:00Z'),
  ...over,
});

describe('intervalloMese', () => {
  it('⚠️ taglia il mese in UTC, non nell’ora locale di chi lo calcola', () => {
    // Il server gira in UTC su Render e il portatile di chi sviluppa no: un report che cambia
    // contenuto a seconda di dove lo si calcola è un report di cui non ci si fida.
    const { dal, al } = intervalloMese(2026, 7);
    expect(dal.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(al.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('dicembre finisce a gennaio dell’anno dopo', () => {
    expect(intervalloMese(2026, 12).al.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('componiReport', () => {
  it('conta stati e conflitti', () => {
    const r = componiReport(
      [
        riga(),
        riga({ id: 'a2', stato: 'annullata' }),
        riga({ id: 'a3', stato: 'in_approvazione', ambito: 'catalogo' }),
        riga({ id: 'a4', stato: 'respinta' }),
        riga({ id: 'a5', conflittoSanitario: true }),
      ],
      [],
      NOMI,
      2026,
      7,
    );
    expect(r.totali).toMatchObject({
      scritte: 5, annullate: 1, inApprovazione: 1, respinte: 1, conflitti: 1, percentualeAnnullate: 20,
    });
    expect(r.periodo).toBe('2026-07');
  });

  it('⚠️ un mese vuoto lo dice, non sparisce', () => {
    // Un report che non arriva è indistinguibile da un report che non è stato generato, e la
    // seconda cosa è un guasto.
    const r = componiReport([], [], NOMI, 2026, 7);
    expect(r.totali.scritte).toBe(0);
    expect(r.testo).toContain('Nessuna regola dettata');
  });

  it('⚠️ mette in cima chi ha più conflitti, non chi ha scritto di più', () => {
    // L'ordine di un elenco è una dichiarazione di cosa conta: qui conta quello che va guardato.
    const r = componiReport(
      [
        riga({ id: 'a1', nutrizionistaId: 'n1' }),
        riga({ id: 'a2', nutrizionistaId: 'n1' }),
        riga({ id: 'a3', nutrizionistaId: 'n1' }),
        riga({ id: 'a4', nutrizionistaId: 'n2', conflittoSanitario: true }),
      ],
      [],
      NOMI,
      2026,
      7,
    );
    expect(r.perNutrizionista.map((v) => v.nome)).toEqual(['Anna Neri', 'Lucia Verdi']);
  });

  it('le righe scavalcate sono elencate una per una, non solo contate', () => {
    const r = componiReport([riga({ conflittoSanitario: true, soggettoNome: 'Mariastella' })], [], NOMI, 2026, 7);
    expect(r.conflitti).toHaveLength(1);
    expect(r.testo).toContain('Mariastella');
    expect(r.testo).toContain('vincolo sanitario');
  });

  it('⚠️ sopra il 20% di annullate lo scrive a parole, non lascia notare il numero', () => {
    // È il guasto che non produce nessun errore rosso: se sale, l'assistente ha smesso di capire
    // qualcosa che prima capiva.
    const r = componiReport([riga(), riga({ id: 'a2', stato: 'annullata' })], [], NOMI, 2026, 7);
    expect(r.totali.percentualeAnnullate).toBe(50);
    expect(r.testo).toContain('è stata annullata');
  });

  it('sotto la soglia non allarma nessuno', () => {
    const righe = Array.from({ length: 10 }, (_, i) => riga({ id: `a${i}` }));
    const r = componiReport(righe, [], NOMI, 2026, 7);
    expect(r.testo).not.toContain('è stata annullata');
  });

  it('le frasi non capite entrano nel report come lavoro, non come lamentela', () => {
    const r = componiReport([riga()], [{ frase: 'togli i cibi pesanti', quante: 3 }], NOMI, 2026, 7);
    expect(r.totali.nonCapite).toBe(3);
    expect(r.testo).toContain('togli i cibi pesanti');
    expect(r.testo).toContain('3 volte');
  });

  it('con una sola nutrizionista non stampa la classifica', () => {
    const r = componiReport([riga()], [], NOMI, 2026, 7);
    expect(r.testo).not.toContain('Per nutrizionista');
  });

  it('chi non ha nome resta identificabile lo stesso', () => {
    const r = componiReport([riga({ nutrizionistaId: 'sconosciuto-lungo-id' })], [], new Map(), 2026, 7);
    expect(r.perNutrizionista[0].nome).toBe('sconosci');
  });
});
