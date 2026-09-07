/**
 * LA ✕ SU UN GIORNO DI MENU (Simone, 7/9) — le tre cose che, tolte, non farebbero fallire niente
 * altro e si scoprirebbero in produzione.
 *
 * ⚠️ Sentinella **sul sorgente**, come le altre di questa cartella: la finestra dei menu vive dentro
 * `ClientDetail.tsx`, tremila righe con dieci popup, e montarla in una prova vorrebbe dire montare
 * mezza scheda cliente. Qui si guarda che le tre regole siano scritte dove devono.
 */
import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./ClientDetail.tsx', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const scheda = sorgenti['./ClientDetail.tsx'] ?? '';

describe('togliere un giorno di menu, dalla scheda cliente', () => {
  it('⛔ ha una chiave sua, e chiede «gestisce»: non basta poter aprire la scheda', () => {
    expect(scheda).toMatch(/can\('cancella_giorno_menu',\s*'manage'\)/);
  });

  it('⛔ la ✕ compare solo da OGGI in poi: un giorno già vissuto non si fa scorrere indietro', () => {
    expect(scheda).toMatch(/puoTogliereUnGiorno && day\.date >= oggiIso/);
  });

  it('⚠️ la conferma dice che i giorni dopo SCALANO e che il motore ricompone: è la parte che nessuno si aspetta', () => {
    expect(scheda).toContain('scalano indietro di uno');
    expect(scheda).toContain('il motore ricompone');
  });

  it('⚠️ e sul giorno di OGGI avverte che il menu può sparire sotto gli occhi della cliente', () => {
    expect(scheda).toMatch(/const oggi = day\.date === oggiIso/);
    expect(scheda).toContain('quello di domani');
  });

  it('la cancellazione passa dalla rotta dei menu della cliente, non da una scorciatoia', () => {
    expect(scheda).toMatch(/\/admin\/clients\/\$\{id\}\/menus\/\$\{day\.id\}`,\s*\{\s*method:\s*'DELETE'/);
  });

  it('⚠️ dopo si RICARICA lo stesso periodo che si stava guardando, non la finestra di default', () => {
    expect(scheda).toMatch(/await openMenus\(menusPeriodo \?\? undefined\)/);
  });
});
