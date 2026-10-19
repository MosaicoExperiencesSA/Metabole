import { componiReport, destinatariDaTesto, eNuova, type RigaReport } from './report-giornaliero';

describe('Invito a Gaia — il report del mattino (parte pura)', () => {
  const ADESSO = new Date('2026-10-20T05:00:00Z'); // 7:00 a Roma
  const riga = (nome: string, quando: string | null, extra: Partial<RigaReport> = {}): RigaReport => ({
    nome, cognome: 'Rossi', email: `${nome.toLowerCase()}@x.it`, telefono: '+39 333 1234567',
    quando: quando ? new Date(quando) : null, scheda: `https://bo.x/crm/lead/${nome}`, ...extra,
  });

  it('destinatari: uno per riga o con virgole, minuscoli, validi, senza doppioni; vuoto = nessuno', () => {
    expect(destinatariDaTesto('giusy@metabole.eu\nGiusy@Metabole.eu, simone@x.it;  non-email \n')).toEqual(['giusy@metabole.eu', 'simone@x.it']);
    expect(destinatariDaTesto('')).toEqual([]);
    expect(destinatariDaTesto(null)).toEqual([]);
  });

  it('«nuova» = ultime 24 ore, non un minuto di più', () => {
    expect(eNuova(new Date('2026-10-19T05:00:01Z'), ADESSO)).toBe(true);
    expect(eNuova(new Date('2026-10-19T05:00:00Z'), ADESSO)).toBe(false);
    expect(eNuova(null, ADESSO)).toBe(false);
  });

  it('i totali sono quelli delle caselle, anche quando le righe sono tagliate', () => {
    const { subject, html } = componiReport({
      cliccati: [riga('Anna', '2026-10-19T18:00:00Z', { entrata: true }), riga('Bea', '2026-10-10T10:00:00Z', { entrata: false })],
      totaleCliccati: 39,
      entrate: [riga('Anna', '2026-10-19T19:00:00Z')],
      totaleEntrate: 22,
      adesso: ADESSO,
      fuso: 'Europe/Rome',
      pannello: 'https://bo.x/marketing',
    });
    expect(subject).toBe('Invito a Gaia — 20/10/2026: 1 nuovi clic, 1 nuove entrate');
    expect(html).toContain('Hanno cliccato: 39');
    expect(html).toContain('Sono entrate: 22');
    expect(html).toContain('le 2 più recenti su 39');
    // L'ora è quella di Roma: le 18:00 UTC del 19/10 sono le 20:00.
    expect(html).toContain('19/10/2026, 20:00');
    expect(html).toContain('https://bo.x/crm/lead/Bea');
    expect(html).toContain('tel:+39 333 1234567');
    // Il contrassegno sta nella cella del nome; il «NUOVA» della riga di spiegazione in cima non conta.
    expect((html.match(/NUOVA<\/b><\/td>/g) ?? []).length).toBe(2);
  });

  it('i nomi arrivano da fuori: si scrivono, non si eseguono', () => {
    const { html } = componiReport({
      cliccati: [riga('<script>x</script>', null)], totaleCliccati: 1, entrate: [], totaleEntrate: 0,
      adesso: ADESSO, fuso: 'Europe/Rome', pannello: 'https://bo.x/marketing',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Nessuna, per ora.');
  });
});
