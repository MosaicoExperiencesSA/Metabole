/**
 * «QUESTA RIGA C'ERA GIÀ» — riconoscere il vincolo di unicità che ha detto no.
 *
 * Serve dove l'idempotenza si fa **provando a scrivere**, invece di guardare prima e scrivere dopo.
 *
 * ## Perché guardare prima non basta
 *
 * Il modo naturale sembra questo:
 *
 * ```ts
 * const gia = await prisma.payment.findFirst({ where: { pspRef: inv.id } });
 * if (gia) return;                       // già fatto
 * await prisma.payment.create({ ... });  // ← fra le due righe non c'è niente che tenga
 * ```
 *
 * Fra il controllo e la scrittura passa un istante, e in quell'istante può entrare una seconda
 * copia della stessa richiesta: Stripe ritenta i webhook, e non arrivano in fila indiana. Entrambe
 * trovano «non c'è», entrambe scrivono. Due pagamenti per la stessa fattura, e a valle **due
 * provvigioni** — che si scoprono solo quando qualcuno confronta i compensi con gli incassi.
 *
 * L'unico posto dove «una sola volta» può essere garantito è il **database**, con un vincolo. Allora
 * si rovescia l'ordine: si scrive, e se il vincolo dice no vuol dire che qualcun altro è arrivato
 * prima — che è esattamente l'informazione che serviva.
 *
 * ## Due codici, non uno
 *
 * `P2002` è il codice di Prisma. `23505` è quello nativo di PostgreSQL, e salta fuori quando la
 * scrittura passa da `$queryRaw` o quando l'errore arriva senza essere tradotto. Riconoscerne solo
 * uno significa che il giorno in cui la stessa protezione viene messa su una query raw non funziona,
 * e non funziona **in silenzio**: il duplicato passa e l'errore viene inghiottito da un catch che
 * credeva di sapere cosa stava filtrando.
 */

/** Vero se l'errore è il rifiuto di un vincolo di unicità (Prisma `P2002` o PostgreSQL `23505`). */
export function eViolazioneUnicita(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const codice = (e as { code?: unknown }).code;
  return codice === 'P2002' || codice === '23505';
}
