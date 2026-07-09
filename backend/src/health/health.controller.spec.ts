import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  async function build(prismaMock: Partial<PrismaService>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('riporta ok/up quando il database risponde', async () => {
    const controller = await build({
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService);

    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.timestamp).toBeDefined();
  });

  it('riporta degraded/down quando il database non risponde', async () => {
    const controller = await build({
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as PrismaService);

    const result = await controller.check();
    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
  });
});
