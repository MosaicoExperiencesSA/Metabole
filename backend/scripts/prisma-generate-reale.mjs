#!/usr/bin/env node
/**
 * RIGENERA I TIPI DI PRISMA — TUTTI E DUE I POSTI IN CUI FINISCONO.
 *
 * IL PROBLEMA CHE RISOLVE (13/8). `npm run typecheck` gira `prisma generate --no-engine`, che
 * scrive i tipi in `node_modules/@prisma/client`, e `tsc` legge quelli: type-check verde.
 * **Jest no**: ts-jest arriva alla copia vecchia in `node_modules/.prisma/client`, e ventisei
 * suite non compilano con errori su campi che nello schema ci sono da ore
 * (`'idoneita' does not exist in type 'ClientProfileSelect'`).
 *
 * ⚠️ È il tipo di guasto peggiore da leggere: il type-check dice verde e i test dicono rosso sulla
 * stessa riga di codice, quindi sembra che a mentire sia uno dei due. Non mente nessuno: guardano
 * due copie diverse degli stessi tipi.
 *
 * Questo comando fa il generate COMPLETO — che aggiorna anche `.prisma/client` — usando lo stesso
 * mirror finto di `typecheck-reale.mjs`, perché il 403 sui binari c'è comunque.
 *
 * COME SI USA:  npm run prisma:tipi
 * Poi `npx jest` e `npm run typecheck` guardano la stessa cosa.
 */
import { spawnSync } from 'node:child_process';
import { avviaMirrorPrisma } from './mirror-prisma.mjs';

const { env, chiudi } = await avviaMirrorPrisma();
console.log('\n▶ Rigenero i tipi di Prisma (completo: @prisma/client e .prisma/client)');
const r = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
chiudi();
const esito = r.status ?? 1;
console.log(esito === 0 ? '\n✅ Tipi rigenerati: ora tsc e jest guardano gli stessi.' : '\n❌ Generate fallito.');
process.exit(esito);
