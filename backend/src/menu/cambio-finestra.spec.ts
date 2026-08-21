/**
 * SPOSTARE LA FINESTRA — i test.
 *
 * Il caso che conta di più non è nessuno dei due metodi preso da solo: è **la direzione**. Sbagliare
 * il verso di quattro ore vuol dire scambiare «stanotte digiuni venti ore invece di sedici» con
 * «stanotte ne digiuni dodici», cioè fare esattamente la cosa che il manuale chiama in causa —
 * interrompere il digiuno troppo presto e perdere i benefici della giornata.
 *
 * E c'è un secondo test che vale quanto quello: **il piano graduale arriva davvero**. Le due
 * funzioni che lo compongono — chi lo apre e chi lo esegue ogni notte — stanno in due punti che non
 * si parlano, e il giorno che divergono la finestra di qualcuno si mette a girare e non arriva mai.
 */
import {
  ORE_FRA_DUE_CAMBI,
  PASSO_GRADUALE_PREDEFINITO,
  PROTOCOLLI_DA_VERIFICARE,
  decidiCambio,
  finestraGiaAperta,
  oreLeggibili,
  passoValido,
  passoDiStanotte,
  ragioniDaVerificare,
  scartoPiuCorto,
} from './cambio-finestra';
import { PROTOCOLLI_DIGIUNO } from './orologio-digiuno';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;
/** Un momento in cui la finestra di 12:00 non si è ancora aperta. */
const MATTINA = { adesso: new Date('2026-08-21T07:00:00Z'), oraMin: H(9) };
const attuale = (protocollo = '16:8', inizioMin = H(12), cambiataIl: Date | null = null) =>
  ({ protocollo, inizioMin, cambiataIl });

describe('⚠️ la direzione: sulla strada più corta, non su «quale numero è più grande»', () => {
  it('le 08:00 sono quattro ore PRIMA delle 12:00, non venti dopo', () => {
    expect(scartoPiuCorto(H(12), H(8))).toBe(-240);
  });

  it('e attraverso la mezzanotte il verso non si rovescia', () => {
    expect(scartoPiuCorto(H(23), H(1))).toBe(120);
    expect(scartoPiuCorto(H(1), H(23))).toBe(-120);
  });

  /**
   * ⛔ Il pareggio. A dodici ore esatte le due strade sono lunghe uguali e il codice deve
   * sceglierne una: sceglie quella che **allunga** il digiuno. *Una parità non deve mai cadere
   * dalla parte che accorcia*, perché il costo dei due errori non è lo stesso.
   */
  it('⛔ dodici ore esatte cadono dalla parte che ALLUNGA il digiuno', () => {
    expect(scartoPiuCorto(H(12), H(0))).toBe(720);
    expect(scartoPiuCorto(H(0), H(12))).toBe(720);
  });

  it('zero è zero, da qualunque parte lo si guardi', () => {
    expect(scartoPiuCorto(H(7, 30), H(7, 30))).toBe(0);
  });
});

describe('metodo B — il reset: la finestra va più tardi, il digiuno si allunga', () => {
  /**
   * ⚠️ L'esempio del manuale: chiusa alle 20:00, invece di riaprire alle 12:00 si tira fino alle
   * 16:00. Venti ore una volta sola, e da lì parte il nuovo orario.
   */
  it('12:00 → 16:00 con la 16:8: stanotte venti ore, e vale da oggi', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(16) }, MATTINA);
    expect(e.permesso).toBe(true);
    expect(e.metodo).toBe('reset');
    expect(e.minutiDigiunoStanotte).toBe(20 * 60);
    expect(e.daQuando).toBe('oggi');
    expect(e.scrivi.inizioMin).toBe(H(16));
    expect(e.scrivi.bersaglioInizioMin).toBeNull();
    expect(e.spiegazione).toContain('20 ore invece di 16');
  });

  /**
   * ⛔ **RIMANDARE NON ANNULLA** (corretto in revisione, 21/8, e prima il test cementava il numero
   * sbagliato). Se sono le 14:00 e la finestra si è aperta a mezzogiorno, ha già pranzato: dirle che
   * oggi apre alle 16:00 sarebbe raccontarle una giornata che non ha fatto, quindi vale da domani.
   *
   * ⚠️ Ma le venti ore arrivano lo stesso, **stanotte**: chiude alle 20:00 con la regola vecchia e
   * riapre alle 16:00 con quella nuova. Prima qui c'era scritto «stanotte non si allunga niente» e
   * il codice rispondeva sedici: la cliente avrebbe confermato credendo di non cambiare niente, e
   * avrebbe digiunato quattro ore in più senza che nessuno gliel'avesse detto.
   */
  it('⛔ finestra già aperta: vale da domani, ma stanotte sono venti ore lo stesso', () => {
    const e = decidiCambio(
      attuale(),
      { inizioMin: H(16) },
      { adesso: new Date('2026-08-21T12:00:00Z'), oraMin: H(14) },
    );
    expect(e.permesso).toBe(true);
    expect(e.daQuando).toBe('domani');
    expect(e.minutiDigiunoStanotte).toBe(20 * 60);
    expect(e.spiegazione).toContain('20 ore invece di 16');
  });

  it('finestraGiaAperta sa leggere anche una finestra che scavalca la mezzanotte', () => {
    // 23:1 dalle 19:00: aperta 19:00-20:00. Alle 19:30 sì, alle 21:00 no.
    expect(finestraGiaAperta(H(19), '23:1', H(19, 30))).toBe(true);
    expect(finestraGiaAperta(H(19), '23:1', H(21))).toBe(false);
    // 16:8 dalle 19:00: aperta 19:00-03:00. All'00:30 è dentro, e il confronto ingenuo direbbe di no.
    expect(finestraGiaAperta(H(19), '16:8', H(0, 30))).toBe(true);
    expect(finestraGiaAperta(H(19), '16:8', H(4))).toBe(false);
  });
});

describe('metodo A — l\'adattamento graduale: la finestra va più presto', () => {
  /**
   * ⛔ **L'esempio scritto da Simone il 19/8**, da 12:00–20:00 a 08:00–16:00 in quattro giorni.
   * ⚠️ E il piano **non parte oggi**: l'inizio resta quello di adesso, si scrive solo il bersaglio.
   * Anticipare di quattro ore stasera accorcerebbe il digiuno di stanotte di quattro ore — la cosa
   * che il metodo A esiste apposta per non fare.
   */
  it('⛔ 12:00 → 08:00: quattro giorni, e stanotte non si accorcia niente', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA);
    expect(e.permesso).toBe(true);
    expect(e.metodo).toBe('graduale');
    expect(e.giorniDelPiano).toBe(4);
    expect(e.scrivi.inizioMin).toBe(H(12)); // ⚠️ NON si tocca
    expect(e.scrivi.bersaglioInizioMin).toBe(H(8));
    // ⚠️ Stanotte è UN PASSO più corto, non quattro ore: chiude alle 20:00 e domani apre alle 11:00.
    // È l'accorciamento che il metodo A concede, ed è quello che la frase dice.
    expect(e.minutiDigiunoStanotte).toBe(15 * 60);
    // ⚠️ «Domani», perché oggi l'orario non si muove: il primo passo lo fa il cron stanotte.
    expect(e.daQuando).toBe('domani');
    expect(e.spiegazione).toContain('08:00');
  });

  /**
   * ⛔ Piano graduale **e** cambio di protocollo insieme. Il protocollo entra in vigore alla
   * prossima apertura — cioè oggi — mentre l'orario ci mette giorni: prima la frase parlava solo di
   * orario e `daQuando` diceva «domani», così la cliente si trovava la finestra accorciata oggi
   * senza che nessuno gliel'avesse detto.
   */
  it('⛔ piano + protocollo: il protocollo vale subito, e si dice', () => {
    const e = decidiCambio(attuale('16:8', H(12)), { protocollo: '20:4', inizioMin: H(8) }, MATTINA);
    expect(e.metodo).toBe('graduale');
    expect(e.scrivi.protocollo).toBe('20:4');
    expect(e.daQuando).toBe('oggi');
    expect(e.spiegazione).toContain('20:4');
    expect(e.daVerificare.length).toBeGreaterThan(0);
  });

  it('dentro il passo si fa e basta: 12:00 → 11:30 è oggi, senza piano', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(11, 30) }, MATTINA);
    expect(e.metodo).toBe('graduale');
    expect(e.giorniDelPiano).toBe(0);
    expect(e.scrivi.inizioMin).toBe(H(11, 30));
    expect(e.scrivi.bersaglioInizioMin).toBeNull();
    expect(e.daQuando).toBe('oggi');
  });

  it('un\'ora esatta è ancora dentro il passo: il confine non esclude sé stesso', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(11) }, MATTINA);
    expect(e.giorniDelPiano).toBe(0);
    expect(e.scrivi.inizioMin).toBe(H(11));
  });

  it('un minuto oltre il passo apre il piano', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(10, 59) }, MATTINA);
    expect(e.giorniDelPiano).toBe(2);
    expect(e.scrivi.inizioMin).toBe(H(12));
  });
});

describe('⛔ il piano graduale ARRIVA — le due funzioni che non si parlano', () => {
  /**
   * ⛔ Chi apre il piano (`decidiCambio`) e chi lo esegue ogni notte (`passoDiStanotte`) stanno in
   * due punti diversi del prodotto: uno in una richiesta HTTP, l'altro in un cron. Nessuno dei due
   * vede l'altro, e il giorno che divergono la finestra di qualcuno si mette a girare senza mai
   * arrivare — un difetto che si scopre solo perché lo dice lei.
   *
   * Questo test li fa girare **insieme**, notte per notte, e chiede due cose: che si arrivi, e che
   * si arrivi nel numero di giorni promesso alla cliente.
   */
  it.each([
    [H(12), H(8), 4],
    [H(12), H(9, 30), 3],
    [H(2), H(22), 4], // ⚠️ attraverso la mezzanotte, all'indietro
    [H(13), H(11, 1), 2], // ⚠️ un resto che non è un'ora tonda: l'ultimo passo è di 59 minuti
  ])('da %s a %s: il piano promette %s giorni e li mantiene', (da, a, giorniAttesi) => {
    const e = decidiCambio(attuale('16:8', da), { inizioMin: a }, MATTINA);
    expect(e.metodo).toBe('graduale');
    expect(e.giorniDelPiano).toBe(giorniAttesi);

    let inizio = e.scrivi.inizioMin;
    let notti = 0;
    for (; notti < 50; notti += 1) {
      const passo = passoDiStanotte(inizio, e.scrivi.bersaglioInizioMin);
      if (!passo) break;
      inizio = passo.inizioMin;
      if (passo.arrivata) { notti += 1; break; }
    }
    expect(inizio).toBe(a);
    expect(notti).toBe(giorniAttesi);
  });

  it('l\'ultimo passo non supera il bersaglio', () => {
    // Mancano 30 minuti e il passo è 60: si arriva esatti, non mezz'ora oltre.
    expect(passoDiStanotte(H(12), H(11, 30))).toEqual({ inizioMin: H(11, 30), arrivata: true });
  });

  it('niente bersaglio, o già arrivata: non si scrive niente', () => {
    expect(passoDiStanotte(H(12), null)).toBeNull();
    expect(passoDiStanotte(H(12), undefined)).toBeNull();
    expect(passoDiStanotte(H(12), H(12))).toBeNull();
  });

  /**
   * ⚠️ Un bersaglio **più tardi** dal piano graduale non nasce: il metodo A va all'indietro. Se ce
   * ne finisse uno lo stesso — scritto a mano, o rimasto da un cambio vecchio — si arriva in un
   * colpo, invece di girare l'orologio al contrario per venti notti.
   */
  it('un bersaglio in avanti si raggiunge subito, non girando tutto il quadrante', () => {
    expect(passoDiStanotte(H(12), H(16))).toEqual({ inizioMin: H(16), arrivata: true });
  });
});

describe('il protocollo: allargare e stringere non sono la stessa cosa (§12.1)', () => {
  it('allargare (20:4 → 16:8) si fa e basta', () => {
    const e = decidiCambio(attuale('20:4', H(12)), { protocollo: '16:8' }, MATTINA);
    expect(e.permesso).toBe(true);
    expect(e.metodo).toBe('subito');
    expect(e.scrivi.protocollo).toBe('16:8');
    // ⚠️ Ieri era ancora sul 20:4: ha chiuso alle 16:00 e oggi apre alle 12:00 — venti ore, come
    // sempre. Allargare il protocollo NON tocca il digiuno in corso, e infatti non lo si nomina.
    expect(e.minutiDigiunoStanotte).toBe(20 * 60);
    expect(e.spiegazione).not.toContain('invece di');
    expect(e.spiegazione).toContain('16:8');
    // ⛔ E «da oggi», perché la finestra oggi non si è ancora aperta. La frase era cablata su
    // «Da domani» mentre il profilo veniva scritto per oggi: la cliente credeva di avere ancora la
    // finestra vecchia e si trovava la cena spostata.
    expect(e.spiegazione).toContain('Da oggi');
    expect(e.daQuando).toBe('oggi');
  });

  it('⛔ e «da domani» solo quando è vero: a finestra già aperta', () => {
    const e = decidiCambio(
      attuale('20:4', H(12)),
      { protocollo: '16:8' },
      { adesso: new Date('2026-08-21T11:00:00Z'), oraMin: H(13) },
    );
    expect(e.daQuando).toBe('domani');
    expect(e.spiegazione).toContain('Da domani');
  });

  /**
   * ⚠️ Stringendo il digiuno di stanotte si allunga, e la cliente lo deve sapere prima di
   * confermare. ⛔ Ma non viene **mai bloccata**: la verifica è un'attività che parte in parallelo.
   */
  it('stringere (16:8 → 20:4) parte lo stesso, e la verifica parte con lei', () => {
    const e = decidiCambio(attuale('16:8', H(12)), { protocollo: '20:4' }, MATTINA);
    expect(e.permesso).toBe(true);
    // ⚠️ Stanotte NON cambia: ieri ha chiuso alle 20:00 col protocollo vecchio e domani apre alle
    // 12:00. Il digiuno più lungo arriva la notte DOPO, quando chiuderà alle 16:00.
    expect(e.minutiDigiunoStanotte).toBe(16 * 60);
    // ⛔ E la ragione per la nutrizionista sta nell'esito, non in una funzione che l'endpoint
    // deve ricordarsi di chiamare.
    expect(e.daVerificare.length).toBeGreaterThan(0);
    expect(e.daVerificare.join(' ')).toContain('20:4');
  });

  /**
   * ⛔ **IL DIGIUNO IN CORSO LO SPOSTA L'ORARIO, NON IL PROTOCOLLO** — la proprietà che tiene
   * insieme i due casi qui sopra, e che sarebbe stato facile perdere.
   *
   * Il digiuno che sta per fare va dall'ultima chiusura (regola vecchia) alla prossima apertura. Il
   * protocollo cambia le **chiusure**, che valgono dalla prossima in poi: quindi cambiarlo da solo
   * non tocca questa notte. Muovere l'orario cambia l'**apertura**, e quella è la notte in corso.
   */
  it('⛔ cambiare SOLO il protocollo non tocca il digiuno di stanotte, per nessuno dei cinque', () => {
    for (const p of PROTOCOLLI_DIGIUNO.map((x) => x.valore)) {
      const e = decidiCambio(attuale('16:8', H(12)), { protocollo: p }, MATTINA);
      expect(e.minutiDigiunoStanotte).toBe(16 * 60);
    }
  });

  /**
   * ⛔ Protocollo **e** orario nella stessa richiesta: prima il conto usava le ore del protocollo
   * NUOVO per una chiusura che era avvenuta col VECCHIO, e diceva alla cliente numeri che nessun
   * orologio produce — «24 ore» su un 20:4, o 18 promesse dove ne avrebbe fatte 22.
   */
  it.each([
    ['16:8', H(12), '20:4', H(16), 20 * 60],
    ['20:4', H(12), '16:8', H(14), 22 * 60],
    ['14:10', H(9), '23:1', H(11), 16 * 60],
  ])('⛔ da %s@%s a %s@%s: stanotte %s minuti, contati sulla chiusura vecchia', (pv, iv, pn, inuovo, atteso) => {
    const e = decidiCambio(attuale(pv as string, iv as number), { protocollo: pn as string, inizioMin: inuovo as number }, MATTINA);
    expect(e.permesso).toBe(true);
    expect(e.minutiDigiunoStanotte).toBe(atteso);
  });

  it('chiedere quello che ha già non è un cambio', () => {
    const e = decidiCambio(attuale(), { protocollo: '16:8', inizioMin: H(12) }, MATTINA);
    expect(e.metodo).toBe('nessuno');
    expect(e.spiegazione).toContain('già');
  });
});

describe('un cambio al giorno', () => {
  it('chi l\'ha spostata due ore fa aspetta, e gli si dice quanto', () => {
    const e = decidiCambio(
      attuale('16:8', H(12), new Date('2026-08-21T05:00:00Z')),
      { inizioMin: H(16) },
      { adesso: new Date('2026-08-21T07:00:00Z'), oraMin: H(9) },
    );
    expect(e.permesso).toBe(false);
    expect(e.rifiuto).toMatch(/fra \d+ ore?/);
    expect(e.scrivi.inizioMin).toBe(H(12)); // ⚠️ e non si scrive niente
  });

  it('passate le ore previste si può di nuovo', () => {
    const e = decidiCambio(
      attuale('16:8', H(12), new Date('2026-08-20T06:00:00Z')),
      { inizioMin: H(16) },
      { adesso: new Date('2026-08-21T07:00:00Z'), oraMin: H(9) },
    );
    expect(e.permesso).toBe(true);
    expect(ORE_FRA_DUE_CAMBI).toBeLessThan(24);
  });

  it('chi non l\'ha mai spostata non aspetta niente', () => {
    expect(decidiCambio(attuale(), { inizioMin: H(16) }, MATTINA).permesso).toBe(true);
  });
});

describe('quello che si rifiuta, e come si dice', () => {
  it('un protocollo che non esiste', () => {
    const e = decidiCambio(attuale(), { protocollo: '30:1' }, MATTINA);
    expect(e.permesso).toBe(false);
    expect(e.scrivi.protocollo).toBe('16:8');
  });

  it.each([-1, 1440, 12.5, NaN])('un orario impossibile (%s)', (v) => {
    expect(decidiCambio(attuale(), { inizioMin: v }, MATTINA).permesso).toBe(false);
  });

  /**
   * ⚠️ Ogni frase di questo file la legge **la cliente**, sul telefono. Un identificativo interno
   * lì dentro non è un dettaglio brutto: è una frase che non vuol dire niente a chi la riceve.
   */
  it('⚠️ nessuna frase contiene un codice interno', () => {
    const casi = [
      decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA),
      decidiCambio(attuale(), { inizioMin: H(16) }, MATTINA),
      decidiCambio(attuale(), { protocollo: '30:1' }, MATTINA),
      decidiCambio(attuale('16:8', H(12), new Date('2026-08-21T05:00:00Z')), { inizioMin: H(16) }, MATTINA),
    ];
    for (const e of casi) {
      for (const frase of [e.spiegazione, e.rifiuto ?? '']) {
        expect(frase).not.toMatch(/skip_|fasting[A-Z]|inizioMin|undefined|NaN|\d\.\d{3}/);
      }
    }
  });
});

describe('le ragioni per la nutrizionista (§3)', () => {
  it('i protocolli estremi sono quelli con quattro ore di finestra o meno', () => {
    expect(PROTOCOLLI_DA_VERIFICARE).toEqual(['20:4', '23:1']);
    // E il conto viene dalla tabella, non da un elenco ricopiato accanto.
    expect(PROTOCOLLI_DIGIUNO.filter((p) => p.oreFinestra <= 4).map((p) => p.valore))
      .toEqual(PROTOCOLLI_DA_VERIFICARE);
  });

  it('un pasto solo è una ragione per sé, qualunque sia il protocollo', () => {
    expect(ragioniDaVerificare('14:10', true)).toHaveLength(1);
    expect(ragioniDaVerificare('14:10', false)).toHaveLength(0);
  });

  it('le due ragioni si sommano invece di sostituirsi', () => {
    expect(ragioniDaVerificare('23:1', true)).toHaveLength(2);
  });

  it('⚠️ sono frasi, non codici: le legge una persona', () => {
    for (const r of ragioniDaVerificare('23:1', true)) {
      expect(r).not.toMatch(/skip_|fasting[A-Z]|oreFinestra/);
      expect(r.length).toBeGreaterThan(20);
    }
  });
});

describe('⛔ il passo che arriva da `config_param`, controllato prima di usarlo', () => {
  /**
   * ⛔ Trovato in revisione (21/8). Il commento in testa al modulo promette che il passo si cambia
   * da `config_param` senza un rilascio — e nessuna riga controllava il valore. Con il campo
   * svuotato arrivava **zero**, e succedevano due cose insieme:
   *
   * - alla cliente compariva *«Sposto la tua finestra un po' alla volta: 0 minuti al giorno, e in
   *   **Infinity** giorni apri alle 08:00»*;
   * - il cron riscriveva ogni notte lo **stesso** orario, per sempre: il bersaglio restava in
   *   profilo e la finestra non arrivava mai. Cioè esattamente il difetto che questo file dice di
   *   voler prevenire.
   */
  it.each([0, -60, NaN, Infinity, 0.4])('⛔ un passo inutilizzabile (%s) ripiega sul predefinito', (v) => {
    expect(passoValido(v)).toBe(PASSO_GRADUALE_PREDEFINITO);
    const e = decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA, v);
    expect(e.passoUsatoMin).toBe(PASSO_GRADUALE_PREDEFINITO);
    expect(e.giorniDelPiano).toBe(4);
    expect(e.spiegazione).not.toMatch(/Infinity|NaN|0 minuti/);
    // ⚠️ E il cron arriva lo stesso: un valore di configurazione sbagliato non congela nessuno.
    expect(passoDiStanotte(H(12), H(8), v)).toEqual({ inizioMin: H(11), arrivata: false });
  });

  /**
   * ⚠️ Ma **si vede**: `passoUsatoMin` diverso da quello configurato è il segnale con cui chi chiama
   * scrive nei log che quel valore era da buttare. *Niente tagli silenziosi.*
   */
  it('un passo valido passa intatto, e si legge nell\'esito', () => {
    expect(decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA, 120).passoUsatoMin).toBe(120);
  });

  it('il passo a parole non dice «un\'ora» per qualcosa che un\'ora non è', () => {
    expect(decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA, 57).spiegazione).toContain('57 minuti');
    expect(decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA, 60).spiegazione).toContain("un'ora");
    expect(decidiCambio(attuale(), { inizioMin: H(4) }, MATTINA, 120).spiegazione).toContain('2 ore');
  });
});

describe('le ore come le legge una persona', () => {
  it.each([
    [960, '16'],
    [930, '15,5'],
    [1220, '20,5'], // 20h20m: si arrotonda alla mezz'ora, non si stampa 20.333333
    [1200, '20'],
    [40, '0,5'], // ⚠️ si arrotonda alla mezz'ora: quaranta minuti sono «mezz'ora», non «0,67»
  ])('%s minuti si leggono «%s»', (min, atteso) => {
    expect(oreLeggibili(min as number)).toBe(atteso);
  });

  it('⚠️ e non esce mai un decimale lungo in una frase', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(16, 20) }, MATTINA);
    expect(e.minutiDigiunoStanotte).toBe(1220);
    expect(e.spiegazione).toContain('20,5 ore');
    expect(e.spiegazione).not.toMatch(/\d\.\d{3}/);
  });
});

describe('il passo è un numero solo, e si può cambiare senza un rilascio', () => {
  it('il predefinito è un\'ora, come l\'estremo prudente del manuale («1-2 ore»)', () => {
    expect(PASSO_GRADUALE_PREDEFINITO).toBe(60);
  });

  it('con due ore di passo lo stesso cambio dura la metà dei giorni', () => {
    const e = decidiCambio(attuale(), { inizioMin: H(8) }, MATTINA, 120);
    expect(e.giorniDelPiano).toBe(2);
    expect(passoDiStanotte(H(12), H(8), 120)).toEqual({ inizioMin: H(10), arrivata: false });
  });
});
