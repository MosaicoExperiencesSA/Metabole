import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { ClientsModule } from '../clients/clients.module';
import { EquivalenceModule } from '../equivalence/equivalence.module';
import { EquivalenceService } from '../equivalence/equivalence.service';
import { FoodSwapsModule } from '../food-swaps/food-swaps.module';
import { FoodSwapsService } from '../food-swaps/food-swaps.service';
import { NutrientFactsModule } from '../nutrient-facts/nutrient-facts.module';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
import { ClientsService } from '../clients/clients.service';
import { NutritionistModule } from '../nutritionist/nutritionist.module';
import { NutritionistService } from '../nutritionist/nutritionist.service';
import { RichiesteVeraService, SCRITTURA_CLIENTE, SCRITTURA_KCAL } from './richieste.service';
import { SCRITTURA_COMBINAZIONE } from './scrittura-combinazione';
import { SCRITTURA_RICETTA } from './scrittura-ricetta';
import { SCRITTURA_SOSTITUZIONI } from './scrittura-sostituzioni';
import { VeraChatService } from './vera-chat.service';
import { VeraController } from './vera.controller';

/**
 * VERA — le fondamenta. Vedi `Metabole_Specifica_Vera_Agente_Nutrizionista.md`.
 *
 * ⚠️ Nessun `imports`, ed è voluto: `PrismaService`, `AuditService` e `ConfigParamsService` sono
 * globali. Aggiungere qui `MenuModule` per riusare il generatore avrebbe legato la pagina di
 * backoffice al percorso che porta il pasto nel piatto di domani — la stessa ragione per cui la
 * scrittura delle sostituzioni passa da una funzione libera e non da un servizio iniettato.
 *
 * Il pool si calcola da capo leggendo catalogo e profilo: costa una manciata di query in più e in
 * cambio questo modulo non può, per costruzione, far fallire l'erogazione.
 *
 * ⚠️ Se un giorno servisse un import, va aggiunto QUI e non «dove compila»: Nest risolve le
 * dipendenze all'AVVIO, non alla compilazione. Il 12/8 un modulo senza il suo import ha fatto
 * uscire il processo con 1 al primo boot su Render con `tsc` verde e 1794 test verdi. Lo vede solo
 * `app.module.spec.ts`, che compila l'applicazione intera.
 */
@Module({
  /**
   * ⚠️ `ClientsModule` serve per una riga sola, ed è una riga del contratto: le esclusioni di una
   * cliente si scrivono da `ClientsService.updateClient`, che controlla il permesso
   * `change_allergies` e lascia la traccia. Una seconda strada per lo stesso dato sanitario è il
   * difetto che questo campo ha già avuto due volte.
   *
   * Nessun anello: `ClientsModule` importa auth, menu e notifiche, e nessuno di quelli importa Vera.
   * ⚠️ Ma è una cosa che vede solo `app.module.spec.ts`, che compila l'applicazione intera: Nest
   * risolve le dipendenze all'AVVIO, non alla compilazione.
   */
  /**
   * ⚠️ `CatalogModule` per le ricette e `NutrientFactsModule` per i valori: due import, due righe di
   * contratto.
   *
   * Le ricette si scrivono da `CatalogService` (che lascia la traccia in audit) e i valori si
   * leggono da `ValoriNutrizionaliService` — la stessa funzione che decide cosa risponde Gaia
   * quando una cliente chiede le calorie di un alimento. Due idee diverse di «quanto pesa questo
   * cibo» sono due risposte diverse alla stessa domanda, fatta da due persone che parlano fra loro.
   *
   * Nessun anello: `CatalogModule` importa solo le notifiche, `NutrientFactsModule` niente.
   * ⚠️ Ma è una cosa che vede solo `app.module.spec.ts`: Nest risolve le dipendenze all'AVVIO.
   */
  // MailModule: il postino dell'avviso di conflitto (13/8 sera). Esporta MailService.
  /**
   * ⚠️ `FoodSwapsModule` per una riga sola, e anche questa è una riga di contratto (voce 245): i
   * cambi concordati in chat si decidono da `FoodSwapsService.aggiorna`, lo stesso metodo del
   * pulsante in scheda, con lo stesso audit e la stessa validazione dello stato.
   *
   * Nessun anello: `FoodSwapsModule` importa solo `NotificationsModule`, che è già nel grafo
   * (ci arriva da `ClientsModule`), e nessuno dei due importa Vera.
   * ⚠️ Ma è una cosa che vede solo `app.module.spec.ts`: Nest risolve le dipendenze all'AVVIO.
   */
  /**
   * ⚠️ `AiModule` per la SECONDA LETTURA (17/8): quando `capisci` torna null, il modello riscrive la
   * frase nella forma canonica e la si rilegge col riconoscitore deterministico. Il modello traduce,
   * non decide, e non vede nessun dato — vedi `seconda-lettura.ts`.
   *
   * Nessun anello: `AiModule` non importa niente e non conosce Vera.
   * ⚠️ Ma è una cosa che vede solo `app.module.spec.ts`: Nest risolve le dipendenze all'AVVIO, non
   * alla compilazione — il 12/8 un modulo senza il suo import ha fatto uscire il processo con 1 al
   * primo boot su Render, con `tsc` verde e 1794 test verdi.
   */
  /**
   * ⚠️ `EquivalenceModule` per una riga sola, e anche questa è una riga di contratto (18/8): le
   * combinazioni si approvano da `EquivalenceService.approve`, lo stesso metodo del pulsante in
   * Equivalenze, con lo stesso audit e lo stesso bump di versione.
   *
   * Nessun anello: `EquivalenceModule` importa solo `NotificationsModule`, che è già nel grafo, e
   * nessuno dei due conosce Vera.
   * ⚠️ Ma è una cosa che vede solo `app.module.spec.ts`: Nest risolve le dipendenze all'AVVIO.
   */
  imports: [ClientsModule, CatalogModule, NutrientFactsModule, MailModule, NutritionistModule, FoodSwapsModule, AiModule, EquivalenceModule],
  controllers: [VeraController],
  providers: [
    PoolDisponibileService,
    DizionarioService,
    RegistroVeraService,
    VeraChatService,
    RichiesteVeraService,
    /**
     * Il punto unico di scrittura sul profilo di una cliente, legato per token.
     * ⚠️ `useExisting` e non `useClass`: si vuole **la stessa istanza** che usa il resto
     * dell'applicazione, non una seconda con la sua cache e i suoi effetti.
     */
    { provide: SCRITTURA_CLIENTE, useExisting: ClientsService },
    /** Il punto unico di scrittura sul catalogo delle ricette. Stessa istanza, stesso audit. */
    { provide: SCRITTURA_RICETTA, useExisting: CatalogService },
    /** Il punto unico delle calorie scritte a mano: permesso, storico e soglia stanno già lì. */
    { provide: SCRITTURA_KCAL, useExisting: NutritionistService },
    /** Il punto unico dei cambi concordati in chat: la stessa porta del pulsante in scheda. */
    { provide: SCRITTURA_SOSTITUZIONI, useExisting: FoodSwapsService },
    /** Il punto unico dell'approvazione di una combinazione: la stessa porta del pulsante in Equivalenze. */
    { provide: SCRITTURA_COMBINAZIONE, useExisting: EquivalenceService },
  ],
  exports: [PoolDisponibileService, DizionarioService, RegistroVeraService, VeraChatService, RichiesteVeraService],
})
export class VeraModule {}
