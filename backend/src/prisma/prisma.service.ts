import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tracciaDietFamily } from './traccia-diet-family';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
    // Diagnostica temporanea: chi riscrive `dietFamily`. Vedi `traccia-diet-family.ts`.
    tracciaDietFamily(this as unknown as Record<string, unknown>);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
