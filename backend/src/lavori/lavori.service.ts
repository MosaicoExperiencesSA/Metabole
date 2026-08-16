import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatiLavoro, datiRisposta, datiSpunta, normalizzaLavoro, ordinaLavori, testoPerClaude } from './lavoro';
import { VOCI_INIZIALI } from './voci-iniziali';

/**
 * L'ELENCO DEI LAVORI — «cosa manca», in un posto solo.
 *
 * Richiesta di Simone (13/8). ⚠️ Non è un doppione di `progetto/REGISTRO.md`: quello racconta **cosa
 * è stato scritto**, per sempre e riga per riga; questo risponde a **cosa manca**, e la spunta ci
 * aggiunge quando è stato chiuso e da chi.
 */

@Injectable()
export class LavoriService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * L'elenco intero, in un colpo solo: sono decine di righe, non migliaia, e paginarle vorrebbe dire
   * nascondere metà di quello che manca dietro un pulsante «avanti».
   *
   * ⚠️ **Da fare in cima, fatte in fondo.** Le fatte non spariscono — è la parte «così è tutto
   * registrato» della richiesta — ma non devono nemmeno stare in mezzo, o l'elenco smette di
   * rispondere a «cosa resta» a colpo d'occhio. Fra le fatte, le ultime chiuse per prime.
   */
  async elenco() {
    const righe = await this.prisma.lavoro.findMany({
      orderBy: [{ fatto: 'asc' }, { categoria: 'asc' }, { ordine: 'asc' }, { createdAt: 'asc' }],
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
    const daFare = righe.filter((r) => !r.fatto).length;
    return {
      righe: ordinaLavori(righe),
      totale: righe.length,
      daFare,
      fatte: righe.length - daFare,
    };
  }

  async crea(dati: DatiLavoro) {
    const campi = normalizzaLavoro(dati, true);
    return this.prisma.lavoro.create({
      data: campi as { titolo: string },
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  async aggiorna(id: string, dati: DatiLavoro) {
    const campi = normalizzaLavoro(dati, false);
    await this.esiste(id);
    return this.prisma.lavoro.update({
      where: { id },
      data: campi,
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  /**
   * La risposta: quello che si è saputo su questa voce.
   *
   * ⚠️ Non spunta niente. «L'ho saputo» e «l'ho fatto» sono due stati diversi: farli coincidere
   * toglierebbe dall'elenco proprio le voci che hanno appena ricevuto quello che serviva per
   * lavorarci.
   */
  async rispondi(id: string, testo: unknown, actorUserId: string) {
    await this.esiste(id);
    const staff = await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } });
    return this.prisma.lavoro.update({
      where: { id },
      data: datiRisposta(testo, staff?.id, new Date()),
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  /** Il testo del pulsante «Copia per Claude»: solo le voci aperte, con le risposte date. */
  async testo() {
    const righe = await this.prisma.lavoro.findMany({
      orderBy: [{ fatto: 'asc' }, { categoria: 'asc' }, { ordine: 'asc' }, { createdAt: 'asc' }],
      include: { rispostaDa: { select: { displayName: true } } },
    });
    return { testo: testoPerClaude(righe) };
  }

  /**
   * IL CARICAMENTO DALLA PAGINA — «Carica le voci nuove».
   *
   * Fa quello che faceva solo la shell, con le stesse due regole:
   *
   * ⚠️ **Prima si guarda, poi si scrive.** `conferma: false` (il primo clic) non tocca niente e
   * dice cosa aggiungerebbe. Sulla shell quella sicurezza ce l'ha `CONFERMA=1`; un pulsante che
   * scrive al primo clic la butterebbe via proprio dove è più facile premere per sbaglio.
   *
   * ⚠️ **Non aggiorna mai quello che trova.** Una voce già in elenco può essere stata spuntata o
   * riscritta a mano: «riallinearla» la riporterebbe indietro senza dirlo. È la lezione di
   * `accendi-automazioni.ts`, che pensato per accenderne tre ne ha spente venti.
   *
   * ⚠️ Lo storico (le 481 righe dal REGISTRO) NON passa da qui: sta in un file accanto allo script,
   * che in `dist/` non c'è. Resta un lavoro da shell, ed è già stato fatto una volta sola.
   */
  async caricaVociIniziali(conferma: boolean) {
    const chiavi = VOCI_INIZIALI.map((v) => v.chiave);
    const righe = (await this.prisma.lavoro.findMany({
      where: { chiave: { in: chiavi } },
      select: { id: true, chiave: true, fatto: true },
    })) as { id: string; chiave: string | null; fatto: boolean }[];
    const perChiave = new Map(righe.map((r) => [r.chiave, r]));

    const mancanti = VOCI_INIZIALI.filter((v) => !perChiave.has(v.chiave));
    /**
     * L'AGGIORNAMENTO DELLO STATO (richiesta di Simone, 13/8 sera): il file può CHIUDERE una voce
     * ancora aperta in pagina — è la notizia «questa consegna l'ha finita» — ma MAI riaprirne una
     * spuntata: la pagina resta lo stato vivo, e una spunta messa a mano non si discute da un file.
     */
    /**
     * ⚠️ Si tiene la VOCE accanto alla riga, non solo la riga. Il chiamante deve poter dire **cosa**
     * spunterebbe con le parole che si leggono in pagina: una lista di chiavi (`vera-menu-dettati`)
     * non è una cosa su cui si preme «Conferma» a cuor leggero.
     */
    const daSpuntare: { voce: (typeof VOCI_INIZIALI)[number]; riga: { id: string; chiave: string | null; fatto: boolean } }[] = [];
    for (const v of VOCI_INIZIALI) {
      if (v.fatta !== true) continue;
      const riga = perChiave.get(v.chiave);
      if (riga && !riga.fatto) daSpuntare.push({ voce: v, riga });
    }

    if (conferma) {
      for (const v of mancanti) {
        // `fatta` è un campo del FILE, non una colonna: si traduce nella spunta e non si scrive.
        const { fatta, ...campi } = v;
        await this.prisma.lavoro.create({
          data: fatta ? { ...campi, ...datiSpunta(true, null, new Date()) } : campi,
        });
      }
      for (const { riga } of daSpuntare) {
        await this.prisma.lavoro.update({ where: { id: riga.id }, data: datiSpunta(true, null, new Date()) });
      }
    }
    return {
      scritto: conferma,
      aggiunte: mancanti.length,
      spuntate: daSpuntare.length,
      saltate: VOCI_INIZIALI.length - mancanti.length - daSpuntare.length,
      titoli: mancanti.map((v) => ({ titolo: v.titolo, categoria: v.categoria })),
      // Titoli e non chiavi: è quello che la pagina mostra prima di far premere «Conferma».
      chiuse: daSpuntare.map(({ voce }) => ({ titolo: voce.titolo, categoria: voce.categoria })),
    };
  }

  /**
   * La spunta.
   *
   * ⚠️ **Togliendola si azzerano anche chi e quando.** Una voce riaperta che continua a dire «fatta
   * da Simone il 13 agosto» è una riga che fa perdere fiducia in tutta la lista — e una lista di cui
   * non ci si fida non si guarda più, che è l'unico modo in cui questa pagina può fallire.
   */
  async segna(id: string, fatto: boolean, actorUserId: string) {
    await this.esiste(id);
    const staff = fatto
      ? await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })
      : null;
    return this.prisma.lavoro.update({
      where: { id },
      data: datiSpunta(fatto, staff?.id, new Date()),
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  /**
   * Si cancella solo quello che è stato scritto per sbaglio. ⚠️ Chiudere un lavoro è **spuntarlo**,
   * non cancellarlo: se il modo di togliere una riga dall'elenco fosse `Elimina`, dopo un mese la
   * pagina non saprebbe più dire cosa è stato fatto — cioè metà del motivo per cui esiste.
   */
  async elimina(id: string) {
    await this.esiste(id);
    await this.prisma.lavoro.delete({ where: { id } });
    return { ok: true };
  }

  private async esiste(id: string) {
    const r = await this.prisma.lavoro.findUnique({ where: { id }, select: { id: true } });
    if (!r) throw new NotFoundException('Questa voce non esiste più: qualcuno l\'ha eliminata.');
    return r;
  }
}
