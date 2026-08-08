import { ROLES_KEY } from '../common/decorators/roles.decorator';
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
