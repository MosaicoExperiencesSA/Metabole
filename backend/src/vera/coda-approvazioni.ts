/**
 * LE TRE CODE DI APPROVAZIONE, UNA COSA PER VOLTA (Simone, 18/8: «se ci sono ricette da approvare,
 * combinazioni da approvare, allergeni da approvare, vanno tutti inviati a vera che aiuta il
 * nutrizionista a verificare uno per uno»).
 *
 * Oggi quelle tre code esistono già, ma si svuotano con tre pulsanti che agiscono **in blocco**
 * sull'intera dieta: «attiva tutte le ricette», «segna gli allergeni verificati», «approva i
 * gruppi». Un pulsante che verifica sessanta piatti in un colpo non verifica niente: è una firma
 * in fondo a un foglio che nessuno ha letto. Qui le stesse code diventano una conversazione, e
 * ogni riga si guarda da sola prima di dire sì.
 *
 * ⚠️ QUESTO FILE NON PARLA COL DATABASE. Prende le tre code già lette, le mette in fila, scrive la
 * domanda e legge la risposta. Le scritture restano dietro le porte che esistono già
 * (`CatalogService.setRecipeAllergens`, `CatalogService.updateRecipe`, `EquivalenceService.approve`),
 * con il loro permesso e la loro traccia in audit: nessuna seconda strada per un dato che decide
 * cosa finisce nel piatto di una cliente.
 */
import { NOME_PASTO } from '../catalog/giornate-complete';
import { normalizza } from '../common/nomi-alimento';

// ───────────────────────────────────────────────────────── quello che entra ────

export type TipoApprovazione = 'allergeni' | 'ricetta' | 'combinazione';

export interface RicettaInRevisione {
  id: string;
  nome: string;
  /** Accesa = il motore la può mettere in una giornata. */
  attiva: boolean;
  /** Gli allergeni sono stati guardati da una persona. */
  allergeniVerificati: boolean;
  slot?: string;
  kcal?: number;
  /** I nomi degli ingredienti, per far vedere cosa si sta approvando. */
  ingredienti?: string[];
}

export interface CombinazioneInRevisione {
  id: string;
  nome: string;
  /** `approved` = già fatta. Qualunque altro valore è «aspetta me». */
  stato: string;
  /** Gli alimenti che il motore potrà scambiare fra loro. */
  alimenti?: string[];
}

export interface DietaInRevisione {
  dietaId: string;
  dietaNome: string;
  ricette: RicettaInRevisione[];
  combinazioni: CombinazioneInRevisione[];
}

export interface VoceDaApprovare {
  tipo: TipoApprovazione;
  /** L'id della ricetta o del gruppo di equivalenza. */
  id: string;
  nome: string;
  dietaId: string;
  dietaNome: string;
  slot?: string;
  kcal?: number;
  elenco?: string[];
}

export interface ContoCoda {
  allergeni: number;
  ricette: number;
  combinazioni: number;
  totale: number;
}

/**
 * ⚠️ Un tetto alla coda costruita, non alle cose da fare: il conto (`contaCoda`) resta quello vero.
 * Serve solo a non tenere in memoria diecimila righe per farne vedere una.
 */
export const MASSIMO_VOCI = 300;

// ───────────────────────────────────────────────────────────── la fila ────

/** L'identità di una voce nella coda. Serve a saltarla senza confondere una ricetta con un gruppo. */
export function chiaveVoce(voce: { tipo: TipoApprovazione; id: string }): string {
  return `${voce.tipo}:${voce.id}`;
}

/**
 * LA FILA, nell'ordine in cui va guardata.
 *
 * Tre decisioni dentro, e nessuna è di gusto:
 *
 * 1. **Gli allergeni vengono prima dell'accensione, e mai insieme sulla stessa ricetta.** Se una
 *    ricetta ha gli allergeni ancora da guardare, di quella ricetta si chiede SOLO l'allergene.
 *    Chiedere «la attivo?» su un piatto di cui nessuno ha guardato gli allergeni vuol dire che un
 *    «sì» detto di corsa accende un piatto non verificato: la domanda sull'accensione ricompare da
 *    sola al giro dopo, perché la coda si ricostruisce ogni volta dalla banca dati.
 * 2. **Le combinazioni vanno in fondo.** Un gruppo di equivalenza dice al motore cosa può scambiare
 *    fra le ricette di quella dieta: approvarlo mentre i piatti sono ancora spenti è approvare
 *    scambi fra cose che non esistono.
 * 3. **Una ricetta si chiede una volta sola** anche se sta in tre diete. È la stessa riga di
 *    catalogo: accenderla la accende per tutte, e chiederlo tre volte insegna a rispondere senza
 *    leggere. La dieta che si mostra è la prima in cui la si incontra — serve a dare un contesto,
 *    non a delimitare l'effetto (e la frase lo dice, quando le diete sono più d'una).
 */
export function costruisciCoda(diete: readonly DietaInRevisione[], saltate: readonly string[] = []): VoceDaApprovare[] {
  const salta = new Set(saltate);
  const viste = new Set<string>();
  const allergeni: VoceDaApprovare[] = [];
  const ricette: VoceDaApprovare[] = [];
  const combinazioni: VoceDaApprovare[] = [];

  for (const d of diete) {
    for (const r of d.ricette ?? []) {
      if (r.allergeniVerificati && r.attiva) continue; // niente da chiedere su questa
      // ⚠️ QUI c'è la regola 1: il tipo è UNO SOLO, e finché gli allergeni sono aperti è quello.
      const voce: VoceDaApprovare = {
        tipo: r.allergeniVerificati ? 'ricetta' : 'allergeni',
        id: r.id,
        nome: r.nome,
        dietaId: d.dietaId,
        dietaNome: d.dietaNome,
        slot: r.slot,
        kcal: r.kcal,
        elenco: r.ingredienti,
      };
      const chiave = chiaveVoce(voce);
      if (viste.has(chiave) || salta.has(chiave)) continue;
      viste.add(chiave);
      (voce.tipo === 'allergeni' ? allergeni : ricette).push(voce);
    }
    for (const g of d.combinazioni ?? []) {
      if (g.stato === 'approved') continue;
      const voce: VoceDaApprovare = {
        tipo: 'combinazione',
        id: g.id,
        nome: g.nome,
        dietaId: d.dietaId,
        dietaNome: d.dietaNome,
        elenco: g.alimenti,
      };
      const chiave = chiaveVoce(voce);
      if (viste.has(chiave) || salta.has(chiave)) continue;
      viste.add(chiave);
      combinazioni.push(voce);
    }
  }

  return [...allergeni, ...ricette, ...combinazioni].slice(0, MASSIMO_VOCI);
}

/**
 * QUANTE COSE ASPETTANO, per tipo.
 *
 * ⚠️ Il conto NON toglie le saltate: quello che si è messo da parte in questa conversazione resta
 * lavoro da fare, e un contatore che cala perché ho detto «dopo» racconta una bugia riposante.
 */
export function contaCoda(diete: readonly DietaInRevisione[]): ContoCoda {
  // ⚠️ NON si conta `costruisciCoda`: quella taglia a MASSIMO_VOCI e tiene nascosta l'accensione
  // di chi ha ancora gli allergeni aperti. Un conto fatto sulla fila direbbe «restano 300» per
  // sempre, e direbbe che le ricette da accendere sono meno di quante sono.
  const viste = new Set<string>();
  let allergeni = 0;
  let ricette = 0;
  let combinazioni = 0;
  for (const d of diete) {
    for (const r of d.ricette ?? []) {
      if (!r.allergeniVerificati) {
        if (viste.has(`allergeni:${r.id}`)) continue;
        viste.add(`allergeni:${r.id}`);
        allergeni++;
      }
      if (!r.attiva) {
        if (viste.has(`ricetta:${r.id}`)) continue;
        viste.add(`ricetta:${r.id}`);
        ricette++;
      }
    }
    for (const g of d.combinazioni ?? []) {
      if (g.stato === 'approved') continue;
      if (viste.has(`combinazione:${g.id}`)) continue;
      viste.add(`combinazione:${g.id}`);
      combinazioni++;
    }
  }
  return { allergeni, ricette, combinazioni, totale: allergeni + ricette + combinazioni };
}

// ─────────────────────────────────────────────────────── leggere la risposta ────

export type RispostaApprovazione = 'si' | 'no' | 'salta' | 'basta';

/**
 * ⚠️ L'ORDINE DEI CONTROLLI È LA FUNZIONE. «non va bene» contiene «va bene»; «non lo so» contiene
 * «lo so». Si guarda prima il più specifico, e il sì per ultimo.
 *
 * ⚠️ E «non lo so» è un **salta**, non un no. Su una coda di verifica il dubbio non è un rifiuto:
 * chi non è sicura deve poter passare oltre senza che il suo dubbio diventi una decisione. Sono
 * tre stati, come sempre in questo progetto: sì, no, e «non lo so» — e il terzo non si arrotonda.
 */
export function leggiRispostaApprovazione(frase: string): RispostaApprovazione | null {
  const t = normalizza(frase);
  if (!t) return null;

  if (/\b(basta|stop|fermati|fermiamoci|smetti|smettiamo|ho finito|un altra volta|riprendo (dopo|poi)|lascia (perdere|stare)|per adesso basta|adesso no|non adesso|piu tardi|dopo tutte)\b/.test(t)) {
    return 'basta';
  }
  if (/\b(salta(la|le|lo)?|salto|passa(la)?|avanti|la prossima|prossima|non lo so|non so|non saprei|non sono sicur[ao]|boh|devo guardarla|la guardo (dopo|poi)|questa dopo)\b/.test(t)) {
    return 'salta';
  }
  if (/\b(no|non (va bene|approvo|attivarla|attivare|accenderla|confermo)|respingi(la)?|respingo|bocci(a|ala|o)|scarta(la)?|lascia(la|lo)? (spenta|spento|com e|cosi)|sbagliat[ao]|va rifatta|rifalla)\b/.test(t)) {
    return 'no';
  }
  if (/\b(si|ok|okay|va bene|approvo|approvat[ao]|approva(la)?|conferm[oa]|confermat[ao]|certo|procedi|vai|d accordo|daccordo|perfetto|giusta|giusto|corrett[ao]|attiva(la)?|accendi(la)?|puoi)\b/.test(t)) {
    return 'si';
  }
  return null;
}

// ────────────────────────────────────────────────────────────── le frasi ────

const etichettaSlot = (slot?: string): string => (slot ? (NOME_PASTO[slot] ?? slot) : '');

/** «restano altre 3 cose» — e a zero non si dice niente, invece di scrivere «restano altre 0». */
function coda(rimanenti: number): string {
  const altre = Math.max(0, rimanenti - 1);
  if (altre === 0) return 'È l\'ultima.';
  return `Dopo questa ne ${altre === 1 ? 'resta un\'altra' : `restano altre ${altre}`}.`;
}

const COMANDI = '«sì» per approvare, «no» per lasciarla com\'è, «salta» per rivederla dopo, «basta» per fermarci qui.';

/**
 * LA DOMANDA SU UNA VOCE.
 *
 * ⚠️ Si mostra sempre **cosa c'è dentro** — gli ingredienti della ricetta, gli alimenti del gruppo.
 * Una domanda che dice solo il nome («Approvo "Pollo alle erbe"?») si risponde «sì» senza guardare:
 * è lo stesso difetto dei pulsanti in blocco, rimpicciolito. Se l'elenco manca lo si dice, e si
 * manda in scheda: «non ho gli ingredienti» non è «non ha ingredienti».
 */
export function testoVoce(voce: VoceDaApprovare, rimanenti: number, quanteDiete = 1): string {
  const dentro = voce.elenco?.length
    ? voce.elenco.slice(0, 12).join(', ') + (voce.elenco.length > 12 ? ', …' : '')
    : null;

  if (voce.tipo === 'ricetta') {
    const dettagli = [etichettaSlot(voce.slot), voce.kcal ? `${voce.kcal} kcal` : ''].filter(Boolean).join(' · ');
    const anche = quanteDiete > 1 ? ` ⚠️ Questa ricetta sta in ${quanteDiete} diete: accenderla le riguarda tutte.` : '';
    return (
      `**${voce.nome}**${dettagli ? ` — ${dettagli}` : ''} · dieta «${voce.dietaNome}»\n` +
      (dentro ? `Ingredienti: ${dentro}\n` : 'Gli ingredienti non riesco a leggerli da qui: aprila in Ricette prima di decidere.\n') +
      `Gli allergeni sono già confermati. La accendo, così il motore la può mettere nei menu?${anche}\n\n` +
      `${COMANDI} ${coda(rimanenti)}`
    );
  }

  return (
    `**${voce.nome}** — combinazione della dieta «${voce.dietaNome}»\n` +
    (dentro
      ? `Il motore potrà scambiare fra loro: ${dentro}\n`
      : 'Gli alimenti del gruppo non riesco a leggerli da qui: aprilo in Equivalenze prima di decidere.\n') +
    `La approvo?\n\n${COMANDI} ${coda(rimanenti)}`
  );
}

/** L'apertura della coda: cosa c'è, e da dove comincio. */
export function fraseApertura(conto: ContoCoda): string {
  const pezzi: string[] = [];
  if (conto.allergeni) pezzi.push(`${conto.allergeni} ${conto.allergeni === 1 ? 'ricetta con gli allergeni da confermare' : 'ricette con gli allergeni da confermare'}`);
  if (conto.ricette) pezzi.push(`${conto.ricette} ${conto.ricette === 1 ? 'ricetta da approvare' : 'ricette da approvare'}`);
  if (conto.combinazioni) pezzi.push(`${conto.combinazioni} ${conto.combinazioni === 1 ? 'combinazione da approvare' : 'combinazioni da approvare'}`);
  return (
    `Ti aspettano ${pezzi.join(', ')}. Te le passo una per volta.\n\n` +
    '⚠️ Comincio dagli allergeni: una ricetta con gli allergeni ancora da guardare non te la faccio accendere.'
  );
}

export function fraseCodaVuotaApprovazioni(): string {
  return 'Non c\'è niente da approvare: allergeni, ricette e combinazioni sono tutti a posto.';
}

export function fraseApprovataRicetta(nome: string): string {
  return `✓ **${nome}** è accesa: da adesso il motore la può usare.`;
}

export function fraseApprovataCombinazione(nome: string): string {
  return `✓ **${nome}** è approvata: il motore può fare quegli scambi.`;
}

/**
 * IL «NO» NON SCRIVE NIENTE, e lo dice.
 *
 * Una ricetta non approvata è già spenta, un gruppo non approvato è già in bozza: il no è lo stato
 * di adesso. Inventare qui una cancellazione o un «rifiutato» sarebbe darle un potere che il
 * pulsante equivalente non ha. Quindi si lascia com'è e si dice **dove** si cambia davvero.
 */
export function fraseLasciata(voce: VoceDaApprovare): string {
  const dove = voce.tipo === 'combinazione' ? 'in Equivalenze' : 'in Ricette';
  return `La lascio com'è: **${voce.nome}** resta ${voce.tipo === 'combinazione' ? 'in bozza' : 'spenta'} e non entra nei menu. Se va corretta o tolta si fa ${dove}, dalla sua scheda.`;
}

export function fraseSaltata(nome: string): string {
  return `Va bene, **${nome}** la rivediamo dopo: la rimetto in coda.`;
}

/** ⚠️ Si dice sempre quanto resta: fermarsi va bene, non sapere cosa si è lasciato indietro no. */
export function fraseInterrotta(rimanenti: number): string {
  if (rimanenti <= 0) return 'Ci fermiamo qui. Non è rimasto niente da guardare.';
  return `Ci fermiamo qui. ${rimanenti === 1 ? 'Resta una cosa' : `Restano ${rimanenti} cose`} da approvare: dimmi «riprendiamo le approvazioni» quando vuoi.`;
}

export function fraseCodaFinita(fatte: number): string {
  if (fatte <= 0) return 'Abbiamo finito la coda. Non ho scritto niente.';
  return `Abbiamo finito la coda: ${fatte === 1 ? 'una cosa approvata' : `${fatte} cose approvate`}. Quello che hai lasciato indietro lo ritrovi qui quando torni.`;
}

/** La riga non c'è più, o l'ha già sistemata un'altra collega mentre parlavamo. */
export function fraseSparita(nome: string): string {
  return `**${nome}** nel frattempo è cambiata — l'ha già sistemata qualcun altro, o non c'è più. La salto.`;
}

export function fraseNonScritta(nome: string): string {
  return `Non sono riuscita a scrivere su **${nome}**: non è approvata. Riprova dalla scheda, così vedi l'errore per intero.`;
}

/** L'invito nel quadro della giornata. `null` = non c'è niente, e allora non si dice niente. */
export function fraseInvitoCoda(conto: ContoCoda): string | null {
  if (conto.totale <= 0) return null;
  return `${conto.totale} ${conto.totale === 1 ? 'cosa aspetta' : 'cose aspettano'} la tua approvazione in catalogo (${conto.allergeni} allergeni, ${conto.ricette} ricette, ${conto.combinazioni} combinazioni) — dimmi «approvazioni» e te le passo una per volta.`;
}
