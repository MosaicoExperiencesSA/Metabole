import { classifyMessage } from './ai-filter';

describe('Filtro AI (primo filtro deterministico, spec sez. 5)', () => {
  describe('temi sensibili → escalation', () => {
    it.each([
      'ultimamente mi faccio vomitare dopo cena',
      'non mangio da due giorni',
      'odio il mio corpo, mi faccio schifo',
      'ieri ho avuto un\'abbuffata terribile',
      'sto prendendo dei lassativi per andare più veloce',
      'stamattina sono quasi svenuta',
      'ho palpitazioni dopo i pasti',
      'sono incinta, posso continuare la dieta?',
      'sto prendendo un antibiotico, cambia qualcosa?',
    ])('"%s" → sensitive', (text) => {
      const result = classifyMessage(text);
      expect(result.kind).toBe('sensitive');
      expect(result.reply).toContain('nutrizionista');
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
});
