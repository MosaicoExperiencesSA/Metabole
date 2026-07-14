/**
 * Snapshot del catalogo vignette del socio (marketing/vignette/catalogo_vignette.json),
 * incorporato come modulo così è sempre disponibile a runtime (nessun file/asset da copiare).
 * Usato da PublisherService.importFromCatalog() per creare le bozze dei post.
 * NB: è una fotografia — se il socio aggiorna il catalogo, va riallineato questo file.
 */
export interface VignetteItem {
  collectionId: string;
  channel: string;
  caption: string;
  hashtags: string[];
  imageRef: string;
  imageSource: string; // canva | png_locale
}

export const VIGNETTE_CATALOG: VignetteItem[] = [
  {
    collectionId: "persona.maria_matrimonio",
    channel: "instagram",
    caption:
      "C'e un giorno che non vuoi guardare da fuori: vuoi viverlo in pieno. Il percorso non e una dieta e non ti giudica - persone vere al tuo fianco, un passo alla volta.",
    hashtags: ["#benessere", "#percorsobenessere", "#personevere", "#nonèunadieta", "#metaboleai"],
    imageRef: "DAHPU2XhIr4",
    imageSource: "canva",
  },
  {
    collectionId: "persona.menopausa",
    channel: "instagram",
    caption:
      "La menopausa non e un traguardo da subire: e una fase che merita cura ed energia. Un percorso pensato per te, seguito da professionisti veri.",
    hashtags: ["#menopausa", "#benesseredonna", "#over50", "#nutrizione", "#metaboleai"],
    imageRef: "DAHPUxBwCGU",
    imageSource: "canva",
  },
  {
    collectionId: "persona.post_gravidanza",
    channel: "instagram",
    caption:
      "Prendersi cura di se dopo essere diventata mamma non e egoismo: e ripartire con dolcezza, con i tuoi tempi e persone vere accanto.",
    hashtags: ["#postgravidanza", "#mammereali", "#benesseredonna", "#percorso", "#metaboleai"],
    imageRef: "DAHPUwFsTX0",
    imageSource: "canva",
  },
  {
    collectionId: "persona.rientro_vacanze",
    channel: "instagram",
    caption:
      "Settembre non e una punizione. Si riparte con dolcezza, di stagione, senza fretta - e con qualcuno che riparte insieme a te.",
    hashtags: ["#rientro", "#settembre", "#benessere", "#stagionalità", "#metaboleai"],
    imageRef: "DAHPU9cMOrQ",
    imageSource: "canva",
  },
  {
    collectionId: "persona.giornata_storta",
    channel: "instagram",
    caption:
      "Le giornate storte capitano. Non cancellano il percorso: si respira, si riparte domani, senza sensi di colpa. Perche qui conti tu, non solo i numeri.",
    hashtags: ["#benesserementale", "#selfcare", "#percorso", "#metaboleai"],
    imageRef: "DAHPU2-mFck",
    imageSource: "canva",
  },
  {
    collectionId: "forza.persone_vere_ai",
    channel: "instagram",
    caption:
      "Il meglio dei due mondi: la tecnologia che ti semplifica la vita e le persone vere che non ti mollano. Coach, nutrizionista e Gaia, insieme per te.",
    hashtags: ["#personevere", "#ai", "#coach", "#nutrizionista", "#metaboleai"],
    imageRef: "DAHPVIBkYbo",
    imageSource: "canva",
  },
  {
    collectionId: "forza.su_misura",
    channel: "instagram",
    caption:
      "Niente piani copia-incolla. Il tuo percorso e filtrato su gusti, allergie, eventi e giornate - unico come te.",
    hashtags: ["#sumisura", "#dietapersonalizzata", "#benessere", "#metaboleai"],
    imageRef: "DAHPVP5OAc0",
    imageSource: "canva",
  },
  {
    collectionId: "app.schermate_reali",
    channel: "instagram",
    caption:
      "Guarda chi c'e nel tuo percorso: coach e nutrizionista veri, piu Gaia l'assistente AI. Sempre a portata di messaggio.",
    hashtags: ["#app", "#coach", "#nutrizionista", "#ai", "#metaboleai"],
    imageRef: "app-screens/app_contatti.png",
    imageSource: "png_locale",
  },
];
