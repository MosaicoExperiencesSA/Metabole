import { dominioDi, giudicaDominio, PostaDeiDomini, serveIndirizzo, EsitoDominio } from './posta-del-dominio';

const mx = (...exchange: string[]) => ({ record: exchange.map((e) => ({ exchange: e })) });
const err = (errore: string) => ({ errore });
const ip = (...r: string[]) => ({ record: r });

describe('giudicaDominio', () => {
  it('dominio inesistente (gmail.con): non riceve', () => {
    expect(giudicaDominio(err('ENOTFOUND'))).toBe('non_riceve');
  });

  it('MX vero: riceve', () => {
    expect(giudicaDominio(mx('mx.libero.it'))).toBe('riceve');
  });

  it('null MX (RFC 7505): il dominio dichiara di non ricevere', () => {
    expect(giudicaDominio(mx(''))).toBe('non_riceve');
    expect(giudicaDominio(mx('.'))).toBe('non_riceve');
  });

  it('senza MX ma con un indirizzo (posta.istruzione.it): riceve, come vuole la RFC 5321', () => {
    expect(serveIndirizzo(err('ENODATA'))).toBe(true);
    expect(giudicaDominio(err('ENODATA'), [ip('1.2.3.4'), err('ENODATA')])).toBe('riceve');
    expect(giudicaDominio(mx(), [err('ENODATA'), ip('::1')])).toBe('riceve');
  });

  it('senza MX e senza indirizzo: non riceve', () => {
    expect(giudicaDominio(err('ENODATA'), [err('ENODATA'), err('ENODATA')])).toBe('non_riceve');
  });

  it('nel dubbio NON si scarta: DNS lento o rotto dà non_so', () => {
    expect(giudicaDominio(err('ETIMEOUT'))).toBe('non_so');
    expect(giudicaDominio(err('ESERVFAIL'))).toBe('non_so');
    expect(giudicaDominio(err('ENODATA'), [err('ETIMEOUT'), err('ENODATA')])).toBe('non_so');
    expect(giudicaDominio(err('ENODATA'))).toBe('non_so');
  });

  it('se il MX basta, non si chiede l indirizzo', () => {
    expect(serveIndirizzo(mx('mx.gmail.com'))).toBe(false);
    expect(serveIndirizzo(err('ENOTFOUND'))).toBe(false);
  });
});

describe('dominioDi', () => {
  it('prende quello dopo l ultima @, in minuscolo', () => {
    expect(dominioDi(' Mario@Gmail.CON ')).toBe('gmail.con');
    expect(dominioDi('a"@"b@example.com')).toBe('example.com');
    expect(dominioDi('senza-chiocciola')).toBeNull();
    expect(dominioDi(null)).toBeNull();
  });
});

describe('PostaDeiDomini.senzaPosta', () => {
  const finto = (esiti: Record<string, EsitoDominio | Error>) => {
    const chiesti: string[] = [];
    const p = PostaDeiDomini.conInterroga(async (d) => {
      chiesti.push(d);
      const e = esiti[d] ?? 'riceve';
      if (e instanceof Error) throw e;
      return e;
    });
    return { p, chiesti };
  };

  it('restituisce solo i domini che sicuramente non ricevono', async () => {
    const { p } = finto({ 'gmail.con': 'non_riceve', 'lento.it': 'non_so', 'rotto.it': new Error('boom') });
    const s = await p.senzaPosta(['a@example.com', 'b@gmail.con', 'c@lento.it', 'd@rotto.it', null, 'x']);
    expect([...s]).toEqual(['gmail.con']);
  });

  it('un dominio si chiede una volta sola, anche se compare in cento indirizzi', async () => {
    const { p, chiesti } = finto({});
    await p.senzaPosta(['a@example.com', 'B@EXAMPLE.COM', 'c@example.com', 'd@x.it']);
    expect(chiesti.sort()).toEqual(['example.com', 'x.it']);
  });

  it('la risposta si ricorda per un giorno; poi si richiede', async () => {
    const { p, chiesti } = finto({ 'gmail.con': 'non_riceve' });
    const t0 = 1_000_000;
    await p.senzaPosta(['a@gmail.con'], t0);
    expect([...(await p.senzaPosta(['b@gmail.con'], t0 + 3600_000))]).toEqual(['gmail.con']);
    expect(chiesti).toEqual(['gmail.con']);
    await p.senzaPosta(['c@gmail.con'], t0 + 25 * 3600_000);
    expect(chiesti).toEqual(['gmail.con', 'gmail.con']);
  });

  it('non_so NON si ricorda: al giro dopo si richiede', async () => {
    const { p, chiesti } = finto({ 'lento.it': 'non_so' });
    await p.senzaPosta(['a@lento.it'], 1);
    await p.senzaPosta(['a@lento.it'], 2);
    expect(chiesti).toEqual(['lento.it', 'lento.it']);
  });
});
