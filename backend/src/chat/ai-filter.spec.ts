import { classifyMessage } from './ai-filter';

describe('Filtro AI (primo filtro deterministico, spec sez. 5)', () => {
  // MEDICI → nutrizionista (sintomi fisici, gravidanza, terapie farmacologiche).
  describe('temi sensibili MEDICI → nutrizionista', () => {
    it.each([
      'stamattina sono quasi svenuta',
      'ho palpitazioni dopo i pasti',
      'sono incinta, posso continuare la dieta?',
      'sto prendendo un antibiotico, cambia qualcosa?',
    ])('"%s" → sensitive (nutrizionista)', (text) => {
      const result = classifyMessage(text);
      expect(result.kind).toBe('sensitive');
      expect((result as { target?: string }).target).toBe('nutritionist');
      expect(result.reply).toContain('nutrizionista');
    });
  });

  // EMOTIVI/COMPORTAMENTALI → coach (primo filtro, inoltra al nutrizionista se serve).
  describe('temi sensibili EMOTIVI/COMPORTAMENTALI → coach', () => {
    it.each([
      'ultimamente mi faccio vomitare dopo cena',
      'non mangio da due giorni',
      'odio il mio corpo, mi faccio schifo',
      'ieri ho avuto un\'abbuffata terribile',
      'sto prendendo dei lassativi per andare più veloce',
    ])('"%s" → sensitive (coach)', (text) => {
      const result = classifyMessage(text);
      expect(result.kind).toBe('sensitive');
      expect((result as { target?: string }).target).toBe('coach');
      expect(result.reply).toContain('coach');
    });
  });

  describe('FAQ → risposta immediata', () => {
    it.each([
      ['quando si sblocca il nuovo menu?', 'menu_sblocco'],
      ['dove trovo la lista della spesa?', 'lista_spesa'],
      ['ogni quanto devo pesarmi?', 'misure_quando'],
      ['quanta acqua devo bere al giorno?', 'acqua'],
      ['posso cambiare il mio obiettivo di peso?', 'obiettivo_cambio'],
      ['parto per le vacanze la prossima settimana', 'eventi_pause'],
      ['voglio parlare con una persona vera', 'contatto_umano'],
    ])('"%s" → faq %s', (text, key) => {
      const result = classifyMessage(text);
      expect(result.kind).toBe('faq');
      expect((result as { faqKey?: string }).faqKey).toBe(key);
    });
  });

  describe('instradamento', () => {
    it('domande cliniche → nutrizionista', () => {
      expect(classifyMessage('ho scoperto di essere intollerante al lattosio').kind).toBe('route_nutritionist');
      expect(classifyMessage('la glicemia nelle ultime analisi era alta').kind).toBe('route_nutritionist');
      expect(classifyMessage('posso prendere le proteine in polvere?').kind).toBe('route_nutritionist');
    });

    it('tutto il resto → coach', () => {
      expect(classifyMessage('oggi sono un po\' demotivata, mi dai una carica?').kind).toBe('route_coach');
      expect(classifyMessage('che scarpe consigli per camminare?').kind).toBe('route_coach');
    });
  });

  it('il sensibile vince sempre (anche se contiene parole da FAQ)', () => {
    const result = classifyMessage('non mangio da tre giorni per sbloccare il menu più in fretta');
    expect(result.kind).toBe('sensitive');
  });

  /**
   * DATI PERSONALI E AMMINISTRATIVI (richiesta di Simone dell'8/8): Gaia non li vede, e lo dice.
   *
   * Prima queste domande finivano nel ramo generico — «Bella domanda! L'ho girata alla tua coach» —
   * che è vero ma sembra una scelta di non rispondere. Due cose contano qui: la frase deve dire
   * *non ho accesso*, e non deve passare dall'AI generativa (un modello che riformula «non ho i
   * tuoi dati» rischia di rispondere come se li avesse).
   */
  describe('dati personali e amministrativi → coach, dicendo che non li vede', () => {
    it.each([
      'mi serve la fattura di luglio',
      'quando mi addebitate il rinnovo?',
      'ho fatto il bonifico ieri, lo vedete?',
      'voglio disdire l\'abbonamento',
      'posso sospendere l\'abbonamento per un mese?',
      'come cambio il mio indirizzo di fatturazione?',
      'voglio cancellare il mio account',
      'come faccio a revocare il consenso?',
    ])('"%s" → coach con la risposta dedicata', (text) => {
      const result = classifyMessage(text);
      expect(result.kind).toBe('route_coach');
      expect(result.reply).toContain('non ho accesso');
      expect(result.reply).toContain('coach');
      // Non si fa riformulare dall'AI: la frase esatta è la sostanza.
      expect((result as { senzaAi?: boolean }).senzaAi).toBe(true);
      expect((result as { reason?: string }).reason).toBeTruthy();
    });

    it('non ruba le domande che non c\'entrano', () => {
      // «matrimonio» resta la FAQ degli eventi, non una domanda sull'abbonamento.
      expect(classifyMessage('la settimana prossima ho un matrimonio').kind).toBe('faq');
      // E una domanda generica resta generica, con la vecchia risposta.
      const generica = classifyMessage('che scarpe consigli per camminare?');
      expect(generica.kind).toBe('route_coach');
      expect((generica as { senzaAi?: boolean }).senzaAi).toBeUndefined();
    });

    it('il tema sensibile batte anche questo: prima la persona, poi la burocrazia', () => {
      expect(classifyMessage('voglio disdire tutto, mi faccio schifo').kind).toBe('sensitive');
    });
  });
});

/**
 * «INDICE GLICEMICO» NON È «GLICEMIA» (11/8, con l'arrivo della banca dati nutrizionale).
 *
 * Prima ogni frase con «glicemi» dentro usciva dalla chat verso la nutrizionista. Giusto per la
 * glicemia di una persona, sbagliato per l'indice glicemico di un alimento — che è un dato che ora
 * abbiamo in tabella, e che era esattamente la domanda per cui la tabella esiste.
 */
describe('classifyMessage — indice glicemico contro glicemia', () => {
  it('l\'indice glicemico di un alimento resta in chat: c\'è un dato da citare', () => {
    for (const frase of [
      'il riso basmati ha un indice glicemico più basso del riso integrale?',
      'qual è l\'indice glicemico della pasta integrale?',
      'il carico glicemico della banana è alto?',
    ]) {
      expect(classifyMessage(frase).kind).not.toBe('route_nutritionist');
    }
  });

  it('la glicemia della PERSONA va alla nutrizionista, come sempre', () => {
    for (const frase of [
      'ho la glicemia alta, posso mangiare la pasta?',
      'la mia glicemia a digiuno era 110',
      'ho fatto le analisi e il colesterolo è alto',
    ]) {
      expect(classifyMessage(frase).kind).toBe('route_nutritionist');
    }
  });

  it('e una frase che ha entrambe le cose resta clinica: vince la persona sull\'alimento', () => {
    expect(classifyMessage('con la mia glicemia alta va bene un alimento a indice glicemico basso?').kind)
      .toBe('route_nutritionist');
  });
});
