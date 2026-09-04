import { describe, expect, it } from 'vitest';

const sorgenti = import.meta.glob(['./Parametri.tsx', './ClientDetail.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const parametri = sorgenti['./Parametri.tsx'] ?? '';
const scheda = sorgenti['./ClientDetail.tsx'] ?? '';

/**
 * ⛔ **LA COACH DI RISERVA NEL BACKOFFICE** (Simone, 4/9). Due cose che una consegna parallela
 * può togliere senza che niente diventi rosso:
 *
 * · nei Parametri la riserva si sceglie fra le PERSONE, non scrivendo un id — e la tendina ammette
 *   anche una commerciale, perché Giusy lo è;
 * · nella scheda cliente la riserva compare fra le coach assegnabili anche se `role=coach` non la
 *   elenca: altrimenti l'unica persona assegnata in automatico sarebbe l'unica che a mano non si
 *   può scegliere.
 */
describe('la coach di riserva nei Parametri', () => {
  it('⛔ ha un\'etichetta, è una tendina di persone, e ammette la commerciale', () => {
    const voce = parametri.slice(parametri.indexOf('coach_di_riserva:'), parametri.indexOf('assign_head_nutritionist_by_default:'));
    expect(voce).toMatch(/kind: 'staff'/);
    expect(voce).toMatch(/ruoli: \[[^\]]*'sales'[^\]]*\]/);
    expect(voce).toMatch(/label: 'Coach di riserva'/);
  });

  it('⛔ «nessuna» si salva come «off», non come casella vuota (che il backend rifiuta)', () => {
    expect(parametri).toMatch(/<option value="off">— nessuna/);
  });

  /** ⛔ Il caso trovato in revisione: ruolo cambiato → la persona sparisce dalla tendina e la pagina mostra «regola spenta». */
  it('⛔ un valore salvato che non è più fra le scelte si vede lo stesso, confrontato con l\'elenco FILTRATO', () => {
    expect(parametri).toMatch(/!scelteStaff\(m\)\.some\(\(u\) => u\.id === draft\[p\.key\]\)/);
  });

  it('⚠️ e il gruppo ha un posto nell\'ordine', () => {
    expect(parametri).toMatch(/GROUP_ORDER = \[[^\]]*'Presa in carico'/);
  });
});

describe('la coach di riserva nella scheda cliente', () => {
  it('⛔ si chiede al backend chi è, e si aggiunge alla tendina se non c\'è già', () => {
    expect(scheda).toContain("api<Riserva>('/admin/coach-di-riserva')");
    expect(scheda).toMatch(/coachOpts\.push\(\{ id: riserva\.staffId, name: `\$\{riserva\.displayName\} · coach di riserva` \}\)/);
  });

  it('⚠️ togliere la coach dice che la cliente è passata alla riserva', () => {
    expect(scheda).toContain('esito?.coachDiRiserva');
    expect(scheda).toContain('la cliente è passata alla coach di riserva');
  });
});
