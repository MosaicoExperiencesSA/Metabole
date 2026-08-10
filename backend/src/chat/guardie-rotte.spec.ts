import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { BACKOFFICE_PAGES } from '../permissions/pages';
import { StaffClientChatController } from './chat.controller';

/**
 * I RUOLI SULLA ROTTA, non solo nel servizio.
 *
 * L'8/8 la decisione «l'admin legge tutte le conversazioni» è stata implementata in
 * `ChatService.assertThreadAccess` — dove funzionava — ma il guardiano del controller non aveva
 * `admin` nell'elenco: 403 prima di arrivare al servizio, e in scheda cliente compariva «Nessuna
 * conversazione visibile per il tuo ruolo». Tutti i test erano verdi: nessuno guardava i decoratori.
 *
 * Questo test guarda i decoratori. È l'unico posto dove la differenza fra «chi può bussare» e «chi
 * può leggere» si vede senza avviare l'applicazione.
 */
describe('Guardie della scheda cliente — chat', () => {
  const ruoli: string[] = Reflect.getMetadata(ROLES_KEY, StaffClientChatController) ?? [];

  it('l\'ADMIN può bussare: le conversazioni della scheda le vede tutte', () => {
    expect(ruoli).toContain('admin');
  });

  it('coach, coordinatrice, nutrizionista e capo nutrizionista restano dentro', () => {
    for (const r of ['coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist']) {
      expect(ruoli).toContain(r);
    }
  });

  it('la manager delle coach (`sales`) resta FUORI: vede il commerciale, non il clinico', () => {
    expect(ruoli).not.toContain('sales');
  });

  it('e nessuna cliente entra da qui', () => {
    expect(ruoli).not.toContain('client');
  });
});

/**
 * IL PERMESSO SULLA ROTTA È `client_conversations`, NON `chat`.
 *
 * Richiesta di Simone dell'11/8: «la visibilità e la scrittura di questa parte devo poterla
 * abilitare dai permessi». Prima queste tre rotte chiedevano `chat`, cioè lo stesso interruttore
 * della pagina Chat dell'azienda: spegnere la card in scheda cliente voleva dire togliere alla coach
 * anche la possibilità di scrivere alle sue clienti, quindi non si spegneva mai.
 *
 * Questo test tiene fermo quel divorzio. Se qualcuno rimette `chat`, la levetta in pagina Permessi
 * torna a non decidere niente — e questo è il tipo di regressione che nessun altro test vedrebbe,
 * perché il comportamento resta «funziona» per l'admin e per la nutrizionista.
 */
describe('Guardie della scheda cliente — il permesso delle conversazioni', () => {
  const pagina = (metodo: string) =>
    Reflect.getMetadata(PAGE_KEY, (StaffClientChatController.prototype as never as Record<string, () => unknown>)[metodo]) as
      | { pageKey: string; level?: string }
      | undefined;

  it('la chiave esiste fra le pagine del backoffice (altrimenti non compare in Permessi)', () => {
    expect(BACKOFFICE_PAGES).toContain('client_conversations');
  });

  it('leggere i thread e i cambi chiede `client_conversations` in visione', () => {
    for (const metodo of ['threads', 'sostituzioniChat']) {
      expect(pagina(metodo)?.pageKey).toBe('client_conversations');
    }
  });

  it('verificare un cambio chiede `client_conversations` in GESTIONE, esplicitamente', () => {
    // `level` esplicito e non dedotto dal metodo HTTP: una PATCH lo dedurrebbe comunque, ma il
    // giorno in cui questa rotta diventasse una POST il livello non deve cambiare per caso.
    expect(pagina('correggiCambio')).toEqual({ pageKey: 'client_conversations', level: 'manage' });
  });

  it('nessuna delle tre resta appesa a `chat`', () => {
    for (const metodo of ['threads', 'sostituzioniChat', 'correggiCambio']) {
      expect(pagina(metodo)?.pageKey).not.toBe('chat');
    }
  });
});
