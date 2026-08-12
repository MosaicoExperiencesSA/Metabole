import { LeadsTable } from './LeadsTable';

/**
 * «LEAD DA ASSEGNARE» — §16.3, richiesta di Simone dell'11/8.
 *
 * «Se clicca sulla notifica le si apre una tabella (da creare) chiamata Lead da assegnare, con tutti
 * i lead non assegnati, in ordine dal più vecchio al più recente, e li vede: nome, cognome, mail e
 * coach.»
 *
 * Non è una pagina nuova: è la stessa tabella di Gestione lead con il filtro sulla coach inchiodato
 * su «nessuna» e l'ordine dal più vecchio. Le quattro colonne che Simone ha chiesto ci sono già —
 * più lo stadio e il valore, che non danno fastidio e servono a decidere a chi darlo.
 *
 * L'ordine **dal più vecchio** è la cosa che rende questa pagina una coda di lavoro invece di un
 * elenco: in cima c'è chi aspetta da più tempo, cioè chi si sta raffreddando.
 */
export function LeadDaAssegnare() {
  return <LeadsTable modo="da_assegnare" />;
}
