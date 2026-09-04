/**
 * ⛔ **LE PROVE DEL DISTURBO: la riga in app non si spegne, la push sì.**
 *
 * La distinzione che questo modulo esiste per tenere: una casella del profilo toglie la push,
 * **non** la segnalazione dall'elenco. Quella è lo stato che tiene ferma un'erogazione.
 */
import { chiVaDisturbato } from './canali-della-segnalazione';

describe('chiVaDisturbato', () => {
  const utenti = [{ id: 'nutri', prefs: {} }, { id: 'coach', prefs: {} }];

  it('su «piano bloccato» disturba la nutrizionista E la coach', () => {
    expect(chiVaDisturbato(['nutri', 'coach'], utenti, 'diet_blocked')).toEqual(['nutri', 'coach']);
  });

  it('chi ha spento quel tipo non viene disturbato', () => {
    const conSpento = [{ id: 'nutri', prefs: { notificationsDisabled: ['escalation_diet_blocked'] } }, utenti[1]];
    expect(chiVaDisturbato(['nutri', 'coach'], conSpento, 'diet_blocked')).toEqual(['coach']);
  });

  /** ⚠️ L'opt-out è PER TIPO: spegnere «bassa aderenza» non spegne «piano bloccato». */
  it('l\'opt-out vale solo per il tipo che nomina', () => {
    const altro = [{ id: 'nutri', prefs: { notificationsDisabled: ['escalation_low_adherence'] } }];
    expect(chiVaDisturbato(['nutri'], altro, 'diet_blocked')).toEqual(['nutri']);
    expect(chiVaDisturbato(['nutri'], altro, 'low_adherence')).toEqual([]);
  });

  /**
   * ⛔ **Non trovare la riga utente non è un opt-out.** Trattarlo come tale vorrebbe dire che un
   * singhiozzo del database spegne un allarme, in silenzio e proprio quando serve.
   */
  it('un destinatario di cui non si sa niente viene disturbato lo stesso', () => {
    expect(chiVaDisturbato(['sconosciuto'], [], 'diet_blocked')).toEqual(['sconosciuto']);
  });

  it('tiene l\'ordine dei destinatari, non quello degli utenti letti', () => {
    expect(chiVaDisturbato(['coach', 'nutri'], utenti, 'diet_blocked')).toEqual(['coach', 'nutri']);
  });
});
