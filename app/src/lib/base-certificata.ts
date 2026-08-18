/**
 * LA BASE CERTIFICATA, DETTA A LEI — il dato che finora vedeva solo il server.
 *
 * `GET /me/personal-base` esiste dall'R8 e risponde da sempre con **quante ricette del catalogo
 * sono state certificate sicure** per questa cliente e con la **firma** del certificato di
 * personalizzazione. ⚠️ Nell'app non lo chiamava **nessuno**: il giro del 16/8 sui dati che il
 * server manda e nessuna schermata mostra l'aveva contato fra i tre grossi, e la nota diceva
 * «schermata nuova, va disegnata prima». Guardandolo da vicino non è vero: non serve una schermata,
 * serve una riga nel posto dove lei dichiara le sue allergie — perché è lì che nasce la domanda a
 * cui questo numero risponde.
 *
 * La promessa del prodotto è «il tuo menu è costruito su di te». Il numero è la prova che è
 * successo, e la sola persona a cui interessa era l'unica a non averlo.
 *
 * ⚠️ Modulo **puro**: nessuna chiamata, nessun React. Decide cosa si può dire, e i tre stati
 * restano tre.
 */

/** La risposta del server, con solo i campi che servono qui. */
export interface RispostaBase {
  status?: string;
  totalSafe?: number;
  certificate?: { version: number; signature: string };
  message?: string;
}

export type BaseDaMostrare =
  | { tipo: 'pronta'; quante: number; versione: number | null; firma: string | null }
  | { tipo: 'in_lavorazione'; testo: string };

/** Il testo del socio, quando il server non ne manda uno suo. */
export const IN_LAVORAZIONE =
  'Stiamo perfezionando il tuo menu insieme al tuo nutrizionista per renderlo sicuro e su misura per te. Ti avvisiamo appena è pronto.';

/** Quanto se ne mostra: una firma intera è un muro di caratteri, e nessuno la legge. */
export const CARATTERI_FIRMA = 12;

/**
 * Cosa si può dire, a partire da quello che il server ha risposto.
 *
 * ⚠️ **Tre stati, e il terzo è `null`.** Se la lettura non riesce non si scrive niente: «0 ricette
 * certificate sicure per te» detto perché una chiamata è andata storta è la frase più spaventosa
 * che questa schermata possa contenere, e sarebbe falsa.
 *
 * ⚠️ E `ready` con zero ricette **non è pronta**: qualunque cosa sia successa in banca dati, per
 * chi legge «pronta, 0 piatti» non vuol dire niente di buono. Si dice che ci stiamo lavorando, che
 * è la verità dal suo punto di vista.
 */
export function baseDaMostrare(r: RispostaBase | null | undefined): BaseDaMostrare | null {
  if (!r) return null;
  const quante = typeof r.totalSafe === 'number' ? r.totalSafe : 0;
  if (r.status === 'ready' && quante > 0) {
    return {
      tipo: 'pronta',
      quante,
      versione: r.certificate?.version ?? null,
      firma: r.certificate?.signature ? firmaCorta(r.certificate.signature) : null,
    };
  }
  if (r.status === 'ready' || r.status === 'blocked') {
    return { tipo: 'in_lavorazione', testo: r.message?.trim() || IN_LAVORAZIONE };
  }
  // Uno stato che non conosciamo: non si inventa una lettura. Meglio non dire niente.
  return null;
}

/** «148 ricette» / «una ricetta» — al singolare non si scrive «1 ricette». */
export function fraseQuante(quante: number): string {
  if (quante === 1) return 'Una ricetta del catalogo è stata certificata sicura per te';
  return `${quante} ricette del catalogo sono state certificate sicure per te`;
}

/** I primi caratteri della firma, con i puntini solo se c'è davvero altro dopo. */
export function firmaCorta(firma: string, caratteri = CARATTERI_FIRMA): string {
  const f = (firma ?? '').trim();
  return f.length > caratteri ? `${f.slice(0, caratteri)}…` : f;
}
