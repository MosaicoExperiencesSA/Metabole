import { GiudiceService } from './giudice.service';

describe('GiudiceService (compliance gate)', () => {
  const g = new GiudiceService();

  it('passa una caption conforme (dal catalogo del socio)', () => {
    const r = g.check({
      caption: "Al matrimonio di mia figlia voglio esserci davvero. Un percorso con persone vere, al mio fianco.",
      hashtags: ['#benessere', '#nonèunadieta', '#metaboleai'],
    });
    expect(r.pass).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('boccia "prima e dopo"', () => {
    const r = g.check({ caption: 'Guarda il prima e dopo di Maria!' });
    expect(r.pass).toBe(false);
    expect(r.issues.join(' ')).toMatch(/prima\/dopo/i);
  });

  it('boccia numeri/tempi/garanzie insieme', () => {
    const r = g.check({ caption: 'Perdi 10 kg in 30 giorni, risultato garantito!' });
    expect(r.pass).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(3); // misure + tempo + garanzia
  });

  it('boccia la seconda persona su attributi fisici', () => {
    const r = g.check({ caption: 'Finalmente entri nel vestito dei tuoi sogni.' });
    expect(r.pass).toBe(false);
  });

  it('boccia il riferimento diretto al peso in seconda persona', () => {
    const r = g.check({ caption: 'Dimezza il tuo peso con noi.' });
    expect(r.pass).toBe(false);
    expect(r.issues.join(' ')).toMatch(/attributi fisici/i);
  });

  it('non ha falsi positivi su "i tuoi tempi"', () => {
    const r = g.check({ caption: 'Un percorso che rispetta i tuoi tempi, con persone vere.' });
    expect(r.pass).toBe(true);
  });
});
