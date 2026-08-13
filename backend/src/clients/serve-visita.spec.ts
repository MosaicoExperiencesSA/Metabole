/**
 * «Serve la visita» in automatico — i criteri di Nocanty (13/8, pagina Lavori; Decisioni §15):
 * «allergia dichiarata, utilizzo farmaci, problemi sanitari».
 *
 * I blocchi che contano sono i NO: una valutazione clinica già scritta non si riapre da un
 * automatismo, e senza criteri non parte niente.
 */
import { apriServeVisita } from './serve-visita';
import * as segnalazioni from '../escalations/apri-segnalazione';

jest.mock('../escalations/apri-segnalazione', () => ({
  apriSegnalazione: jest.fn().mockResolvedValue({ id: 'esc-1' }),
}));

const prismaCon = (profilo: Record<string, unknown> | null) =>
  ({ clientProfile: { findUnique: jest.fn().mockResolvedValue(profilo) } }) as never;

beforeEach(() => jest.clearAllMocks());

describe('apriServeVisita', () => {
  it('allergia dichiarata e nessuna valutazione: apre, e il motivo dice perché', async () => {
    const esito = await apriServeVisita(prismaCon({ allergies: ['latte'], screeningFlag: false, idoneita: null }), 'c1', 'scheda-in-home');
    expect(esito.aperta).toBe(true);
    const input = (segnalazioni.apriSegnalazione as jest.Mock).mock.calls[0][1];
    expect(input.clientId).toBe('c1');
    expect(input.category).toBe('clinical');
    expect(input.reason).toContain('allergia dichiarata');
    expect(input.reason).toContain('scheda-in-home');
  });

  it('farmaci o patologie (screeningFlag) bastano da soli', async () => {
    const esito = await apriServeVisita(prismaCon({ allergies: [], screeningFlag: true, idoneita: null }), 'c1', 'questionario');
    expect(esito.aperta).toBe(true);
    expect((segnalazioni.apriSegnalazione as jest.Mock).mock.calls[0][1].reason).toContain('farmaci');
  });

  it('una valutazione clinica GIÀ SCRITTA non si riapre da un automatismo', async () => {
    for (const idoneita of ['idonea', 'serve_visita']) {
      const esito = await apriServeVisita(prismaCon({ allergies: ['latte'], screeningFlag: true, idoneita }), 'c1', 'campagna-allergie');
      expect(esito.aperta).toBe(false);
    }
    expect(segnalazioni.apriSegnalazione).not.toHaveBeenCalled();
  });

  it('senza criteri non parte niente — e nemmeno senza profilo', async () => {
    expect((await apriServeVisita(prismaCon({ allergies: [], screeningFlag: false, idoneita: null }), 'c1', 'x')).aperta).toBe(false);
    expect((await apriServeVisita(prismaCon(null), 'c1', 'x')).aperta).toBe(false);
    expect(segnalazioni.apriSegnalazione).not.toHaveBeenCalled();
  });
});
