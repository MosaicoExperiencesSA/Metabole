/**
 * Divide un nome intero in NOME e COGNOME.
 *
 * Sta qui, e non dentro lo script che ripara i dati, perché è una regola di prodotto e non una
 * riga di manutenzione: la usa `prisma/sistema-nomi.ts` per rimettere a posto le clienti
 * importate, e resta a disposizione di chiunque debba fare la stessa cosa domani.
 *
 * **L'ultima parola è il cognome, il resto è il nome.** Non il contrario: «Maria Grazia
 * Cerchiara» è Maria Grazia di cognome Cerchiara, non Maria di cognome Grazia Cerchiara.
 * Le PARTICELLE («de», «di», «della», «lo», «van»…) restano attaccate al cognome, altrimenti
 * «Maria Teresa De Santis» diventerebbe una signora di cognome «Santis».
 *
 * Resta un margine d'errore — i cognomi doppi senza particella («Anna Rossi Bianchi») vengono
 * divisi male — ed è il motivo per cui chi la usa deve MOSTRARE prima e scrivere dopo.
 */

/** Particelle che appartengono al cognome, non al nome. */
const PARTICELLE = new Set([
  'de', "de'", 'del', 'della', 'dello', 'degli', 'dei', 'delle',
  'di', 'da', 'dal', 'dalla', 'dallo', 'dai', 'dagli',
  'lo', 'la', 'li', 'le', "d'", 'd', "o'", 'mac', 'mc',
  'van', 'von', 'der', 'den', 'ter', 'saint', 'san',
]);

export function dividiNome(intero: string): { nome: string; cognome: string } | null {
  const parti = (intero ?? '').trim().split(/\s+/).filter(Boolean);
  if (parti.length < 2) return null; // una parola sola: non si inventa un cognome
  let inizioCognome = parti.length - 1;
  // Risale finché trova particelle: «Maria Teresa De Santis» → il cognome parte da «De».
  while (inizioCognome > 1 && PARTICELLE.has(parti[inizioCognome - 1].toLowerCase())) {
    inizioCognome -= 1;
  }
  const nome = parti.slice(0, inizioCognome).join(' ');
  const cognome = parti.slice(inizioCognome).join(' ');
  if (!nome || !cognome) return null;
  return { nome, cognome };
}

/**
 * Quanto ci si può fidare della divisione: serve a far rivedere a mano SOLO i casi dubbi
 * invece di rileggere cinquecento righe (richiesta di Simone, 8/8, sui lead importati).
 *
 * - `sicuro` — **due parole**: «Rosa Tinelli» non ha alternative. Oppure tre e più parole **con
 *   una particella**: in «Maria Teresa De Santis» il «De» ancora il cognome, e il resto è nome.
 *   Qui non c'è niente da decidere, è aritmetica.
 * - `da_controllare` — **tre o più parole senza particella**: «Maria Grazia Cerchiara» (nome
 *   composto + cognome) e «Anna Rossi Bianchi» (nome + cognome doppio) hanno la stessa forma, e
 *   nessuna regola può distinguerle senza sapere che «Maria Grazia» è un nome e «Rossi Bianchi»
 *   no. Un dizionario dei nomi propri sarebbe una scorciatoia che sbaglia su ogni nome straniero,
 *   e chi conosce quella persona lo sa in un secondo: quindi si mostra e si chiede.
 */
export function certezzaDivisione(intero: string): 'sicuro' | 'da_controllare' {
  const parti = (intero ?? '').trim().split(/\s+/).filter(Boolean);
  if (parti.length <= 2) return 'sicuro';
  const haParticella = parti.slice(1, -1).some((p) => PARTICELLE.has(p.toLowerCase()));
  return haParticella ? 'sicuro' : 'da_controllare';
}
