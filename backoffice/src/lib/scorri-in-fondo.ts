/**
 * ⛔ **UNA CHAT SI APRE SULL'ULTIMO MESSAGGIO** — richiesta di Simone del 23/8: *«aprendo una
 * conversazione si parte dal primo messaggio e bisogna scorrere fino in fondo per vedere l'ultimo.
 * Vale per tutte»*.
 *
 * ⚠️ È il difetto che cresce con la conversazione: alla decima riga è un fastidio, alla centesima la
 * chat sembra ferma a mesi fa — e chi risponde deve scorrere prima ancora di poter leggere la
 * domanda a cui sta rispondendo.
 *
 * ## ⚠️ Si sposta il CONTENITORE, non si «porta in vista» l'ultimo messaggio
 *
 * Il modo più corto sarebbe `endRef.current.scrollIntoView()` su un segnaposto in fondo — ed è
 * quello che facevano le chat che già scorrevano. Ma `scrollIntoView` scorre **tutti** gli antenati:
 * dentro una pagina lunga come la scheda cliente, aprire una conversazione farebbe saltare la pagina
 * intera su quella card. Qui si tocca solo la scatola che deve scorrere.
 *
 * ⚠️ **Due giri, e il secondo non è superstizione**: al primo disegno le altezze possono non essere
 * ancora quelle vere (un carattere che arriva dopo, un'immagine, una bolla che va a capo). Il
 * secondo giro, dopo il frame, rimette in fondo — senza, la chat si ferma «quasi» in fondo, che è il
 * modo peggiore di sbagliare: sembra fatto apposta.
 */
export function portaInFondo(el: { scrollTop: number; scrollHeight: number } | null | undefined): void {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

/**
 * ⛔ **LA SCATOLA NON C'È ANCORA QUANDO ARRIVANO I MESSAGGI** — 31/8, dagli screenshot di Simone:
 * la pagina dell'assistente si apriva su messaggi del 26/8 mentre la conversazione finiva il 31/8
 * alle 09:39. Il codice per scorrere c'era, e non serviva a niente.
 *
 * ⚠️ Il motivo è una sola riga: `if (loading) return <Spinner />`. Chi carica scrive prima i
 * messaggi e spegne il caricamento DOPO (c'è un secondo `await` in mezzo, il registro). Nel disegno
 * in cui i messaggi arrivano la scatola è ancora una rotellina: il `ref` è `null`, l'effetto scorre
 * il nulla — e quando la scatola compare l'effetto non riparte, perché i messaggi non sono
 * cambiati. Una lista che si apre in cima **non è la prova che manchi il codice per scorrerla**.
 *
 * Il rimedio non è aggiungere `loading` alle dipendenze in ogni pagina — è non dipendere più dal
 * momento: si scorre **quando la scatola si attacca**, che è l'istante in cui esiste davvero.
 * Il `ref` normale continua a servire all'effetto dei messaggi nuovi, e questa funzione lo riempie.
 *
 * ⚠️ Da memoizzare (`useMemo(() => agganciaInFondo(ref), [])`): una funzione nuova a ogni disegno
 * React la stacca e la riattacca ogni volta, e la chat tornerebbe in fondo mentre qualcuno sta
 * leggendo indietro.
 */
export function agganciaInFondo<T extends { scrollTop: number; scrollHeight: number }>(
  ref: { current: T | null },
): (el: T | null) => void {
  return (el) => {
    ref.current = el;
    if (!el) return;
    portaInFondo(el);
    // Secondo giro, per la stessa ragione dell'effetto: al primo disegno le altezze non sono quelle
    // vere. Si rilegge `ref.current`, così un elemento nel frattempo staccato non fa danni.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => portaInFondo(ref.current));
  };
}
