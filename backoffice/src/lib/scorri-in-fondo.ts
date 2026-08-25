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
