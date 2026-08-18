import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
    /**
     * ⚠️ Qui c'era `tracciaDietFamily`, la trappola che dall'11/8 registrava **chi** riscrivesse
     * `dietFamily`. Tolta il 19/8, come previsto, perché ha finito il suo lavoro — e la risposta,
     * che è la parte che conta, resta scritta dove serve (`clients.service.updateClient`):
     * **nessuno lo riscriveva**. Le `ops` venivano costruite e mai eseguite, perché mancava il
     * `$transaction`: le operazioni di Prisma sono pigre, e la dieta spostata cinque volte non
     * tornava indietro — non era mai partita.
     *
     * La lezione, che vale più della trappola: quando l'audit racconta una modifica e il database
     * non la conosce, la domanda non è «chi la sovrascrive» ma «quella scrittura viene eseguita?».
     */
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
