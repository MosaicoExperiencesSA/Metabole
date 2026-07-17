import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

/** Registro Agenti AI (fondamenta): CRUD + costi. Il runtime (orchestratore) arriverà qui. */
@Module({
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
