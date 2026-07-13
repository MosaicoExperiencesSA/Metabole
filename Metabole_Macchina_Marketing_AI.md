# MetaboleAI — La Macchina di Marketing (sistema AI)

Progetto di una **macchina di marketing** che nessuno ha mai visto: non un reparto che "fa le grafiche", ma un **sistema ad agenti AI** che pensa *come catturare il cliente*, decide *cosa pubblicare*, lo **produce** (vignette, video, testi, testimonianze), lo fa **validare da un agente giudice** prima di pubblicare, lo **pubblica**, **raccoglie i lead** e li versa nel CRM, e **impara** da ogni risultato. Il tutto **conforme** alle policy dei social (per non farsi bloccare) e integrato con il prodotto Metabole (eventi, `refcod`, AI composer, alert).

Questo documento è la sua **specifica**: architettura, motore creativo, cosa chiedere al cliente e quando, compliance/anti-blocco, piano editoriale, media planning per l'Italia, KPI e roadmap.

> Assunzione di mercato: **Italia** come mercato primario, target donne 30-60 (core) + segmenti 50+/menopausa e neo-mamme. La macchina è però disegnata per scalare ad altri Paesi/lingue.

---

# 1. Visione: la macchina in una riga

**Un cervello (strategia) + tante mani (produzione) + un giudice (compliance/qualità) + un banditore (pubblicazione) + una rete (raccolta lead) + una memoria (apprendimento).** Ogni giorno la macchina genera decine di proposte di contenuto, le fa passare da un controllo automatico di conformità e di brand, sottopone all'umano solo ciò che serve, pubblica, misura e ricicla ciò che funziona. La supervisione umana resta sui **claim sensibili** (salute) e sull'**approvazione finale**: l'AI propone, l'umano dà l'ok dove conta.

---

# 2. Architettura: gli agenti AI

Sette agenti specializzati coordinati da un **orchestratore**. Ognuno ha un compito, input e output chiari.

| Agente | Cosa fa | Output |
|---|---|---|
| **Stratega** | Legge KPI, stagionalità, segmenti, ciò che ha funzionato; decide temi, angoli, priorità per canale e fase | Brief creativi con angolo, target, obiettivo |
| **Creativo (art)** | Genera concept visivi: vignette, illustrazioni, storyboard video, format carosello | Bozze visive + istruzioni di produzione |
| **Copywriter** | Scrive testi per ogni canale (hook, caption, script video, email, SMS, adv) nel tono del brand | Varianti di testo pronte |
| **Compliance & Brand (il GIUDICE)** | **Valuta ogni proposta** prima della pubblicazione: conformità policy social + rischio ban + veridicità claim + coerenza brand; assegna un punteggio e un verdetto | Approva / Rivedi / Blocca + motivazione |
| **Publisher** | Programma e pubblica sui canali via API ufficiali; gestisce calendario e A/B | Post pubblicati + metadati |
| **Lead** | Cattura i lead da form/ads/social, deduplica, applica consenso, attribuisce fonte, li versa nel CRM come "in lavorazione" | Lead normalizzati nel CRM |
| **Analista** | Raccoglie performance, capisce cosa funziona, alimenta lo Stratega e la memoria | Report + segnali di apprendimento |

## 2.1 Il ciclo di vita di un contenuto

```
Stratega (brief)
   → Creativo + Copy (produzione)
      → GIUDICE compliance/brand  ──[Blocca]──► scarta + spiega
              │[Approva / Rivedi]
              ▼
      Revisione umana (solo se claim sensibile o punteggio incerto)
              ▼
      Publisher (programma e pubblica via API)
              ▼
      Lead (cattura → CRM)   +   Analista (misura)
              ▼
      Memoria: rialza ciò che converte, abbassa ciò che fallisce → torna allo Stratega
```

## 2.2 L'agente Giudice in dettaglio (il cuore della sicurezza)

Prima di pubblicare **qualsiasi** cosa, il Giudice esegue un checklist automatico e restituisce un verdetto:

- **Conformità policy** (Meta/TikTok/Google): la creatività o il copy violano una regola? (vedi §5). Es. "prima/dopo", seconda persona su attributi personali, promesse a tempo.
- **Rischio ban account**: elementi che innescano i sistemi antifrode (claim proibiti, landing non conforme, naming sensibile).
- **Veridicità del claim**: promette risultati non sostenibili? Un claim di salute va **escalato al nutrizionista capo** (come le altre parti cliniche del prodotto).
- **Coerenza brand**: tono, palette, messaggi-pilastro ("persone vere + AI", "senza fame", trasparenza).
- **Punteggio + verdetto**: *Approva* (pubblica), *Rivedi* (torna al Creativo/Copy con note), *Blocca* (scarta e spiega). Solo i casi *sensibili* o *incerti* arrivano all'umano. Ogni decisione è **loggata** (audit) per imparare e per difendersi in caso di contestazioni.

---

# 3. Il motore creativo: cosa pubblicare

La macchina produce **famiglie di contenuto**, ciascuna con uno scopo nel funnel. Non "post a caso": ogni formato risponde a un obiettivo.

## 3.1 Formati e a cosa servono

- **Vignette / illustrazioni** — leggere, condivisibili, "verità quotidiane" sul dimagrimento (la fame nervosa, la dieta lampo fallita, la giornata storta). Costruiscono empatia e riconoscibilità del brand.
- **Video brevi (Reel/TikTok/Shorts)** — il formato a più alta reach. Tipi: dietro le quinte di coach e nutrizionista (persone vere), "come funziona in 30 secondi", una ricetta veloce, il momento del check-in con Gaia, mini-lezioni ("impara lo stile di vita").
- **Testimonianze** — il differenziatore. **Positive, senza confronti di peso "prima/dopo"** (vietati, §5): storie di percorso, "come mi sento adesso", la relazione col coach. Video-testimonianza > testo.
- **Caroselli educativi** — porzioni, lettura etichette, gestione fame emotiva, spesa smart. Firmati dal nutrizionista → autorevolezza + SEO social.
- **Frasi/testo (quote card)** — messaggi-pilastro in immagine ("Non una dieta. Un percorso con persone vere."). Facili da declinare in serie.
- **Demo di prodotto** — la voce di Gaia, l'assaggio del menu, l'onboarding: mostrano il valore *prima* di pagare.
- **UGC (user-generated)** — contenuti dai clienti reali (con consenso): il più credibile e il meno costoso.

## 3.2 Angoli narrativi (i "gancî")

Lo Stratega ruota su angoli che parlano ai segmenti: *"le ho provate tutte"* (delusa dalle diete) · *"persone vere, non solo un'app"* · *"capisce le tue giornate no"* · *"mangi e dimagrisci, senza fame"* · *menopausa* (energia, ossa, muscolo) · *post-gravidanza* (anti-pressione, sano). Ogni angolo diventa una serie di contenuti in tutti i formati.

---

# 4. Cosa chiedere al cliente e quando

La macchina non chiede tutto subito: **aggancia le richieste agli eventi** del prodotto, quando il cliente è più disponibile (dopo un risultato, dopo un'interazione positiva). Tutto con consenso.

| Momento (evento nel prodotto) | Cosa chiedere | Perché allora |
|---|---|---|
| Post-onboarding (giorno 1-2) | Consenso marketing granulare (email/SMS/immagini) | Base legale per tutto il resto |
| Primo "seguito = sì" / prima settimana | Micro-sondaggio: com'è andata la prima settimana? | Feedback a caldo, segnale di attivazione |
| **Primo risultato** (traguardo -1/-3 kg, misure) | **Richiesta recensione** + eventuale testimonianza | Massima soddisfazione = massima disponibilità |
| Valutazione ricetta a 5★ | Chiedi una foto del piatto / UGC | Contenuto autentico e a costo zero |
| Metà percorso | Sondaggio NPS ("consiglieresti Metabole?") | Individua i promotori → referral |
| Promotori (NPS alto) | Invito al **referral** (`refcod`) + testimonianza video | Chi ama il prodotto porta altri |
| Fine percorso / rinnovo | Storia completa "il mio percorso" (con consenso) | Case study per acquisizione |

Regola d'oro: **si chiede poco, al momento giusto, dopo aver dato valore.** Mai chiedere recensioni a chi è "a rischio" (prima si recupera).

---

# 5. Compliance & blocchi social (per non farsi bloccare)

Questa è la parte che salva l'investimento: i social **bloccano account e campagne** nel verticale dimagrimento con facilità. Regole azionabili, per piattaforma. *(Le policy cambiano spesso: il Giudice va aggiornato periodicamente.)*

## 5.1 Meta (Facebook/Instagram)

- **Attributi personali**: vietato affermare/implicare che conosci salute o peso dell'utente. **No** seconda persona ("Vuoi perdere peso?", "Stai lottando con i chili?"). Anche framing indiretto ("per chi è in sovrappeso") è a rischio. **Sì** al parlare del *servizio* in terza/prima persona ("Il nostro metodo con coach e nutrizionista…").
- **Immagini prima/dopo VIETATE** e vietate immagini che idealizzano un corpo o generano auto-percezione negativa (metro stretto, "pizzicare" il grasso). **Sì** a testimonianze positive e stile di vita sano.
- **Niente numeri/tempi/garanzie**: "perdi 10 kg in 30 giorni", "garantito", "cura" → rifiutati. Linguaggio prudente su benessere e stile di vita.
- **Solo 18+**: il target dimagrimento va impostato con età minima 18.
- **Categoria sensibile (dal 2025)**: restrizioni su ottimizzazione per conversioni lower-funnel e su Custom/Lookalike Audiences con nomi "sensibili". **Naming pulito** di pixel/audience/conversioni (niente termini sanitari); ottimizzare su eventi più alti nel funnel (traffico, lead) + dati first-party/CRM.

## 5.2 TikTok

- Claim di dimagrimento ammessi **solo 18+** e **solo** promuovendo uno stile di vita sano. **Vietato**: promettere che è facile/garantito, che il prodotto dimagrisce "da solo senza dieta o esercizio", risultati irrealistici.
- **Body image**: vietato body-shaming, "corpo ideale", collegare aspetto a valore/felicità/successo.
- **Prima/dopo** legate a un prodotto = trattate come claim espliciti → **non ammesse**.
- **Integratori dimagranti / app di digiuno**: in Italia di fatto **non pubblicizzabili**. Anche l'organico segue le Community Guidelines (niente "what I eat in a day" restrittivi, niente calorie estreme).

## 5.3 Google Ads

- **Salute = categoria sensibile**: niente **Customer Match / Lookalike / your-data** su temi salute. **Sì** ad audience predefinite Google (in-market, affinity, demografiche), keyword e contesto.
- **Contenuto**: niente body-shaming né risultati irrealistici.
- **Vietati** prodotti hCG per dimagrimento; farmaci su prescrizione (GLP-1) richiedono certificazioni specifiche (verificare idoneità Italia).
- Under 18 esclusi dal personalized advertising.

## 5.4 Anti-ban dell'account (best practice)

Verificare **Business Manager + dominio**; non lanciare da profili personali; **account nuovo e pulito** (non riusare pagine/domini con storico negativo); **warmup 3-7 giorni** (partire con obiettivi leggeri e budget basso, poi salire — niente salti improvvisi che allertano l'antifrode); **pagamenti solidi** (no prepagate/carte riusate); **2FA** e ruoli a privilegio minimo; **landing page conformi** (privacy, termini, contatti, rimborsi, testimonianze reali, coerenza annuncio↔pagina); **naming pulito**; correggere subito le disapprovazioni e usare l'appello quando serve.

## 5.5 Email/SMS (deliverability e consenso)

- **Email**: autenticare il dominio (**SPF, DKIM, DMARC**) e **scaldarlo** aumentando i volumi gradualmente (rilevante se le transazionali partono da un dominio nuovo, es. via Brevo). Doppio opt-in.
- **SMS**: opt-in **separato** ed esplicito (regole più severe). Consensi granulari, revocabili, con timestamp e base giuridica (già previsto nello standard CRM).

---

# 6. Piano editoriale (calendario di pubblicazione)

Cadenza sostenibile e coerente col funnel. Esempio di **settimana tipo** (poi ottimizzata dall'Analista):

| Giorno | Instagram/TikTok (Reel) | Feed/Carosello | Storie | Altro |
|---|---|---|---|---|
| Lun | Mini-lezione nutrizionista | — | Sondaggio veloce | Newsletter educativa |
| Mar | Dietro le quinte coach | Carosello educativo | Q&A | — |
| Mer | Ricetta veloce | Quote card (pilastro) | UGC repost | — |
| Gio | Testimonianza (percorso) | — | Poll "giornata no?" | — |
| Ven | Demo Gaia / assaggio menu | Carosello mito-vs-fatto | Countdown offerta | Email retention |
| Sab | Reel lifestyle/community | — | Behind the scenes | — |
| Dom | Motivazionale | Riepilogo settimana | Domande aperte | — |

Ritmo consigliato di partenza: **1 Reel/giorno** per canale video + **3-4 feed/settimana** + storie quotidiane. La macchina genera il triplo dei contenuti necessari e il Giudice/Analista selezionano i migliori.

---

# 7. Media planning Italia (riviste, giornali, canali)

Dove fare pubblicità e PR. Contesto: **il cartaceo dei quotidiani è in forte declino** (Corriere ~197mila copie/giorno, Repubblica sotto 100mila), mentre il **digitale wellness cresce** (categoria salute/benessere/nutrizione ~30 mln utenti/mese). Quindi: **budget sul digitale verticale**, cartaceo solo per **prestigio/autorevolezza/testimonial**.

## 7.1 Reach digitale sul verticale (priorità alta)

- **MyPersonalTrainer** (Mondadori) — ~13-14 mln utenti/mese: massima reach salute/fitness/nutrizione.
- **DiLei** (Italiaonline) — leader siti femminili (~4,9 mln/mese), verticale "Take Care".
- **Corriere Salute** (RCS) — reach ampia + autorevolezza + branded content (RCS Studio).
- **Fanpage** — ~1,07 mln utenti/giorno **in crescita**, native data-driven, skew femminile/giovane.
- **TGCom24 – Donne/Benessere** (Mediaset/Publitalia) — verticale dedicato + integrazione TV.
- **Melarossa** — adiacente diretto (dieta personalizzata donne): utile come **benchmark** competitivo.

## 7.2 Autorevolezza / brand-safety (cartaceo + digitale)

- **Starbene** — storica testata benessere femminile (dieta, menopausa).
- **OK Salute e Benessere** (RCS) — autorevolezza medica (specialisti, Fondazione Veronesi come garanzia scientifica).
- **Riza / Salute Naturale** — emotional eating, "dimagrimento e psiche".
- **Repubblica Salute** (GEDI) — reach di massa, media kit dedicato, native via A. Manzoni.

## 7.3 Segmenti "blue ocean" (poco presidiati, alta affinità)

- **Menopausa** (~17 mln di donne in Italia): **Radio Monte Carlo** (profilo 45-64, alta capacità di spesa) e il suo format benessere **RMC DOC**; creator @meno_dieta (Barbara Menozzi), ginecologa Ambra Garretto; podcast *Vamp – Storie di Menopausa*.
- **Neo-mamme**: **QuiMamme**, **Nostrofiglio**, **Pianeta Mamma** (mobile-first); posizionamento **anti-pressione estetica** con ostetriche/fisioterapiste del pavimento pelvico come partner credibili (tema sensibile: la pressione sul "corpo post-parto" ha generato polemiche → tono di cura, non di performance).

## 7.4 Influencer / creator (mid-tier e micro, miglior ROI)

Nutrizione brand-safe: **Paola Stavolone** (~950K, anti-dieta/equilibrio), **Marco Bianchi**, **Edoardo Mocini** (divulgazione scientifica). Fitness femminile: **Traininpink/Carlotta** (ha già una app in abbonamento → competitor o partner ideale), **Cotto al Dente**. Mercato influencer Italia ~€425 mln con spostamento verso mid-tier/micro (più credibilità e ROI delle celebrity).

## 7.5 TV, radio, farmacia (awareness e testimonial)

- **TV femminile**: *Verissimo* (Canale 5, share femminile ~23-24%) per storytelling/testimonial; *Buongiorno Benessere* (Rai 1) per contesto salute credibile.
- **Radio di massa**: RTL 102.5, Radio Italia; **RDS** (skew femminile adulto).
- **Canale farmacia** (dato forte): ~20.000 farmacie, ~4 mln accessi/giorno a prevalenza femminile e orientati alla salute → altamente pertinente. Riviste al banco (*È Magazine*, *Bellezza in Farmacia*), digital signage (contatto diretto: Elo TV, PharmaFulcri, IppoMedia), co-marketing prevenzione salute-donna.

## 7.6 Da evitare / note

- **Evitare** contesti pseudoscientifici (es. "Dieta del Gruppo Sanguigno"): rischio brand.
- **Non vendono spazi adv** ma utili come **partnership editoriale/autorevolezza**: Fondazione Veronesi, Humanitas Salute, IssSalute; *Uppa* (neo-mamme, autorevole, senza pubblicità).
- Prima di impegnare budget cartaceo: chiedere i **media kit** e le diffusioni certificate (i numeri dichiarati dagli editori non sono certificazioni indipendenti).

---

# 8. Come la macchina alimenta le 5 fasi

- **Acquisizione**: ads conformi (§5) + contenuti organici + PR/native (§7) + influencer → lead nel CRM.
- **Nurture lead**: sequenze email/SMS + retargeting conforme, guidate dagli eventi; handoff a Vendite a MQL.
- **Attivazione + Retention**: onboarding, richiesta recensione al primo risultato, contenuti educativi, messaggi da eventi (no check-in → messaggio).
- **Win-back**: app-allert di rientro ("pesati ogni settimana → percorso veloce") come prodotto gratuito + campagne dedicate ai "churn".
- **Automazione**: publisher + lead agent = la macchina che pubblica e raccoglie 24/7, con il Giudice a fare da freno di sicurezza.

---

# 9. KPI e loop di apprendimento

Per fase: **Acquisizione** (CAC, ROAS, lead/giorno), **Nurture** (lead→cliente, tempo di conversione), **Retention** (attivazione a 7gg, churn, aderenza), **Win-back** (riattivati/churn, costo per rientro), trasversali **LTV** e **LTV/CAC**. L'Analista chiude il cerchio: identifica creatività e angoli vincenti, li fa replicare allo Stratega, ritira ciò che non rende. La **memoria** rende la macchina più brava nel tempo (effetto rete sui dati creativi, come il motore della dieta lo è sui menu).

---

# 10. Roadmap di attivazione

1. **Fondamenta** (settimana 1-2): consensi/GDPR, dominio email autenticato e scaldato, Business Manager + verifica, account "puliti", naming standard, ruolo `head_marketing` a sistema.
2. **Giudice + libreria** (settimana 2-4): regole compliance nel Giudice, template di formati, messaggi-pilastro, brand kit.
3. **Motore organico** (mese 2): calendario editoriale, produzione AI + revisione, primi Reel/caroselli/testimonianze.
4. **Acquisizione a pagamento** (mese 2-3): warmup, prime campagne conformi, landing conformi, tracking first-party.
5. **Lifecycle** (mese 3): automazioni nurture/retention/win-back agganciate agli eventi; app-allert di rientro.
6. **Media & PR** (mese 3-4): native sui verticali digitali, influencer mid-tier, test farmacia/menopausa.
7. **Ottimizzazione continua**: l'Analista guida budget e creatività; revisione policy periodica.

---

# 11. Rischi e guardrail

- **Blocco account/campagne** → il Giudice + le best practice §5 sono la difesa; tenere account/domini di riserva e non concentrare tutto su un solo canale.
- **Claim di salute** → sempre supervisione del nutrizionista capo; niente promesse di risultato.
- **GDPR** → consensi granulari, dati sanitari fuori dal marketing, hosting UE.
- **Reputazione** → tono di cura (soprattutto menopausa/post-parto), zero body-shaming, testimonianze reali.
- **Dipendenza dall'AI** → l'umano approva i contenuti sensibili e sorveglia la qualità; l'AI accelera, non decide da sola sui temi delicati.

---

## In una riga

Una **macchina ad agenti AI** che pensa, crea, si autocontrolla (il Giudice), pubblica e raccoglie lead 24/7 lungo le 5 fasi — **conforme** alle policy per non farsi bloccare, **integrata** col prodotto e col CRM, e capace di **imparare**: l'agenzia di marketing più sofisticata *e* più funzionale, costruita su ciò che i concorrenti non hanno (persone vere + AI + trasparenza).

---

### Fonti principali

Policy social: Meta Health & Wellness / Personal Attributes / Cosmetic Procedures (transparency.meta.com); TikTok Weight Management and Body Image (ads.tiktok.com); Google Ads Health in personalized advertising / Healthcare and medicines (support.google.com/adspolicy). Media Italia: Audicom/Audiweb (Nielsen) ranking news nov 2025; Digital News Report Italia 2025 (Reuters Institute); schede editori Mondadori/RCS/GEDI/Italiaonline; Audiradio 2025; Rapporto Federfarma 2025; DeRev report influencer 2025. Elenco URL completo nei report di ricerca allegati al progetto.
