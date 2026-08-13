/**
 * IL MIRROR FINTO DEI BINARI PRISMA — la trovata dell'11/8, in un posto solo.
 *
 * Qui e sul Mac `prisma generate` fallisce con 403 su `binaries.prisma.sh`, e senza generate i tipi
 * di `@prisma/client` restano quelli vecchi. Il rimedio: un mirror locale che risponde a qualunque
 * richiesta di binario con un .gz di byte a caso. La CLI scarica, è contenta, e genera i tipi veri
 * dallo schema vero.
 *
 * ⚠️ Stava dentro `typecheck-reale.mjs`. È qui perché ora serve a DUE comandi, e la stessa trovata
 * scritta due volte è la stessa trovata che un giorno viene corretta in uno solo dei due.
 *
 * ⚠️ Restano in `node_modules/@prisma/engines` due file finti da 1 KB. Non fanno danno finché in
 * locale non si eseguono query o migrazioni vere; `npm ci` rimette tutto a posto.
 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

const FINTO = gzipSync(Buffer.alloc(1024, 7));

/** Avvia il mirror e torna l'ambiente da passare ai comandi, più il modo di spegnerlo. */
export async function avviaMirrorPrisma() {
  const server = createServer((req, res) => {
    // I .sha256 NON si servono di proposito: il 404 fa saltare la verifica del checksum, che è
    // quello che vogliamo (i byte sono finti per costruzione).
    if (req.url?.endsWith('.gz')) {
      res.writeHead(200, { 'content-type': 'application/gzip', 'content-length': FINTO.length });
      res.end(FINTO);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const porta = server.address().port;
  return {
    env: {
      ...process.env,
      PRISMA_ENGINES_MIRROR: `http://127.0.0.1:${porta}`,
      PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
    },
    chiudi: () => server.close(),
  };
}
