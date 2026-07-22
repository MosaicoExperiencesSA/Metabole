# Registro modifiche — Secondo numero di telefono sui record CRM (#11, parte 1)

**Data:** 22 luglio 2026 · Base: origin/main 90aaacf (+ #7,#8). (Richiesta #11 / bonifica import.)

## Summary
Molti telefoni importati da Mosaico sono **due numeri appiccicati** (es. `33357817433335781734`
= `3335781743` + `3335781734`). Invece di indovinare quale tenere, ora esiste un **secondo campo
telefono** (`phone2`) sui record CRM: si mette il primo numero in `phone` e il secondo in `phone2`,
così non si perde nessun contatto. Il secondo numero è visibile e modificabile nella scheda lead
del backoffice.

## Description
**Backend**
- `schema.prisma` → `CrmRecord.phone2 String?` (colonna `phone2`).
- Migration `20260722180000_crm_phone2`: `ALTER TABLE "crm_record" ADD COLUMN "phone2" TEXT;`.
- `commerce.controller.ts` (`UpdateLeadInfoDto`): aggiunti `phone` e `phone2` (stringa, opzionali).
- `crm.service.ts` → `updateInfo`: ora aggiorna anche `phone` e `phone2` (prima il telefono non
  era modificabile dalla scheda). Il `detail` restituisce già `phone2` (usa `include`, tutti gli
  scalari del record).

**Backoffice**
- `LeadDetail.tsx`: mostra il **2° numero** nell'intestazione; in "Modifica scheda" ci sono i campi
  **Telefono** e **2° telefono** editabili (per i lead non ancora clienti).

## Nota bonifica (anteprima aggiornata)
- Aggiornato il foglio di anteprima `Bonifica_Import_Anteprima.xlsx`: il foglio telefoni ora ha
  due colonne **Numero 1 / Numero 2**. Dei 180 telefoni sporchi, **119 sono divisi in modo sicuro**
  (esattamente 20 cifre = 10+10); i restanti 61 (lunghezze diverse) restano "DA CONTROLLARE".
- L'**applicazione** della bonifica al database (email + i due numeri) è il passo successivo, da
  fare dopo la revisione del foglio.

## Note
- Migration additiva (solo ADD COLUMN), nessun rischio sui dati. Al deploy backend gira
  `prisma migrate deploy`.
- Verifica: transpile backend OK (controller+service), NUL check migration OK, `tsc --noEmit`
  backoffice OK.
