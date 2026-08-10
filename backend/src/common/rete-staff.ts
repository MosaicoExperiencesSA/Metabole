/**
 * LA RETE DELLO STAFF, PERCORSA PER INTERO — chi risponde di chi.
 *
 * Richieste di Simone dell'11/8, a un minuto di distanza: «perché la responsabile delle coach non
 * vede le chat? I permessi di lettura devono risalire la rete, quindi coach, coordinatrice,
 * responsabile» e «anche in chat va risalita la rete come autorizzazioni di lettura».
 *
 * ## Il difetto: la rete si fermava al primo livello
 *
 * `coachTeamScope` prendeva la coordinatrice e le coach con `managerId = lei`. Un livello, e basta.
 * Ma la rete è a tre: coach → coordinatrice → responsabile. Quindi la responsabile vedeva le sue
 * coordinatrici e **non** le clienti delle coach sotto di loro: le persone che il suo ruolo esiste
 * per seguire erano esattamente quelle che non poteva vedere. E in scheda cliente il controllo era
 * ancora più stretto — pretendeva che l'attore fosse **la coach assegnata**, cosa che una
 * coordinatrice non è mai — quindi leggeva «Il tuo ruolo non può leggere le conversazioni di questa
 * cliente» su ogni cliente della sua rete.
 *
 * Qui la rete si percorre **tutta**, per quanti livelli ha. Due archi, perché nel dominio ce ne sono
 * due: `managerId` (la catena delle coach) e `headNutritionistId` (la catena delle nutrizioniste).
 * Chi sta sopra copre chi sta sotto, a qualunque distanza.
 *
 * ## Lettura sì, scrittura no
 *
 * Questo file serve ai permessi di **lettura**, ed è la parola che Simone ha usato due volte.
 * Scrivere resta di chi segue la cliente: una coordinatrice che scrive nel thread «Coach» farebbe
 * comparire alla cliente un messaggio che sembra della sua coach — e per parlare al posto di
 * qualcun altro c'è l'impersonazione, che è dichiarata e tracciata.
 *
 * ## I cicli
 *
 * Un ciclo nei dati (A responsabile di B, B responsabile di A) è possibile: nessun vincolo del
 * database lo impedisce, e basta una riassegnazione fatta male. Senza protezione questa funzione
 * girerebbe per sempre e porterebbe giù il processo. Quindi si tiene l'elenco dei già visti e si
 * mette un tetto alla profondità: una rete di dieci livelli non esiste, e se esistesse il problema
 * non sarebbe questo codice.
 */
import type { PrismaService } from '../prisma/prisma.service';

/** Oltre questo non si scende: la rete vera ha tre livelli, dieci è già un errore nei dati. */
const PROFONDITA_MASSIMA = 10;

/**
 * Tutte le schede staff **sotto** questa, a qualunque livello, lei compresa.
 *
 * Si scende a strati (un giro di query per livello) invece di una query per persona: una rete di
 * cento coach sono tre query, non cento.
 */
export async function reteSottoDiMe(
  prisma: PrismaService,
  staffId: string,
  profonditaMassima = PROFONDITA_MASSIMA,
): Promise<string[]> {
  const visti = new Set<string>([staffId]);
  let frontiera = [staffId];

  for (let livello = 0; livello < profonditaMassima && frontiera.length > 0; livello += 1) {
    const figli = (await prisma.staff.findMany({
      where: {
        OR: [{ managerId: { in: frontiera } }, { headNutritionistId: { in: frontiera } }],
      } as never,
      select: { id: true },
    })) as { id: string }[];

    const nuovi = figli.map((f) => f.id).filter((id) => !visti.has(id));
    for (const id of nuovi) visti.add(id);
    // I già visti non si riesplorano: è la protezione contro i cicli nei dati.
    frontiera = nuovi;
  }

  return [...visti];
}

/**
 * Vero se l'attore **copre** quella scheda staff: è lei, oppure sta sopra di lei nella rete.
 *
 * È la domanda che si fanno i controlli di lettura: «questa cliente è seguita da qualcuno di cui io
 * rispondo?». `null`/assenti tornano `false`: in dubbio non si apre.
 */
export async function copreQuestoStaff(
  prisma: PrismaService,
  attoreStaffId: string | null | undefined,
  staffId: string | null | undefined,
): Promise<boolean> {
  if (!attoreStaffId || !staffId) return false;
  if (attoreStaffId === staffId) return true;
  const rete = await reteSottoDiMe(prisma, attoreStaffId);
  return rete.includes(staffId);
}

/**
 * Vero se l'attore copre **almeno una** delle schede indicate. Serve dove una cliente ha due
 * riferimenti — la coach e la nutrizionista — e basta coprirne uno per poterla leggere.
 */
export async function copreUnoDi(
  prisma: PrismaService,
  attoreStaffId: string | null | undefined,
  staffIds: (string | null | undefined)[],
): Promise<boolean> {
  const validi = staffIds.filter((s): s is string => !!s);
  if (!attoreStaffId || validi.length === 0) return false;
  if (validi.includes(attoreStaffId)) return true;
  const rete = await reteSottoDiMe(prisma, attoreStaffId);
  return validi.some((s) => rete.includes(s));
}
