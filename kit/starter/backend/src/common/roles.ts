/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — i ruoli. Manuale: kit/manuale/00-decisioni.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ⛔ **I RUOLI DI SISTEMA SONO QUATTRO, E RESTANO QUATTRO.**
 *
 * I mestieri veri del progetto — «tutor», «segreteria», «agente», «nutrizionista» — **non** vanno
 * qui: diventano **ruoli personalizzati** (tabella `custom_role`), che hanno la loro etichetta, il
 * loro colore e la loro riga nella matrice dei permessi, ma poggiano su uno di questi quattro.
 *
 * Il motivo è tutto qui: questo elenco è un `enum` nel database, e ogni mestiere in più è **una
 * migrazione**. Con i ruoli personalizzati il mestiere nuovo si crea dalla pagina Ruoli, in trenta
 * secondi, senza rilascio e senza di te.
 *
 * ⚠️ La tentazione di aggiungerne uno arriva sempre al secondo mese, e sembra sempre l'eccezione
 * ragionevole. Non lo è: la prima volta che cedi, il progetto ha due sistemi di ruoli.
 */
export const ROLES = ['user', 'staff', 'manager', 'admin'] as const;

export type Role = (typeof ROLES)[number];

/** Ruoli assegnabili a chi lavora (l'utente finale si registra da sé, non si assegna). */
export const STAFF_ROLES: Role[] = ['staff', 'manager', 'admin'];

/** Etichette leggibili — usate negli elenchi e nella matrice dei permessi. */
export const SYSTEM_ROLE_LABELS: Record<Role, string> = {
  user: 'Utente',
  staff: 'Staff',
  manager: 'Responsabile',
  admin: 'Amministratore',
};

export function isSystemRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * IL LIVELLO NELLA RETE (solo se il progetto ha una rete di vendita — kit/manuale/08-commerciale.md).
 *
 * ⚠️ Il livello sta sulla **persona** (`Staff.level`), non sul ruolo: due `manager` possono stare a
 * due livelli diversi, e il giorno che qualcuno sale non deve cambiare ruolo per farlo. Questi sono
 * solo i valori di partenza di chi viene creato con quel ruolo.
 */
export const LIVELLO_DI_PARTENZA: Record<Role, number> = {
  user: 0,
  staff: 1,
  manager: 2,
  admin: 3,
};
