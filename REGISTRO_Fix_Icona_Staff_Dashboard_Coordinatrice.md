# Registro modifiche — Fix icona profilo staff + dashboard backoffice coordinatrice

**Data:** 20 luglio 2026 · Base: origin/main 17f7937.

## Summary
Due correzioni: (1) l'iconcina "profilo" nell'header dell'**app staff** aveva i colori
invertiti rispetto alle altre; (2) la home del **backoffice** per la **Responsabile Coach**
(ruolo personalizzato) cadeva sulla Dashboard generica invece della home Coach (con il
"link d'invito"/ref link).

## Description
- **app/src/staff/theme-staff.css** — `.sf-hicon-user`: da sfondo bianco/icona colorata a
  sfondo traslucido/icona bianca, come le altre iconcine dell'header (stessa correzione già
  fatta lato app cliente).
- **backoffice/src/pages/Home.tsx**: la scelta della home usava `permissions.role`, che per un
  **ruolo personalizzato** (es. "Responsabile Coach") è la chiave custom e non
  `coach_coordinator` → finiva sulla Dashboard generica. Ora usa il **ruolo di SISTEMA**
  (`user.role`), che per un ruolo custom è il ruolo BASE su cui è costruito: la Responsabile
  Coach vede la **home Coach** (link d'invito/ref code, clienti, piani in scadenza) come le
  coach. Nessun impatto su admin/altri ruoli.

## Note
- Perché funzioni, il ruolo "Responsabile Coach" dev'essere costruito sul ruolo base
  **coach_coordinator** (o coach). Se fosse basato su un altro ruolo (es. sales/admin) la
  home resterebbe diversa: in quel caso si reimposta il ruolo base dai Permessi.
- Solo CSS + una riga di routing: nessuna migration.
