/**
 * UNA GIORNATA HA TRE FORME, E SONO SCRITTE IN DICIOTTO POSTI — 20/8.
 *
 * Cercando la stessa famiglia di difetto trovata oggi tre volte — un elenco scritto a mano che deve
 * rincorrere una verità che sta altrove — ho contato gli elenchi di slot nel backend:
 *
 *   · i cinque pasti in ordine → **9 volte**
 *   · i tre pasti             → **5 volte**
 *   · il digiuno              → **4 volte**
 *
 * ✅ **Oggi combaciano tutte**, e per questo non è stato riscritto niente: cambiare l'ordine dei
 * pasti dentro il motore per fare ordine sarebbe rischiare la colazione dopo la cena — il danno
 * scritto nel commento di `collega-ricetta.ts` — in cambio di niente che si veda.
 *
 * ⚠️ Quello che mancava è **qualcuno che se ne accorga quando smetteranno di combaciare**. Questo
 * test legge i file veri e pretende che ogni elenco di slot sia una delle tre forme dichiarate in
 * `slot-pasto.ts`. Il giorno che ne compare una quarta, o che qualcuno sposta la colazione in
 * fondo, il test lo dice — e chi l'ha scritta decide se era voluta invece di scoprirlo da una
 * cliente che vede la cena a colazione.
 *
 * ⛔ Che serva è già dimostrato: **sul «4 pasti» le funzioni non dicevano la stessa cosa**, e
 * nessuno l'ha visto per mesi perché nessuno guardava i quattro elenchi insieme.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { FORME_DI_GIORNATA, GIORNATA_CINQUE, GIORNATA_DIGIUNO, GIORNATA_TRE, MAIN_SLOTS } from './slot-pasto';

const SRC = resolve(__dirname, '..');
const SLOT = new Set(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);

/**
 * ⚠️ Le eccezioni si dichiarano qui, con il motivo accanto. Un elenco di eccezioni senza motivo
 * diventa il posto dove si nasconde la prossima divergenza.
 */
const AMMESSE: { forma: string; dove: string; perche: string }[] = [
  {
    forma: 'breakfast,lunch,afternoon_snack,dinner',
    dove: 'engine-rules/engine-rules.service.ts',
    perche:
      'Il ramo `n === 4` di `slotsForMeals`, il solo posto che conosce una giornata da quattro pasti. ' +
      'Non lo raggiunge più nessuno: dal 20/8 il DTO accetta solo 3 e 5 (diag:pasti → zero clienti a 4). ' +
      'Resta scritto perché toglierlo vorrebbe dire decidere che una giornata da quattro non esisterà mai.',
  },
  {
    forma: 'breakfast,morning_snack,lunch',
    dove: 'menu/finestre-digiuno.ts',
    perche: 'Non è una giornata: è l\'elenco dei pasti che una finestra di digiuno SALTA.',
  },
  {
    forma: 'breakfast,morning_snack,dinner,afternoon_snack',
    dove: 'menu/finestre-digiuno.ts',
    perche: 'Come sopra: pasti saltati, non una giornata. L\'ordine qui non conta e infatti non è quello del giorno.',
  },
];

function tuttiITs(dir: string): string[] {
  const fuori: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fuori.push(...tuttiITs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) fuori.push(p);
  }
  return fuori;
}

/** Ogni array letterale di soli slot trovato nei sorgenti, con il file dov'era. */
function elenchiTrovati(): { forma: string; dove: string }[] {
  const fuori: { forma: string; dove: string }[] = [];
  for (const file of tuttiITs(SRC)) {
    const testo = readFileSync(file, 'utf8');
    for (const m of testo.matchAll(/\[([^[\]]{10,200}?)\]/g)) {
      const voci = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
      if (voci.length < 3 || !voci.every((v) => SLOT.has(v))) continue;
      if (new Set(voci).size !== voci.length) continue;
      fuori.push({ forma: voci.join(','), dove: relative(SRC, file) });
    }
  }
  return fuori;
}

const chiave = (f: readonly string[]) => f.join(',');

describe('le forme dichiarate', () => {
  it('sono tre, e sono quelle', () => {
    expect(FORME_DI_GIORNATA.map(chiave)).toEqual([
      'breakfast,morning_snack,lunch,afternoon_snack,dinner',
      'breakfast,lunch,dinner',
      'lunch,afternoon_snack,dinner',
    ]);
  });

  it('⚠️ i pasti su cui si misura la soglia sono la giornata da tre', () => {
    expect(chiave(MAIN_SLOTS)).toBe(chiave(GIORNATA_TRE));
  });

  it('la colazione è prima della cena, in tutte e due le giornate che ce l\'hanno', () => {
    for (const f of [GIORNATA_CINQUE, GIORNATA_TRE]) {
      expect(f.indexOf('breakfast')).toBeLessThan(f.indexOf('dinner'));
    }
    expect(GIORNATA_DIGIUNO).not.toContain('breakfast');
  });
});

describe('quello che sta scritto nei file', () => {
  const trovati = elenchiTrovati();

  it('ce ne sono, altrimenti questo test non sta guardando niente', () => {
    expect(trovati.length).toBeGreaterThanOrEqual(15);
  });

  /**
   * ⚠️ **L'eccezione vale per la forma NEL SUO FILE, non per la forma ovunque.**
   *
   * La prima versione confrontava solo la forma, e la mutazione di prova non mordeva: ho messo la
   * giornata da quattro dentro `giornate-complete.ts` — dove non c'entra niente — e il test è
   * passato, perché quella forma era ammessa *da qualche parte*. Un permesso dato a un file
   * diventava un permesso dato a tutti. È la quarta volta oggi che una mutazione non morde e il
   * test sbagliato sono io.
   */
  it('⛔ ogni elenco di slot è una forma dichiarata, o un\'eccezione con la sua ragione, nel suo file', () => {
    const forme = new Set(FORME_DI_GIORNATA.map(chiave));
    const eccezioni = new Set(AMMESSE.map((a) => `${a.forma}|${a.dove}`));
    const fuori = trovati
      .filter((t) => !forme.has(t.forma) && !eccezioni.has(`${t.forma}|${t.dove}`))
      .map((t) => `${t.dove}: [${t.forma}]`);
    expect([...new Set(fuori)]).toEqual([]);
  });

  it('ogni eccezione dichiarata esiste davvero: un\'eccezione morta è una regola più debole per niente', () => {
    const presenti = new Set(trovati.map((t) => `${t.forma}|${t.dove}`));
    for (const a of AMMESSE) expect(presenti.has(`${a.forma}|${a.dove}`)).toBe(true);
  });

  it('e ognuna ha scritto il perché', () => {
    for (const a of AMMESSE) expect(a.perche.length).toBeGreaterThan(40);
  });
});
