import { nutrizionistaDiRiferimento } from './nutrizionista-di-riferimento';

/**
 * CHI RISPONDE DI UNA CLIENTE NUOVA, finché la nutrizionista è una sola.
 *
 * ⚠️ Il caso che conta è il terzo: se il capo non c'è, il campo resta vuoto. Riempirlo con «una
 * nutrizionista qualsiasi» sarebbe peggio del vuoto — il vuoto almeno si vede.
 */
describe('nutrizionistaDiRiferimento', () => {
  const finto = (righe: unknown[]) => ({ staff: { findMany: jest.fn().mockResolvedValue(righe) } });

  it('con il solo capo, è lui — e dice che non ce ne sono altre', async () => {
    const p = finto([{ id: 's-capo', userId: 'u-capo', user: { role: 'head_nutritionist' } }]);
    expect(await nutrizionistaDiRiferimento(p as never)).toEqual({ staffId: 's-capo', userId: 'u-capo', altre: 0 });
  });

  it('⚠️ con altre nutrizioniste risponde ancora il capo, ma le CONTA: è il momento di spegnere la regola', async () => {
    const p = finto([
      { id: 's-capo', userId: 'u-capo', user: { role: 'head_nutritionist' } },
      { id: 's-2', userId: 'u-2', user: { role: 'nutritionist' } },
      { id: 's-3', userId: 'u-3', user: { role: 'nutritionist' } },
    ]);
    const esito = await nutrizionistaDiRiferimento(p as never);
    expect(esito?.staffId).toBe('s-capo');
    expect(esito?.altre).toBe(2);
  });

  it('senza capo non si inventa un destinatario', async () => {
    const p = finto([{ id: 's-2', userId: 'u-2', user: { role: 'nutritionist' } }]);
    expect(await nutrizionistaDiRiferimento(p as never)).toBeNull();
  });

  it('senza nessuno, null', async () => {
    expect(await nutrizionistaDiRiferimento(finto([]) as never)).toBeNull();
  });
});
