import { compleanniDiOggi, parametriCompleanno } from './compleanni';

/**
 * GLI AUGURI CHE NON ARRIVAVANO (difetto trovato l'11/8).
 *
 * Prima: 500 clienti a caso (`take: 500` senza `orderBy`), poi il filtro su mese e giorno **in
 * JavaScript**. Con più di 500 clienti con la data di nascita, chi restava fuori da quei 500 non
 * riceveva gli auguri mai — sempre le stesse persone, senza un errore da nessuna parte.
 *
 * Il primo test è quello che conta: **il filtro sta nella query**. Se un domani qualcuno lo riporta in
 * JavaScript, questo test diventa rosso.
 */
const finto = (righe: unknown[]) => {
  const chiamate: { sql: string; valori: unknown[] }[] = [];
  const prisma = {
    $queryRaw: (strings: TemplateStringsArray, ...valori: unknown[]) => {
      chiamate.push({ sql: strings.join('?'), valori });
      return Promise.resolve(righe);
    },
  };
  return { prisma, chiamate };
};

const cliente = (n: number) => ({ id: `u${n}`, email: `c${n}@m.eu`, firstName: `Cliente ${n}` });

describe('compleanniDiOggi — il filtro lo fa il database', () => {
  it('la query filtra mese e giorno in SQL, non dopo', async () => {
    const { prisma, chiamate } = finto([cliente(1)]);
    await compleanniDiOggi(prisma, new Date('2026-08-11T10:00:00Z'), 500);
    const { sql, valori } = chiamate[0];
    expect(sql).toContain('EXTRACT(MONTH FROM birth_date)');
    expect(sql).toContain('EXTRACT(DAY FROM birth_date)');
    // 8 = agosto in convenzione SQL (i mesi partono da 1, non da 0 come in JavaScript).
    expect(valori).toContain(8);
    expect(valori).toContain(11);
  });

  it('ordina per id e chiede una riga in più del limite: serve a sapere se il freno è scattato', async () => {
    const { prisma, chiamate } = finto([]);
    await compleanniDiOggi(prisma, new Date('2026-08-11T10:00:00Z'), 500);
    expect(chiamate[0].sql).toContain('ORDER BY id');
    expect(chiamate[0].valori).toContain(501);
  });

  it('restituisce i festeggiati', async () => {
    const { prisma } = finto([cliente(1), cliente(2)]);
    const out = await compleanniDiOggi(prisma, new Date('2026-08-11T10:00:00Z'), 500);
    expect(out.map((f) => f.id)).toEqual(['u1', 'u2']);
  });

  it('nessun festeggiato non è un errore', async () => {
    const { prisma } = finto([]);
    expect(await compleanniDiOggi(prisma, new Date('2026-08-11T10:00:00Z'), 500)).toEqual([]);
  });
});

describe('parametriCompleanno — il 29 febbraio', () => {
  it('un giorno normale: mese e giorno di oggi, nessun recupero', () => {
    const p = parametriCompleanno(new Date('2026-08-11T10:00:00Z'));
    expect(p).toEqual({ mese: 8, giorno: 11, anno: 2026, recuperaVentinove: false });
  });

  it('i mesi partono da 1: gennaio è 1, non 0', () => {
    // Il difetto che questo test previene: passare `getUTCMonth()` a SQL, cioè cercare i nati a
    // dicembre il primo di gennaio.
    expect(parametriCompleanno(new Date('2026-01-15T00:00:00Z')).mese).toBe(1);
    expect(parametriCompleanno(new Date('2026-12-15T00:00:00Z')).mese).toBe(12);
  });

  it('1° marzo di un anno NON bisestile: si recuperano i nati il 29 febbraio', () => {
    expect(parametriCompleanno(new Date('2026-03-01T09:00:00Z')).recuperaVentinove).toBe(true);
  });

  it('1° marzo di un anno bisestile: niente recupero, gli auguri sono partiti ieri', () => {
    expect(parametriCompleanno(new Date('2028-03-01T09:00:00Z')).recuperaVentinove).toBe(false);
  });

  it('il 29 febbraio vero non ha bisogno di recuperi', () => {
    const p = parametriCompleanno(new Date('2028-02-29T09:00:00Z'));
    expect(p).toEqual({ mese: 2, giorno: 29, anno: 2028, recuperaVentinove: false });
  });

  it('un altro giorno di marzo non recupera nessuno', () => {
    expect(parametriCompleanno(new Date('2026-03-02T09:00:00Z')).recuperaVentinove).toBe(false);
  });

  it('gli anni secolari: 1900 non è bisestile, 2000 sì', () => {
    // La regola completa, non solo «divisibile per 4». Vale per chi è nato nel 1900 — nessuno, oggi —
    // ma soprattutto per il 2100, che arriverà.
    expect(parametriCompleanno(new Date('1900-03-01T00:00:00Z')).recuperaVentinove).toBe(true);
    expect(parametriCompleanno(new Date('2000-03-01T00:00:00Z')).recuperaVentinove).toBe(false);
    expect(parametriCompleanno(new Date('2100-03-01T00:00:00Z')).recuperaVentinove).toBe(true);
  });
});
