import { I18nService, hashString } from './i18n.service';
import { CATALOGS } from './messages';

describe('I18nService (multilingua, spec sez. 12)', () => {
  const i18n = new I18nService();

  it('normalizza i locale: en-US → en, de/vuoto/sconosciuto → it', () => {
    expect(i18n.normalize('en-US')).toBe('en');
    expect(i18n.normalize('EN')).toBe('en');
    expect(i18n.normalize('de')).toBe('it');
    expect(i18n.normalize(undefined)).toBe('it');
    expect(i18n.normalize(null)).toBe('it');
  });

  it('rende il testo nella lingua giusta con interpolazione', () => {
    const it = i18n.render('it', 'pre_event_upcoming', { days: 2, eventLabel: 'Matrimonio' });
    const en = i18n.render('en', 'pre_event_upcoming', { days: 2, eventLabel: 'Wedding' });
    expect(it.title).toBe('Evento tra 2 giorni');
    expect(en.title).toBe('Event in 2 days');
  });

  it('fallback su it per chiavi mancanti in en e per chiavi inesistenti', () => {
    // chiave inesistente: non esplode
    const missing = i18n.render('en', 'chiave_che_non_esiste');
    expect(missing.title).toBe('chiave_che_non_esiste');
  });

  it('la scelta della variante è deterministica per seed e varia col seed', () => {
    const a1 = i18n.render('it', 'checkin_reminder', undefined, 'utente1:2026-07-10');
    const a2 = i18n.render('it', 'checkin_reminder', undefined, 'utente1:2026-07-10');
    expect(a1.body).toBe(a2.body); // stesso seed → stesso testo
    const bodies = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => i18n.render('it', 'checkin_reminder', undefined, s).body),
    );
    expect(bodies.size).toBeGreaterThan(1); // seed diversi → varietà
  });

  it('OGNI chiave italiana esiste anche in inglese (catalogo completo)', () => {
    for (const key of Object.keys(CATALOGS.it)) {
      expect(CATALOGS.en[key]).toBeDefined();
    }
    for (const key of Object.keys(CATALOGS.en)) {
      expect(CATALOGS.it[key]).toBeDefined();
    }
  });

  it('i parametri non forniti restano visibili (nessun undefined nel testo)', () => {
    const out = i18n.interpolate('Ciao {nome}, mancano {days} giorni', { days: 3 });
    expect(out).toBe('Ciao {nome}, mancano 3 giorni');
  });

  it('hashString è stabile e non negativo', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).toBeGreaterThanOrEqual(0);
  });
});
