/**
 * ⛔ **UNA MIGRAZIONE CHE NOMINA UNA TABELLA CHE NON ESISTE BLOCCA TUTTO IL RILASCIO.**
 *
 * Trovato in revisione il 25/8, ed era il difetto peggiore della consegna sul digiuno: la migrazione
 * scriveva `ALTER TABLE "client_profiles"` — al plurale — mentre il modello ha
 * `@@map("client_profile")`. `prisma migrate deploy` sarebbe fallito con *relation does not exist*, la
 * migrazione sarebbe restata marcata **failed**, e da lì in poi **nessuna migrazione successiva**
 * sarebbe girata. Il rilascio non parte; se qualcuno lo forza, il codice legge una colonna che non c'è.
 *
 * ⚠️ **E la suite era tutta verde**: 333 suite, 5556 test, e nessuno guardava questo. È il tipo di
 * difetto che non si vede finché non lo si prova in produzione — cioè nel posto più caro.
 *
 * ⛔ Questo guardiano confronta i nomi di tabella scritti nelle migrazioni con quelli che lo schema
 * dichiara. Non verifica le colonne né i tipi: verifica **la cosa che rompe il deploy**, che è
 * sbagliare il nome di una tabella.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const RADICE = resolve(__dirname, '../..');

/** I nomi di tabella che lo schema dichiara: `@@map("…")`, più i modelli senza map. */
function tabelleDelloSchema(): Set<string> {
  const schema = readFileSync(join(RADICE, 'prisma/schema.prisma'), 'utf8');
  const nomi = new Set<string>();
  for (const m of schema.matchAll(/@@map\("([^"]+)"\)/g)) nomi.add(m[1]);
  /**
   * ⚠️ Anche i modelli **senza** `@@map`: lì la tabella si chiama come il modello, e Prisma non
   * pluralizza niente. Escluderli renderebbe questo test cieco proprio sulle tabelle più vecchie.
   */
  for (const m of schema.matchAll(/^model\s+(\w+)\s*\{/gm)) nomi.add(m[1]);
  // Le tabelle di sistema di Prisma: le crea lei, non stanno nello schema.
  nomi.add('_prisma_migrations');
  return nomi;
}

function fileDiMigrazione(): string[] {
  const dir = join(RADICE, 'prisma/migrations');
  return readdirSync(dir)
    .map((n) => join(dir, n))
    .filter((p) => statSync(p).isDirectory())
    .map((p) => join(p, 'migration.sql'))
    .filter((p) => {
      try { return statSync(p).isFile(); } catch { return false; }
    });
}

describe('⛔ le migrazioni nominano tabelle che esistono', () => {
  it('⛔ ogni `ALTER TABLE` punta a una tabella dichiarata nello schema', () => {
    const tabelle = tabelleDelloSchema();
    const fuori: string[] = [];
    for (const f of fileDiMigrazione()) {
      const sql = readFileSync(f, 'utf8');
      /**
       * ⚠️ **Anche `CREATE INDEX … ON "tabella"`** (25/8): sbagliare il nome lì rompe il deploy
       * esattamente come in un `ALTER TABLE`, e il primo indice nuovo dopo questo guardiano sarebbe
       * passato senza che nessuno lo guardasse. Un guardiano che copre una porta sola invita a
       * usare l'altra.
       */
      const nomi = [
        ...sql.matchAll(/ALTER TABLE\s+(?:IF EXISTS\s+)?"([^"]+)"/gi),
        ...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF NOT EXISTS\s+)?"[^"]+"\s+ON\s+"([^"]+)"/gi),
      ];
      for (const m of nomi) {
        /**
         * ⚠️ I nomi con un punto (`public.x`) e i vincoli (`"x_fkey"`) non sono tabelle: il primo è
         * qualificato, il secondo è il secondo argomento di un `RENAME CONSTRAINT`.
         */
        if (m[1].includes('.') || /_fkey$|_key$|_pkey$/.test(m[1])) continue;
        if (!tabelle.has(m[1])) fuori.push(`${f.split('/').slice(-2).join('/')}: "${m[1]}"`);
      }
    }
    expect(
      fuori.length
        ? `${fuori.join('\n')}\n→ Questa tabella non è dichiarata in schema.prisma. `
          + '`prisma migrate deploy` fallirebbe e la migrazione resterebbe marcata failed, bloccando '
          + 'tutte quelle dopo. Controlla il `@@map` del modello: quasi sempre è un plurale di troppo.'
        : '',
    ).toBe('');
  });

  /** ⚠️ E la controprova: se lo schema non si legge, il test tace invece di dire «tutto bene». */
  it('⚠️ lo schema si legge davvero, e dichiara più di cento tabelle', () => {
    expect(tabelleDelloSchema().size).toBeGreaterThan(100);
    expect(fileDiMigrazione().length).toBeGreaterThan(10);
  });
});
