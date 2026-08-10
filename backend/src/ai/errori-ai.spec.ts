import { classificaErroreAi } from './errori-ai';

/**
 * IL CASO VERO DEL 12/8, congelato qui perché non si ripeta.
 *
 * Il credito Anthropic è finito a metà generazione del catalogo. Due difetti insieme: il messaggio
 * mostrato era il JSON inglese del servizio, troncato a metà parola, e il generatore ha continuato a
 * riprovare — tre tentativi per pasto, cinque pasti, diciotto varianti: 270 chiamate destinate tutte
 * allo stesso rifiuto.
 */
const CORPO_VERO =
  '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low '
  + 'to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';

describe('classificaErroreAi — credito esaurito', () => {
  it('riconosce il corpo vero di Anthropic e risponde in italiano, con la strada da seguire', () => {
    const e = classificaErroreAi(400, CORPO_VERO);
    expect(e.fatale).toBe(true);
    expect(e.messaggio).toContain('credito');
    expect(e.messaggio).toContain('console.anthropic.com');
    // Il JSON inglese NON si allega: la frase dice già tutto e accanto sarebbe solo rumore.
    expect(e.messaggio).not.toContain('credit balance');
    expect(e.messaggio).not.toContain('{');
  });

  it('si riconosce dal CORPO, non dallo stato: Anthropic risponde 400, non 402', () => {
    // Se un domani qualcuno provasse a distinguerlo dallo stato, questo test lo fermerebbe.
    expect(classificaErroreAi(400, CORPO_VERO).fatale).toBe(true);
    expect(classificaErroreAi(400, 'richiesta malformata: max_tokens').fatale).toBe(false);
  });

  it('accetta più formulazioni: il testo di un servizio esterno non è un contratto', () => {
    expect(classificaErroreAi(400, 'insufficient_quota').fatale).toBe(true);
    expect(classificaErroreAi(402, 'payment required').fatale).toBe(true);
  });
});

describe('classificaErroreAi — cosa è definitivo e cosa passa da sé', () => {
  it('chiave non valida e modello inesistente: riprovare non serve', () => {
    expect(classificaErroreAi(401, '').fatale).toBe(true);
    expect(classificaErroreAi(403, '').fatale).toBe(true);
    const m = classificaErroreAi(404, '', 'claude-inesistente');
    expect(m.fatale).toBe(true);
    expect(m.messaggio).toContain('claude-inesistente');
  });

  it('limite di richieste e stati inattesi: riprovare è giusto', () => {
    expect(classificaErroreAi(429, '').fatale).toBe(false);
    expect(classificaErroreAi(500, 'internal').fatale).toBe(false);
    expect(classificaErroreAi(529, 'overloaded').fatale).toBe(false);
  });

  it('sugli errori inattesi il corpo si allega: è l\'unica traccia per capirci qualcosa', () => {
    expect(classificaErroreAi(500, 'upstream timeout').messaggio).toContain('upstream timeout');
  });

  it('un corpo lunghissimo non finisce dentro un messaggio da leggere', () => {
    const lungo = 'x'.repeat(5000);
    expect(classificaErroreAi(500, lungo).messaggio.length).toBeLessThan(220);
  });
});
