/**
 * IL PIANO DELL'IMPORT — deciso qui, senza banca dati, così si può provare.
 *
 * ## Perché è un file a parte
 *
 * Questa decisione — «questa riga la creo? rinomino quella vecchia? la salto?» — stava dentro
 * `main()` di `importa-alimenti.ts`, fra una `findMany` e una `create`. Per provarla ci voleva un
 * database, quindi non è mai stata provata, e il 20/8 la prova a vuoto sui due fogli insieme ha
 * scoperto che sbagliava: la mappa dei nomi non si aggiornava e i nomi presenti in tutti e due i
 * fogli venivano lavorati due volte, con il nome nudo che finiva a prendersi il valore **da cotto**
 * — l'opposto del motivo per cui lo script esiste.
 *
 * ⚠️ Qui dentro non c'è Prisma. Entrano due elenchi, esce un piano. È tutto quello che serviva
 * perché quel difetto avesse un test.
 */
import { normalizzaStato, STATI_A_CRUDO } from './stato-alimento';
import { normalizzaNome } from './valori-nutrizionali.service';
import type { RigaAlimento } from '../../prisma/dati-alimenti';

/** Una riga già in tabella, per quel poco che serve a decidere. */
export interface Conosciuta {
  id: string;
  name: string;
  synonyms: string[];
  state: string | null;
  kcal: number | null;
}

export type Mossa =
  | { tipo: 'crea'; riga: RigaAlimento; messaggio: string }
  | { tipo: 'rinomina-e-crea'; riga: RigaAlimento; id: string; nuovoNome: string; sinonimi: string[]; messaggio: string }
  | { tipo: 'salta'; riga: RigaAlimento; messaggio: string };

export interface Piano {
  mosse: Mossa[];
  creati: number;
  rinominati: number;
  saltati: number;
}

/**
 * Il nome che prende la riga vecchia quando le si toglie il nome nudo: «carote» → «carote (da cotto)».
 *
 * ⚠️ **Prima incollava la parola dello stato così com'era**, e la prova a vuoto del 20/8 ha mostrato
 * cosa ne usciva: «broccoli bollito», «barbabietola bollito», «spinaci bollito», «polenta cotto».
 * In italiano lo stato si accorda con l'alimento, e l'alimento cambia genere e numero: non c'è una
 * regola che ci arrivi da sola, e indovinarla sbaglierebbe sul primo nome nuovo.
 *
 * ⛔ E non è eleganza: **questi nomi li legge una persona** — stanno nella pagina Alimenti, e Gaia
 * li può citare a una cliente («le barbabietola bollito hanno…»). Un nome storto in banca dati si
 * corregge solo con un'altra migrazione.
 *
 * `(da cotto)` è sempre grammaticale, per qualunque alimento, ed è **la frase che il prodotto già
 * usa**: «Solo da cotto» è l'etichetta dell'elenco «Alimenti da correggere».
 */
export function nomeConStato(nome: string, stato: string | null): string {
  const s = (stato ?? '').trim().toLowerCase();
  if (!s) return `${nome} (vecchia)`;
  const daCotto = s.startsWith('bollit') || s.startsWith('cott') || s.startsWith('lessat');
  return daCotto ? `${nome} (da cotto)` : `${nome} (${s})`;
}

export function pianifica(righe: RigaAlimento[], esistenti: Conosciuta[]): Piano {
  /**
   * ⚠️ **LA MAPPA SI AGGIORNA DENTRO IL GIRO.** I due fogli hanno una ventina di nomi in comune.
   * Se la mappa resta ferma a com'era la tabella all'inizio, alla riga del secondo foglio risponde
   * ancora con la riga *da cotto*, come se il primo foglio non fosse mai passato: la riga vecchia
   * viene rinominata due volte, e il nome nudo — «broccoli», «carote», «barbabietola», «pane di
   * segale» — finisce a prendersi il valore da cotto. E siccome `NutrientFact.name` è unico, la
   * seconda `create` morirebbe a metà lavoro.
   *
   * `origine` esiste per non dire una bugia nel messaggio: «in tabella 35 kcal» su una riga che in
   * tabella non c'è ancora — l'ha messa in coda il foglio di prima — è una ragione falsa, e una
   * ragione falsa è peggio di un ordine sbagliato.
   */
  type Vista = Conosciuta & { origine: 'tabella' | 'foglio' };
  const perNome = new Map<string, Vista>(
    esistenti.map((a) => [normalizzaNome(a.name), { ...a, origine: 'tabella' as const }]),
  );
  const ricorda = (r: RigaAlimento) =>
    perNome.set(normalizzaNome(r.name), {
      id: '(in coda)', name: r.name, synonyms: r.synonyms ?? [], state: r.state, kcal: r.kcal, origine: 'foglio',
    });

  const mosse: Mossa[] = [];
  let creati = 0; let rinominati = 0; let saltati = 0;

  for (const r of righe) {
    if (r.kcal === null) {
      mosse.push({ tipo: 'salta', riga: r, messaggio: `⚠️  SALTO «${r.name}»: senza kcal non si carica (è l'unico campo che non si può indovinare).` });
      saltati += 1;
      continue;
    }
    const esistente = perNome.get(normalizzaNome(r.name));

    if (!esistente) {
      mosse.push({ tipo: 'crea', riga: r, messaggio: `+ nuova   «${r.name}»  (${r.state ?? 'senza stato'}, ${r.kcal} kcal)  [${r.foglio}]` });
      creati += 1;
      ricorda(r);
      continue;
    }

    if (STATI_A_CRUDO.includes(normalizzaStato(esistente.state))) {
      /**
       * ⚠️ Esiste già ed è già a crudo: i valori NON si toccano. Sono dati verificati, e
       * sovrascriverli con un file nuovo vorrebbe dire perdere in silenzio una correzione fatta a
       * mano. Si dice, e decide una persona.
       */
      const dove = esistente.origine === 'tabella' ? 'in tabella' : 'nel foglio di prima';
      mosse.push({ tipo: 'salta', riga: r, messaggio: `· c'è già a crudo, non tocco  «${esistente.name}»  (${dove} ${esistente.kcal ?? '?'} kcal, in questa riga ${r.kcal})` });
      saltati += 1;
      continue;
    }

    /**
     * ⚠️ IL CASO CHE VALE LO SCRIPT: la riga esiste **da cotto** e occupa il nome nudo. Si rinomina
     * («carote» → «carote (da cotto)»), il nome vecchio le resta come **sinonimo**, e il nome nudo
     * va alla riga a crudo — perché è quello che scrivono le ricette, e le ricette sono a crudo.
     */
    const nuovoNome = nomeConStato(esistente.name, esistente.state);
    if (perNome.has(normalizzaNome(nuovoNome))) {
      mosse.push({ tipo: 'salta', riga: r, messaggio: `⚠️  SALTO «${r.name}»: «${nuovoNome}» esiste già, e rinominare creerebbe un doppione. Guardala a mano.` });
      saltati += 1;
      continue;
    }
    mosse.push({
      tipo: 'rinomina-e-crea',
      riga: r,
      id: esistente.id,
      nuovoNome,
      // ⚠️ Il nome vecchio diventa un sinonimo: chi chiedeva «carote» continua a trovarla, e adesso
      // trova DUE righe con stati diversi — che è ciò che fa dire «dipende» a Gaia.
      sinonimi: [...new Set([...(esistente.synonyms ?? []), esistente.name])],
      messaggio: `~ rinomino  «${esistente.name}» → «${nuovoNome}»  (resta come sinonimo)\n+ e creo    «${r.name}»  (${r.state ?? 'senza stato'}, ${r.kcal} kcal)`,
    });
    rinominati += 1; creati += 1;
    perNome.set(normalizzaNome(nuovoNome), { ...esistente, name: nuovoNome, origine: 'foglio' });
    ricorda(r);
  }

  return { mosse, creati, rinominati, saltati };
}
