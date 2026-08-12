/**
 * §16.2 — riconoscere di quale giorno la cliente sta parlando.
 *
 * Il test che conta di più è quello che NON riconosce niente: in una chat sulle sostituzioni i
 * numeri sono grammi, e un parser generoso trasformerebbe «togli il 15» in una data.
 */
import {
  distanzaGiorni,
  eOggi,
  etichettaGiorno,
  giornoDalTesto,
  giornoDellaConversazione,
  sommaGiorni,
} from './giorno-conversazione';

// Mercoledì 12 agosto 2026 (lo stesso giorno in cui §16.2 è stata scritta).
const OGGI = '2026-08-12';

describe('il giorno della conversazione', () => {
  describe('quello che si riconosce', () => {
    it('oggi, domani, dopodomani', () => {
      expect(giornoDalTesto('oggi a pranzo non mi va', OGGI)).toBe('2026-08-12');
      expect(giornoDalTesto('domani a cena c\'è il minestrone', OGGI)).toBe('2026-08-13');
      expect(giornoDalTesto('dopodomani vorrei altro', OGGI)).toBe('2026-08-14');
    });

    it('«stasera» e «stamattina» sono oggi: sta guardando il piatto che ha davanti', () => {
      expect(giornoDalTesto('stasera non ho voglia di pesce', OGGI)).toBe('2026-08-12');
      expect(giornoDalTesto('stamattina la colazione è pesante', OGGI)).toBe('2026-08-12');
    });

    it('il nome del giorno porta alla prossima volta che capita', () => {
      // Oggi è mercoledì.
      expect(giornoDalTesto('venerdì a pranzo', OGGI)).toBe('2026-08-14');
      expect(giornoDalTesto('lunedì vorrei altro', OGGI)).toBe('2026-08-17');
    });

    it('⚠️ il nome del giorno DI OGGI significa oggi, non fra una settimana', () => {
      // È la regola opposta a quella della data di inizio piano, e di proposito: chi scrive
      // «mercoledì a pranzo» di mercoledì sta guardando il piatto che ha davanti.
      expect(giornoDalTesto('mercoledì a pranzo ho il minestrone', OGGI)).toBe(OGGI);
    });

    it('l\'accento non serve, e la parola dentro la frase si trova lo stesso', () => {
      expect(giornoDalTesto('di giovedi mangio fuori', OGGI)).toBe('2026-08-13');
      expect(giornoDalTesto('Giovedì!', OGGI)).toBe('2026-08-13');
    });

    it('dopodomani vince su domani: la parola più lunga la contiene', () => {
      expect(giornoDalTesto('dopodomani', OGGI)).toBe('2026-08-14');
    });
  });

  describe('⚠️ quello che NON si riconosce, ed è il punto', () => {
    it('i numeri sono grammi, non date', () => {
      expect(giornoDalTesto('togli il 15', OGGI)).toBeNull();
      expect(giornoDalTesto('mettine 20 invece di 100', OGGI)).toBeNull();
      expect(giornoDalTesto('facciamo 15 settembre grammi', OGGI)).toBeNull();
    });

    it('una frase senza giorni non ne inventa uno', () => {
      expect(giornoDalTesto('vorrei sostituire le carote', OGGI)).toBeNull();
      expect(giornoDalTesto('', OGGI)).toBeNull();
      expect(giornoDalTesto('non mi piace', OGGI)).toBeNull();
    });

    it('il passato non si corregge: non esiste modo di indicarlo', () => {
      // «ieri» non è nell'elenco di proposito: un menu di ieri è già stato mangiato.
      expect(giornoDalTesto('ieri il pranzo era pesante', OGGI)).toBeNull();
    });
  });

  describe('come si chiama quel giorno parlandole', () => {
    it('i primi tre hanno un nome, e si scrivono minuscoli perché stanno dentro la frase', () => {
      expect(etichettaGiorno('2026-08-12', OGGI)).toBe('oggi');
      expect(etichettaGiorno('2026-08-13', OGGI)).toBe('domani');
      expect(etichettaGiorno('2026-08-14', OGGI)).toBe('dopodomani');
    });

    it('dal terzo in poi il nome del giorno NON basta: ci vuole il numero', () => {
      // «giovedì» detto di martedì è ambiguo quanto una data, e qui costa un piatto.
      expect(etichettaGiorno('2026-08-15', OGGI)).toBe('sabato 15 agosto');
      expect(etichettaGiorno('2026-08-17', OGGI)).toBe('lunedì 17 agosto');
    });
  });

  describe('quale giorno vince', () => {
    it('quello appena scritto batte quello della conversazione: è più fresco', () => {
      expect(giornoDellaConversazione({ testo: 'domani', statoData: OGGI, oggiIso: OGGI })).toBe('2026-08-13');
    });

    it('senza indicazioni si resta su quello di cui si stava parlando', () => {
      // Una conversazione su domani non torna a oggi solo perché la frase dopo è «sì, va bene».
      expect(giornoDellaConversazione({ testo: 'sì va bene', statoData: '2026-08-13', oggiIso: OGGI })).toBe('2026-08-13');
    });

    it('senza niente, oggi', () => {
      expect(giornoDellaConversazione({ oggiIso: OGGI })).toBe(OGGI);
      expect(giornoDellaConversazione({ testo: 'le carote', statoData: null, oggiIso: OGGI })).toBe(OGGI);
    });

    it('⚠️ una conversazione ripresa il giorno dopo non lavora su ieri', () => {
      // Lo stato viaggia appeso a un messaggio, e un messaggio può essere vecchio.
      expect(giornoDellaConversazione({ testo: 'sì', statoData: '2026-08-11', oggiIso: OGGI })).toBe(OGGI);
    });

    it('e nemmeno su un giorno assurdamente in là', () => {
      expect(giornoDellaConversazione({ testo: 'sì', statoData: '2027-01-01', oggiIso: OGGI })).toBe(OGGI);
    });
  });

  describe('i conti sui giorni', () => {
    it('sommare attraversa il cambio di mese', () => {
      expect(sommaGiorni('2026-08-31', 1)).toBe('2026-09-01');
      expect(sommaGiorni('2026-12-31', 2)).toBe('2027-01-02');
    });

    it('la distanza è in giorni pieni, e sa andare all\'indietro', () => {
      expect(distanzaGiorni('2026-08-14', OGGI)).toBe(2);
      expect(distanzaGiorni('2026-08-11', OGGI)).toBe(-1);
    });

    it('«è oggi» vale anche quando il giorno non è stato mai deciso', () => {
      // È il caso di tutte le conversazioni aperte prima di §16.2, che non hanno il campo.
      expect(eOggi(undefined, OGGI)).toBe(true);
      expect(eOggi(null, OGGI)).toBe(true);
      expect(eOggi(OGGI, OGGI)).toBe(true);
      expect(eOggi('2026-08-13', OGGI)).toBe(false);
    });
  });
});
