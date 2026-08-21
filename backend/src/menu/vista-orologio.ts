/**
 * QUELLO CHE L'APP VEDE DELL'OROLOGIO — una funzione sola, senza database.
 *
 * Compone in un posto solo le tre risposte che l'app deve avere insieme:
 *
 *  - **le si apre la pagina?** (`chiedi-la-finestra.ts`) e con che cosa;
 *  - **com'è messa adesso**: protocollo, apertura, chiusura, e gli orari dei pasti già calcolati;
 *  - **c'è un piano graduale in corso?** e quanti giorni mancano.
 *
 * ⚠️ Sta qui e non nel servizio perché è la parte che si può sbagliare in silenzio — un'ora di
 * chiusura calcolata male, un pasto in più o in meno — e in un servizio che parla con Prisma quelle
 * cose si provano solo montando mezzo mondo. Il servizio legge il profilo e chiama questa.
 *
 * ⛔ **La chiusura non è un dato salvato**: si calcola. Una durata scritta in due posti è una durata
 * che prima o poi diverge, ed è la stessa ragione per cui `fasting_close_min` non esiste in tabella.
 */
import { atterraggioOrologio, type ProfiloPerOrologio } from './chiedi-la-finestra';
import {
  PROTOCOLLI_DIGIUNO,
  chiusuraFinestra,
  derivaDaOrologio,
  etichettaPasto,
  oraDelGiorno,
  protocolloDigiuno,
  type MarginiPasti,
  type SogliaPasti,
} from './orologio-digiuno';
import { passoValido, passoDiStanotte, scartoPiuCorto, PASSO_GRADUALE_PREDEFINITO } from './cambio-finestra';

export interface ProfiloDigiuno extends ProfiloPerOrologio {
  fastingProtocol?: string | null;
  fastingStartMin?: number | null;
  fastingTargetStartMin?: number | null;
  /** ⚠️ Il protocollo rimandato a domani: lo applica il passo notturno, poi torna `null`. */
  fastingTargetProtocol?: string | null;
  fastingChangedAt?: Date | null;
}

export interface PastoInVista {
  slot: string;
  oraMin: number;
  /** L'ora già scritta, `08:15`: così l'app non la riformatta a modo suo. */
  ora: string;
  /**
   * ⚠️ Il nome che legge la cliente — «Primo pasto», non «Pranzo». Con la finestra 08:00-16:00 il
   * motore chiama `lunch` il pasto delle 08:15, e scriverle «Pranzo alle 08:15» sarebbe una frase
   * falsa. Lo slot resta accanto perché serve al motore, non a lei.
   */
  etichetta: string;
}

export interface VistaOrologio {
  digiuna: boolean;
  /** Le si apre la pagina dell'orologio al prossimo avvio? */
  daChiedere: boolean;
  motivo: 'non_digiuna' | 'ha_gia_scelto' | 'mai_chiesta';
  /** Con che cosa si apre la pagina se non ha ancora scelto. Assente = **vuota**. */
  proposta?: { protocollo: string; inizioMin: number; ora: string };
  /** ⚠️ Vero se la sua finestra storica non è riproducibile: da qui nasce la segnalazione (§15). */
  finestraNonTraducibile: boolean;
  /** Com'è messa adesso. Assente finché non ha scelto: **non si inventa un orologio**. */
  attuale?: {
    protocollo: string;
    inizioMin: number;
    apertura: string;
    chiusuraMin: number;
    chiusura: string;
    oreFinestra: number;
    oreDigiuno: number;
    fastingWindow?: string;
    pasti: PastoInVista[];
  };
  /** Il piano graduale in corso, se c'è. */
  piano?: {
    bersaglioInizioMin: number;
    bersaglio: string;
    /** Quante notti mancano al bersaglio. `1` = domani ci arriva. */
    giorniMancanti: number;
  };
  /** I cinque protocolli, per la tendina: l'app non se li riscrive. */
  protocolli: { valore: string; oreFinestra: number; nome: string }[];
}

const CATALOGO_PROTOCOLLI = PROTOCOLLI_DIGIUNO.map((p) => ({
  valore: p.valore,
  oreFinestra: p.oreFinestra,
  nome: p.nome,
}));

/**
 * La vista, composta.
 *
 * ⚠️ **`attuale` manca finché non ha scelto**, e non si riempie con la proposta: la proposta è
 * quello con cui si apre la pagina, `attuale` è quello che il motore sta usando davvero. Fonderli
 * farebbe comparire in home un orologio che nessuno ha impostato — *un dato che agisce e non si
 * vede*, al contrario.
 */
export function vistaOrologio(
  profilo: ProfiloDigiuno,
  passoMin: number = PASSO_GRADUALE_PREDEFINITO,
  soglie?: SogliaPasti[],
  margini?: MarginiPasti,
): VistaOrologio {
  const atterraggio = atterraggioOrologio(profilo);
  const vista: VistaOrologio = {
    digiuna: profilo.pathType === 'intermittent_fasting',
    daChiedere: atterraggio.daChiedere,
    motivo: atterraggio.motivo,
    finestraNonTraducibile: atterraggio.finestraNonTraducibile,
    protocolli: CATALOGO_PROTOCOLLI,
  };
  if (atterraggio.proposta) {
    vista.proposta = { ...atterraggio.proposta, ora: oraDelGiorno(atterraggio.proposta.inizioMin) };
  }

  const p = protocolloDigiuno(profilo.fastingProtocol);
  const inizio = profilo.fastingStartMin;
  // ⚠️ Servono **tutti e due**: un protocollo senza orario (o viceversa) non è mezza finestra, è
  // nessuna finestra. Comporne una con un valore di scorta vorrebbe dire mostrarle in home un
  // orologio che nessuno ha impostato.
  if (p && typeof inizio === 'number') {
    const derivata = derivaDaOrologio(inizio, p.valore, soglie, margini);
    const chiusuraMin = chiusuraFinestra(inizio, p.oreFinestra);
    vista.attuale = {
      protocollo: p.valore,
      inizioMin: inizio,
      apertura: oraDelGiorno(inizio),
      chiusuraMin,
      chiusura: oraDelGiorno(chiusuraMin),
      oreFinestra: p.oreFinestra,
      oreDigiuno: 24 - p.oreFinestra,
      fastingWindow: derivata?.fastingWindow,
      // ⚠️ L'etichetta si CALCOLA qui con la stessa funzione che la definisce, invece di essere un
      // campo del pasto: dipende da quanti pasti ci sono in tutto («Primo», «Ultimo»), e un campo
      // riempito a monte si sarebbe portato dietro il totale sbagliato la prima volta che qualcuno
      // filtra la lista.
      pasti: (derivata?.pasti ?? []).map((pasto, i, tutti) => ({
        slot: pasto.slot,
        oraMin: pasto.oraMin,
        ora: oraDelGiorno(pasto.oraMin),
        etichetta: etichettaPasto(i, tutti.length, pasto.slot),
      })),
    };

    const bersaglio = profilo.fastingTargetStartMin;
    if (typeof bersaglio === 'number' && bersaglio !== inizio) {
      vista.piano = {
        bersaglioInizioMin: bersaglio,
        bersaglio: oraDelGiorno(bersaglio),
        giorniMancanti: giorniAlBersaglio(inizio, bersaglio, passoMin),
      };
    }
  }
  return vista;
}

/**
 * Quante notti mancano.
 *
 * ⚠️ Il conto lo fa **girando `passoDiStanotte`**, non con una divisione: è la stessa funzione che
 * il cron eseguirà, quindi il numero che la cliente legge e quello che succede davvero non possono
 * divergere. Una divisione qui sarebbe una seconda risposta alla stessa domanda.
 */
export function giorniAlBersaglio(
  inizioMin: number,
  bersaglioMin: number,
  passoMin: number = PASSO_GRADUALE_PREDEFINITO,
): number {
  const passo = passoValido(passoMin);
  // Il piano graduale va all'indietro: un bersaglio in avanti si raggiunge in una notte sola.
  if (scartoPiuCorto(inizioMin, bersaglioMin) > 0) return 1;
  let dove = inizioMin;
  for (let notti = 1; notti <= 24 * 60; notti += 1) {
    const passoFatto = passoDiStanotte(dove, bersaglioMin, passo);
    if (!passoFatto) return notti - 1;
    dove = passoFatto.inizioMin;
    if (passoFatto.arrivata) return notti;
  }
  // ⛔ Non ci si arriva mai: non si torna un numero inventato. Chi chiama lo vede e lo dice.
  return 0;
}
