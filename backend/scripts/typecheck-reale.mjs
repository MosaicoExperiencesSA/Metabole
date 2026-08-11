#!/usr/bin/env node
/**
 * TYPE-CHECK CON I TIPI VERI DI PRISMA — cioè lo stesso controllo che fa Render.
 *
 * IL PROBLEMA CHE RISOLVE (11/8). Qui e sul Mac `npx prisma generate` fallisce con 403 sui binari
 * (`binaries.prisma.sh`), quindi `@prisma/client` resta uno **stub**: `findMany` torna un tipo
 * lasco, e `tsc` non può più dire niente sui campi. Da lì la convenzione «42 errori = verde», poi
 * «32 = verde»: un numero di rumore da confrontare a occhio. Ma un numero di rumore non distingue
 * il rumore da un errore VERO — e infatti un errore vero è passato, ha superato 1578 test verdi ed
 * è esploso nel build di produzione:
 *
 *     src/menu/menu.service.ts:463 - error TS2322: Type '{ meals?: unknown; }[]' is not
 *     assignable to type '{ id: string; dayIndex: number; dietId: string; level: number; ... }[]'
 *
 * LA TROVATA. `prisma generate --no-engine` genera i tipi TypeScript **senza** motore di query:
 * per i tipi il motore non serve, serve solo lo schema. La CLI però prova comunque a scaricare i
 * binari prima di partire, e lì prende il 403. Allora le si dà un mirror finto in locale
 * (`PRISMA_ENGINES_MIRROR`) che risponde a qualunque richiesta con un .gz di byte a caso: la CLI
 * scarica, è contenta, e genera i tipi veri dallo schema vero.
 *
 * COSA RESTA IN NODE_MODULES. Due file finti da 1 KB in `node_modules/@prisma/engines`. Non
 * servono a niente e non fanno danno finché **in locale non si eseguono query o migrazioni**: se
 * serve, `npm ci` rimette tutto a posto. In produzione non cambia nulla — su Render il download
 * funziona e il client si rigenera con il suo motore a ogni build.
 *
 * COME SI USA:  node scripts/typecheck-reale.mjs
 * Il verde ora è **zero errori**, non «42» e non «32».
 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

// Un .gz valido di contenuto qualunque: la CLI lo scompatta e lo salva, non lo esegue.
const FINTO = gzipSync(Buffer.alloc(1024, 7));

const server = createServer((req, res) => {
  // I .sha256 NON si servono di proposito: il 404 fa saltare la verifica del checksum, che è
  // quello che vogliamo (i byte sono finti per costruzione). Vedi PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING.
  if (req.url?.endsWith('.gz')) {
    res.writeHead(200, { 'content-type': 'application/gzip', 'content-length': FINTO.length });
    res.end(FINTO);
    return;
  }
  res.writeHead(404).end();
});

await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const porta = server.address().port;

const env = {
  ...process.env,
  PRISMA_ENGINES_MIRROR: `http://127.0.0.1:${porta}`,
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
};

const passo = (titolo, cmd, args) => {
  console.log(`\n▶ ${titolo}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  return r.status ?? 1;
};

let esito = passo('Genero i tipi veri di Prisma (senza motore)', 'npx', ['prisma', 'generate', '--no-engine']);
if (esito === 0) esito = passo('Type-check (deve dare ZERO errori)', 'npx', ['tsc', '-p', 'tsconfig.build.json', '--noEmit']);

server.close();
console.log(esito === 0 ? '\n✅ Type-check pulito: zero errori, con i tipi veri di Prisma.' : '\n❌ Type-check FALLITO: sono gli stessi errori che farebbero fallire il build su Render.');
process.exit(esito);
