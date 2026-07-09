import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UsersService } from './users.service';

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** Dati essenziali dell'utente autenticato (il profilo cliente completo arriva con la milestone 2). */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.getById(user.sub);
  }
}
