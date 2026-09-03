/**
 * ⛔ **CHI PUÒ BUSSARE A QUESTE TRE ROTTE.**
 *
 * Prova **sui decoratori**, che è l'unico posto dove la domanda si vede senza avviare
 * l'applicazione — la lezione di `chat/guardie-rotte.spec.ts` e delle cinque prove scritte il 17/8
 * per l'annullamento abbonamento.
 *
 * ⚠️ Nasce da una mutazione **sopravvissuta**: togliendo `@RequirePage('menu_a_mano')` dalla classe,
 * le due `GET` restavano senza guardia di pagina e nessuna prova se ne accorgeva — perché
 * `chiavi-senza-guardia.spec.ts` guarda se la **chiave** è letta da qualche parte, e il `POST` la
 * legge lo stesso. Sono due domande diverse: «la chiave accende qualcosa?» e «questa rotta è
 * protetta?».
 *
 * ⛔ Su questa porta la seconda conta più della prima: le `GET` rendono i **motivi** delle
 * incompatibilità, che sono frasi come «contiene Crostacei (allergene dichiarato)» — dati sanitari.
 */
import 'reflect-metadata';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { MenuAManoController } from './menu-a-mano.controller';

const suClasse = <T>(chiave: string): T | undefined => Reflect.getMetadata(chiave, MenuAManoController) as T | undefined;
const suMetodo = <T>(chiave: string, metodo: string): T | undefined =>
  Reflect.getMetadata(chiave, (MenuAManoController.prototype as unknown as Record<string, never>)[metodo]) as T | undefined;

describe('le guardie del menu scritto a mano', () => {
  it('⛔ la classe chiede la chiave di pagina: vale per TUTTE le rotte, GET comprese', () => {
    expect(suClasse<{ pageKey: string }>(PAGE_KEY)?.pageKey).toBe('menu_a_mano');
  });

  /**
   * ⚠️ `@Roles` sotto, perché il `PageGuard` è permissivo se il database non risponde: in quel caso
   * dietro deve esserci ancora un cancello. È la lezione del 17/8, pagata su `impersonate` e
   * sull'annullamento abbonamento.
   */
  it('⛔ e i ruoli restano sotto: il PageGuard da solo si apre quando il database tossisce', () => {
    expect(suClasse<string[]>(ROLES_KEY)).toEqual(['nutritionist', 'head_nutritionist', 'admin']);
  });

  /** ⛔ La scrittura chiede `manage`: vedere la schermata e cambiare cosa mangia una persona sono due cose. */
  it('⛔ la scrittura chiede «gestisce», non «vede»', () => {
    expect(suMetodo<{ pageKey: string; level?: string }>(PAGE_KEY, 'scrivi'))
      .toMatchObject({ pageKey: 'menu_a_mano', level: 'manage' });
  });

  /**
   * ⚠️ E le due letture **non** chiedono `manage`: chi ha la sola vista deve poterle chiamare senza
   * prendere un 403, o la schermata si aprirebbe vuota con un errore rosso.
   */
  it('⚠️ le due letture non chiedono «gestisce»', () => {
    for (const m of ['ricette', 'giornata']) {
      expect(suMetodo<{ level?: string }>(PAGE_KEY, m)?.level).toBeUndefined();
    }
  });
});
