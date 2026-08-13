import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
import { ClientsService } from '../clients/clients.service';
import { RichiesteVeraService, SCRITTURA_CLIENTE } from './richieste.service';
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
  imports: [ClientsModule],
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
  ],
  exports: [PoolDisponibileService, DizionarioService, RegistroVeraService, VeraChatService, RichiesteVeraService],
})
export class VeraModule {}
