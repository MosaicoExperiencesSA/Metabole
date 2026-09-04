import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CoachDiRiservaService } from './coach-di-riserva.service';

/**
 * Chi è la coach di riserva, per la tendina «Coach» della scheda cliente: Giusy è `sales`, quindi
 * `/admin/users?role=coach` non la elenca, e senza questa risposta l'unica persona che la regola
 * assegna in automatico sarebbe l'unica che a mano non si può scegliere.
 */
@Controller('admin/coach-di-riserva')
@Roles('admin')
export class CoachDiRiservaController {
  constructor(private readonly riserva: CoachDiRiservaService) {}

  @Get()
  chi() {
    return this.riserva.chi();
  }
}
