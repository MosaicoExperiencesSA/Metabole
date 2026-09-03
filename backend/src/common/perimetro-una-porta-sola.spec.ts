/**
 * UNA PORTA SOLA PER «CHI VEDE TUTTE LE CLIENTI» — 20/8.
 *
 * `const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales']` stava copiato **identico** in
 * quattro servizi — alert, analytics, dashboard, riassunti delle chat — e in tutti e quattro
 * decideva la stessa cosa: se chi guarda vede tutte le clienti o solo le sue.
 *
 * ⛔ Quattro copie di una decisione di perimetro sono quattro copie della domanda «chi può vedere i
 * dati di chi». Il giorno che quella risposta cambia se ne aggiornano una, due o tre, e il
 * risultato non è una pagina storta: è una persona che vede gli alert, le chat o i numeri di
 * clienti che non sono sue. `perimetro-clienti.ts` è nato l'11/8 esattamente per questo, e queste
 * quattro copie gli erano rimaste accanto.
 *
 * Il difetto non sta dentro una funzione: sta nei punti che la copiano. Per questo si guarda il
 * testo dei file.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { RUOLI_CHE_VEDONO_TUTTE, clienteNelPerimetro, perimetroClienti, vedeTutteLeClienti } from './perimetro-clienti';
import { ROLES } from './roles';

const SRC = resolve(__dirname, '..');
const PORTA = 'common/perimetro-clienti.ts';

function tuttiITs(dir: string): string[] {
  const fuori: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fuori.push(...tuttiITs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) fuori.push(p);
  }
  return fuori;
}

describe('la porta è una sola', () => {
  it("⛔ nessun altro file elenca a mano i ruoli che vedono tutto", () => {
    const colpevoli: string[] = [];
    for (const file of tuttiITs(SRC)) {
      const rel = relative(SRC, file);
      if (rel === PORTA) continue;
      const testo = readFileSync(file, 'utf8');
      /**
       * Le tre stringhe insieme in una riga di codice: è la copia, comunque la si scriva.
       *
       * ⚠️ **Fuori `@Roles(...)`**, che è una domanda diversa e va tenuta separata: quel decoratore
       * dice **chi può entrare** in una pagina, questo elenco dice **quanto vede** chi è entrato.
       * Lo scrive già il commento in testa a `perimetro-clienti.ts`, e la prima versione di questo
       * test non lo sapeva: segnalava 24 controller che stavano facendo il loro mestiere. Un
       * controllo che grida sui punti giusti insegna a ignorarlo sui punti sbagliati.
       */
      for (const riga of testo.split('\n')) {
        if (riga.trimStart().startsWith('*')) continue; // i commenti possono citarlo
        if (riga.includes('@Roles(')) continue;
        const ci = (r: string) => riga.includes(`'${r}'`);
        if (!RUOLI_CHE_VEDONO_TUTTE.every(ci)) continue;
        /**
         * ⚠️ E **solo quei tre**: `common/roles.ts` elenca tutti i ruoli di sistema, ed è la sua
         * ragione di esistere, non una copia del perimetro. La copia che si cerca è la riga che
         * nomina quei tre e nessun altro ruolo.
         */
        if ([...ROLES].some((r) => !RUOLI_CHE_VEDONO_TUTTE.includes(r) && ci(r))) continue;
        colpevoli.push(`${rel}: ${riga.trim().slice(0, 90)}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });

  it('i quattro servizi passano dalla porta', () => {
    for (const f of ['alerts/alerts.service.ts', 'analytics/analytics.service.ts', 'dashboard/dashboard.service.ts', 'chat/conversation-summary.service.ts']) {
      expect(readFileSync(join(SRC, f), 'utf8')).toContain('vedeTutteLeClienti');
    }
  });
});

describe('cosa risponde, ruolo per ruolo', () => {
  /**
   * ⚠️ Questo test non dice che la risposta è **giusta**: dice qual è **oggi**. Serve a rendere
   * visibile una decisione che finora era sparsa in quattro file, così il giorno che si cambia si
   * vede riga per riga cosa si sta cambiando — invece di scoprirlo da una coach che vede gli alert
   * di clienti che non sono sue.
   */
  const ATTESO: Record<string, boolean> = {
    client: false,
    coach: false,
    coach_coordinator: false,
    nutritionist: false,
    head_nutritionist: true,
    sales: true,
    marketing: false,
    head_marketing: false,
    admin: true,
  };

  it('⚠️ ogni ruolo di sistema ha una risposta scritta qui: nessuno resta implicito', () => {
    expect(Object.keys(ATTESO).sort()).toEqual([...ROLES].sort());
  });

  for (const [ruolo, atteso] of Object.entries(ATTESO)) {
    it(`«${ruolo}» ${atteso ? 'vede tutte' : 'vede solo le sue'}`, () => {
      expect(vedeTutteLeClienti(ruolo)).toBe(atteso);
    });
  }

  it('un ruolo che non esiste non vede tutto: sbagliare per difetto si vede, per eccesso no', () => {
    expect(vedeTutteLeClienti('ruolo_inventato')).toBe(false);
    expect(vedeTutteLeClienti(null)).toBe(false);
    expect(vedeTutteLeClienti(undefined)).toBe(false);
    expect(vedeTutteLeClienti('')).toBe(false);
  });

  it('l\'elenco è quello che era nei quattro file: questa consegna sposta, non cambia', () => {
    expect([...RUOLI_CHE_VEDONO_TUTTE]).toEqual(['admin', 'head_nutritionist', 'sales']);
  });
});

/**
 * ⛔ LA DIVERGENZA CHE ESISTE OGGI, scritta qui perché si veda.
 *
 * `perimetroClienti` (stesso file) risponde «nessun limite» a tutto ciò che non è coach-like e non
 * è nutrizionista — quindi anche a `marketing` e `head_marketing`. `vedeTutteLeClienti` no.
 * Le due risposte divergono su quei due ruoli, **adesso**, e questa consegna non le appiana:
 * è una decisione su chi vede i dati delle clienti, e la prende Simone.
 */
describe('⚠️ dove le due risposte NON combaciano (oggi)', () => {
  /**
   * ⛔ **SI CHIAMA `perimetroClienti`, NON SI RISCRIVE LA SUA REGOLA** (corretto il 3/9).
   *
   * Qui c'era una riga che rifaceva a mano il ragionamento del perimetro:
   *
   *     const perimetroSarebbeNullo = (r) => r !== 'coach' && r !== 'coach_coordinator' && r !== 'nutritionist'
   *
   * ⚠️ Cioè **il cancello più pericoloso dei due era quello che nessuno guardava**. Togliere `sales`
   * da `RUOLI_CHE_VEDONO_TUTTE` fa diventare rosso questo file in due punti; cambiare
   * `perimetroClienti` — aggiungere un ruolo a `isCoachLike`, o togliere il `role !== 'nutritionist'`
   * — lo lasciava **verde**, perché il test confrontava la funzione vera con una copia della sua
   * regola vecchia. Una copia di una regola di perimetro dentro la prova che la sorveglia è la
   * stessa cosa che questo file esiste per vietare, un piano più sotto.
   *
   * ⚠️ Il perimetro vero fa due query, e per questo qui c'era una scorciatoia: si chiedono
   * `user.role` e la scheda `Staff`, e per la coordinatrice anche la rete sotto (`reteSottoDiMe`,
   * che interroga `staff.findMany`). Sono tre righe di finto Prisma, e valgono la differenza fra un
   * test che guarda e uno che sembra guardare.
   */
  const perimetroDi = (ruolo: string) => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: ruolo }) },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        // La rete sotto la coordinatrice: vuota basta, qui interessa solo `null` o non-`null`.
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    return perimetroClienti(prisma as never, 'u-1');
  };

  it('marketing e head_marketing: per `perimetroClienti` nessun limite, per `vedeTutteLeClienti` no', async () => {
    const diverse: string[] = [];
    for (const r of ROLES) {
      if (r === 'client') continue; // vedi la prova qui sotto
      const senzaLimite = (await perimetroDi(r)) === null;
      if (senzaLimite !== vedeTutteLeClienti(r)) diverse.push(r);
    }
    expect(diverse).toEqual(['marketing', 'head_marketing']);
  });

  /**
   * ⚠️ **E i ruoli che un perimetro ce l'hanno sono esattamente tre**, chiesti alla funzione vera.
   * Serve a rendere rossa la riga giusta quando qualcuno tocca `isCoachLike` o il ramo della
   * nutrizionista: senza, la prova qui sopra potrebbe restare verde spostando due ruoli insieme.
   */
  it('⛔ chi ha un perimetro, e su quale campo: chiesto alla funzione, non riscritto', async () => {
    const conPerimetro: Record<string, string> = {};
    for (const r of ROLES) {
      const p = await perimetroDi(r);
      if (p) conPerimetro[r] = p.field;
    }
    expect(conPerimetro).toEqual({
      coach: 'assignedCoachId',
      coach_coordinator: 'assignedCoachId',
      nutritionist: 'assignedNutritionistId',
    });
  });

  /**
   * ⛔ **E `client` NON è escluso perché è innocuo: è escluso perché la risposta è «nessun limite».**
   *
   * `perimetroClienti` non conosce il ruolo `client`, quindi ci risponde `null` come a un admin.
   * ⚠️ Oggi non è un buco perché nessuna rotta che usa il perimetro ammette quel ruolo — lo
   * decidono i `@Roles` dei controller, che sono l'altra domanda («chi entra», non «quanto vede»).
   * ⛔ Ma è un ripiego **per eccesso** dentro il file che dichiara in testa di volerne fare uno per
   * difetto, e sta scritto qui invece che in un commento: il giorno che una rotta aperta alle
   * clienti si appoggiasse al perimetro, questa riga dice cosa succederebbe.
   */
  it('⛔ per una cliente il perimetro è «nessun limite»: la tiene fuori la guardia dei ruoli, non questo file', async () => {
    expect(await perimetroDi('client')).toBeNull();
    expect(vedeTutteLeClienti('client')).toBe(false);
  });
});

/**
 * ⛔ **LA DECISIONE DI SIMONE, 25/8** — e da qui in poi è un test, non un commento.
 *
 * La domanda aperta dal 22/8 era: *«la nutrizionista deve vedere anche le clienti SENZA
 * nutrizionista assegnata?»*. Risposta: *«il capo nutrizionista sì li deve vedere tutti, gli altri
 * nutrizionisti no, vedono solo quelli assegnati a loro»*.
 *
 * ⚠️ È **quello che il codice già faceva**, e allora perché scriverlo? Perché finché era solo il
 * comportamento di oggi, chiunque poteva «migliorarlo» in buona fede — «così la nutrizionista vede
 * anche le orfane, che è più comodo» — e nessuno avrebbe saputo che era una decisione presa. Un
 * comportamento senza una prova che lo tiene è un comportamento in attesa di essere cambiato per
 * sbaglio.
 *
 * ⛔ **Le clienti «di nessuno» restano del capo.** Finché la nutrizionista è una sola la cosa non
 * morde perché il capo copre il vuoto; con due o più, «le clienti di nessuno» sono un buco che
 * nessuno guarda per mestiere — ed è lo stesso momento in cui va spento
 * `assign_head_nutritionist_by_default`. Quello resta il passo da fare, non questo.
 */
describe('⛔ il perimetro delle nutrizioniste: la decisione del 25/8', () => {
  const NESSUNO = '00000000-0000-0000-0000-000000000000';

  /** Il minimo per far rispondere `perimetroClienti`: un utente col suo ruolo e la sua scheda. */
  const chiede = (ruolo: string, staffId: string | null = 'staff-1') => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: ruolo }) },
      staff: { findUnique: jest.fn().mockResolvedValue(staffId ? { id: staffId } : null) },
    };
    return perimetroClienti(prisma as never, 'u-1');
  };

  it('⛔ il capo nutrizionista non ha perimetro: le vede tutte', async () => {
    expect(await chiede('head_nutritionist')).toBeNull();
    expect(vedeTutteLeClienti('head_nutritionist')).toBe(true);
  });

  it('⛔ la nutrizionista vede SOLO le clienti assegnate a lei', async () => {
    expect(await chiede('nutritionist')).toEqual({ field: 'assignedNutritionistId', staffIds: ['staff-1'] });
    expect(vedeTutteLeClienti('nutritionist')).toBe(false);
  });

  /**
   * ⛔ **E una cliente senza nutrizionista assegnata NON è sua.** È la domanda del 22/8 messa alla
   * prova: il filtro chiede `assignedNutritionistId IN (staff-1)`, e `null` non sta in nessun
   * elenco. Se un domani qualcuno aggiungesse un `OR: { assignedNutritionistId: null }` «per
   * comodità», questo test diventerebbe rosso.
   */
  it('⛔ una cliente senza nutrizionista assegnata non entra nel perimetro di nessuna nutrizionista', async () => {
    const perimetro = await chiede('nutritionist');
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-c', assignedNutritionistId: null }),
      },
    };
    expect(await clienteNelPerimetro(prisma as never, perimetro, 'cliente-orfana')).toBe(false);
    // ⚠️ E per il capo sì, perché il capo non ha perimetro affatto.
    expect(await clienteNelPerimetro(prisma as never, null, 'cliente-orfana')).toBe(true);
  });

  /**
   * ⛔ **Senza scheda `Staff` il perimetro è VUOTO, non «tutto».** È la scelta di fondo del file, e
   * vale la pena tenerla ferma con una prova: in una funzione che decide chi vede i dati clinici di
   * chi, sbagliare per difetto si vede subito e si aggiusta; sbagliare per eccesso non si vede.
   */
  it('⛔ una nutrizionista senza scheda staff non vede nessuno, non tutti', async () => {
    expect(await chiede('nutritionist', null)).toEqual({ field: 'assignedNutritionistId', staffIds: [NESSUNO] });
  });
});

/**
 * ⚠️ **LA DIVERGENZA SU MARKETING, MISURATA** (25/8) — perché non è un difetto di oggi.
 *
 * Il riquadro qui sopra dice che `perimetroClienti` risponde «nessun limite» anche a `marketing` e
 * `head_marketing`, mentre `vedeTutteLeClienti` no. Vero. ⛔ Ma prima di appianarla è stato misurato
 * **dove può mordere**, e la risposta è: da nessuna parte che tocchi dati clinici. I punti che
 * chiamano `perimetroClienti` stanno dietro controller i cui `@Roles` **non nominano marketing**;
 * l'unico che un ruolo marketing può raggiungere è il CRM dei lead, dove «vede tutti i lead» è
 * esattamente il mestiere della pagina.
 *
 * ⛔ **E il guardiano si costruisce l'elenco da solo** — riscritto al secondo giro di revisione,
 * 25/8. La prima stesura elencava tre file **a mano**, e proprio i due che il commento della voce
 * indica come il rischio vero (i controller del commercio) non c'erano: il guardiano non guardava
 * la porta che il testo accanto nominava. Adesso l'elenco si ricava dai **chiamanti veri** di
 * `perimetroClienti`, quindi un punto nuovo entra nel controllo senza che nessuno se ne ricordi.
 *
 * ⛔ **E un `@Roles` che non è fatto di sole stringhe letterali NON si dichiara sicuro.** Misurato:
 * la prima stesura leggeva riga per riga cercando `marketing`, quindi
 * `@Roles('admin', ...RUOLI_MKT)` passava verde — e `coach-tasks.controller.ts` usa già proprio
 * quella forma (`...RUOLI_NUTRIZIONISTA`). Una lista che non si può leggere non è una lista sicura:
 * o è tutta letterale, o va dichiarata qui sotto con il motivo.
 */
describe('⚠️ la divergenza su marketing non tocca nessun dato clinico', () => {

  /** I file di produzione che chiamano `perimetroClienti`: sono loro a filtrare le clienti. */
  const chiamanti = (): string[] => {
    const trovati: string[] = [];
    for (const f of tuttiITs(SRC)) {
      const testo = readFileSync(f, 'utf8');
      if (/\bperimetroClienti\s*\(/.test(testo) && !f.endsWith('perimetro-clienti.ts')) {
        trovati.push(relative(SRC, f));
      }
    }
    return trovati;
  };

  /** Il controller che sta davanti a un servizio: `x/y.service.ts` → `x/*.controller.ts`. */
  const controllerDi = (file: string): string[] => {
    const cartella = join(SRC, file.split('/').slice(0, -1).join('/'));
    return tuttiITs(cartella)
      .filter((f) => f.endsWith('.controller.ts'))
      .map((f) => relative(SRC, f));
  };

  it('⚠️ i chiamanti di `perimetroClienti` ci sono, e sono più di tre', () => {
    // Se un giorno fossero zero, questo file starebbe controllando il nulla senza dirlo.
    expect(chiamanti().length).toBeGreaterThan(3);
  });

  it('⛔ nessun `@Roles` davanti a un filtro sulle clienti nomina marketing', () => {
    const colpevoli: string[] = [];
    const files = [...new Set(chiamanti().flatMap(controllerDi))];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      for (const riga of readFileSync(join(SRC, f), 'utf8').split('\n')) {
        if (riga.includes('@Roles(') && /marketing/.test(riga)) colpevoli.push(`${f}: ${riga.trim()}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });

  /**
   * ⛔ Il controllo sopra guarda le stringhe: qui si guarda che **siano stringhe**. Un `@Roles` con
   * uno spread o una costante non si può leggere riga per riga, quindi non si può dichiarare sicuro.
   */
  /**
   * ⛔ Il controllo sopra guarda le stringhe: qui si guarda che **si possano guardare**. Un `@Roles`
   * con uno spread non si legge riga per riga — misurato: `@Roles('admin', ...RUOLI_MKT)` passava
   * verde alla prima stesura, e `coach-tasks.controller.ts` usa già proprio quella forma
   * (`...RUOLI_NUTRIZIONISTA`). Quindi lo spread **si risolve**: si va a leggere la costante e si
   * guarda cosa c'è dentro. Se non si trova, è rosso — una lista che non si può leggere non è una
   * lista che si può dichiarare sicura.
   */
  it('⛔ e gli spread dentro quei `@Roles` si risolvono, e nemmeno loro nominano marketing', () => {
    /** Il contenuto letterale di una costante esportata, cercata in tutto `src`. */
    const contenutoDi = (nome: string): string | null => {
      for (const f of tuttiITs(SRC)) {
        const testo = readFileSync(f, 'utf8');
        const m = testo.match(new RegExp(`(?:export )?const ${nome}[^=]*=\\s*\\[([^\\]]*)\\]`, 's'));
        if (m) return m[1];
      }
      return null;
    };

    const problemi: string[] = [];
    for (const f of [...new Set(chiamanti().flatMap(controllerDi))]) {
      // ⚠️ I commenti si tolgono prima: possono citare un `@Roles` che non è codice.
      const testo = readFileSync(join(SRC, f), 'utf8')
        .split('\n')
        .filter((r) => !r.trimStart().startsWith('*') && !r.trimStart().startsWith('//'))
        .join('\n');
      for (const m of testo.matchAll(/@Roles\(([^)]*)\)/gs)) {
        for (const pezzo of m[1].split(',')) {
          const p = pezzo.trim();
          if (!p || /^'[a-z_]+'$/.test(p)) continue;
          const spread = p.match(/^\.\.\.([A-Za-z_][A-Za-z0-9_]*)$/);
          if (!spread) {
            problemi.push(`${f}: «${p}» dentro @Roles non è né una stringa né uno spread leggibile`);
            continue;
          }
          const dentro = contenutoDi(spread[1]);
          if (dentro === null) problemi.push(`${f}: non trovo la costante ${spread[1]}`);
          else if (/marketing/.test(dentro)) problemi.push(`${f}: ${spread[1]} contiene marketing`);
        }
      }
    }
    expect(
      problemi.length
        ? `${problemi.join('\n')}\n→ Questo \`@Roles\` sta davanti a un punto che filtra le clienti: `
          + 'se ci finisce dentro un ruolo marketing, `perimetroClienti` risponde «nessun limite» e '
          + 'quel reparto si ritrova l\'intera tabella clienti, in silenzio.'
        : '',
    ).toBe('');
  });
});
