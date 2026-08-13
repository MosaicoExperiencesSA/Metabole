/**
 * COSA SUCCEDE QUANDO IL CAPO APPROVA — l'unico punto in cui una proposta diventa vera.
 *
 * Una riga «in approvazione» nasce quando la nutrizionista risponde «a tutte» alla domanda
 * sull'ambito: da lì in poi **non è stato scritto niente**, e la riga è una richiesta. Qui c'è cosa
 * comporta dire di sì.
 *
 * ## ⚠️ Approvare scrive su molte persone in una volta
 *
 * È l'unica azione di tutto il progetto che tocca più di una cliente per volta, ed è il motivo per
 * cui esiste la coda. Tre precauzioni, tutte per lo stesso motivo:
 *
 *  - si scrive **solo sulle clienti di chi ha proposto** (`perimetroClienti` sull'autore, non su chi
 *    approva): «a tutte» detto da una nutrizionista vuol dire «a tutte le mie», e il capo che
 *    approva ne vede molte di più;
 *  - è **idempotente**: chi ha già quell'alimento fra i non graditi non viene toccato, così
 *    riapprovare non raddoppia niente e il conteggio resta vero;
 *  - si **conta e si racconta** quante ne sono state toccate. Un'azione che scrive su ottanta
 *    profili e risponde «fatto» è un'azione di cui nessuno saprà mai la portata.
 */
import { combaciaAlimento } from '../common/nomi-alimento';
import { perimetroClienti } from '../common/perimetro-clienti';
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
import type { PrismaService } from '../prisma/prisma.service';

/** ⚠️ Oltre questo numero di clienti non si scrive: si dice quante sarebbero e si chiede a mano. */
const MAX_CLIENTI_IN_UNA_VOLTA = 200;

export interface Proposta {
  id: string;
  nutrizionistaId: string;
  azione: string;
  ambito: string;
  soggettoId: string | null;
  soggettoNome: string | null;
  dettaglio: unknown;
}

export interface EsitoApplicazione {
  riepilogo: string;
  /** Quante clienti sono state toccate davvero. */
  toccate: number;
}

/**
 * Applica una proposta approvata.
 *
 * Ritorna sempre un riepilogo leggibile: è quello che il capo si vede scritto in chat e che finisce
 * nel registro, ed è l'unico modo che ha di sapere cosa ha appena fatto.
 */
export async function applicaProposta(prisma: PrismaService, p: Proposta): Promise<EsitoApplicazione> {
  const dettaglio = (p.dettaglio ?? {}) as { termini?: string[]; intento?: { tipo?: string; from?: string; to?: string } };

  if (p.azione === 'restrizione_cliente') {
    return applicaRestrizione(prisma, p, dettaglio.termini ?? []);
  }

  if (p.azione === 'sostituzione_cliente') {
    /**
     * ⚠️ Una sostituzione estesa NON diventa un gruppo di equivalenza da qui.
     *
     * Portare «X si può fare con Y» dentro il motore per tutte è già un gesto che esiste, si chiama
     * «promuovi a regola» e sta nella tabella delle sostituzioni (§16.9). Rifarlo qui vorrebbe dire
     * una seconda strada per creare gruppi, con la sua logica, che prima o poi deciderà in modo
     * diverso dalla prima. Quindi: si scrive la riga per la cliente, già validata, e la promozione
     * la fa una persona da dove si è sempre fatta.
     */
    const i = dettaglio.intento ?? {};
    if (p.soggettoId && i.from && i.to) {
      await registraSostituzione(prisma, {
        clientId: p.soggettoId,
        tipo: 'ingrediente',
        from: i.from,
        to: i.to,
        recipeId: null,
        origine: 'manuale',
        stato: 'verificata',
        nota: 'Approvata dal capo nutrizionista su proposta dell’assistente.',
        creataDaId: p.nutrizionistaId,
      });
    }
    return {
      toccate: p.soggettoId ? 1 : 0,
      riepilogo:
        `Ho scritto la sostituzione per ${p.soggettoNome ?? 'la cliente'}, già validata. ` +
        'Per farla valere per tutte c’è «promuovi a regola» nella tabella delle sostituzioni: ' +
        'il gruppo nasce comunque in bozza, e quello è il posto dove si è sempre fatto.',
    };
  }

  return { toccate: 0, riepilogo: 'Approvata. Nessun effetto automatico per questo tipo di azione.' };
}

async function applicaRestrizione(prisma: PrismaService, p: Proposta, termini: string[]): Promise<EsitoApplicazione> {
  const puliti = termini.map((t) => (t ?? '').trim()).filter(Boolean);
  if (!puliti.length) return { toccate: 0, riepilogo: 'Non c’era nessun alimento da vietare: non ho scritto niente.' };

  // ⚠️ Il perimetro è quello di CHI HA PROPOSTO, non di chi approva.
  const perimetro = await perimetroClienti(prisma, p.nutrizionistaId);
  const profili = (await prisma.clientProfile.findMany({
    where: (perimetro ? { [perimetro.field]: { in: perimetro.staffIds } } : {}) as never,
    select: { userId: true, dislikedFoods: true },
  })) as { userId: string; dislikedFoods: string[] }[];

  if (profili.length > MAX_CLIENTI_IN_UNA_VOLTA) {
    return {
      toccate: 0,
      riepilogo:
        `Questa regola toccherebbe ${profili.length} clienti in una volta, che è oltre il tetto di ` +
        `${MAX_CLIENTI_IN_UNA_VOLTA}. Non ho scritto niente: una modifica di questa portata va fatta ` +
        'sapendo esattamente su chi ricade.',
    };
  }

  let toccate = 0;
  for (const profilo of profili) {
    const attuali = profilo.dislikedFoods ?? [];
    const nuovi = puliti.filter((t) => !attuali.some((a) => combaciaAlimento(a, t)));
    if (!nuovi.length) continue; // già a posto: non si tocca, e non si conta
    await prisma.clientProfile.update({
      where: { userId: profilo.userId },
      data: { dislikedFoods: [...attuali, ...nuovi] } as never,
    });
    toccate += 1;
  }

  return {
    toccate,
    riepilogo:
      toccate === 0
        ? `Erano già tutte a posto: nessuna delle ${profili.length} clienti aveva bisogno della modifica.`
        : `Applicata a ${toccate} client${toccate === 1 ? 'e' : 'i'} su ${profili.length}: ` +
          `da adesso non vedranno più ${puliti.join(', ')}.`,
  };
}

/**
 * L'ordine con cui la coda si sottopone: **per rischio, non per data**.
 *
 * Una coda cronologica fa arrivare per ultima la cosa più importante, e chi la guarda di fretta
 * legge le prime tre. Quindi: prima le regole confermate sopra un vincolo sanitario (poche, e ognuna
 * va letta), poi quelle a raggio largo, poi il resto — e a parità, la più vecchia, che è quella che
 * sta aspettando da più tempo.
 */
export function ordinaPerRischio<T extends { conflittoSanitario: boolean; ambito: string; createdAt: Date }>(righe: T[]): T[] {
  const peso = (r: T) => (r.conflittoSanitario ? 0 : r.ambito === 'catalogo' ? 1 : 2);
  return righe.slice().sort((a, b) => peso(a) - peso(b) || a.createdAt.getTime() - b.createdAt.getTime());
}
