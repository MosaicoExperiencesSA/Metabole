import {
  AZIONI_LISTA,
  azioniDi,
  descriviAzione,
  leggiIlNumero,
  numera,
  testoDellaLista,
  testoDepennata,
  type VoceDaFare,
} from './lista-della-mattina';

const v = (tipo: VoceDaFare['tipo'], id: string, titolo = id, causa?: string): VoceDaFare => ({ tipo, id, titolo, causa });

describe('l\'ordine e i numeri della lista', () => {
  /**
   * ⚠️ LE CLINICHE IN TESTA — decisione di Simone del 14/8, ripresa qui: «se ci sono problemi clinici
   * vanno in testa a tutte le richieste». Poi quello dietro cui c'è qualcuno che aspetta oggi, e in
   * fondo quello dietro cui non aspetta nessuno.
   */
  it('⚠️ le segnalazioni cliniche sono la 1, la manutenzione è l\'ultima', () => {
    const lista = numera([
      v('dizionario_invecchiato', 'd'),
      v('domanda_aperta', 'q'),
      v('segnalazione_clinica', 'c'),
      v('da_validare', 'm'),
    ]);
    expect(lista.map((x) => x.id)).toEqual(['c', 'm', 'q', 'd']);
    expect(lista.map((x) => x.n)).toEqual([1, 2, 3, 4]);
  });

  /**
   * ⚠️ A PARITÀ DI TIPO L'ORDINE NON SI TOCCA. Su una lista in cui si risponde «faccio la 3», una
   * riga che si sposta fra una lettura e l'altra è una cosa fatta al posto di un'altra.
   */
  it('⚠️ a parità di tipo resta l\'ordine con cui è arrivata', () => {
    const lista = numera([v('segnalazione', 'b'), v('segnalazione', 'a'), v('segnalazione', 'c')]);
    expect(lista.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  /** ⚠️ La coda «Da validare» c'è: nel quadro del 14/8 non compariva affatto. */
  it('⚠️ le decisioni del motore stanno nella lista, subito dopo le cliniche', () => {
    expect(numera([v('segnalazione', 's'), v('da_validare', 'm')]).map((x) => x.id)).toEqual(['m', 's']);
  });
});

describe('le azioni di una voce', () => {
  /**
   * ⚠️ LE AZIONI DEL MOTORE NON SI RISCRIVONO QUI: si importano da `causa-decisione`, che è la
   * tabella concordata con Nocanty. Ricopiarle vorrebbe dire che il giorno in cui ne toglie una, la
   * coda «Da validare» e la chat offrono due cose diverse sulla stessa riga.
   */
  it('⚠️ su una decisione del motore sono quelle della sua CAUSA', () => {
    const azioni = azioniDi({ tipo: 'da_validare', causa: 'calo_rapido_energia' });
    expect(azioni).toContain('autorizza_proseguire');
    // Sull'energia bassa quel punto di partenza non esiste, e infatti non c'è.
    expect(azioniDi({ tipo: 'da_validare', causa: 'energia_bassa_cronica' })).not.toContain('autorizza_proseguire');
  });

  /**
   * ⚠️ Una causa che questa versione non conosce (righe scritte prima dell'11/8) non resta senza
   * risposte: una voce numerata su cui digitando il numero non succede niente insegna a non fidarsi
   * dei numeri. Si offrono i due rimandi, che non modificano nulla.
   */
  it('⚠️ una causa sconosciuta non lascia la voce senza azioni', () => {
    const azioni = azioniDi({ tipo: 'da_validare', causa: 'boh' });
    expect(azioni).toEqual(['apri_scheda', 'scrivi_in_chat', AZIONI_LISTA.RIMANDA]);
  });

  /**
   * ⚠️ SU UNA SEGNALAZIONE NON SI OFFRE NIENTE CHE TOCCHI IL PIANO. Alzare le calorie o bloccare il
   * piano cambia cosa mangia una persona: sono decisioni cliniche, e finché non le prende chi di
   * dovere «Apri la scheda» porta dove quelle leve vivono già coi loro permessi.
   */
  it('⚠️ una segnalazione clinica offre solo azioni che NON toccano il piano', () => {
    const azioni = azioniDi({ tipo: 'segnalazione_clinica' });
    expect(azioni).not.toContain('blocca_piano');
    expect(azioni).toContain(AZIONI_LISTA.SEGNA_RISOLTA);
  });

  /**
   * ⚠️ «RIMANDA» C'È SU TUTTE, ed è l'unica risposta onesta a «questa non la so ancora». Senza, si
   * finisce per chiudere una riga solo per toglierla dall'elenco — e una segnalazione chiusa per
   * fare ordine è peggio di una segnalazione aperta.
   */
  it('⚠️ «rimanda» c\'è su ogni voce', () => {
    const tipi: VoceDaFare['tipo'][] = [
      'segnalazione_clinica', 'segnalazione', 'da_validare', 'proposta_da_approvare',
      'domanda_aperta', 'sostituzione_da_verificare', 'catalogo_da_approvare', 'dizionario_invecchiato',
    ];
    for (const t of tipi) expect(azioniDi({ tipo: t, causa: 'screening' })).toContain(AZIONI_LISTA.RIMANDA);
  });

  /** Ogni azione offerta si sa spiegare: un pulsante senza spiegazione è un pulsante che si evita. */
  it('ogni azione ha etichetta e spiegazione', () => {
    for (const t of ['segnalazione_clinica', 'da_validare'] as VoceDaFare['tipo'][]) {
      for (const a of azioniDi({ tipo: t, causa: 'calo_rapido_energia' })) {
        expect(descriviAzione(a)?.etichetta?.length).toBeGreaterThan(2);
        expect(descriviAzione(a)?.cosaFa?.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('il numero che ha detto', () => {
  it('le forme che si usano davvero', () => {
    expect(leggiIlNumero('3', 7)).toBe(3);
    expect(leggiIlNumero('la 3', 7)).toBe(3);
    expect(leggiIlNumero('facciamo la 3', 7)).toBe(3);
    expect(leggiIlNumero('numero 3', 7)).toBe(3);
    expect(leggiIlNumero('la terza', 7)).toBe(3);
    expect(leggiIlNumero('  2.  ', 7)).toBe(2);
  });

  /**
   * ⚠️ FUORI DALL'ELENCO È «NON HO CAPITO», NON «IL PIÙ VICINO». Se ha scritto 12 e le voci sono 7,
   * fargli fare la 7 vuol dire fargli fare una cosa che non ha chiesto — su una lista di decisioni
   * cliniche è il tipo di aiuto che non si dà.
   */
  it('⚠️ un numero fuori dall\'elenco non diventa il più vicino', () => {
    expect(leggiIlNumero('12', 7)).toBeNull();
    expect(leggiIlNumero('0', 7)).toBeNull();
  });

  /** ⚠️ Un numero dentro una frase non è una scelta: «ho 3 clienti da chiamare» non è «fai la 3». */
  it('⚠️ un numero in mezzo a una frase non si prende', () => {
    expect(leggiIlNumero('ho 3 clienti da chiamare', 7)).toBeNull();
    expect(leggiIlNumero('domani ne faccio 3', 7)).toBeNull();
    expect(leggiIlNumero('', 7)).toBeNull();
  });

  it('senza voci non c\'è nessun numero da leggere', () => {
    expect(leggiIlNumero('1', 0)).toBeNull();
  });
});

describe('i testi', () => {
  const lista = numera([v('segnalazione_clinica', 'c', 'Giulia: calo 2,8 kg/settimana con energia bassa'), v('domanda_aperta', 'q', 'Maria: «favismo» non so tradurlo')]);

  it('numera in testa alla riga e dice come si risponde', () => {
    const t = testoDellaLista(lista, 'Anna');
    expect(t).toContain('1. Giulia: calo 2,8 kg/settimana con energia bassa');
    expect(t).toContain('2. Maria');
    expect(t).toContain('Dimmi il numero');
    expect(t).toContain('Anna');
  });

  /** ⚠️ Niente elenco vuoto con «0 cose»: se non c'è niente si dice, e si dice bene. */
  it('⚠️ a elenco vuoto non stampa una lista di zero righe', () => {
    const t = testoDellaLista([], 'Anna');
    expect(t).not.toContain('1.');
    expect(t).toContain('niente che aspetti te');
  });

  it('il depennamento dice quante ne restano', () => {
    expect(testoDepennata(6)).toContain('Ne restano 6');
    expect(testoDepennata(1)).toContain('Ne resta una');
    expect(testoDepennata(0)).toContain('finito');
  });
});
