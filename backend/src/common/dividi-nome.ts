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
