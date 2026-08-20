import { apriSegnalazione, PrismaPerSegnalazione } from '../escalations/apri-segnalazione';
import { aGiorno } from '../common/date-only';

/**
 * SENZA GLUTINE: riconoscere la dichiarazione e assegnare la variante giusta.
 *
 * Richiesta di Simone del 9/8: «se mettono allergia al glutine, o intolleranza, o gluten free,
 * avvisa il cliente e assegna in automatico questa dieta» — e, per chi è già iscritto, «mandiamo
 * notifica e cambiamo».
 *
 * ## Perché è una funzione con Prisma passato e non un servizio
 *
 * Serve in quattro punti che non si assomigliano: il questionario (`onboarding`), la scheda cliente
 * (`clients`, quando la coach aggiunge l'intolleranza), il profilo in app, e uno script di
 * migrazione per chi è già iscritto. Un servizio Nest non si può importare in uno script `prisma/`,
 * e la stessa decisione scritta in due posti diventa due decisioni diverse entro un mese. Stessa
 * strada di `apri-segnalazione.ts`, per gli stessi motivi.
 *
 * ## La regola che conta: non si promette una dieta che non c'è
 *
 * L'assegnazione consiste nello scrivere `dietFamily`/`dietStyle` sul profilo, e da lì il motore
 * abbina la variante (`catalog/pick-diet.ts`). Ma `pickDietFor` ha una catena di ripieghi: se la
 * variante senza glutine **non esiste o non è approvata**, scende ai tentativi più larghi e finisce
 * su una dieta col glutine dentro — senza errori, senza avvisi. Sarebbe il modo peggiore di
 * fallire: una cliente celiaca convinta di avere un piano senza glutine.
 *
 * Quindi: si assegna **solo se la variante approvata esiste**; se non esiste non si scrive niente,
 * non si dice niente alla cliente e si avvisa chi può rimediare. Il glutine resta comunque escluso
 * dai menu (`exclusions.ts`), che è la rete di sicurezza vera; la variante dedicata serve a dare un
 * menu **pensato** senza glutine invece di uno a cui è stato tolto tutto.
 */

/** Etichetta della famiglia di dieta: deve combaciare con `engine-rules.presets.ts`. */
export const DIETA_SENZA_GLUTINE = 'Mediterranea senza glutine';

/**
 * Stile della variante — **solo come ripiego**, se il catalogo non lo dice.
 *
 * ⚠️ §16.10 (12/8): prima era un filtro. La variante si cercava con `style: 'mediterranean'`
 * scritto qui dentro, e se in catalogo quella dieta avesse avuto un altro stile — un nutrizionista
 * la crea «flexible», o la rinomina — la ricerca non l'avrebbe trovata: alla cliente celiaca
 * sarebbe arrivato `variante_mancante` invece della sua dieta, per una stringa che non combacia.
 * Su una celiaca questo non è un dettaglio di catalogo.
 *
 * Ora la variante si cerca **per nome** — che è il prodotto — e lo stile si **legge da lei**. La
 * costante resta come ultimo ripiego per non scrivere `null` su un campo che `pickDietFor` usa
 * insieme al nome.
 */
export const STILE_SENZA_GLUTINE = 'mediterranean';

/**
 * Come la cliente può aver dichiarato la cosa. Coprire le forme vere è il punto: il questionario
 * salva `gluten`, gli import portano l'italiano, e nel campo libero «altro» la gente scrive quello
 * che vuole — «gluten free», «celiaca», «no glutine». Una forma non riconosciuta qui è una cliente
 * che non riceve niente, e non se ne accorge nessuno.
 *
 * ⚠️ Volutamente NON contiene i singoli cereali (frumento, farro, orzo, segale…). La prima versione
 * li aveva, ed era un errore che si vedeva solo pensando a una cliente vera: «farro» fra i cibi non
 * graditi vuol dire «non mi piace il farro», non «sono celiaca». Cambiarle la dieta per quello
 * sarebbe una decisione presa al posto suo su un dato che dice un'altra cosa. Per la stessa ragione
 * «grano saraceno» — che di glutine non ne ha — non deve far scattare niente.
 */
const DICHIARAZIONI = /glutin|gluten|celiac/i;

/**
 * Vero se fra i termini dichiarati (allergie, intolleranze, cibi non graditi, testo libero) c'è
 * qualcosa che significa «senza glutine».
 *
 * Si guardano anche i **cibi non graditi**, ma solo per la parola «glutine» (vedi sopra): chi scrive
 * «niente glutine» lì sta dichiarando la stessa cosa con parole sue, e ignorarlo sarebbe una
 * distinzione che esiste solo nel nostro database.
 */
export function dichiaraSenzaGlutine(termini: (string | null | undefined)[]): boolean {
  return termini.some((t) => !!t && DICHIARAZIONI.test(String(t)));
}

/**
 * Vero se la dichiarazione è di tipo **clinico** (allergia o celiachia) e non una preferenza.
 * Cambia il destinatario dell'avviso: la celiachia la guarda la nutrizionista, non la coach.
 */
export function eClinico(termini: (string | null | undefined)[]): boolean {
  return termini.some((t) => !!t && /celiac|allerg/i.test(String(t)));
}

// ---------- Testi ----------

/**
 * Il messaggio alla cliente. Dice tre cose e nessuna di più: che l'abbiamo letto, che cosa cambia
 * nei suoi menu, e chi controlla. In particolare **non** dice «certificato senza glutine»: noi
 * escludiamo gli ingredienti, non garantiamo la filiera, e scriverlo sarebbe una promessa che non
 * possiamo mantenere (vedi le note del preset).
 */
export const TITOLO_AVVISO = 'Il tuo piano è senza glutine';

export function corpoAvviso(nome?: string | null): string {
  const n = (nome ?? '').trim().split(' ')[0];
  const apertura = n ? `${n}, ` : '';
  return (
    `${apertura}abbiamo letto quello che hai indicato sul glutine: da adesso i tuoi menu sono costruiti ` +
    'su una **Mediterranea senza glutine** — al posto di pane e pasta di frumento trovi riso, mais, ' +
    'grano saraceno, quinoa, patate e legumi.\n\n' +
    'Una cosa importante, detta chiara: noi scegliamo gli **ingredienti** senza glutine, ma non ' +
    'possiamo garantire l\'assenza di contaminazione nei prodotti che compri o in cucina. Se sei ' +
    'celiaca usa prodotti certificati e parlane con la tua nutrizionista: la trovi in chat. 💚'
  );
}

/** Nota per lo staff quando la variante manca: è il caso in cui NON si dice niente alla cliente. */
export function motivoSegnalazioneVarianteMancante(nome: string | null): string {
  return (
    `Glutine dichiarato da ${nome ?? 'una cliente'} ma la variante «${DIETA_SENZA_GLUTINE}» non è ` +
    'disponibile in catalogo (assente o non approvata) per il suo regime e numero di pasti. ' +
    'Il glutine resta escluso dai menu, ma il piano NON è quello pensato senza glutine: serve ' +
    'generare e approvare la variante, oppure adattare il piano a mano. ' +
    'Alla cliente non è stato promesso niente.'
  );
}

/** Nota per lo staff quando la dieta è stata cambiata a percorso avviato. */
export function motivoSegnalazioneMenuDaRifare(nome: string | null, giorniFuturi: number): string {
  return (
    `${nome ?? 'Una cliente'} ha dichiarato il glutine e il piano è passato a «${DIETA_SENZA_GLUTINE}». ` +
    `Ha ${giorniFuturi} giornate già erogate da oggi in avanti, costruite sulla dieta precedente: ` +
    'vanno rigenerate dalla scheda cliente («Rigenera menu»), altrimenti nei prossimi giorni ' +
    'continuerebbe a vedere piatti con glutine.'
  );
}

// ---------- Assegnazione ----------

/** Il minimo del client Prisma che serve: così si può provare con un oggetto finto. */
export interface PrismaPerSenzaGlutine {
  clientProfile: {
    findUnique(args: unknown): Promise<{
      name: string | null;
      regime: string | null;
      dietStyle: string | null;
      dietFamily: string | null;
      mealsPerDay: number | null;
      objective: string | null;
      allergies: string[];
      intolerances: string[];
      dislikedFoods: string[];
    } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  diet: {
    findFirst(args: unknown): Promise<{ id: string; name: string } | null>;
  };
  menuDay: {
    count(args: unknown): Promise<number>;
  };
  notification: {
    create(args: unknown): Promise<unknown>;
  };
}

export type EsitoSenzaGlutine =
  /** Non ha dichiarato niente sul glutine: nessuna azione. */
  | { esito: 'non_serve' }
  /** Aveva già questa dieta: nessuna azione, nessun messaggio ripetuto. */
  | { esito: 'gia_assegnata' }
  /** Assegnata: la cliente è stata avvisata. `giorniDaRifare` > 0 = menu futuri da rigenerare. */
  | { esito: 'assegnata'; dietId: string; giorniDaRifare: number }
  /** La variante non è in catalogo: non si scrive niente e non si promette niente. */
  | { esito: 'variante_mancante'; motivo: string };

/**
 * Assegna la variante senza glutine a chi l'ha dichiarato, e **avvisa la cliente**.
 *
 * L'ordine dei controlli è quello che evita le due figure peggiori: prima si guarda se serve, poi
 * **se la variante esiste davvero**, e solo dopo si scrive sul profilo e si manda il messaggio. Un
 * messaggio mandato prima di aver verificato il catalogo sarebbe una promessa scoperta.
 *
 * Non tocca i menu già erogati: li conta e lo dice al chiamante (`giorniDaRifare`), perché
 * rigenerarli è mestiere di `MenuService` — qui non è raggiungibile, e prendersi quel compito
 * chiuderebbe un anello fra i moduli. Chi chiama decide se aprire una segnalazione.
 */
export async function assegnaSenzaGlutine(
  prisma: PrismaPerSenzaGlutine,
  clientId: string,
  opzioni?: { /** Non scrivere la notifica (script di migrazione in prova). */ senzaAvviso?: boolean },
): Promise<EsitoSenzaGlutine> {
  const profilo = await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: {
      name: true, regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
      objective: true, allergies: true, intolerances: true, dislikedFoods: true,
    },
  });
  if (!profilo) return { esito: 'non_serve' };

  const dichiarazioni = [
    ...(profilo.allergies ?? []),
    ...(profilo.intolerances ?? []),
    ...(profilo.dislikedFoods ?? []),
  ];
  if (!dichiaraSenzaGlutine(dichiarazioni)) return { esito: 'non_serve' };
  if (profilo.dietFamily === DIETA_SENZA_GLUTINE) return { esito: 'gia_assegnata' };

  // LA VARIANTE ESISTE? Si cerca approvata e con la struttura pasti della cliente. Il numero di
  // pasti fa parte della ricerca perché è quello che il motore userà: trovare la variante a 5 pasti
  // e assegnarla a chi ne fa 3 sposterebbe il problema di un passo.
  const variante = await prisma.diet.findFirst({
    where: {
      name: DIETA_SENZA_GLUTINE,
      status: 'approved',
      ...(profilo.regime ? { regime: profilo.regime } : {}),
      ...(profilo.mealsPerDay ? { mealsPerDay: profilo.mealsPerDay, fasting: false } : {}),
    },
    // ⚠️ Lo `style` si LEGGE, non si impone: vedi il commento su `STILE_SENZA_GLUTINE`.
    select: { id: true, name: true, style: true },
  });
  if (!variante) {
    return { esito: 'variante_mancante', motivo: motivoSegnalazioneVarianteMancante(profilo.name) };
  }

  // Da qui in avanti si scrive. `updateMany` e non `update`: se il profilo non esistesse più non
  // deve esplodere una richiesta che per la cliente era «ho salvato il questionario».
  // Lo stile è quello della variante trovata: `pickDietFor` lo usa insieme al nome, e scriverne uno
  // diverso da quello a catalogo vorrebbe dire una famiglia che non aggancia più la sua dieta.
  const stile = (variante as { style?: string | null }).style || STILE_SENZA_GLUTINE;
  await prisma.clientProfile.updateMany({
    where: { userId: clientId },
    data: { dietFamily: DIETA_SENZA_GLUTINE, dietStyle: stile },
  });

  // Le giornate già erogate da oggi in avanti sono costruite sulla dieta di prima: contarle è
  // l'unico modo per sapere se serve una rigenerazione. Zero = cliente nuova, niente da rifare.
  // Il giorno di Roma: con la mezzanotte UTC, all'una di notte questo conto partiva da ieri e
  // includeva la giornata di oggi — già erogata, già letta, magari già comprata al supermercato.
  const oggi = aGiorno(new Date());
  const giorniDaRifare = await prisma.menuDay.count({
    where: { clientId, date: { gte: oggi } },
  });

  if (!opzioni?.senzaAvviso) {
    // Titolo e corpo vivono nel `payload`: la tabella `notification` non ha quelle colonne, e
    // scriverle come campi (com'era la mia prima versione) fa esplodere Prisma a runtime.
    // Stessa forma usata da `NotificationsService`, così l'app la mostra come tutte le altre.
    await prisma.notification.create({
      data: {
        userId: clientId,
        type: 'diet_gluten_free',
        channel: 'inapp',
        payload: {
          title: TITOLO_AVVISO,
          body: corpoAvviso(profilo.name),
          kind: 'diet_changed',
          dietFamily: DIETA_SENZA_GLUTINE,
        },
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });
  }

  return { esito: 'assegnata', dietId: variante.id, giorniDaRifare };
}

/**
 * Il giro completo, quello che chiamano onboarding e scheda cliente: assegna, avvisa la cliente e —
 * quando serve — apre la segnalazione allo staff.
 *
 * Le due segnalazioni non sono un dettaglio, sono la differenza fra un'automazione e una promessa:
 *  - **variante mancante** → nessuno ha detto niente alla cliente, ma qualcuno deve saperlo, o il
 *    caso resta sospeso per sempre;
 *  - **menu futuri già erogati** → la dieta è cambiata ma quelle giornate hanno ancora il glutine
 *    dentro, e vanno rigenerate a mano dalla scheda. Senza questa riga, la cliente riceve il
 *    messaggio «il tuo piano è senza glutine» e nei tre giorni successivi mangia pasta di grano.
 *
 * Categoria `clinical`: va alla nutrizionista, che è chi decide su glutine e celiachia. E se la
 * nutrizionista non è assegnata, `apriSegnalazione` la gira al capo nutrizionista — è il buco che
 * quella funzione nasce per chiudere.
 */
export async function assegnaSenzaGlutineEAvvisa(
  prisma: PrismaPerSenzaGlutine & PrismaPerSegnalazione,
  clientId: string,
  opzioni?: { senzaAvviso?: boolean },
): Promise<EsitoSenzaGlutine> {
  const esito = await assegnaSenzaGlutine(prisma, clientId, opzioni);
  if (esito.esito === 'variante_mancante') {
    await apriSegnalazione(prisma, {
      clientId,
      category: 'clinical',
      reason: esito.motivo,
      source: 'screening',
    });
  }
  if (esito.esito === 'assegnata' && esito.giorniDaRifare > 0) {
    const profilo = await prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: {
        name: true, regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
        objective: true, allergies: true, intolerances: true, dislikedFoods: true,
      },
    });
    await apriSegnalazione(prisma, {
      clientId,
      category: 'clinical',
      reason: motivoSegnalazioneMenuDaRifare(profilo?.name ?? null, esito.giorniDaRifare),
      source: 'screening',
    });
  }
  return esito;
}
