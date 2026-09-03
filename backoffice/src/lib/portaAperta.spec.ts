import { describe, expect, it } from 'vitest';
import { paroleDellaPorta, type CellaAperta } from './portaAperta';

const pagina = (k: string) => ({ diet_workspace: 'Gestione dieta', recipes: 'Ricette' }[k] ?? k);
const ruolo = (k: string) => ({ nutritionist: 'Nutrizionista' }[k] ?? k);
const cella = (over: Partial<CellaAperta>): CellaAperta =>
  ({ role: 'r', pageKey: 'recipes', livello: 'view', provenienza: 'hub', ...over });

describe('le parole dell\'avviso «aperta lo stesso»', () => {
  it('⛔ l\'hub si nomina, e dice su cosa agire', () => {
    const p = paroleDellaPorta(cella({ provenienza: 'hub', chiave: 'diet_workspace' }), pagina, ruolo);
    expect(p.breve).toBe('aperta da Gestione dieta');
    expect(p.lunga).toContain('agisci su «Gestione dieta»');
  });

  it('⛔ l\'eredità dice ANCHE la seconda via d\'uscita: salvare una riga esplicita', () => {
    const p = paroleDellaPorta(cella({ provenienza: 'riga del genitore', chiave: 'recipes' }), pagina, ruolo);
    expect(p.breve).toBe('eredita Ricette');
    expect(p.lunga).toContain('salva una riga esplicita');
  });

  /**
   * ⛔ Il caso del ruolo personalizzato: qui si spegne la **voce di menu**, non la porta. Dirlo con
   * le parole dell'hub manderebbe a spegnere una cosa che non c'entra.
   */
  it('⛔ il ruolo di base nomina il RUOLO, non una pagina', () => {
    const p = paroleDellaPorta(cella({ provenienza: 'ruolo di base', ruolo: 'nutritionist' }), pagina, ruolo);
    expect(p.breve).toBe('vale Nutrizionista');
    expect(p.lunga).toContain('non questa colonna');
    expect(p.lunga).toContain('«Nutrizionista»');
  });

  /**
   * ⛔ **Nessun ramo inventa un consiglio che non si può seguire.** Per il default non c'è nessun
   * permesso su cui agire: il valore sta nel codice del backend.
   */
  it('⛔ e il default NON dice «agisci su»: non c\'è niente su cui agire', () => {
    const p = paroleDellaPorta(cella({ provenienza: 'default' }), pagina, ruolo);
    expect(p.lunga).not.toContain('agisci');
    expect(p.lunga).not.toContain('undefined');
  });

  /** ⚠️ E nessuna etichetta scrive mai «undefined» o «null» quando manca una chiave. */
  it('⚠️ una chiave mancante non finisce in pagina come «undefined»', () => {
    for (const p of (['hub', 'riga del genitore', 'ruolo di base', 'default', 'riga propria'] as const)) {
      const parole = paroleDellaPorta(cella({ provenienza: p, chiave: undefined, ruolo: undefined }), pagina, ruolo);
      expect(`${parole.breve} ${parole.lunga}`).not.toMatch(/undefined|null/);
    }
  });

  /** ⚠️ Una provenienza che questa versione non conosce resta VERA, invece di dire una cosa sbagliata. */
  it('⚠️ una provenienza sconosciuta ha parole neutre e corrette', () => {
    const p = paroleDellaPorta(cella({ provenienza: 'domani' as never }), pagina, ruolo);
    expect(p.lunga).toBe('Aperta lo stesso da un altro permesso.');
  });
});
