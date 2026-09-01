import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * ⛔ **IL CRON `daily` NON COMPONE I MENU — e chi scrive il contrario manda qualcuno a premere un
 * pulsante che non fa niente.**
 *
 * Il commento in cima a `cron.controller.ts` lo dice da mesi: *«i menu non li compone questo cron.
 * `engine.runBatch()` valuta le regole e scrive decisioni; a comporre i menu è `deliverIfEligible`,
 * che gira quando la cliente apre l'app»* — e al salvataggio di una misura.
 *
 * ⚠️ **Questa sentinella nasce l'1/9 da un mio errore.** Avevo appena scritto uno script che
 * cancella giornate perché il motore le ricomponga, e in tre punti — lo script, il messaggio di
 * commit, il registro — avevo scritto «le ricompone il cron notturno». Simone ha fatto girare
 * `daily` fidandosi di quella riga; il cron ha lavorato per 56 secondi, ha fatto tutto il suo
 * mestiere, e i due menu mancanti sono rimasti mancanti.
 *
 * ⛔ Il danno di una frase così non è il tempo perso: è che **chi la legge smette di cercare**.
 * Aveva già premuto il pulsante giusto secondo la documentazione, quindi il problema doveva essere
 * altrove — ed è il modo in cui una cliente resta senza menu per un giorno mentre tutti credono di
 * aver già fatto la cosa che serviva.
 *
 * ⚠️ Il commento vero esisteva. Nessuno lo aveva letto perché la frase sbagliata era **più vicina**
 * a chi lavorava. Per questo il controllo sta qui e non in un documento.
 */

const BACKEND = join(__dirname, '..', '..');

/**
 * La forma dell'errore: si nomina il cron (o «il giro della notte») **come autore** della
 * ricomposizione dei menu.
 *
 * ⚠️ Stretta apposta: non grida su chi nomina il cron e i menu nella stessa pagina — succede
 * dappertutto e per buone ragioni — ma su chi mette i due in **quella** relazione.
 */
const IL_CRON_COMPONE = [
  /(?:cron|giro della notte|notturno)[^.\n]{0,80}?(?:ricompone|compone|rifà)\s+(?:i\s+)?(?:menu|giornate|le giornate|i giorni)/i,
  /(?:ricompone|compone|rifà)[^.\n]{0,60}?(?:il\s+)?cron\s+(?:notturno|`?daily`?)/i,
  /le ricompone il (?:giro di erogazione, cioè il )?cron/i,
];

/**
 * ⛔ **LA NEGAZIONE, e senza questa la sentinella grida sulla verità.** «Il cron `daily` NON compone
 * menu» contiene le stesse parole nella stessa relazione della frase sbagliata: una regex che
 * guarda solo le parole vieta di scrivere la cosa giusta e lascia passare solo il silenzio — cioè
 * ottiene l'opposto di quello per cui esiste.
 *
 * ⚠️ Si guarda **il testo che ha fatto match**, non la riga intera: un «non» dieci parole più in là
 * appartiene a un'altra frase e non nega questa.
 */
const loAfferma = (testo: string): boolean => {
  /**
   * ⛔ **E LE CITAZIONI NON CONTANO — trovato subito, su me stesso.** La prima stesura gridava
   * sulla riga in cui **cito** la frase sbagliata per smentirla: *dicevo «le ricompone il cron
   * notturno». Falso, e il commento in `cron.controller.ts` lo dice da mesi.* Un guardiano che
   * vieta di scrivere la lezione è un guardiano che **cancella la lezione**, e la prossima persona
   * ricomincia da capo dall'errore.
   *
   * ⚠️ In questo progetto le virgolette basse «…» sono la citazione, dappertutto. Quello che sta
   * dentro è riportato, non affermato: si toglie prima di cercare. Affermarlo in proprio, fuori
   * dalle virgolette, resta vietato.
   */
  const affermato = testo.replace(/«[^»]*»/g, ' ');
  return IL_CRON_COMPONE.some((r) => {
    const m = r.exec(affermato);
    return !!m && !/\bnon\b/i.test(m[0]);
  });
};

/**
 * ⚠️ Chi può nominare quella relazione, e perché: i due file che spiegano **che è falsa**. Un
 * guardiano che grida su chi lo cita è un guardiano che impedisce di scrivere la lezione.
 */
const PERMESSI = new Set<string>([
  'src/cron/cron.controller.ts',
  'src/cron/il-cron-non-compone-menu.spec.ts',
]);

function tuttiIFile(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === 'dist' || nome === 'migrations') continue;
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) out.push(...tuttiIFile(pieno));
    else if (nome.endsWith('.ts')) out.push(pieno);
  }
  return out;
}

describe('⛔ nessuno scrive che il cron ricompone i menu', () => {
  it('⛔ perché non è vero, e chi ci crede smette di cercare', () => {
    const colpevoli: string[] = [];
    for (const dir of ['src', 'prisma']) {
      for (const f of tuttiIFile(join(BACKEND, dir))) {
        const rel = f.slice(BACKEND.length + 1).replace(/\\/g, '/');
        if (PERMESSI.has(rel)) continue;
        const src = readFileSync(f, 'utf8');
        if (src.split('\n').some((r) => loAfferma(r))) colpevoli.push(rel);
      }
    }
    expect(colpevoli.sort()).toEqual([]);
  });

  it('⚠️ e riconoscerebbe la frase che avevo scritto davvero', () => {
    const mie = [
      'le ricompone il giro di erogazione, cioè il cron notturno',
      'Le ricompone il cron notturno. Se non vuoi aspettare la notte, fallo girare adesso',
      'il motore non le rifà da solo: le rifà il cron daily',
    ];
    for (const frase of mie) expect(loAfferma(frase)).toBe(true);
  });

  it('⛔ e non impedisce di CITARE l\'errore per smentirlo', () => {
    expect(loAfferma('Scritto male la prima volta: dicevo «le ricompone il cron notturno». Falso.')).toBe(false);
    // …ma affermarlo in proprio, fuori dalle virgolette, resta vietato.
    expect(loAfferma('Le ricompone il cron notturno, come dice la documentazione.')).toBe(true);
  });

  it('⚠️ e tace su chi dice la cosa giusta', () => {
    const giuste = [
      'Le ricompone `deliverIfEligible`, che gira quando la cliente apre l\'app.',
      'Il cron `daily` NON compone menu: valuta le regole e scrive decisioni.',
      'Il cron notturno scrive le decisioni del motore.',
      'Per non aspettare: «Rigenera menu» dalla scheda della cliente.',
    ];
    for (const frase of giuste) expect(loAfferma(frase)).toBe(false);
  });

  /** ⛔ E la frase vera dev'essere ancora lì: è l'unica fonte da cui tutto il resto discende. */
  it('⛔ il commento che lo dice è ancora in `cron.controller.ts`', () => {
    const src = readFileSync(join(BACKEND, 'src', 'cron', 'cron.controller.ts'), 'utf8');
    expect(src).toMatch(/i menu non li compone questo cron/i);
    expect(src).toMatch(/deliverIfEligible/);
  });
});
