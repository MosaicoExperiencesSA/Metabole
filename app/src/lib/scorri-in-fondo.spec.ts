import { describe, expect, it } from 'vitest';
import { portaInFondo } from './scorri-in-fondo';

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
