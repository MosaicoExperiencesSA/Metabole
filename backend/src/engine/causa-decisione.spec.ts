import {
  AZIONI,
  AZIONI_CON_NUMERO,
  AZIONI_ESEGUIBILI,
  AZIONI_PER_CAUSA,
  CAUSE,
  DESCRIZIONE_AZIONE,
  azioneAmmessa,
  azioniPerCausa,
} from './causa-decisione';

/**
 * ⛔ **LA TABELLA DELLE AZIONI NON AVEVA UN TEST SUO** — e il 28/8, aggiungendone una terza, si è
 * visto perché serve: le tre liste (`AZIONI`, `AZIONI_ESEGUIBILI`, `DESCRIZIONE_AZIONE`) devono
 * restare d'accordo fra loro, e finora niente lo verificava. Un'azione senza descrizione arriva alla
 * finestra come `undefined.etichetta`; una eseguibile ma non descritta è un pulsante muto; una
 * descritta ma non eseguibile è un pulsante che non fa niente e non lo dice.
 */
describe('le azioni della coda «Da validare»', () => {
  const tutte = Object.values(AZIONI);

  it('⛔ ogni azione ha la sua etichetta e la sua spiegazione', () => {
    for (const a of tutte) {
      expect(DESCRIZIONE_AZIONE[a]?.etichetta?.length).toBeGreaterThan(0);
      // ⚠️ «cosaFa» si legge PRIMA di premere: un pulsante che cambia il piano di una persona deve
      // dire cosa cambia, e la frase sta qui, non riscritta da ogni schermata.
      expect(DESCRIZIONE_AZIONE[a]?.cosaFa?.length).toBeGreaterThan(20);
    }
  });

  it('⛔ le eseguibili e quelle che chiedono un numero sono azioni vere', () => {
    for (const a of [...AZIONI_ESEGUIBILI, ...AZIONI_CON_NUMERO]) expect(tutte).toContain(a);
    // I due rimandi non li esegue il backend: li esegue il frontend andando da qualche parte.
    expect(AZIONI_ESEGUIBILI).not.toContain(AZIONI.APRI_SCHEDA);
    expect(AZIONI_ESEGUIBILI).not.toContain(AZIONI.SCRIVI_IN_CHAT);
    // ⚠️ Un'azione che chiede un numero e non è eseguibile dal server sarebbe un modulo che non
    // manda niente da nessuna parte.
    for (const a of AZIONI_CON_NUMERO) expect(AZIONI_ESEGUIBILI).toContain(a);
  });

  it('⚠️ ogni causa offre almeno un rimando: non si resta senza niente da fare', () => {
    for (const causa of Object.values(CAUSE)) {
      const azioni = AZIONI_PER_CAUSA[causa];
      expect(azioni.length).toBeGreaterThan(0);
      expect(azioni).toContain(AZIONI.APRI_SCHEDA);
      // Nessun doppione: la finestra mostrerebbe due pulsanti identici.
      expect(new Set(azioni).size).toBe(azioni.length);
    }
  });

  /**
   * ⛔ **«Alza le calorie» dove ha senso, e solo lì** (28/8). Sullo screening e su una regola scritta
   * dal nutrizionista non si offre: della prima non sappiamo che è una questione di calorie, della
   * seconda non sappiamo proprio cosa dica — e offrire una leva clinica al buio è peggio che non
   * offrirla.
   */
  it('⛔ «alza le calorie» sta sulle due cause che parlano di calorie', () => {
    expect(azioniPerCausa(CAUSE.CALO_RAPIDO_ENERGIA)).toContain(AZIONI.ALZA_CALORIE);
    expect(azioniPerCausa(CAUSE.ENERGIA_BASSA_CRONICA)).toContain(AZIONI.ALZA_CALORIE);
    expect(azioniPerCausa(CAUSE.SCREENING)).not.toContain(AZIONI.ALZA_CALORIE);
    expect(azioniPerCausa(CAUSE.REGOLA)).not.toContain(AZIONI.ALZA_CALORIE);
    // E il controllo del backend segue la tabella, non i pulsanti.
    expect(azioneAmmessa(CAUSE.SCREENING, AZIONI.ALZA_CALORIE)).toBe(false);
    expect(azioneAmmessa(CAUSE.ENERGIA_BASSA_CRONICA, AZIONI.ALZA_CALORIE)).toBe(true);
  });

  /**
   * ⚠️ **L'ordine è una decisione clinica, non un dettaglio**: è quello in cui i pulsanti compaiono.
   * Sul calo rapido «autorizza a proseguire» resta il primo — è il gesto più frequente, e spostare
   * il primo pulsante sotto il naso di chi lo preme ogni giorno è il modo in cui si preme quello
   * sbagliato. Sull'energia bassa cronica «alza le calorie» è invece la prima ipotesi da guardare.
   */
  it('⚠️ e l\'ordine è quello deciso, non quello che capita', () => {
    expect(azioniPerCausa(CAUSE.CALO_RAPIDO_ENERGIA)[0]).toBe(AZIONI.AUTORIZZA_PROSEGUIRE);
    expect(azioniPerCausa(CAUSE.CALO_RAPIDO_ENERGIA)[1]).toBe(AZIONI.ALZA_CALORIE);
    expect(azioniPerCausa(CAUSE.ENERGIA_BASSA_CRONICA)[0]).toBe(AZIONI.ALZA_CALORIE);
  });

  it('⚠️ una causa sconosciuta (righe storiche) non offre niente, invece di indovinare', () => {
    expect(azioniPerCausa(null)).toEqual([]);
    expect(azioniPerCausa('causa_mai_vista')).toEqual([]);
    expect(azioneAmmessa(null, AZIONI.ALZA_CALORIE)).toBe(false);
  });
});
