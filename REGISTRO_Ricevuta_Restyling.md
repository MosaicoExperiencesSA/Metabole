# Registro modifiche — Ricevuta di pagamento: restyling + indirizzo e codice fiscale

**Data:** 18 luglio 2026 · Base: origin/main 6307eaa.

## Summary
La ricevuta PDF è ridisegnata nello stile del Diario (logo, fascia verde con numero e data,
pannelli "Intestatario" e "Dettaglio", totale in evidenza) ed è più completa: **nome e cognome**,
email, **indirizzo** e **codice fiscale** — questi ultimi due compaiono solo se presenti in
anagrafica. Il codice fiscale ora si può inserire anche dalla **Modifica scheda** del cliente.

## Description
- **commerce.generateReceiptPdf**: intestatario col nome anagrafico (nome+cognome, con
  fallback al nome percorso), indirizzo composto su una riga (via, CAP città, provincia) e
  codice fiscale (User, con fallback alla scheda CRM per gli importati dallo storico).
  Nuovi segnaposto: `address`, `taxCode` e le righe pronte `addressRow`/`taxCodeRow`
  (vuote quando il dato manca: niente campi "—" nella ricevuta).
- **pdf.defaults (receipt)**: template ridisegnato — logo in testa, fascia verde
  numero+data, pannello Intestatario (cliente/email/indirizzo/CF), pannello Dettaglio
  (descrizione/metodo/stato con chip), totale grande bordato, footer con riferimenti del
  documento. Anteprima dell'editor aggiornata con dati d'esempio completi.
- **Scheda cliente**: campo "Codice fiscale" nella Modifica scheda (salvato su User,
  maiuscolo) e visibile nell'intestazione della scheda (riga "CF: …" sotto l'indirizzo).
  L'app cliente lo permetteva già dal profilo.

## Note
- **Dopo il deploy**: Grafica PDF → "Ricevuta di pagamento" → **Ripristina** per adottare la
  nuova grafica (insieme agli altri due Ripristina già in lista).
- La ricevuta di RIMBORSO (PDFkit) resta con la grafica semplice: si può allineare in seguito.
