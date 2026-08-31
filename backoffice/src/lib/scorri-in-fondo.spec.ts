import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agganciaInFondo, portaInFondo } from './scorri-in-fondo';

describe('una chat si apre sull\'ultimo messaggio', () => {
  it('porta la scatola in fondo', () => {
    const el = { scrollTop: 0, scrollHeight: 1200 };
    portaInFondo(el);
    expect(el.scrollTop).toBe(1200);
  });

  /**
   * ⚠️ Il caso vero: la lista è già scorsa a metà (la coach stava leggendo), arrivano messaggi nuovi
   * e la scatola deve tornare in fondo — non restare dov'era.
   */
  it('anche quando era già scorsa a metà', () => {
    const el = { scrollTop: 300, scrollHeight: 2000 };
    portaInFondo(el);
    expect(el.scrollTop).toBe(2000);
  });

  it('⚠️ e senza elemento non esplode: la card si monta prima dei messaggi', () => {
    expect(() => portaInFondo(null)).not.toThrow();
    expect(() => portaInFondo(undefined)).not.toThrow();
  });
});

/**
 * ⛔ **IL DIFETTO DEL 31/8**: la pagina dell'assistente si apriva su messaggi del 26/8. Il codice per
 * scorrere c'era — ma girava mentre al posto della scatola c'era ancora la rotellina, cioè su
 * `null`. Queste prove stanno sull'aggancio, che è il punto in cui la scatola esiste per certo.
 */
describe('la scatola si scorre quando si attacca', () => {
  type Scatola = { scrollTop: number; scrollHeight: number };
  /**
   * ⚠️ Qui si collauda in `node`, dove `requestAnimationFrame` non esiste: si mette e si toglie, così
   * il secondo giro viene provato davvero invece di essere saltato dalla guardia.
   */
  const g = globalThis as unknown as { requestAnimationFrame?: (cb: () => void) => unknown };
  const primaDelFrame = g.requestAnimationFrame;
  beforeEach(() => { g.requestAnimationFrame = (cb) => setTimeout(cb, 0); });
  afterEach(() => { g.requestAnimationFrame = primaDelFrame; });
  const frame = () => new Promise((r) => setTimeout(r, 1));

  it('⛔ appena la scatola compare, è già in fondo — e il ref resta riempito', () => {
    const ref: { current: Scatola | null } = { current: null };
    const scatola: Scatola = { scrollTop: 0, scrollHeight: 5000 };
    agganciaInFondo(ref)(scatola);
    expect(scatola.scrollTop).toBe(5000);
    // ⚠️ Il ref serve ancora all'effetto dei messaggi nuovi: l'aggancio lo riempie, non lo sostituisce.
    expect(ref.current).toBe(scatola);
  });

  it('⚠️ e ci torna dopo il frame, quando le altezze sono quelle vere', async () => {
    const ref: { current: Scatola | null } = { current: null };
    const scatola: Scatola = { scrollTop: 0, scrollHeight: 1000 };
    agganciaInFondo(ref)(scatola);
    // Le bolle vanno a capo dopo il primo disegno: la scatola si allunga.
    scatola.scrollHeight = 4200;
    await frame();
    expect(scatola.scrollTop).toBe(4200);
  });

  it('quando si stacca svuota il ref e non esplode', async () => {
    const ref: { current: Scatola | null } = { current: { scrollTop: 0, scrollHeight: 10 } };
    expect(() => agganciaInFondo(ref)(null)).not.toThrow();
    expect(ref.current).toBeNull();
    await frame();
  });

  it('⚠️ un elemento staccato subito dopo non viene toccato al secondo giro', async () => {
    const ref: { current: Scatola | null } = { current: null };
    const attacca = agganciaInFondo(ref);
    const scatola: Scatola = { scrollTop: 0, scrollHeight: 800 };
    attacca(scatola);
    scatola.scrollTop = 120; // qualcuno scorre indietro
    attacca(null); // …e la card si chiude
    scatola.scrollHeight = 9000;
    await frame();
    expect(scatola.scrollTop).toBe(120);
  });

  it('senza `requestAnimationFrame` (collaudo in node) il primo giro basta e non si rompe niente', () => {
    g.requestAnimationFrame = undefined;
    const ref: { current: Scatola | null } = { current: null };
    const scatola: Scatola = { scrollTop: 0, scrollHeight: 300 };
    expect(() => agganciaInFondo(ref)(scatola)).not.toThrow();
    expect(scatola.scrollTop).toBe(300);
  });
});
