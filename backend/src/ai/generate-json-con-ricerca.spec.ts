import { AiService } from './ai.service';

/**
 * ⛔ **LA RICERCA IN RETE SPEZZA LA RISPOSTA**: un blocco `text` per ogni citazione, più i blocchi
 * `server_tool_use` e `web_search_tool_result` in mezzo. Queste prove fissano le tre cose che il
 * metodo deve fare con un `fetch` finto: incollare TUTTI i blocchi di testo, continuare su
 * `pause_turn` rimandando la risposta come turno dell'assistente, e contare le ricerche.
 */

function monta(risposte: unknown[]) {
  const chiamate: unknown[] = [];
  const fetchFinto = jest.fn(async (_url: string, init: { body: string }) => {
    chiamate.push(JSON.parse(init.body));
    const r = risposte.shift();
    if (r && typeof r === 'object' && 'status' in (r as object)) {
      const { status, body } = r as { status: number; body: string };
      return { ok: false, status, text: async () => body } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => r } as unknown as Response;
  });
  (global as { fetch: unknown }).fetch = fetchFinto;
  const config = { get: (k: string) => (k === 'AI_API_KEY' ? 'chiave' : undefined) };
  const service = new AiService(config as never, {} as never);
  return { service, chiamate, fetchFinto };
}

const blocchi = (...testi: string[]) => testi.map((text) => ({ type: 'text', text, citations: [] }));

describe('generateJsonConRicerca', () => {
  const fetchVero = global.fetch;
  afterEach(() => { (global as { fetch: unknown }).fetch = fetchVero; });

  it('⛔ incolla tutti i blocchi di testo: il JSON spezzato dalle citazioni si legge intero', async () => {
    const { service, chiamate } = monta([{
      stop_reason: 'end_turn',
      usage: { server_tool_use: { web_search_requests: 2 } },
      content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'taleggio kcal' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
        ...blocchi('{"e_un_alimento": true, "kcal": ', '315', ', "allergeni": ["latte"], "fonte": {"url": "https://x"}}'),
      ],
    }]);
    const out = await service.generateJsonConRicerca<{ kcal: number; allergeni: string[] }>('s', 'p', 1000, 3);
    expect(out).toEqual({ e_un_alimento: true, kcal: 315, allergeni: ['latte'], fonte: { url: 'https://x' } });
    expect(service.lastRicerche).toBe(2);
    expect((chiamate[0] as { tools: unknown[] }).tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]);
  });

  it('⚠️ pause_turn: rimanda la risposta come turno dell\'assistente e continua; le ricerche si sommano', async () => {
    const primo = [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'q' } }, ...blocchi('Cerco. ')];
    const { service, chiamate } = monta([
      { stop_reason: 'pause_turn', usage: { server_tool_use: { web_search_requests: 1 } }, content: primo },
      { stop_reason: 'end_turn', usage: { server_tool_use: { web_search_requests: 1 } }, content: blocchi('{"kcal": 10}') },
    ]);
    const out = await service.generateJsonConRicerca<{ kcal: number }>('s', 'p');
    expect(out).toEqual({ kcal: 10 });
    expect(chiamate).toHaveLength(2);
    const messaggi = (chiamate[1] as { messages: { role: string; content: unknown }[] }).messages;
    expect(messaggi.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messaggi[1].content).toEqual(primo);
    expect(service.lastRicerche).toBe(2);
  });

  it('⛔ credito finito: null, errore fatale, e nessuna seconda chiamata', async () => {
    const { service, fetchFinto } = monta([{ status: 400, body: '{"error":{"message":"Your credit balance is too low"}}' }]);
    expect(await service.generateJsonConRicerca('s', 'p')).toBeNull();
    expect(service.lastErrorFatale).toBe(true);
    expect(fetchFinto).toHaveBeenCalledTimes(1);
  });
});
