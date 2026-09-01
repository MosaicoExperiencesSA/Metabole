import { readFileSync } from 'fs';
import { join } from 'path';
import { IMPOSSIBILI, combinazioneImpossibile } from './appartenenza-panieri';

/**
 * ⛔ **KETO E VEGANO INSIEME NON È UNA DIETA MAGRA DI RICETTE: NON È UNA DIETA.**
 *
 * Decisione del 31/8, Fase 5 del piano panieri: *«chi le chiede legge "combinazione non possibile",
 * non un paniere vuoto — che sembra un problema temporaneo e nessuno lo guarda»*.
 */
describe('le combinazioni che non si possono fare', () => {
  it('⛔ keto + vegano si ferma, e dice perché', () => {
    for (const chiave of IMPOSSIBILI) {
      const [famiglia, regime] = chiave.split('|');
      const motivo = combinazioneImpossibile(famiglia, regime);
      expect(motivo).toBeTruthy();
      expect(motivo).toContain(famiglia);
      expect(motivo).toContain(regime);
    }
  });

  /**
   * ⚠️ **Un rifiuto senza un'alternativa lascia la cliente ferma davanti a una schermata.** Se il
   * vegano è la sua scelta di vita e la keto è quella che le hanno consigliato, qualcuno deve dirle
   * quale delle due si può tenere. Le famiglie proposte sono quelle in cui vanno a finire le
   * ricette di quella cella: sono i panieri che quei piatti li hanno davvero.
   */
  it('⚠️ e non dice solo di no: dice dove andare', () => {
    const motivo = combinazioneImpossibile('Keto (non terapeutica)', 'vegan');
    expect(motivo).toContain('Low carb');
    expect(motivo).toContain('Basso indice glicemico');
  });

  it('tutto il resto si può fare, e la porta tace', () => {
    expect(combinazioneImpossibile('Mediterranea', 'vegan')).toBeNull();
    expect(combinazioneImpossibile('Keto (non terapeutica)', 'omnivore')).toBeNull();
    expect(combinazioneImpossibile('Keto (non terapeutica)', 'vegetarian')).toBeNull();
  });

  /**
   * ⚠️ Metà coppia non è una combinazione: durante l'onboarding il regime arriva prima della
   * famiglia, e rifiutare a metà strada vorrebbe dire fermare chi non ha ancora scelto niente.
   */
  it('⚠️ con solo metà della coppia non si rifiuta niente', () => {
    expect(combinazioneImpossibile('Keto (non terapeutica)', null)).toBeNull();
    expect(combinazioneImpossibile(null, 'vegan')).toBeNull();
    expect(combinazioneImpossibile('', '')).toBeNull();
    expect(combinazioneImpossibile('  ', '  ')).toBeNull();
  });

  it('e gli spazi attorno ai nomi non aprono una porta di servizio', () => {
    expect(combinazioneImpossibile('  Keto (non terapeutica)  ', ' vegan ')).toBeTruthy();
  });
});

/**
 * ⛔ **E il rifiuto dev'essere APPLICATO, non solo disponibile.** Una funzione giusta che nessuno
 * chiama non ferma niente: la cliente continuerebbe a ottenere il paniere vuoto.
 */
describe('il rifiuto è applicato dove si sceglie', () => {
  const src = readFileSync(join(__dirname, '..', 'profile', 'profile.service.ts'), 'utf8');

  it('⛔ `updateProfile` lo chiede prima di salvare', () => {
    expect(src).toMatch(/const impossibile = combinazioneImpossibile\(famigliaDopo, regimeDopo\);/);
    expect(src).toMatch(/if \(impossibile\) throw new BadRequestException\(impossibile\);/);
  });

  /**
   * ⛔ **Si guarda la coppia che RESTA, non quella che arriva.** Chi cambia solo il regime lascia
   * la famiglia com'era: guardando il solo campo nuovo passerebbe proprio il caso in cui la
   * combinazione impossibile **nasce** — una cliente vegana che passa alla keto.
   */
  it('⛔ e guarda la coppia dopo la modifica, non solo i campi cambiati', () => {
    expect(src).toMatch(/dto\.dietFamily !== undefined \? dto\.dietFamily :/);
    expect(src).toMatch(/dto\.regime !== undefined \? dto\.regime :/);
  });
});
