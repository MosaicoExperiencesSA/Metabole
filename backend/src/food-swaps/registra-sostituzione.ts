import { Logger } from '@nestjs/common';
import { chiaveAlimento } from '../common/nomi-alimento';
import { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('RegistraSostituzione');

export interface SostituzioneDaRegistrare {
  clientId: string;
  /** ingrediente (un alimento dentro un piatto) | piatto (tutto il piatto cambiato) */
  tipo: 'ingrediente' | 'piatto';
  from: string;
  to: string;
  recipeId?: string | null;
  dishName?: string | null;
  mealSlot?: string | null;
  fromQty?: number | null;
  toQty?: number | null;
  unit?: string | null;
  /** La CHIAVE del motivo (gusto, scorta, …), non l'etichetta: le etichette cambiano. */
  motivo?: string | null;
  dietId?: string | null;
  /**
   * chat (concordata con Gaia) · app (pulsante «sostituisci» nel menu) · manuale (scritta a mano
   * dal nutrizionista) · nutrizionista (letta da una sua frase in chat — vedi
   * `impara-dal-nutrizionista.ts`; è l'unica in cui a poter aver sbagliato è il programma e non
   * la persona).
   */
  origine?: 'chat' | 'app' | 'manuale' | 'nutrizionista';
  stato?: string;
  nota?: string | null;
  creataDaId?: string | null;
}

/**
 * La chiave che rende una richiesta ripetuta la STESSA riga: cliente, piatto, e le due radici.
 *
 * `chiaveAlimento` toglie plurali e maiuscole, quindi «Carote» oggi e «carota» il mese prossimo
 * non aprono due righe. Il piatto entra nella chiave di proposito: «togliere le carote dal
 * minestrone» e «togliere le carote dall'insalata» sono due richieste diverse, ed è precisamente
 * il CONTESTO che questa tabella esiste per tenere — se le accorpassimo avremmo riscritto, peggio,
 * un gruppo di equivalenza.
 */
export function chiaveSostituzione(input: {
  clientId: string;
  recipeId?: string | null;
  from: string;
  to: string;
}): string {
  return [input.clientId, input.recipeId ?? '-', chiaveAlimento(input.from), chiaveAlimento(input.to)].join('|');
}

/**
 * Scrive (o ricconta) una sostituzione nella tabella §16.9.
 *
 * ⚠️ **Non lancia mai.** Viene chiamata subito dopo che il cambio è stato scritto sul menu della
 * cliente, e quel cambio è già cosa fatta: se questa scrittura fallisce, la cliente deve comunque
 * vedere la risposta di Gaia e trovare il piatto giusto domani mattina. La memoria è utile, il
 * pasto è necessario — e non sono la stessa cosa. Il fallimento finisce nei log, dove qualcuno lo
 * vede, e non addosso a chi stava solo chiedendo di togliere le carote.
 *
 * Ritorna la riga scritta, o `null` se non è stato possibile (o se mancano i due nomi, senza i
 * quali la riga non direbbe niente).
 */
export async function registraSostituzione(
  prisma: PrismaService,
  dati: SostituzioneDaRegistrare,
): Promise<{ id: string; volte: number } | null> {
  const from = (dati.from ?? '').trim();
  const to = (dati.to ?? '').trim();
  if (!dati.clientId || !from || !to) return null;

  try {
    const chiave = chiaveSostituzione({ clientId: dati.clientId, recipeId: dati.recipeId, from, to });
    const adesso = new Date();
    const riga = await prisma.foodSwap.upsert({
      where: { chiave },
      create: {
        chiave,
        clientId: dati.clientId,
        recipeId: dati.recipeId ?? null,
        dishName: dati.dishName ?? null,
        mealSlot: dati.mealSlot ?? null,
        tipo: dati.tipo,
        fromFood: from,
        toFood: to,
        fromKey: chiaveAlimento(from),
        toKey: chiaveAlimento(to),
        fromQty: dati.fromQty ?? null,
        toQty: dati.toQty ?? null,
        unit: dati.unit ?? null,
        motivo: dati.motivo ?? null,
        dietId: dati.dietId ?? null,
        origine: dati.origine ?? 'chat',
        stato: dati.stato ?? 'da_verificare',
        nota: dati.nota ?? null,
        creataDaId: dati.creataDaId ?? null,
        primaVoltaIl: adesso,
        ultimaVoltaIl: adesso,
      },
      update: {
        volte: { increment: 1 },
        ultimaVoltaIl: adesso,
        // Le quantità e il nome del piatto si aggiornano all'ultima volta: sono il «com'era
        // adesso», e la porzione può essere cambiata. Lo STATO no: se la nutrizionista aveva già
        // validato questa richiesta, ripeterla non la rimette in coda — sarebbe un lavoro che si
        // riapre da solo ogni volta che la cliente riconferma quello che le è già stato concesso.
        ...(dati.fromQty !== undefined && dati.fromQty !== null ? { fromQty: dati.fromQty } : {}),
        ...(dati.toQty !== undefined && dati.toQty !== null ? { toQty: dati.toQty } : {}),
        ...(dati.dishName ? { dishName: dati.dishName } : {}),
        ...(dati.dietId ? { dietId: dati.dietId } : {}),
      },
      select: { id: true, volte: true },
    });
    return riga as { id: string; volte: number };
  } catch (err) {
    logger.warn(
      `Sostituzione non registrata (cliente=${dati.clientId} ${dati.from}→${dati.to}): ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
