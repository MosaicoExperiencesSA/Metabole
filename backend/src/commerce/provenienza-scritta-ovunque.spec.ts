import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * ⛔ **CHI SCRIVE LA DATA DI INIZIO DEVE DIRE DA DOVE VIENE — TUTTI, non quattro su cinque.**
 *
 * `clientProfile.planStartDate` conteneva due cose diverse — un giorno scelto o la scadenza del
 * piano in corso — e dal valore non si distinguevano: l'euristica «mezzanotte UTC esatta = un
 * giorno» era stata provata e buttata, perché la scadenza di un piano partito da un giorno produce
 * *proprio* mezzanotte UTC esatta. Dal 28/8 lo dice `planStartOrigine`.
 *
 * ⛔ **Questo test esiste perché una mezza chiusura è peggio di niente.** La revisione ha provato a
 * togliere la provenienza da tre dei cinque punti di scrittura — il questionario, la matita della
 * scheda e la chat con Gaia — e **la suite è rimasta tutta verde**: i loro spec non nominano il
 * campo, e la scrittura passa da un `as never`, quindi nemmeno il compilatore la guarda. Con la voce
 * marcata «fatta» e un test che dice «nasce ATTIVO» per un'altra strada, il difetto delle due ore si
 * sarebbe riaperto **in silenzio**, su chi ci si era appena fidato.
 *
 * ⚠️ È un test **strutturale**, e la ragione è che l'invariante non è su un comportamento ma su una
 * regola di scrittura: *ogni volta che si scrive quella data, si scrive anche da dove viene*. Vale
 * anche per il **sesto** punto, quello che non esiste ancora — ed è quello per cui è scritto.
 */
const RADICE = join(__dirname, '..');

function tuttiIFile(dir: string, dentro: string[] = []): string[] {
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) tuttiIFile(p, dentro);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) dentro.push(p);
  }
  return dentro;
}

/**
 * ⚠️ **Una SCRITTURA, non una lettura.** `planStartDate:` compare anche nelle risposte delle API,
 * nei filtri `where`, nei metadata dell'audit e nei confronti «cosa è cambiato»: pretendere la
 * provenienza anche lì farebbe gridare il test sul posto sbagliato, e un test che grida a vuoto lo
 * si spegne. Una scrittura è un `planStartDate:` dentro una chiamata Prisma su `clientProfile`.
 */
function scritturePlanStart(file: string): { riga: number; testo: string; conProvenienza: boolean }[] {
  const righe = readFileSync(file, 'utf8').split('\n');
  const trovate: { riga: number; testo: string; conProvenienza: boolean }[] = [];
  righe.forEach((testo, i) => {
    if (!/planStartDate:\s*(?!true\b)\S/.test(testo)) return;
    if (/where:/.test(testo) || /metadata:/.test(testo)) return;
    const sopra = righe.slice(Math.max(0, i - 12), i + 1).join('\n');
    const eScrittura = /prisma\.clientProfile/.test(sopra) && /\.(update|upsert|updateMany|create)\(/.test(sopra);
    if (!eScrittura) return;
    /**
     * ⛔ **Su un oggetto scritto tutto su una riga, la provenienza va SU QUELLA RIGA.**
     *
     * La prima stesura guardava una finestra di righe intorno, e su un `upsert` — dove `update:` e
     * `create:` stanno una sotto l'altra — bastava che **una delle due** ce l'avesse: togliendola
     * dall'altra il test restava verde. Cioè metà delle scritture di due dei cinque punti sarebbe
     * tornata muta senza che nessuno se ne accorgesse. Provato per mutazione.
     *
     * ⚠️ La finestra resta per gli oggetti scritti su più righe, dove pretenderla sulla stessa riga
     * vorrebbe dire imporre un formato — ma lì l'oggetto è uno solo, quindi non c'è il vicino che
     * copre il buco.
     */
    const oggettoInLinea = testo.includes('{') && testo.includes('}');
    const dove = oggettoInLinea ? testo : righe.slice(Math.max(0, i - 3), i + 8).join('\n');
    trovate.push({ riga: i + 1, testo: testo.trim(), conProvenienza: dove.includes('planStartOrigine') });
  });
  return trovate;
}

describe('⛔ ogni scrittura della data di inizio dichiara da dove viene', () => {
  const perFile = tuttiIFile(RADICE)
    .map((f) => ({ file: f.replace(`${RADICE}/`, ''), scritture: scritturePlanStart(f) }))
    .filter((x) => x.scritture.length > 0);

  it('⛔ nessun punto scrive `planStartDate` senza `planStartOrigine`', () => {
    const nude = perFile.flatMap((x) =>
      x.scritture.filter((s) => !s.conProvenienza).map((s) => `${x.file}:${s.riga} — ${s.testo}`),
    );
    expect(nude).toEqual([]);
  });

  /**
   * ⚠️ E i file che la scrivono sono **questi quattro**: se domani uno sparisse, il test qui sopra
   * resterebbe verde (zero violazioni) mentre la copertura si sarebbe ridotta. Un invariante che si
   * può soddisfare cancellando il codice non è un invariante.
   *
   * ⛔ E se ne comparisse un **quinto file**, questo test si accende: è il caso per cui esiste, cioè
   * la porta nuova che si dimentica la provenienza e rimette il campo nell'ambiguità.
   */
  it('⚠️ e i file che la scrivono sono ancora quattro, questi', () => {
    expect(perFile.map((x) => x.file).sort()).toEqual([
      'clients/clients.service.ts',
      'commerce/commerce.service.ts',
      'menu/data-inizio-chat.service.ts',
      'profile/profile.service.ts',
    ]);
  });
});
