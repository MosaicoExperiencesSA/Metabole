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

  // Catena proxy in produzione (misurata via /health/proxy-check):
  //   cliente → Cloudflare → Render → app
  // In X-Forwarded-For il vero IP della cliente è il 2° da destra; l'ultimo è
  // l'edge Cloudflare (che ruota) e un eventuale valore falsificato dal client
  // finisce più a sinistra. Fidarsi di ESATTAMENTE 2 hop (Render + Cloudflare)
  // dà req.ip = IP reale della cliente e rende il rate limiter NON aggirabile
  // con header X-Forwarded-For falsi. Vale anche per gli IP nell'audit log.
  app.set('trust proxy', 2);

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
