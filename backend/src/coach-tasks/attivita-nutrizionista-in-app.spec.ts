/**
 * ⛔ **LA PUSH E LA SCHERMATA SI MUOVONO INSIEME.**
 *
 * Dal 21/8 quattro tipi di attività nascono addosso alla nutrizionista — digiuno estremo, finestra
 * non traducibile, pasti non serviti, calorie corte — e la push le arriva sul telefono. Ma
 * `NutriDashboard` chiamava `/nutritionist/dashboard`, `validation-queue` ed `escalations`, e
 * `/staff/coach-tasks` non lo chiamava nessuno: la notifica portava a una schermata **vuota**.
 *
 * Il 22/8 la frase era stata corretta al ribasso («La trovi nel backoffice, in CRM › Attività da
 * fare») — *se degradi, dillo*. Il 3/9 la sezione c'è, e la frase è tornata una sola.
 *
 * ⛔ **Le due metà si possono sbagliare una per volta**, ed è il difetto che questa prova impedisce:
 * rimettere la frase senza la sezione manda di nuovo la nutrizionista su una schermata vuota; fare
 * la sezione lasciando la frase vecchia la manda al computer quando ha la cosa nel telefono.
 *
 * ⛔ **PERCHÉ META' DI QUESTO FILE LEGGE DEI SORGENTI, E META' NO.** Una revisione avversariale ha
 * fatto notare che la prima stesura era **tutta** `toMatch` su testo: una mutazione da un token
 * (`if (lista.length === 0) return <></>` fatto incondizionato) spegneva la sezione e lasciava sei
 * prove verdi. La frase della push **è backend, quindi si prova chiamando il codice** — come fa
 * `avvisi-attivita.spec.ts` — e da qui si fa così. Restano su sorgente solo le due metà che stanno
 * nell'app e che questo progetto non compila da qui: e lì si àncora alla **chiamata**, non a una
 * stringa che un commento può soddisfare da solo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avvisaAttivitaNuova } from './avvisi-attivita';
import { nomeDellaCliente } from './coach-tasks.service';
import { PrismaService } from '../prisma/prisma.service';

const app = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', 'app', 'src', ...p), 'utf8');
const dashboard = app('staff', 'nutritionist', 'NutriDashboard.tsx');
const shell = app('staff', 'ui.tsx');

/**
 * ⚠️ Si guarda **il codice, non i commenti**. Il file cita `/staff/coach-tasks` anche in prosa: una
 * regex su quella stringa nuda passava anche cancellando tutta la sezione e lasciando il commento.
 */
/**
 * ⛔ **Le prove «non c'è» si fanno sul CODICE, coi commenti tolti.** La prima stesura cercava
 * `TIPI_DELLA_NUTRIZIONISTA` nel sorgente intero e falliva su un **commento** che spiega perché
 * quel filtro sta nel backend: una prova che vieta di *nominare* una cosa vieta di spiegarla.
 */
export function senzaCommenti(sorgente: string): string {
  return sorgente
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')   // {/* … */} di JSX
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}
const codiceDashboard = senzaCommenti(dashboard);

const CHIAMA_LE_ATTIVITA = /useApi<Attivita\[\]>\('\/staff\/coach-tasks\?status=todo/;
const MOSTRA_LE_ATTIVITA = /\{attivita\.data && attivita\.data\.length > 0 &&/;
const CHIUDE_LE_ATTIVITA = /api\(`\/staff\/coach-tasks\/\$\{id\}\/status`, \{ method: 'PATCH'/;

const push = () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) });
const prismaFinto = () => ({
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-nutri', prefs: null }), findMany: jest.fn().mockResolvedValue([]) },
  clientProfile: {
    findUnique: jest.fn().mockResolvedValue({
      name: 'Giulia Rossi',
      assignedCoach: { id: 'staff-c', userId: 'u-nutri', displayName: 'Sara' },
    }),
  },
  notification: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
  coachTask: { findMany: jest.fn().mockResolvedValue([]) },
} as unknown as PrismaService);

describe('le attività della nutrizionista, nella sua app', () => {
  const TASK = { id: 't1', clientId: 'c1', title: 'Digiuno estremo da verificare', description: null, dueDate: new Date('2026-09-04') };

  /**
   * ⛔ **La frase si legge dal messaggio vero**, non dal sorgente: qui gira `avvisaAttivitaNuova`
   * con un push finto e si guarda il `body` che parte davvero.
   */
  it('⛔ la push dice «La trovi in Dashboard», e lo dice nel messaggio che parte', async () => {
    const prisma = prismaFinto();
    const p = push();
    await avvisaAttivitaNuova(prisma, p, TASK);
    const body = p.sendToUser.mock.calls[0][2] as string;
    expect(body).toContain('La trovi in Dashboard.');
    expect(body).not.toContain('backoffice');
  });

  /** ⚠️ E vale per tutti i destinatari, non per un ramo: il messaggio è uno solo. */
  it('⚠️ e la frase non dipende da chi la riceve: il corpo è uno', async () => {
    const prisma = prismaFinto();
    const p = push();
    await avvisaAttivitaNuova(prisma, p, { ...TASK, title: 'Visita da fissare (entro il 30/09/2026)' });
    expect(p.sendToUser.mock.calls[0][2] as string).toContain('La trovi in Dashboard.');
  });

  it('⛔ la sua dashboard chiede le attività, e le mostra', () => {
    expect(dashboard).toMatch(CHIAMA_LE_ATTIVITA);
    expect(dashboard).toMatch(MOSTRA_LE_ATTIVITA);
  });

  /**
   * ⛔ **E gliele fa CHIUDERE.** Su questi quattro tipi la coach prende 403
   * (`TIPI_DELLA_NUTRIZIONISTA` in `coach-tasks.service.ts`): è lei l'unica che può chiuderle.
   * Mostrargliele senza il pulsante voleva dire mandarle una push, farle aprire la Dashboard e
   * rispedirla nel backoffice per il clic — mentre la push ha appena smesso di dirle dov'è il
   * backoffice. E il giorno dopo `escalateAttivitaScadute` le manda alla manager commerciale.
   */
  it('⛔ e da lì le può chiudere: senza il pulsante la schermata è una vetrina', () => {
    expect(dashboard).toMatch(CHIUDE_LE_ATTIVITA);
  });

  /**
   * ⛔ **Si mostrano tutte quelle che arrivano.** L'app staff non ha una pagina «tutte le attività»,
   * e il suo backoffice è dietro una chiave che può essere spenta: un «…e altre 12» senza nessun
   * posto dove andarle a prendere rende falsa la frase della push. ⚠️ E l'ordine è `dueDate asc`,
   * quindi l'attività **appena notificata** è l'ultima: un taglio in cima nasconderebbe proprio
   * quella per cui la notifica è arrivata.
   */
  it('⛔ non taglia la lista a N righe: non c\'è nessun posto dove vedere il resto', () => {
    expect(codiceDashboard).not.toMatch(/lista\.slice\(/);
  });

  /**
   * ⚠️ **Nessun filtro nell'app**: l'endpoint la serve già con i suoi quattro tipi sulle sue
   * clienti (`filtroNutrizionista`). Due regole per la stessa domanda divergono — e questa decide
   * cosa vede una persona.
   */
  it('⚠️ e non rifiltra per tipo: il filtro sta nel backend, in un posto solo', () => {
    expect(codiceDashboard).not.toMatch(/TIPI_DELLA_NUTRIZIONISTA|a\.kind ===|a\.kind\.startsWith|\.includes\(a\.kind\)/);
  });

  it('⛔ il pallino sul tab non è più solo dei ruoli coach', () => {
    expect(shell).toMatch(/NUTRI_ROLES\.has\(user\.role\)/);
    expect(shell).toMatch(/if \(!conAttivita\) return;/);
  });

  /**
   * ⛔ **La prova che tiene ferme le due metà insieme.** Se un giorno la sezione sparisse dalla
   * dashboard e la frase restasse, la notifica tornerebbe a portare su una schermata vuota — e
   * nessun'altra prova se ne accorgerebbe, perché ciascuna metà da sola sta in piedi.
   *
   * ⛔ Si pretende che siano **tutte e due vere**, non che «siano uguali»: `false === false`
   * passava, e chi toglieva tutte e due non incontrava nessuna resistenza.
   */
  it('⛔ la frase «in Dashboard» e la sezione ci sono TUTTE E DUE', async () => {
    const p = push();
    await avvisaAttivitaNuova(prismaFinto(), p, TASK);
    expect((p.sendToUser.mock.calls[0][2] as string).includes('La trovi in Dashboard')).toBe(true);
    expect(CHIAMA_LE_ATTIVITA.test(dashboard) && MOSTRA_LE_ATTIVITA.test(dashboard)).toBe(true);
  });

  /** ⚠️ E la scadenza si scrive sempre, non solo quando è passata: «per il 5/9» dice cosa fare. */
  it('⚠️ ogni riga porta la sua scadenza, in ritardo o no', () => {
    expect(dashboard).toMatch(/a\.overdue \? 'scaduta il ' : 'per il '/);
  });

  /**
   * ⛔ **IL NOME DELLA CLIENTE NON PUÒ ARRIVARE VUOTO.** Era `name ?? [nome, cognome].join(' ') ??
   * email ?? 'Cliente'`: `join` non torna mai nullish, quindi con tutti i campi vuoti usciva `''` e
   * i due ripieghi erano codice morto. Nella Dashboard la riga cominciava con « · per il 05/09».
   */
  it('⛔ il nome della cliente ha un ripiego che funziona davvero', () => {
    expect(nomeDellaCliente({ firstName: null, lastName: null, email: 'a@b.it', clientProfile: { name: null } })).toBe('a@b.it');
    expect(nomeDellaCliente({ firstName: null, lastName: null, email: null, clientProfile: { name: '   ' } })).toBe('Cliente');
    expect(nomeDellaCliente({ firstName: 'Anna', lastName: null, email: 'a@b.it', clientProfile: null })).toBe('Anna');
    expect(nomeDellaCliente(null)).toBe('Cliente');
  });
});
