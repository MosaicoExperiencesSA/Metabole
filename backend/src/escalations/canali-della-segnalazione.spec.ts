/**
 * ⛔ **LE PROVE DEL DISTURBO: la riga in app non si spegne, la push sì.**
 *
 * La distinzione che questo modulo esiste per tenere: una casella del profilo toglie la push,
 * **non** la segnalazione dall'elenco. Quella è lo stato che tiene ferma un'erogazione.
 */
import { chiRicevePostaAncheLei, chiVaDisturbato, CATEGORIE_CON_EMAIL } from './canali-della-segnalazione';

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

describe('chiRicevePostaAncheLei', () => {
  const utenti = [
    { id: 'nutri', email: 'n@x.it', locale: 'it', prefs: {} },
    { id: 'coach', email: 'c@x.it', locale: null, prefs: {} },
  ];

  it('alla nascita di un «piano bloccato» la posta va a tutti e due', () => {
    expect(chiRicevePostaAncheLei(['nutri', 'coach'], utenti, 'diet_blocked', true)).toEqual([
      { userId: 'nutri', email: 'n@x.it', locale: 'it' },
      { userId: 'coach', email: 'c@x.it', locale: null },
    ]);
  });

  /**
   * ⛔ **È l'argine al diluvio.** La stessa segnalazione si chiude e si riapre più volte in un
   * pomeriggio: con la push va bene, con la posta sarebbero dieci mail identiche.
   */
  it('quando la segnalazione TORNA dentro la tregua, la posta non parte', () => {
    expect(chiRicevePostaAncheLei(['nutri'], utenti, 'diet_blocked', false)).toEqual([]);
  });

  it('sulle altre categorie non parte nemmeno alla nascita', () => {
    expect(chiRicevePostaAncheLei(['nutri'], utenti, 'low_adherence', true)).toEqual([]);
  });

  /** ⚠️ Parte da chi va disturbato: chi ha spento l'avviso non è in quell'elenco, e non ci rientra. */
  it('la posta segue chi va disturbato, non i destinatari grezzi', () => {
    expect(chiRicevePostaAncheLei(['coach'], utenti, 'diet_blocked', true).map((p) => p.userId))
      .toEqual(['coach']);
  });

  it('senza indirizzo non si inventa una mail', () => {
    const senza = [{ id: 'nutri', email: '   ', locale: 'it', prefs: {} }];
    expect(chiRicevePostaAncheLei(['nutri'], senza, 'diet_blocked', true)).toEqual([]);
  });

  it('e di un destinatario che non si è riusciti a leggere non si conosce l\'indirizzo', () => {
    expect(chiRicevePostaAncheLei(['sconosciuto'], [], 'diet_blocked', true)).toEqual([]);
  });

  /**
   * ⚠️ L'elenco è di prodotto, e va letto: `menu.service` apre anche una `other` con motivo «menu
   * NON erogato», che lascia la cliente senza menu allo stesso modo. È una candidata dichiarata,
   * non una dimenticanza — allungarlo abbassa l'attenzione su quello che c'era già.
   */
  it('oggi la posta parte per una categoria sola', () => {
    expect([...CATEGORIE_CON_EMAIL]).toEqual(['diet_blocked']);
  });
});
