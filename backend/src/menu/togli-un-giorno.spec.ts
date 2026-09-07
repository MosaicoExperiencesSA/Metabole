/**
 * Togliere un giorno di menu: le cose che si sbagliano sono **quali giorni si possono togliere**,
 * **in che ordine si spostano gli altri** e **se resta un buco**. Qui si verificano con un
 * calendario scritto a mano e un «oggi» passato da fuori, senza banca dati e senza aspettare la
 * mezzanotte.
 */
import { giornoPrimaDi, toglieUnGiorno, type GiornoInCalendario } from './togli-un-giorno';

const OGGI = '2026-09-07';

/** Un calendario consecutivo di `n` giorni a partire da `dal`, con id parlanti. */
function calendario(dal: string, n: number): GiornoInCalendario[] {
  const out: GiornoInCalendario[] = [];
  let g = dal;
  for (let i = 0; i < n; i += 1) {
    out.push({ id: `id-${g}`, giorno: g });
    const [a, m, d] = g.split('-').map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    g = dt.toISOString().slice(0, 10);
  }
  return out;
}

const ok = (e: ReturnType<typeof toglieUnGiorno>) => {
  if (!e.si) throw new Error(`atteso un sì, ricevuto: ${e.perche}`);
  return e;
};

describe('giornoPrimaDi', () => {
  it('toglie un giorno, e attraversa i mesi e gli anni', () => {
    expect(giornoPrimaDi('2026-09-07')).toBe('2026-09-06');
    expect(giornoPrimaDi('2026-09-01')).toBe('2026-08-31');
    expect(giornoPrimaDi('2026-01-01')).toBe('2025-12-31');
    expect(giornoPrimaDi('2028-03-01')).toBe('2028-02-29'); // bisestile
  });

  it('⛔ il cambio dell’ora non sposta niente: il 25 ottobre 2026 è la domenica dell’ora solare', () => {
    expect(giornoPrimaDi('2026-10-26')).toBe('2026-10-25');
    expect(giornoPrimaDi('2026-10-25')).toBe('2026-10-24');
  });
});

describe('toglieUnGiorno', () => {
  it('⛔ un giorno PASSATO non si toglie: farebbe scorrere indietro giornate già vissute', () => {
    const cal = calendario('2026-09-01', 12);
    const e = toglieUnGiorno({ calendario: cal, idDaTogliere: 'id-2026-09-05', oggi: OGGI });
    expect(e.si).toBe(false);
    if (!e.si) expect(e.perche).toContain('già vissuto');
  });

  it('OGGI si toglie: l’ha deciso Simone il 7/9', () => {
    const cal = calendario('2026-09-01', 12);
    expect(ok(toglieUnGiorno({ calendario: cal, idDaTogliere: `id-${OGGI}`, oggi: OGGI })).giornoTolto).toBe(OGGI);
  });

  it('un giorno che non c’è più non fa esplodere niente: lo dice e basta', () => {
    const e = toglieUnGiorno({ calendario: calendario('2026-09-01', 3), idDaTogliere: 'id-inesistente', oggi: OGGI });
    expect(e.si).toBe(false);
    if (!e.si) expect(e.perche).toContain('già stato tolto');
  });

  it('⛔ togliendo un giorno in mezzo, TUTTI i successivi scalano di uno e non resta nessun vuoto', () => {
    // 07 → 11 settembre, tolgo il 9.
    const e = ok(toglieUnGiorno({ calendario: calendario('2026-09-07', 5), idDaTogliere: 'id-2026-09-09', oggi: OGGI }));
    expect(e.idDaCancellare).toBe('id-2026-09-09');
    expect(e.spostamenti).toEqual([
      { id: 'id-2026-09-10', da: '2026-09-10', a: '2026-09-09' },
      { id: 'id-2026-09-11', da: '2026-09-11', a: '2026-09-10' },
    ]);
    // Le date che restano occupate, applicando tutto: 07, 08, 09, 10. Nessun salto.
    const dopo = ['2026-09-07', '2026-09-08', ...e.spostamenti.map((s) => s.a)].sort();
    for (let i = 1; i < dopo.length; i += 1) expect(giornoPrimaDi(dopo[i])).toBe(dopo[i - 1]);
  });

  it('⛔ gli spostamenti escono in ordine di data CRESCENTE: applicati al contrario il database rifiuta', () => {
    const e = ok(toglieUnGiorno({ calendario: calendario('2026-09-07', 6), idDaTogliere: `id-${OGGI}`, oggi: OGGI }));
    const date = e.spostamenti.map((s) => s.da);
    expect(date).toEqual([...date].sort());
    // Ogni destinazione è la data che il passo precedente ha appena liberato.
    expect(e.spostamenti[0].a).toBe(OGGI);
    for (let i = 1; i < e.spostamenti.length; i += 1) expect(e.spostamenti[i].a).toBe(e.spostamenti[i - 1].da);
  });

  it('⚠️ si libera l’ULTIMA data: è lì che il motore sa ricomporre', () => {
    const e = ok(toglieUnGiorno({ calendario: calendario('2026-09-07', 5), idDaTogliere: 'id-2026-09-08', oggi: OGGI }));
    expect(e.dataLiberata).toBe('2026-09-11');
  });

  it('togliendo l’ULTIMO giorno non si sposta niente e non si libera niente: è la coda di sempre', () => {
    const e = ok(toglieUnGiorno({ calendario: calendario('2026-09-07', 3), idDaTogliere: 'id-2026-09-09', oggi: OGGI }));
    expect(e.spostamenti).toEqual([]);
    expect(e.dataLiberata).toBeNull();
  });

  it('⛔ un calendario che ha già un vuoto non si peggiora: il vuoto resta UNO e arretra', () => {
    // 07, 08, 09, ⟂10, 11, 12 — manca il 10. Tolgo l’8.
    const cal: GiornoInCalendario[] = [
      { id: 'a', giorno: '2026-09-07' },
      { id: 'b', giorno: '2026-09-08' },
      { id: 'c', giorno: '2026-09-09' },
      { id: 'e', giorno: '2026-09-11' },
      { id: 'f', giorno: '2026-09-12' },
    ];
    const e = ok(toglieUnGiorno({ calendario: cal, idDaTogliere: 'b', oggi: OGGI }));
    const restano = ['2026-09-07', ...e.spostamenti.map((s) => s.a)];
    // Prima mancava il 10; adesso manca il 9. Uno prima, uno dopo.
    expect(restano.sort()).toEqual(['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11']);
    expect(e.dataLiberata).toBe('2026-09-12');
  });

  it('il calendario arriva disordinato e non cambia niente: si ordina qui', () => {
    const cal = calendario('2026-09-07', 4);
    const alRovescio = [...cal].reverse();
    expect(toglieUnGiorno({ calendario: alRovescio, idDaTogliere: `id-${OGGI}`, oggi: OGGI }))
      .toEqual(toglieUnGiorno({ calendario: cal, idDaTogliere: `id-${OGGI}`, oggi: OGGI }));
  });
});
