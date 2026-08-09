/**
 * Il preset «Mediterranea senza glutine» (richiesta di Simone del 9/8).
 *
 * Perché merita dei test suoi, quando è "solo" un oggetto di configurazione: le sue
 * `clinicalNotes` **non sono documentazione**, sono l'istruzione che il generatore passa
 * letteralmente all'AI («Regole cliniche da rispettare: …», vedi `generaRicetteDiUnPasto`). Se
 * qualcuno domani le accorcia per farle stare in una schermata, il generatore comincia a produrre
 * ricette col farro dentro e nessuno si accorge di niente finché non lo legge una cliente che il
 * glutine non lo può mangiare.
 *
 * Quindi qui si verifica una cosa sola, ma quella giusta: che il vincolo sia scritto, che i cereali
 * ammessi siano elencati (senza alternative il menu diventa riso e riso), e che l'avvertenza sulla
 * celiachia non sparisca.
 */

import { SUGGESTED_PRESETS } from './engine-rules.presets';

const preset = SUGGESTED_PRESETS.find((p) => p.label === 'Mediterranea senza glutine');
const mediterranea = SUGGESTED_PRESETS.find((p) => p.label === 'Mediterranea');

describe('preset Mediterranea senza glutine', () => {
  it('esiste ed è agganciato allo stile mediterranean', () => {
    expect(preset).toBeDefined();
    expect(preset?.style).toBe('mediterranean');
  });

  it('ha le REGOLE identiche alla Mediterranea: togliere il glutine non cambia i macro', () => {
    expect(preset?.rules).toEqual(mediterranea?.rules);
  });

  it('è una FAMIGLIA a sé: l\'etichetta diversa è ciò che le dà ricette proprie', () => {
    // `generateCatalogFromPreset` cerca la famiglia per (label, style, regime, objective): con la
    // stessa etichetta della Mediterranea si sarebbe attaccata alle sue ricette, col glutine dentro.
    expect(preset?.label).not.toBe(mediterranea?.label);
  });

  it.each([
    'frumento', 'farro', 'orzo', 'segale', 'couscous', 'bulgur', 'seitan', 'birra', 'pangrattato',
  ])('vieta esplicitamente «%s»', (vietato) => {
    expect(preset?.clinicalNotes?.toLowerCase()).toContain(vietato);
  });

  it.each([
    'riso', 'mais', 'grano saraceno', 'quinoa', 'miglio', 'patate', 'legumi', 'castagne',
  ])('elenca «%s» fra le alternative: senza queste il menu si impoverisce', (ammesso) => {
    expect(preset?.clinicalNotes?.toLowerCase()).toContain(ammesso);
  });

  it('l\'avena è ammessa solo certificata: è la trappola classica del senza glutine', () => {
    expect(preset?.clinicalNotes).toMatch(/avena SOLO se[^.]*certificata/i);
  });

  it('dice che NON è un piano per la celiachia, e perché', () => {
    const note = preset?.clinicalNotes ?? '';
    expect(note).toMatch(/celiachia/i);
    expect(note).toMatch(/contaminazione/i);
  });

  it('ricorda la fibra: i sostitutivi senza glutine ne hanno meno', () => {
    expect(preset?.clinicalNotes).toMatch(/fibra/i);
  });

  it('cita le fonti, come ogni altro preset', () => {
    expect(preset?.source?.length ?? 0).toBeGreaterThan(30);
  });
});
