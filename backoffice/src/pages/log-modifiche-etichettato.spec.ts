import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./ClientDetail.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../../backend/src/clients/clients.service.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const src = (f: string) => sorgenti[f] ?? '';

/**
 * ⛔ **OGNI AZIONE DEL LOG MODIFICHE HA LA SUA ETICHETTA** — 2/9, dalla revisione.
 *
 * Il log della scheda filtra su una lista bianca (`CHANGE_ACTIONS`, nel backend) e il backoffice
 * traduce le azioni in italiano (`CHANGE_ACTION_LABEL`). ⚠️ Sono **due elenchi che devono
 * combaciare**, in due repository diversi: un'azione ammessa e non etichettata compare col nome
 * tecnico, `client.personal_base_failed`, in una schermata che legge una nutrizionista.
 *
 * ⛔ È la stessa forma del difetto delle pagine nei permessi (`CLAUDE.md`): una chiave dichiarata
 * in un posto e non letta nell'altro non dà nessun errore — dà una riga che nessuno capisce.
 */
describe('il log modifiche della scheda', () => {
  const service = src('../../../backend/src/clients/clients.service.ts');
  const pagina = src('./ClientDetail.tsx');

  /** ⚠️ Se il file del backend non è raggiungibile la prova non deve passare in silenzio. */
  it('⚠️ vede tutti e due gli elenchi', () => {
    expect(service).toMatch(/const CHANGE_ACTIONS = \[/);
    expect(pagina).toMatch(/const CHANGE_ACTION_LABEL/);
  });

  it('⛔ ogni azione ammessa ha un\'etichetta in italiano', () => {
    const blocco = service.slice(service.indexOf('const CHANGE_ACTIONS = ['));
    const azioni = [...blocco.slice(0, blocco.indexOf('];')).matchAll(/'([a-z][\w.]+)'/g)].map((m) => m[1]);
    expect(azioni.length).toBeGreaterThan(10);
    const etichettate = new Set([...pagina.matchAll(/'([\w.]+)':\s*'/g)].map((m) => m[1]));
    const senza = azioni.filter((a) => !etichettate.has(a));
    expect(senza).toEqual([]);
  });

  /** ⚠️ E la voce nuova c'è davvero, in tutti e due. */
  it('⚠️ compresa la base personale non aggiornata', () => {
    expect(service).toMatch(/'client\.personal_base_failed'/);
    expect(pagina).toMatch(/'client\.personal_base_failed':/);
  });
});
