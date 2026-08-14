import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { ClientsModule } from '../clients/clients.module';
import { NutrientFactsModule } from '../nutrient-facts/nutrient-facts.module';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
import { ClientsService } from '../clients/clients.service';
import { NutritionistModule } from '../nutritionist/nutritionist.module';
import { NutritionistService } from '../nutritionist/nutritionist.service';
import { RichiesteVeraService, SCRITTURA_CLIENTE, SCRITTURA_KCAL } from './richieste.service';
import { SCRITTURA_RICETTA } from './scrittura-ricetta';
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
  imports: [ClientsModule, CatalogModule, NutrientFactsModule, MailModule, NutritionistModule],
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
  ],
  exports: [PoolDisponibileService, DizionarioService, RegistroVeraService, VeraChatService, RichiesteVeraService],
})
export class VeraModule {}
