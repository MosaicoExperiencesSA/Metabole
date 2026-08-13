/**
 * IL COLLAUDO CHE SI COSTRUISCE DA SOLO.
 *
 * L'avvertenza sta in testa a `registro.service.ts` e questo file è la sua metà mancante: un
 * traduttore marcisce senza che nessuno se ne accorga. Il giorno in cui cambia il catalogo, il
 * dizionario o una regola in `capisci.ts`, nessuno sa dire se ha smesso di capire le frasi che prima
 * capiva — il guasto non è un errore rosso, è che a lei comincia a sembrare più scema di prima.
 *
 * L'unico rimedio che funziona è un elenco di **frasi vere** con accanto l'azione giusta, ripassato
 * prima di ogni rilascio. Qui si estrae da quello che è già scritto:
 *
 * - le frasi **capite**, dal registro (`AzioneVera.frase` + `azione`): sono i casi che devono
 *   continuare a passare;
 * - le frasi **non capite**, dalla conversazione: sono i casi da far passare.
 *
 * ## ⚠️ Le frasi non capite si leggono accoppiando i messaggi, non da un campo
 *
 * Quando l'agente si arrende non conserva la frase nello stato — lo stato lo butta, il giro è
 * finito. La frase è però lì sopra: è l'ultimo messaggio della nutrizionista prima della resa.
 * Accoppiarli è banale e ha un vantaggio che un campo dedicato non avrebbe: funziona anche sulle
 * conversazioni **già avvenute**, comprese quelle di prima che questo file esistesse.
 */

export interface RigaMessaggio {
  id: string;
  ruolo: string;
  testo: string;
  meta: unknown;
  createdAt: Date;
}

export interface FraseNonCapita {
  frase: string;
  quante: number;
  ultimaVolta: Date;
  /** Si è arreso dopo il secondo tentativo, o era solo il primo «non ci arrivo»? */
  arresa: boolean;
}

export interface CasoCapito {
  frase: string;
  azione: string;
  ambito: string;
  /** `annullata` è il caso più interessante: capita, ma tradotta in un modo che è stato disfatto. */
  stato: string;
}

const ESITI_MANCATI = new Set(['non_capito', 'arresa']);

const esitoDi = (m: RigaMessaggio): string | null =>
  ((m.meta ?? null) as { esito?: string } | null)?.esito ?? null;

/**
 * Le frasi su cui l'agente si è fermato, dalla più ripetuta.
 *
 * ⚠️ Si conta la **frase**, non l'episodio: la stessa frase riscritta tre volte da tre persone
 * diverse è un buco solo, e vederla in cima con «3 volte» è il modo di sapere da dove cominciare.
 * L'ordine è per frequenza e non per data proprio per questo — un elenco cronologico fa lavorare
 * sull'ultima capitata invece che sulla più frequente.
 */
export function fraseNonCapite(messaggi: RigaMessaggio[], limite = 50): FraseNonCapita[] {
  const ordinati = messaggi.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const per = new Map<string, FraseNonCapita>();

  for (let i = 0; i < ordinati.length; i += 1) {
    const m = ordinati[i];
    if (m.ruolo !== 'agente') continue;
    const esito = esitoDi(m);
    if (!esito || !ESITI_MANCATI.has(esito)) continue;

    // La frase è l'ultimo messaggio suo prima di questa risposta.
    let frase: string | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (ordinati[j].ruolo === 'nutrizionista') {
        frase = (ordinati[j].testo ?? '').trim();
        break;
      }
    }
    if (!frase) continue;

    const chiave = frase.toLowerCase();
    const gia = per.get(chiave);
    if (gia) {
      gia.quante += 1;
      gia.ultimaVolta = m.createdAt;
      gia.arresa = gia.arresa || esito === 'arresa';
    } else {
      per.set(chiave, { frase, quante: 1, ultimaVolta: m.createdAt, arresa: esito === 'arresa' });
    }
  }

  return [...per.values()]
    .sort((a, b) => b.quante - a.quante || b.ultimaVolta.getTime() - a.ultimaVolta.getTime())
    .slice(0, limite);
}

/**
 * I casi che devono continuare a passare, dal registro.
 *
 * ⚠️ Le frasi si ripetono spesso identiche («a X niente formaggi molli» detta a venti clienti): si
 * tiene **una** riga per frase+azione, altrimenti il corpus si riempie di copie e diventa un elenco
 * che nessuno rilegge.
 */
export function casiCapiti(
  righe: { frase: string; azione: string; ambito: string; stato: string }[],
  limite = 200,
): CasoCapito[] {
  const visti = new Map<string, CasoCapito>();
  for (const r of righe) {
    const frase = (r.frase ?? '').trim();
    if (!frase) continue;
    const chiave = `${frase.toLowerCase()}|${r.azione}`;
    // ⚠️ Una riga annullata vince su una attiva con la stessa frase: fra le due, quella che insegna
    // qualcosa è quella andata storta.
    const gia = visti.get(chiave);
    if (gia && gia.stato === 'annullata') continue;
    visti.set(chiave, { frase, azione: r.azione, ambito: r.ambito, stato: r.stato });
  }
  return [...visti.values()].slice(0, limite);
}
