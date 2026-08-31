import { describe, expect, it } from 'vitest';

const SORGENTI: Record<string, string> = import.meta.glob('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * ⛔ **31/8, dagli screenshot di Simone**: la pagina dell'assistente si apriva su messaggi del 26/8
 * mentre la conversazione finiva il 31/8 alle 09:39. Il codice per scorrere c'era da una settimana.
 *
 * ⚠️ La lezione è quella che questa prova sorveglia: **in una pagina che nasconde la scatola dietro
 * una rotellina, l'effetto sui messaggi non basta**. I messaggi possono arrivare prima che la
 * rotellina se ne vada, il `ref` è ancora `null`, e quando la scatola compare l'effetto non riparte
 * perché i messaggi non sono cambiati. Chi scorre deve agganciarsi alla scatola, non al momento.
 *
 * Prove sul SORGENTE, come le altre di questa cartella: dicono che l'aggancio c'è. Che si comporti
 * bene è collaudato in `lib/scorri-in-fondo.spec.ts`.
 */
describe('le chat si aprono sull\'ultimo messaggio, anche dietro una rotellina', () => {
  /**
   * Il secondo elemento è la rotellina VERA di quella scatola, non una qualsiasi della pagina:
   * ⚠️ la prima stesura cercava `? <Spinner />` in tutto il file e su `ClientDetail` trovava la
   * rotellina di un ALTRO componente (e una riga di commento) — passava anche a scatola scoperta.
   */
  const CON_ROTELLINA: [string, RegExp][] = [
    ['./Vera.tsx', /if \(loading\) return <Spinner \/>;/],
    ['./ClientDetail.tsx', /\{caricaMsg \? \(\s*\n\s*<Spinner \/>/],
  ];

  for (const [nome, rotellina] of CON_ROTELLINA) {
    const src = SORGENTI[nome] ?? '';

    it(`${nome} c'è`, () => {
      expect(src).not.toBe('');
    });

    it(`⛔ ${nome} scorre la scatola quando si ATTACCA, non solo quando cambiano i messaggi`, () => {
      // ⚠️ Con le dipendenze, non solo `useMemo(...)`: `useMemo(() => agganciaInFondo(x), [messaggi])`
      // rifà l'aggancio a ogni messaggio, e la chat tornerebbe in fondo mentre qualcuno legge indietro.
      expect(src).toMatch(/const attacca\w* = useMemo\(\(\) => agganciaInFondo\(\w+\), \[\]\);/);
      // …e l'aggancio è davvero appeso alla scatola che scorre.
      expect(src).toMatch(/<div ref=\{attacca\w*\}[^>]*overflowY: 'auto'/);
    });

    it(`⚠️ ${nome}: la scatola sta ancora dietro la sua rotellina — se un giorno non fosse più vero questa prova va rivista, non cancellata`, () => {
      expect(src).toMatch(rotellina);
    });
  }
});
