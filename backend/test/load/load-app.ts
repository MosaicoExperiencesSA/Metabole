/**
 * Harness per il load test LOCALE (M10): avvia l'app vera (routing, guardie,
 * helmet, validazione, rate limiter) con PrismaService stubbato in memoria —
 * misura lo stack API senza dipendere dal database.
 * Uso: THROTTLE_LIMIT=1000000 npx ts-node -P tsconfig.json --transpile-only test/load/load-app.ts
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

const PLANS = [
  { id: 'p1', name: 'Percorso 3 mesi', priceCents: 29700, period: '3m', features: [], active: true },
  { id: 'p2', name: 'Percorso 6 mesi', priceCents: 49700, period: '6m', features: [], active: true },
  { id: 'p3', name: 'Percorso 12 mesi', priceCents: 79700, period: '12m', features: [], active: true },
];

/** Stub Prisma: ogni modello risponde con valori neutri, plan.findMany con il listino. */
function prismaStub(): unknown {
  const model = (overrides: Record<string, unknown> = {}) =>
    new Proxy(
      {
        findMany: async () => [],
        findFirst: async () => null,
        findUnique: async () => null,
        create: async (args: { data?: unknown }) => ({ id: 'stub', ...(args?.data as object) }),
        update: async () => ({}),
        upsert: async () => ({}),
        count: async () => 0,
        aggregate: async () => ({ _sum: {} }),
        groupBy: async () => [],
        ...overrides,
      },
      { get: (t: Record<string, unknown>, k: string) => t[k] ?? (async () => null) },
    );
  const models: Record<string, unknown> = {
    plan: model({ findMany: async () => PLANS }),
    configParam: model(),
  };
  return new Proxy(
    {
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      $queryRaw: async () => [{ ok: 1 }],
      $transaction: async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    },
    {
      get(target: Record<string, unknown>, key: string) {
        if (key in target) return target[key];
        if (typeof key === 'string' && !key.startsWith('$') && !key.startsWith('_')) {
          models[key] = models[key] ?? model();
          return models[key];
        }
        return undefined;
      },
    },
  );
}

async function main() {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'solo-load-test-locale';
  const builder = await import('@nestjs/testing');
  const moduleRef = await builder.Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaStub())
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, bodyParser: false });
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(3998, '0.0.0.0');
  console.log('Load-test app pronta su :3998 (Prisma stubbato)');
}

void main();
