/**
 * ⛔ **UNA DIPENDENZA `@Optional()` CON UN TIPO UNIONE NON ARRIVA MAI, E NESSUNO LO DICE.**
 *
 * Misurato la notte fra il 3 e il 4/9, scrivendo la push di «Piano bloccato». Con
 * `@Optional() private readonly mail: MailService | null = null` TypeScript emette **`Object`** in
 * `design:paramtypes` — è quello che fa per ogni tipo unione — Nest non sa cosa iniettare,
 * `@Optional()` inghiotte il fallimento, e resta il valore di default. La dipendenza è `null` per
 * sempre, in silenzio: nessun errore, nessun log, e le prove non se ne accorgono perché
 * costruiscono i servizi con `new`, passando quello che vogliono.
 *
 * ```
 * MenuService         → … | PushService | Object
 * PersonalBaseService → PrismaService | ConfigParamsService | AuditService | Object
 * RegistroVeraService → PrismaService | AuditService | DizionarioService | Object | Object
 * ```
 *
 * ⛔ **Non è un difetto di stanotte: `RegistroVeraService` ce l'aveva dal 13/8**, e l'email di
 * conflitto al capo — decisione di Simone di quella sera, *«l'in-app da solo vale finché il capo
 * entra quel giorno»* — non è mai partita. Un mese e mezzo di avvisi che non c'erano, con il codice
 * per mandarli scritto e verde.
 *
 * La cura è togliere l'unione: `@Optional() private readonly mail?: MailService`. Il tipo emesso
 * torna `MailService` e Nest lo risolve.
 *
 * ⚠️ **Questa prova guarda i SORGENTI e non i metadati**, ed è voluto: `@Inject(TOKEN)` su
 * un'interfaccia emette `Object` legittimamente (ha un token esplicito, Nest sa cosa fare), quindi
 * una regola sui metadati direbbe «rotto» a `RegistroVeraService.ricette`, che sta benissimo. La
 * regola vera è più stretta e più semplice: **un parametro `@Optional()` non dichiara un'unione**.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sorgenti(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) sorgenti(p, out);
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

/** Ogni parametro che porta `@Optional()`, col testo della sua dichiarazione fino alla virgola. */
const PARAMETRI: { file: string; testo: string }[] = (() => {
  const out: { file: string; testo: string }[] = [];
  for (const p of sorgenti(join(__dirname, '..'))) {
    const testo = readFileSync(p, 'utf8');
    /**
     * ⛔ **Ancorato a inizio riga, e non è pignoleria: la prima stesura è diventata rossa su una
     * VOCE DEI LAVORI** che, raccontando questo difetto, cita `@Optional() … : MailService | null`
     * dentro una stringa. È la lezione già scritta il 3/9 per le descrizioni diete — *«un test che
     * legge un sorgente deve distinguere il codice dalla menzione del codice»* — e un parametro di
     * costruttore sta sempre su una riga sua.
     */
    for (const m of testo.matchAll(/^[ \t]*@Optional\(\)[^,\n]*(?:\n[^,)]*)?/gm)) {
      out.push({ file: p.replace(/^.*\/src\//, 'src/'), testo: m[0] });
    }
  }
  return out;
})();

describe('le dipendenze facoltative arrivano davvero', () => {
  /**
   * ⛔ A zero parametri trovati, la prova sotto sarebbe verde sul nulla — ed è successo davvero:
   * ancorando la ricerca a inizio riga (vedi sopra) il conto è sceso da tre a due, perché uno dei
   * tre era la **menzione** dentro una voce dei lavori. Il numero è due, e sono questi due.
   */
  it('⛔ il lettore trova davvero i parametri `@Optional()`, e sono i due che ci sono', () => {
    expect(PARAMETRI.map((p) => p.file).sort()).toEqual([
      'src/personal-base/personal-base.service.ts',
      'src/vera/registro.service.ts',
    ]);
  });

  it('⛔ nessuno dichiara un tipo unione: sarebbe `Object` nei metadati, e non arriverebbe mai', () => {
    const rotti = PARAMETRI.filter((p) => /:\s*[^,]*\|/.test(p.testo));
    expect(rotti.map((p) => `${p.file} → ${p.testo.trim()}`)).toEqual([]);
  });
});
