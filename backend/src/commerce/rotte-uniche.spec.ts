import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import * as controllers from './commerce.controller';

/**
 * Guardia contro le rotte doppie.
 *
 * Il 7/8 due metodi diversi si sono ritrovati su `GET /me/subscription`: uno restituiva
 * l'abbonamento principale (letto da Calendario, Profilo e dal promemoria della data d'inizio),
 * l'altro l'abbonamento ricorrente. Nest non protesta: registra il primo e ignora il secondo, e
 * una schermata dell'app inizia a ricevere il payload sbagliato. Nessun test se ne accorge, perché
 * ognuno dei due metodi, preso da solo, funziona.
 *
 * Questo test guarda i decoratori, non il comportamento: elenca `metodo + percorso` di ogni
 * controller del modulo e verifica che non ci siano ripetizioni.
 */

const VERBI = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

/** Una classe qualsiasi: qui interessano solo i decoratori, non cosa costruisce. */
type Classe = { name: string; prototype: object };

function rotteDi(ctrl: Classe): string[] {
  const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) ?? '').replace(/^\/|\/$/g, '');
  const proto = ctrl.prototype;
  return Object.getOwnPropertyNames(proto)
    .filter((n) => n !== 'constructor')
    .map((n) => Object.getOwnPropertyDescriptor(proto, n)?.value)
    .filter((fn): fn is (...a: never[]) => unknown => typeof fn === 'function')
    .filter((fn) => Reflect.getMetadata(PATH_METADATA, fn) !== undefined)
    .map((fn) => {
      const verbo = VERBI[Reflect.getMetadata(METHOD_METADATA, fn) as number] ?? '?';
      const path = String(Reflect.getMetadata(PATH_METADATA, fn) ?? '').replace(/^\/|\/$/g, '');
      // I parametri contano per la POSIZIONE, non per il nome: `:id` e `:planId` sono la
      // stessa rotta e si oscurano a vicenda.
      const completo = [base, path].filter(Boolean).join('/').replace(/:[^/]+/g, ':param');
      return `${verbo} /${completo}`;
    });
}

describe('Rotte dei controller commerce (nessun percorso registrato due volte)', () => {
  const classi: Classe[] = (Object.values(controllers) as unknown[]).filter(
    (v): v is Classe => typeof v === 'function' && Reflect.getMetadata(PATH_METADATA, v) !== undefined,
  );

  it('trova i controller del modulo (se questo fallisce, il test non stava guardando niente)', () => {
    expect(classi.length).toBeGreaterThanOrEqual(5);
  });

  it.each(classi.map((c) => [c.name, c] as const))('%s non ha rotte doppie', (_nome, ctrl) => {
    const rotte = rotteDi(ctrl);
    const doppie = rotte.filter((r, i) => rotte.indexOf(r) !== i);
    expect(doppie).toEqual([]);
  });
});
