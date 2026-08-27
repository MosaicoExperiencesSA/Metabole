import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * ⛔ **IL SEGNALE «HO APERTO QUESTO GIORNO»** — 26/8, voce `visto-non-vuol-dire-aperto`.
 *
 * Il server aveva un solo dato, `viewedAt`, e lo scriveva su TUTTI i giorni della finestra a ogni
 * apertura dell'app: bastava aprirla una volta perché tutto il futuro risultasse letto, e
 * «rifai i giorni già preparati» non trovava più niente. Questo modulo manda l'altra metà.
 */
vi.mock('../api/client', () => ({
  api: vi.fn(() => Promise.resolve(undefined)),
  isOspite: vi.fn(() => false),
}));
const { api, isOspite } = await import('../api/client');
let segnaGiornoAperto: (g: string | null | undefined) => void;
let dimenticaAperture: () => void;

beforeEach(async () => {
  vi.resetModules();
  vi.mocked(api).mockClear();
  vi.mocked(api).mockResolvedValue(undefined as never);
  vi.mocked(isOspite).mockReturnValue(false);
  ({ segnaGiornoAperto, dimenticaAperture } = await import('./giorno-aperto'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('segnaGiornoAperto', () => {
  it('manda il giorno che la cliente sta guardando', () => {
    segnaGiornoAperto('2026-08-27');
    expect(api).toHaveBeenCalledWith('/me/menu/aperto', { method: 'POST', body: JSON.stringify({ giorno: '2026-08-27' }) });
  });

  it('la data completa si accorcia al giorno: al server serve il giorno, non l\'istante', () => {
    segnaGiornoAperto('2026-08-27T00:00:00.000Z');
    expect(vi.mocked(api).mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ giorno: '2026-08-27' }) });
  });

  /**
   * ⚠️ Si scorre il calendario avanti e indietro: senza questo, ogni tocco sarebbe una chiamata. Il
   * server la scriverebbe una volta sola comunque, ma il traffico resterebbe.
   */
  it('⚠️ lo stesso giorno non si manda due volte', () => {
    segnaGiornoAperto('2026-08-27');
    segnaGiornoAperto('2026-08-27');
    segnaGiornoAperto('2026-08-28');
    expect(api).toHaveBeenCalledTimes(2);
  });

  /**
   * ⛔ **Un errore di rete non deve far perdere il segnale per sempre.** Se restasse segnato come
   * «già mandato», quel giorno resterebbe «non lo so» per il server finché lei non chiude l'app — e
   * nessuno lo rifarebbe, senza che si veda da nessuna parte.
   */
  it('⛔ se la chiamata fallisce, il giorno si rimanda — ma dopo l\'attesa', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'));
    vi.mocked(api).mockRejectedValueOnce(new Error('rete'));
    segnaGiornoAperto('2026-08-27');
    await Promise.resolve();
    await Promise.resolve();
    vi.setSystemTime(new Date('2026-08-27T10:02:00Z'));
    segnaGiornoAperto('2026-08-27');
    expect(api).toHaveBeenCalledTimes(2);
  });

  /**
   * ⛔ **E PRIMA DELL'ATTESA NON SI RIPROVA.** `Menu.tsx` chiama questa funzione a ogni disegno: col
   * server irraggiungibile, riprovare subito vuol dire una richiesta per fotogramma sul telefono di
   * chi ha già la rete che non va.
   */
  it('⛔ col server giù non riprova a ogni disegno', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'));
    vi.mocked(api).mockRejectedValue(new Error('rete'));
    segnaGiornoAperto('2026-08-27');
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 0; i < 20; i++) segnaGiornoAperto('2026-08-27');
    expect(api).toHaveBeenCalledTimes(1);
  });

  /**
   * ⛔ **«Passa all'altro profilo» cambia persona senza ricaricare la pagina** (madre e figlia sullo
   * stesso telefono): l'elenco dei giorni già mandati è di chi è collegato adesso, non del modulo.
   */
  it('⛔ dopo il cambio profilo lo stesso giorno si manda di nuovo', () => {
    segnaGiornoAperto('2026-08-27');
    dimenticaAperture();
    segnaGiornoAperto('2026-08-27');
    expect(api).toHaveBeenCalledTimes(2);
  });

  /**
   * ⛔ **«Entra come»**: sta guardando lo staff, non la cliente. Segnare il giorno come aperto da lei
   * lo renderebbe intoccabile per i rifacimenti — per una schermata che lei non ha mai visto.
   */
  it('⛔ chi guarda con «Entra come» non apre niente', () => {
    vi.mocked(isOspite).mockReturnValue(true);
    segnaGiornoAperto('2026-08-27');
    expect(api).not.toHaveBeenCalled();
  });

  it('una data che non è una data non si manda', () => {
    for (const brutta of ['', null, undefined, 'domani', '27/08/2026']) segnaGiornoAperto(brutta as never);
    expect(api).not.toHaveBeenCalled();
  });
});
