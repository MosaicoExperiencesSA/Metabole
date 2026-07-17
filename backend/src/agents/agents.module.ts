import { Module } from '@nestjs/common';
import { AgentRunnerService } from './agent-runner.service';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

/** Registro + runtime Agenti AI: CRUD, esecuzione con costi/budget. L'orchestratore (code/cron) arriverà qui. */
@Module({
  controllers: [AgentsController],
  providers: [AgentsService, AgentRunnerService],
  exports: [AgentsService, AgentRunnerService],
})
export class AgentsModule {}
