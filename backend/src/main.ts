import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // bodyParser disattivato e ri-registrato con limiti espliciti (upload contabili/documenti
  // in base64 fino a ~5MB) mantenendo rawBody per la firma dei webhook Stripe.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });

  // Dietro il proxy di Render: senza questo req.ip è l'IP interno del load
  // balancer (diverso a ogni richiesta) → il rate limiter non accumula mai
  // e l'audit log registra IP interni. Un solo hop fidato = niente spoofing.
  app.set('trust proxy', 1);

  // Hardening OWASP: security header di base (l'API non serve HTML).
  app.use(helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // scarta i campi non dichiarati nei DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Metabole backend in ascolto sulla porta ${port}`);
}

void bootstrap();
