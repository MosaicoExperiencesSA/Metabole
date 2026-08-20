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
import { RUOLI_CHE_VEDONO_TUTTE, vedeTutteLeClienti } from './perimetro-clienti';
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
  /** Il perimetro vero fa una query; qui si riproduce solo la sua regola sui ruoli. */
  const perimetroSarebbeNullo = (ruolo: string) => ruolo !== 'coach' && ruolo !== 'coach_coordinator' && ruolo !== 'nutritionist';

  it('marketing e head_marketing: per `perimetroClienti` nessun limite, per `vedeTutteLeClienti` no', () => {
    const diverse = [...ROLES].filter((r) => r !== 'client' && perimetroSarebbeNullo(r) !== vedeTutteLeClienti(r));
    expect(diverse).toEqual(['marketing', 'head_marketing']);
  });
});
