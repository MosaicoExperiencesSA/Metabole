import { Module } from '@nestjs/common';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentRunnerService } from './agent-runner.service';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

/** Registro + runtime Agenti AI: CRUD, esecuzione con costi/budget, orchestratore (coda + cron) e Giudice in pipeline. */
@Module({
  controllers: [AgentsController],
  providers: [AgentsService, AgentRunnerService, AgentOrchestratorService],
  exports: [AgentsService, AgentRunnerService, AgentOrchestratorService],
})
export class AgentsModule {}
