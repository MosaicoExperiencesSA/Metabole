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

  // Dietro il proxy di Render ci sono PIÙ salti interni: con un solo hop
  // fidato req.ip restava un IP interno variabile e il rate limiter non
  // accumulava mai (verificato in produzione con gli header X-RateLimit).
  // Render normalizza X-Forwarded-For al suo edge, quindi fidarsi dell'intera
  // catena è la configurazione raccomandata: req.ip = vero IP della cliente
  // (vale per il throttler e per gli IP nell'audit log).
  app.set('trust proxy', true);

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
