import { Module } from '@nestjs/common';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
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
  controllers: [VeraController],
  providers: [PoolDisponibileService, DizionarioService, RegistroVeraService],
  exports: [PoolDisponibileService, DizionarioService, RegistroVeraService],
})
export class VeraModule {}
