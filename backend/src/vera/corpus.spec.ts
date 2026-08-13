import { casiCapiti, fraseNonCapite, RigaMessaggio } from './corpus';

const D = (iso: string) => new Date(iso);

let n = 0;
const sua = (testo: string, iso: string): RigaMessaggio => ({
  id: `u${(n += 1)}`, ruolo: 'nutrizionista', testo, meta: null, createdAt: D(iso),
});
const agente = (esito: string | null, iso: string): RigaMessaggio => ({
  id: `a${(n += 1)}`, ruolo: 'agente', testo: '…', meta: esito ? { esito } : null, createdAt: D(iso),
});

describe('fraseNonCapite', () => {
  it('⚠️ prende la frase dal messaggio prima della resa, non da un campo', () => {
    // Quando l'agente si arrende butta lo stato: la frase è però lì sopra. Accoppiarli funziona
    // anche sulle conversazioni già avvenute, comprese quelle di prima che questo file esistesse.
    const fuori = fraseNonCapite([
      sua('togli i cibi pesanti', '2026-08-01T10:00:00Z'),
      agente('non_capito', '2026-08-01T10:00:01Z'),
    ]);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].frase).toBe('togli i cibi pesanti');
  });

  it('non conta i giri andati a buon fine', () => {
    expect(
      fraseNonCapite([
        sua('a Giulia niente tonno', '2026-08-01T10:00:00Z'),
        agente('scritta', '2026-08-01T10:00:01Z'),
      ]),
    ).toEqual([]);
  });

  it('⚠️ conta la frase, non l’episodio, e mette in cima la più ripetuta', () => {
    // Un elenco cronologico fa lavorare sull'ultima capitata invece che sulla più frequente.
    const fuori = fraseNonCapite([
      sua('togli i cibi pesanti', '2026-08-01T10:00:00Z'),
      agente('non_capito', '2026-08-01T10:00:01Z'),
      sua('alleggerisci la dieta', '2026-08-02T10:00:00Z'),
      agente('arresa', '2026-08-02T10:00:01Z'),
      sua('Togli i cibi pesanti', '2026-08-03T10:00:00Z'),
      agente('non_capito', '2026-08-03T10:00:01Z'),
    ]);
    expect(fuori.map((f) => f.quante)).toEqual([2, 1]);
    expect(fuori[0].frase).toBe('togli i cibi pesanti');
    expect(fuori[0].ultimaVolta).toEqual(D('2026-08-03T10:00:01Z'));
  });

  it('ricorda se dopo il secondo tentativo si è arreso', () => {
    const fuori = fraseNonCapite([
      sua('fai la cosa giusta', '2026-08-01T10:00:00Z'),
      agente('non_capito', '2026-08-01T10:00:01Z'),
      sua('fai la cosa giusta', '2026-08-01T10:01:00Z'),
      agente('arresa', '2026-08-01T10:01:01Z'),
    ]);
    expect(fuori[0].arresa).toBe(true);
  });

  it('una resa senza niente prima non inventa nessuna frase', () => {
    expect(fraseNonCapite([agente('arresa', '2026-08-01T10:00:00Z')])).toEqual([]);
  });

  it('rimette in ordine i messaggi che arrivano dal più recente', () => {
    // La query li legge `desc` in molti punti: l'accoppiamento non deve dipendere da come arrivano.
    const fuori = fraseNonCapite([
      agente('non_capito', '2026-08-01T10:00:01Z'),
      sua('togli i cibi pesanti', '2026-08-01T10:00:00Z'),
    ]);
    expect(fuori[0]?.frase).toBe('togli i cibi pesanti');
  });
});

describe('casiCapiti', () => {
  const c = (over: Record<string, string> = {}) => ({
    frase: 'a Giulia niente tonno', azione: 'restrizione_cliente', ambito: 'cliente', stato: 'attiva', ...over,
  });

  it('⚠️ una riga annullata vince sulla gemella attiva', () => {
    // Fra due righe con la stessa frase, quella che insegna qualcosa è quella andata storta.
    const fuori = casiCapiti([c({ stato: 'annullata' }), c()]);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].stato).toBe('annullata');
  });

  it('la stessa frase su venti clienti resta una riga sola', () => {
    expect(casiCapiti([c(), c(), c()])).toHaveLength(1);
  });

  it('stessa frase ma azione diversa sono due casi', () => {
    expect(casiCapiti([c(), c({ azione: 'sostituzione_cliente' })])).toHaveLength(2);
  });

  it('scarta le righe senza frase', () => {
    expect(casiCapiti([c({ frase: '   ' })])).toEqual([]);
  });
});
