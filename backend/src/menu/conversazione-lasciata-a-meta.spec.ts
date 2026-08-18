import {
  eUnaDomandaInAttesa,
  testoChiusuraPerSilenzio,
  vaChiusa,
  GIORNI_ALL_INDIETRO,
  ORE_DI_SILENZIO,
} from './conversazione-lasciata-a-meta';

const ADESSO = new Date('2026-08-18T12:00:00Z');
const oreFa = (h: number) => new Date(ADESSO.getTime() - h * 3_600_000);

const domanda = (h: number, meta?: Record<string, unknown>) => ({
  senderRole: 'ai',
  sentAt: oreFa(h),
  meta: { kind: 'sostituzione', sost: { passo: 'cibo', tentativi: 0 }, ...meta },
});

describe('eUnaDomandaInAttesa — il marcatore è la riga stessa', () => {
  it('una domanda di Gaia con lo stato del dialogo attaccato: sì', () => {
    expect(eUnaDomandaInAttesa(domanda(30))).toBe(true);
  });

  it('⚠️ un messaggio della cliente non è mai una domanda in attesa: ha risposto lei per ultima', () => {
    expect(eUnaDomandaInAttesa({ senderRole: 'client', sentAt: oreFa(30), meta: null })).toBe(false);
  });

  it('⚠️ senza `sost` il dialogo NON aspetta niente: si è applicato, o è passato alla coach', () => {
    expect(eUnaDomandaInAttesa({
      senderRole: 'ai',
      sentAt: oreFa(30),
      meta: { kind: 'sostituzione', esitoSostituzione: 'applicata' },
    })).toBe(false);
  });

  it('una risposta di Gaia che non è del dialogo sostituzione non la riguarda', () => {
    expect(eUnaDomandaInAttesa({ senderRole: 'ai', sentAt: oreFa(30), meta: { kind: 'faq' } })).toBe(false);
  });

  it('niente meta, meta nullo, messaggio assente: no, senza esplodere', () => {
    expect(eUnaDomandaInAttesa({ senderRole: 'ai', sentAt: oreFa(30) })).toBe(false);
    expect(eUnaDomandaInAttesa({ senderRole: 'ai', sentAt: oreFa(30), meta: null })).toBe(false);
    expect(eUnaDomandaInAttesa(null)).toBe(false);
    expect(eUnaDomandaInAttesa(undefined)).toBe(false);
  });

  /**
   * ⚠️ È il messaggio che scrive questa chiusura: se contasse come domanda in attesa, il giro dopo
   * la richiuderebbe, e la cliente riceverebbe la stessa frase ogni notte. Non ha `sost` — ed è
   * esattamente per questo che il marcatore è la riga e non un contatore.
   */
  it('⚠️ la chiusura stessa non è una domanda in attesa: non si richiude ogni notte', () => {
    expect(eUnaDomandaInAttesa({
      senderRole: 'ai',
      sentAt: oreFa(30),
      meta: { kind: 'sostituzione', esitoSostituzione: 'chiusa_per_silenzio' },
    })).toBe(false);
  });
});

describe('vaChiusa — tre modi di dire no, e si sa quale', () => {
  it('un giorno di silenzio su una domanda aperta: si chiude', () => {
    expect(vaChiusa(domanda(ORE_DI_SILENZIO), ADESSO)).toEqual({ chiudere: true });
  });

  it('⚠️ un\'ora fa NO: potrebbe rispondere fra un minuto, e chiudere sarebbe interromperla', () => {
    expect(vaChiusa(domanda(1), ADESSO)).toEqual({ chiudere: false, perche: 'troppo_presto' });
  });

  it('sul filo della soglia non si chiude: si aspetta di averla passata', () => {
    expect(vaChiusa(domanda(ORE_DI_SILENZIO - 0.1), ADESSO)).toEqual({ chiudere: false, perche: 'troppo_presto' });
  });

  /**
   * ⚠️ IL PRIMO GIRO DOPO IL RILASCIO. In banca dati ci sono le conversazioni lasciate a metà da
   * sempre: senza questa finestra, la notte del rilascio Gaia scriverebbe a chiunque abbia toccato
   * quel pulsante negli ultimi mesi. Chiudere una conversazione di marzo non è chiuderla — è
   * aprirne una.
   */
  it('⚠️ oltre la finestra NON si sveglia nessuno: una domanda di due mesi fa resta dov\'è', () => {
    expect(vaChiusa(domanda((GIORNI_ALL_INDIETRO + 1) * 24), ADESSO)).toEqual({
      chiudere: false,
      perche: 'troppo_vecchia',
    });
  });

  it('l\'ultimo messaggio è della cliente: non c\'è niente da chiudere', () => {
    expect(vaChiusa({ senderRole: 'client', sentAt: oreFa(100), meta: null }, ADESSO)).toEqual({
      chiudere: false,
      perche: 'non_e_una_domanda',
    });
  });

  it('le soglie si possono passare da fuori (arrivano da `config_param`)', () => {
    expect(vaChiusa(domanda(3), ADESSO, 2)).toEqual({ chiudere: true });
    expect(vaChiusa(domanda(3), ADESSO, 6)).toEqual({ chiudere: false, perche: 'troppo_presto' });
  });
});

describe('testoChiusuraPerSilenzio — deve dire cosa chiude, e che si può ricominciare', () => {
  it('col nome, e col nome preso come lo prende il resto di Gaia', () => {
    const t = testoChiusuraPerSilenzio('patricia rossi');
    expect(t.startsWith('Patricia, ti avevo chiesto quale alimento volevi cambiare')).toBe(true);
  });

  it('senza nome resta una frase italiana, con la maiuscola al posto giusto', () => {
    expect(testoChiusuraPerSilenzio(null).startsWith('Ti avevo chiesto')).toBe(true);
  });

  it('⚠️ dice A COSA si riferisce: a un giorno di distanza «capisco» da solo non si capisce', () => {
    expect(testoChiusuraPerSilenzio('Anna')).toContain('quale alimento volevi cambiare');
  });

  it('dice la frase che ha chiesto Simone', () => {
    expect(testoChiusuraPerSilenzio('Anna')).toContain('non sia più di tuo interesse');
  });

  /** ⚠️ Senza questa, «ho capito che non ti interessa» è una porta chiusa in faccia a chi si era
   *  solo distratta. La chiusura non toglie niente: il pulsante è lì. */
  it('⚠️ e dice che si può ricominciare, con come si fa', () => {
    const t = testoChiusuraPerSilenzio('Anna');
    expect(t).toContain('Se cambi idea');
    expect(t).toContain('«Sostituisci»');
  });
});
