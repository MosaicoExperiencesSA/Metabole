# Metabole 2.1 — note di rilascio e sequenza di pubblicazione

**Versione:** 2.1 · **build/versionCode:** 5 · **data prevista:** 6 agosto 2026
Fonte unica delle versioni: `app/android-version.json` (Xcode la legge da lì tramite
`scripts/install-ios.mjs`, non va toccata a mano da nessuna parte).

---

## Testo per gli store

Scritto per le clienti, non per noi: niente nomi di file, niente gergo tecnico, nessuna promessa
di risultati.

### App Store — «Novità di questa versione»

```
Cosa cambia in questa versione:

• Digiuno intermittente: ora scegli tu quali pasti saltare, e i menu si adattano. Una volta a
  settimana ti viene proposta la giornata 20-4, spiegata prima di iniziarla.
• Menu di stagione: niente più piatti invernali a luglio.
• In registrazione, accanto a ogni tipo di alimentazione trovi un "?" con una spiegazione basata
  su fonti scientifiche, compreso quello che è bene sapere prima di sceglierla.
• Il check-in ti chiede anche energia, fame e stress, e ti viene proposto solo quando hai un
  percorso attivo.
• Porta un'amica: il tuo link personale è in Home, con la condivisione del telefono.
• La posta mostra anche i messaggi che hai inviato.
• Promemoria più chiari quando mancano le misure: senza quelle il percorso non può proseguire.
• Correzioni: intestazione ferma mentre scorri, grafici scorrevoli e card dell'obiettivo più
  chiara quando il peso si muove nella direzione sbagliata.
```

### Google Play — «Novità» (limite 500 caratteri)

```
• Digiuno intermittente: scegli quali pasti saltare, con la giornata 20-4 una volta a settimana.
• Menu di stagione.
• Un "?" spiega ogni tipo di alimentazione, con fonti attendibili.
• Check-in con energia, fame e stress, solo con un percorso attivo.
• Porta un'amica: link personale e condivisione dal telefono.
• Posta: anche i messaggi inviati.
• Promemoria più chiari se mancano le misure.
• Intestazione ferma, grafici scorrevoli, card obiettivo più chiara.
```

---

## Sequenza della serata

1. **Render verde.** Il deploy applica le migrazioni e rilancia il seed (`prisma db seed` in
   preDeploy): da lì entrano anche le 12 varianti Keto-Mediterranea.
2. **iOS.** Chiudere **Xcode**, poi `bash build-ios.sh`. In Xcode: Product → Archive → Distribute.
   Controllo prima dell'invio: `aps-environment` deve risultare **production** (è la voce che nel
   2.0 mancava e teneva le push spente).
3. **Android.** `bash build-aab.sh`, poi caricare l'AAB su Play Console (versionCode 5).
4. **Dopo la pubblicazione**, svuotare **`OTA_VERSION`** su Render. Se resta valorizzata, le app
   appena aggiornate scaricherebbero un bundle OTA più vecchio del nativo.

⚠️ **Niente OTA prima della pubblicazione**: è il motivo per cui abbiamo fatto tutto in un giorno
solo. Le due guardie in `scripts/ota-release.mjs` impediscono i due incidenti già capitati (bundle
senza codice push, e versione ripubblicata con lo stesso numero), ma la regola resta.

---

## Cosa resta fuori da questa versione

- **Voce #10 — monitoraggio a pagamento dopo il mantenimento**: bloccata dallo Stripe ricorrente
  (oggi `mode: 'payment'`). Prima serve la decisione sulle **provvigioni sul rinnovo**.
- **Voce #2 — Keto-Mediterranea**: il codice c'è ed è nel generatore; le 12 varianti vanno
  generate e validate dalla nutrizionista. Non blocca la pubblicazione: finché non sono approvate
  nessuna cliente le vede.
- **Una card per prodotto in registrazione** (invece che per stile): in `metabole-backlog.md`,
  richiede migrazione e verifica sul motore.
