/**
 * ⛔ **LE GUARDIE CHE DECIDONO DAVVERO — e il loro costo zero, CALCOLATO.**
 *
 * ## Perché serve una prova diversa da quella del 5/9
 *
 * `guardie-agganciate-a-costo-zero.spec.ts` copre le dieci chiavi agganciate il 5/9, e il suo
 * criterio di «costo zero» è: la rotta è `@Roles('admin')` **e basta**. È vero e verificabile, ma
 * riguarda solo le guardie **inerti** — l'admin salta il `PageGuard` prima di leggere la matrice,
 * quindi lì la casella continua a governare la voce di menu e non la porta.
 *
 * Le cinque agganciate il 7/9 sera sono un'altra cosa: sotto ci sono **nutrizioniste, capo, coach e
 * coordinatrice**, e per loro la casella comincia a contare. Il costo zero, qui, non si legge nel
 * `@Roles`: si **calcola**, confrontando i ruoli ammessi con quello che i default danno loro.
 *
 * ⚠️ **E va calcolato, non congelato.** Un elenco scritto a mano direbbe «costava zero il 7
 * settembre»; questa prova dice «costa zero **adesso**». Diventa rossa in tre versi, e servono tutti
 * e tre: qualcuno **allarga** un `@Roles` a un ruolo che la chiave non ce l'ha (e quel ruolo
 * prenderebbe 403 dal giorno dopo); qualcuno **toglie** un default a un ruolo che passa da lì;
 * qualcuno **stacca** una guardia.
 *
 * ⛔ **Il difetto che questa prova esiste per impedire non è teorico.** È successo due volte il 7/9,
 * in due pagine diverse: una casella accesa nella pagina Permessi che non accendeva niente, perché
 * la rotta guardava il ruolo e non la matrice. Il verso opposto — agganciare una chiave a un ruolo
 * che nei default non ce l'ha — produce il gemello speculare: una persona che ieri lavorava e oggi
 * legge «Non hai il permesso per questa sezione», senza che nessuno abbia deciso niente.
 */
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PAGE_KEY, type PageLevel } from '../common/decorators/require-page.decorator';
import { DEFAULT_PERMISSIONS, GUARDIA_INERTE, MOTIVO_SENZA_GUARDIA, type PageKey } from './pages';
import { ROLES, type Role } from '../common/roles';
import { EscalationsController } from '../escalations/escalations.controller';
import { NutritionistController as NutritionistApiController } from '../nutritionist/nutritionist.controller';
import { LeadAssignmentController } from '../commerce/lead-assignment.controller';
import { ProtocolsController } from '../engine/engine.controller';
import { NutritionistController as HealthAreaNutritionistController } from '../health-area/health-area.controller';

/** Una porta agganciata il 7/9: dove sta la guardia, e con che livello. */
interface Agganciata {
  chiave: PageKey;
  /** La classe che porta la guardia (o il metodo). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controller: any;
  /** Il metodo, quando la guardia è per metodo e non di classe. */
  metodo?: string;
  livello: PageLevel;
  perche: string;
}

const AGGANCIATE_IL_7_9: Agganciata[] = [
  {
    chiave: 'escalations',
    controller: EscalationsController,
    livello: 'view',
    perche: 'le segnalazioni cliniche: elenco e chiusura',
  },
  {
    chiave: 'escalations',
    controller: NutritionistApiController,
    metodo: 'segnalazioni',
    livello: 'view',
    perche: 'le segnalazioni sui propri pazienti',
  },
  {
    chiave: 'escalations',
    controller: NutritionistApiController,
    metodo: 'sblocca',
    livello: 'manage',
    perche: 'sbloccare un piano bloccato non è guardarlo',
  },
  {
    chiave: 'assign_nutritionist',
    controller: LeadAssignmentController,
    metodo: 'assignNutritionist',
    livello: 'manage',
    perche: 'chi assegna la nutrizionista a una cliente',
  },
  {
    chiave: 'assign_nutritionist',
    controller: LeadAssignmentController,
    metodo: 'nutritionists',
    livello: 'view',
    perche: "l'elenco per il menu di assegnazione: è una lettura",
  },
  {
    chiave: 'lead_acceptance',
    controller: LeadAssignmentController,
    metodo: 'accept',
    livello: 'manage',
    perche: 'accettare un lead assegnato',
  },
  {
    chiave: 'lead_acceptance',
    controller: LeadAssignmentController,
    metodo: 'reject',
    livello: 'manage',
    perche: 'rifiutarlo è la stessa decisione nell’altro verso',
  },
  {
    chiave: 'engine_protocols',
    controller: ProtocolsController,
    livello: 'view',
    perche: 'i protocolli del motore: propone il nutrizionista, valida il capo',
  },
  {
    chiave: 'health_documents',
    controller: HealthAreaNutritionistController,
    metodo: 'patientDocuments',
    livello: 'view',
    perche: 'i documenti sanitari di una paziente',
  },
  {
    chiave: 'health_documents',
    controller: HealthAreaNutritionistController,
    metodo: 'reviewDocument',
    livello: 'manage',
    perche: 'la revisione di un documento sanitario',
  },
  {
    chiave: 'health_documents',
    controller: HealthAreaNutritionistController,
    metodo: 'notesList',
    livello: 'view',
    perche: 'le note cliniche',
  },
  {
    chiave: 'health_documents',
    controller: HealthAreaNutritionistController,
    metodo: 'createNote',
    livello: 'manage',
    perche: 'scriverne una: entra nella cartella clinica',
  },
];

/** I metadata come li legge Nest: il metodo vince sulla classe. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const leggi = <T>(chiave: string, controller: any, metodo?: string): T | undefined => {
  if (metodo) {
    const suo = Reflect.getMetadata(chiave, controller.prototype[metodo]) as T | undefined;
    if (suo !== undefined) return suo;
  }
  return Reflect.getMetadata(chiave, controller) as T | undefined;
};

const guardia = (a: Agganciata) =>
  leggi<{ pageKey: string; level?: PageLevel }>(PAGE_KEY, a.controller, a.metodo);
const ruoli = (a: Agganciata) => leggi<string[]>(ROLES_KEY, a.controller, a.metodo) ?? [];

/** Il livello effettivo: quello scritto, o quello che il `PageGuard` dedurrebbe. */
const livelloDi = (a: Agganciata) => guardia(a)?.level ?? a.livello;

const etichetta = (a: Agganciata) =>
  `${a.chiave} · ${a.controller.name}${a.metodo ? `.${a.metodo}` : ''}`;

describe('⛔ le cinque guardie del 7/9 decidono davvero, e a costo zero', () => {
  it('sono dodici porte su cinque chiavi: se il numero cambia, questa prova va riletta', () => {
    expect(AGGANCIATE_IL_7_9).toHaveLength(12);
    expect(new Set(AGGANCIATE_IL_7_9.map((a) => a.chiave)).size).toBe(5);
  });

  it.each(AGGANCIATE_IL_7_9.map((a) => [etichetta(a), a] as const))(
    '⛔ %s: la guardia c’è, e chiede la chiave giusta',
    (_nome, a) => {
      expect(guardia(a)?.pageKey).toBe(a.chiave);
      expect(livelloDi(a)).toBe(a.livello);
    },
  );

  it.each(AGGANCIATE_IL_7_9.map((a) => [etichetta(a), a] as const))(
    '⛔ %s: `@Roles` RESTA sotto la guardia — senza, il fail-open non ha più nessuna rete',
    (_nome, a) => {
      expect(ruoli(a).length).toBeGreaterThan(0);
    },
  );

  /**
   * ⛔ **IL COSTO ZERO, CALCOLATO.** Per ogni ruolo che il `@Roles` ammette, la chiave deve già
   * essere nei default al livello che la guardia chiede. L'`admin` è escluso perché salta il
   * `PageGuard` prima di leggere la matrice: per lui la guardia non esiste.
   */
  it.each(AGGANCIATE_IL_7_9.map((a) => [etichetta(a), a] as const))(
    '⛔ %s: nessun ruolo ammesso perde l’accesso',
    (_nome, a) => {
      const livello = livelloDi(a);
      const senzaIlPermesso = ruoli(a)
        .filter((r) => r !== 'admin')
        .filter((r) => {
          const def = DEFAULT_PERMISSIONS[r as Role]?.[a.chiave];
          return !(livello === 'view' ? def?.view : def?.manage);
        });
      expect(senzaIlPermesso).toEqual([]);
    },
  );

  /**
   * ⛔ **E NON SONO INERTI, che è tutta la differenza con le dieci del 5/9.** Una guardia è inerte
   * quando sotto c'è solo l'admin: la casella continua a governare il menu e non la porta. Qui sotto
   * c'è almeno un ruolo vero, quindi la casella decide — e dichiararle inerti sarebbe scrivere in
   * pagina un avviso falso, che è il modo più veloce per far smettere di leggere gli avvisi.
   */
  it.each(AGGANCIATE_IL_7_9.map((a) => [etichetta(a), a] as const))(
    '⛔ %s: c’è almeno un ruolo NON admin, quindi la casella conta',
    (_nome, a) => {
      expect(ruoli(a).filter((r) => r !== 'admin').length).toBeGreaterThan(0);
    },
  );

  it('⛔ e infatti nessuna delle cinque si dichiara inerte, né resta fra i buchi', () => {
    for (const chiave of new Set(AGGANCIATE_IL_7_9.map((a) => a.chiave))) {
      expect(GUARDIA_INERTE[chiave]).toBeUndefined();
      expect(MOTIVO_SENZA_GUARDIA[chiave]).toBeUndefined();
    }
  });

  /**
   * ⚠️ **La prova sa leggere davvero i metadata**: senza questo controllo, un `leggi` rotto
   * renderebbe `undefined` ovunque e i test sui ruoli passerebbero sul vuoto.
   */
  it('⚠️ il lettore funziona: su una chiave inventata non trova niente, sui ruoli sì', () => {
    const a = AGGANCIATE_IL_7_9[0];
    expect(leggi('chiave-che-non-esiste', a.controller, a.metodo)).toBeUndefined();
    expect(ruoli(a).every((r) => (ROLES as readonly string[]).includes(r))).toBe(true);
  });
});
