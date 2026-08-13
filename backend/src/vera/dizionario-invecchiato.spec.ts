import { cercaNuoviMembri, FamigliaDaControllare, nomiIngredienti, RicettaInCatalogo } from './dizionario-invecchiato';

const D = (iso: string) => new Date(iso);

const famiglia = (over: Partial<FamigliaDaControllare> = {}): FamigliaDaControllare => ({
  id: 'f1',
  nome: 'formaggi molli',
  membri: ['mozzarella', 'stracchino', 'yogurt greco'],
  aggiornataIl: D('2026-07-01T00:00:00Z'),
  ...over,
});

const ricetta = (ingredienti: string[], iso = '2026-08-01T00:00:00Z', id = 'r1'): RicettaInCatalogo => ({
  id,
  createdAt: D(iso),
  ingredienti,
});

describe('cercaNuoviMembri', () => {
  it('propone l’alimento entrato dopo che somiglia a un membro', () => {
    const fuori = cercaNuoviMembri([famiglia()], [ricetta(['yogurt magro', 'pane'])]);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].candidati).toEqual(['yogurt magro']);
  });

  it('⚠️ non riapre quello che c’era già quando la parola è stata insegnata', () => {
    // Su quelle ricette la nutrizionista ha già deciso: riproporgliele vorrebbe dire chiederle di
    // nuovo una cosa a cui ha già risposto, e insegnarle a chiudere la domanda senza leggerla.
    const fuori = cercaNuoviMembri([famiglia()], [ricetta(['yogurt magro'], '2026-06-01T00:00:00Z')]);
    expect(fuori).toEqual([]);
  });

  it('non propone quello che è già dentro la famiglia', () => {
    expect(cercaNuoviMembri([famiglia()], [ricetta(['mozzarella'])])).toEqual([]);
  });

  it('⚠️ confronta per parola intera con la radice, non per sottostringa', () => {
    // «pepe» prenderebbe «peperoni»: è la lezione già pagata altrove, e qui costerebbe una famiglia
    // che si allarga a cose che non c'entrano.
    const fuori = cercaNuoviMembri([famiglia({ membri: ['pepe'] })], [ricetta(['peperoni rossi'])]);
    expect(fuori).toEqual([]);
  });

  it('singolare e plurale si trovano lo stesso', () => {
    const fuori = cercaNuoviMembri([famiglia({ membri: ['formaggio spalmabile'] })], [ricetta(['formaggi spalmabili light'])]);
    expect(fuori[0]?.candidati).toEqual(['formaggi spalmabili light']);
  });

  it('lo stesso ingrediente in dieci ricette resta una proposta sola', () => {
    const fuori = cercaNuoviMembri(
      [famiglia()],
      [ricetta(['yogurt magro'], '2026-08-01T00:00:00Z', 'r1'), ricetta(['Yogurt Magro'], '2026-08-02T00:00:00Z', 'r2')],
    );
    expect(fuori[0].candidati).toHaveLength(1);
  });

  it('⚠️ si ferma a otto: oltre non è una domanda, è un modulo da compilare', () => {
    // A un modulo si risponde «va bene tutto» senza leggerlo, ed è il modo di far entrare nel
    // dizionario proprio le cose che non c'entrano.
    const tanti = Array.from({ length: 20 }, (_, i) => `yogurt gusto${i}`);
    const fuori = cercaNuoviMembri([famiglia()], [ricetta(tanti)]);
    expect(fuori[0].candidati).toHaveLength(8);
  });

  it('una famiglia senza membri non si controlla: non c’è niente a cui somigliare', () => {
    expect(cercaNuoviMembri([famiglia({ membri: [] })], [ricetta(['yogurt magro'])])).toEqual([]);
  });

  it('⚠️ se la famiglia ha già il nome generico, la versione precisa non si chiede', () => {
    // Con «yogurt» dentro, il motore toglie anche «yogurt magro»: chiederlo sarebbe far confermare
    // una cosa che è già vera, e ogni domanda inutile è una ragione per non leggere la prossima.
    expect(cercaNuoviMembri([famiglia({ membri: ['yogurt'] })], [ricetta(['yogurt magro'])])).toEqual([]);
  });

  it('prima la famiglia che sta coprendo meno di quanto sembra', () => {
    const fuori = cercaNuoviMembri(
      [
        famiglia({ id: 'f1', nome: 'yogurt', membri: ['yogurt greco'] }),
        famiglia({ id: 'f2', nome: 'pane', membri: ['pane integrale'] }),
      ],
      [ricetta(['yogurt magro', 'yogurt bianco', 'pane azzimo'])],
    );
    expect(fuori.map((f) => f.famigliaId)).toEqual(['f1', 'f2']);
  });
});

describe('nomiIngredienti', () => {
  it('legge la forma vera del catalogo', () => {
    expect(nomiIngredienti([{ name: 'mozzarella', qty: 100, unit: 'g' }, { name: ' pane ' }])).toEqual(['mozzarella', 'pane']);
  });

  it('non si fida della forma: stringhe, righe senza nome, JSON storto', () => {
    expect(nomiIngredienti(['pane', { qty: 100 }, null, 42])).toEqual(['pane']);
    expect(nomiIngredienti(null)).toEqual([]);
    expect(nomiIngredienti('pane, olio')).toEqual([]);
  });
});
