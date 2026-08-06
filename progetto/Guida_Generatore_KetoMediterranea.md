# Il generatore, spiegato mentre lo si usa

**Per:** la nutrizionista · **Con:** Simone · **Data:** 6 agosto 2026
**Caso d'uso di esempio:** la Keto-Mediterranea, 12 varianti.

---

## Cosa fa e cosa NON fa

Il generatore scrive una **bozza** di catalogo: ricette, giornate, gruppi di equivalenza. Non
pubblica niente e non tocca il motore: le ricette nascono **disattivate** e la dieta nasce
**bozza, non visibile alle clienti**. Finché non pubblichi tu, per il sistema non esiste.

Non sostituisce il tuo lavoro clinico: propone una prima stesura da correggere. La regola del
progetto non cambia — **i menu li validi tu**.

---

## I due stadi, che è la cosa che confonde di più

1. **La definizione** (quella che vedi al passo 1, con «· 12 varianti»): sono le *istruzioni*.
   Dicono al generatore quante kcal, quante proteine, quali vincoli clinici rispettare.
2. **La dieta vera**: nasce quando premi *Genera*. Sono ricette e giornate scritte davvero,
   dentro il catalogo.

Eliminare la definizione **non** elimina le diete già generate, e viceversa. Sono due cose
separate, ed è la trappola in cui si cade più spesso.

---

## Perché 12 varianti e non una

Il motore sceglie la dieta che combacia con la cliente su quattro cose: stile, regime, obiettivo
e struttura dei pasti. Se manca la combinazione esatta — per dire, vegetariana in mantenimento a
3 pasti — quella cliente **resta senza menu**. Per questo un prodotto è sempre una famiglia:
2 regimi × 2 obiettivi × 3 strutture pasti.

---

## La sequenza

**Passo 1.** Richiama *Keto-Mediterranea*. Nel riquadro compaiono nome, vincoli e note cliniche:
è il testo che il generatore riceve. Vale la pena leggerlo insieme — è lì che sta la differenza
fra questa e la Keto classica (solo ingredienti da supermercato italiano, con l'elenco di quelli
esclusi perché introvabili).

**Passo 2.** *Genera tutte le 12 varianti*. Ci mette qualche minuto: è l'AI che scrive, una
variante per volta, con la barra di avanzamento. Non chiudere la pagina.
Cosa produce per ciascuna: **5 ricette per pasto**, fino a 10 giornate scritte una per una, e le
altre completate ruotando le ricette fino ai 28 giorni.

Se una variante esiste già, la **lascia intatta**: rigenerare non sovrascrive. Per rifarne una,
la si genera da sola e si conferma la sostituzione.

**Passo 3.** La revisione, che è la parte tua. Poi *Valida e pubblica tutte*.

---

## ⚠️ Il punto delicato

*Valida e pubblica tutte* fa quattro cose in un colpo: attiva le ricette, **segna gli allergeni
come verificati**, approva i gruppi di equivalenza e pubblica.

Il sistema si fida di quel clic. Gli allergeni che vedi sono stati **indovinati dagli ingredienti**
(uova → uova, mozzarella → latte): sono un punto di partenza, non una revisione. Su una cliente
allergica la differenza non è teorica. Quindi il controllo va fatto **prima** di premerlo.

---

## Cosa guardare nelle bozze

- **Ingredienti fuori tavolozza.** È il motivo per cui esiste questo prodotto. Se compare una
  farina di mandorle o un dolcificante particolare, va sostituito: il riferimento è
  `Metabole_KetoMediterranea_Materia_Prima.md`.
- **Allergeni**, uno per uno, come sopra.
- **Stagioni e difficoltà**: il generatore **non le compila**. Vuoto significa "va bene tutto
  l'anno" — accettabile, ma è quello che a luglio produce lo spezzatino. Dieci secondi a piatto
  spesi ora valgono una segnalazione in meno dopo. E le ricette marcate "semplice" entrano nel
  meccanismo delle alternative per chi ha chiesto ricette veloci.
- **Le kcal**: sono stime coerenti fra loro, utili al motore, ma restano stime.
- **La varietà**: 5 ricette per pasto sono poche per 28 giorni. Se un pasto si ripete troppo,
  la soluzione è aggiungere ricette al catalogo, non rigenerare.

---

## Se qualcosa va storto

- «Generazione non riuscita»: quasi sempre è l'AI che ha restituito un JSON malformato. Riprova:
  il sistema fa già tre tentativi da solo, ma un quarto a mano spesso basta.
- Una variante generata per errore (capita con le famiglie a digiuno) si **archivia**, non si
  cancella: esce dai menu e resta recuperabile.
