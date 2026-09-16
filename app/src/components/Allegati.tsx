import { useEffect, useRef, useState } from 'react';
import { App as AppNativa } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  ACCETTA_ALLEGATI,
  type AllegatoDaInviare,
  type AllegatoRicevuto,
  LATO_MASSIMO_FOTO,
  allegatiPossibili,
  fotoDaRidurre,
  pesoDetto,
  problemaAllegato,
  tipoDelFile,
  nomeCorto,
} from '../lib/allegati';

/**
 * ⛔ **ALLEGARE UN FILE IN CHAT — un pezzo solo per le tre chat dell'app** (Simone, 16/9: *«nelle
 * chat tutte, anche quella del Nutrizionista»*): il foglio chat della home, la pagina chat della
 * cliente e la chat di coach e nutrizioniste. Come per la ✕ di «chi scrive può cancellare», una
 * regola che vive in un posto solo non può dire due cose diverse in due schermate.
 *
 * ⚠️ Non su Gaia: non legge i file. Lo decidono le schermate (non mostrano il pulsante sul suo
 * thread) e, comunque, il server (che rifiuta).
 */

/** Se su questo telefono il pulsante si può mostrare. Vedi `IOS_ALLEGATI_DALLA_VERSIONE`. */
export function useAllegatiPossibili(): boolean {
  const piattaforma = Capacitor.getPlatform();
  const [ok, setOk] = useState(() => piattaforma !== 'ios' || !Capacitor.isNativePlatform());
  useEffect(() => {
    if (piattaforma !== 'ios' || !Capacitor.isNativePlatform()) return;
    let vivo = true;
    AppNativa.getInfo()
      .then((i) => { if (vivo) setOk(allegatiPossibili('ios', i.version)); })
      .catch(() => { if (vivo) setOk(false); });
    return () => { vivo = false; };
  }, [piattaforma]);
  return ok;
}

function comeBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Una foto grande diventa un JPEG da 2000 px di lato lungo. ⚠️ Se qualcosa va storto (il browser non
 * sa disegnarla) si manda l'originale: meglio una foto pesante di una foto persa.
 */
async function ridotta(file: File): Promise<{ blob: Blob; nome: string; tipo: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const lato = Math.max(img.naturalWidth, img.naturalHeight);
    if (!fotoDaRidurre(file.type, file.size, lato)) return { blob: file, nome: file.name, tipo: file.type };
    const scala = Math.min(1, LATO_MASSIMO_FOTO / lato);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scala);
    c.height = Math.round(img.naturalHeight * scala);
    const g = c.getContext('2d');
    if (!g) return { blob: file, nome: file.name, tipo: file.type };
    // Sfondo bianco: un PNG trasparente diventato JPEG avrebbe lo sfondo nero.
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return { blob: file, nome: file.name, tipo: file.type };
    return { blob, nome: file.name.replace(/\.[^.]+$/, '') + '.jpg', tipo: 'image/jpeg' };
  } catch {
    return { blob: file, nome: file.name, tipo: file.type };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Legge il file scelto e lo prepara per l'invio. Lancia un `Error` con la frase da mostrare. */
export async function preparaAllegato(file: File): Promise<AllegatoDaInviare> {
  const tipo = tipoDelFile(file.name, file.type);
  if (!file.size) throw new Error('Il file è vuoto.');
  // Qui solo il TIPO: il peso si guarda dopo, perché una foto grande si rimpicciolisce.
  const primo = problemaAllegato(tipo, 1);
  if (primo) throw new Error(primo);
  const r = tipo.startsWith('image/') ? await ridotta(new File([file], file.name, { type: tipo })) : { blob: file, nome: file.name, tipo };
  const problema = problemaAllegato(r.tipo, r.blob.size);
  if (problema) throw new Error(problema);
  return { nome: nomeCorto(r.nome), tipo: r.tipo, base64: await comeBase64(r.blob), peso: r.blob.size };
}

/** La graffetta: apre la scelta del file e restituisce l'allegato pronto (o l'errore da dire). */
export function BottoneAllega({
  onPronto,
  onErrore,
  disabilitato,
  className,
  style,
}: {
  onPronto: (a: AllegatoDaInviare) => void;
  onErrore: (frase: string) => void;
  disabilitato?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [leggo, setLeggo] = useState(false);
  return (
    <>
      <input
        ref={campo}
        type="file"
        accept={ACCETTA_ALLEGATI}
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          // ⚠️ Si svuota subito: scegliendo di nuovo lo STESSO file, senza, non partirebbe niente.
          e.target.value = '';
          if (!f) return;
          setLeggo(true);
          try {
            onPronto(await preparaAllegato(f));
          } catch (err) {
            onErrore(err instanceof Error ? err.message : 'Non riesco a leggere il file.');
          } finally {
            setLeggo(false);
          }
        }}
      />
      <button
        type="button"
        className={className}
        style={style}
        aria-label="Allega un file"
        title="Allega un file"
        disabled={disabilitato || leggo}
        onClick={() => campo.current?.click()}
      >
        <i className={leggo ? 'ti ti-loader-2' : 'ti ti-paperclip'} />
      </button>
    </>
  );
}

/** Il file scelto e non ancora mandato, con la ✕ per toglierlo. */
export function AllegatoInAttesa({ allegato, onTogli }: { allegato: AllegatoDaInviare; onTogli: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', margin: '6px 0',
        borderRadius: 12, background: 'rgba(18,163,134,.08)', fontSize: 12.5,
      }}
    >
      <i className={allegato.tipo.startsWith('image/') ? 'ti ti-photo' : 'ti ti-file'} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {allegato.nome}
      </span>
      <span style={{ opacity: 0.6 }}>{pesoDetto(allegato.peso)}</span>
      <button type="button" aria-label="Togli l'allegato" onClick={onTogli} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
        <i className="ti ti-x" />
      </button>
    </div>
  );
}

/**
 * Gli allegati dentro una bolla: le foto si vedono, gli altri file si aprono.
 * ⚠️ Il link apre FUORI dall'app (sul telefono il sistema sceglie con cosa): un PDF dentro la
 * webview non ha un «indietro».
 */
export function AllegatiInBolla({ allegati }: { allegati?: AllegatoRicevuto[] | null }) {
  if (!allegati?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
      {allegati.map((a) =>
        a.immagine ? (
          /*
            ⚠️ **Altezza fissa** (revisione, 16/9): una foto senza misura spinge giù la conversazione
            quando arriva, e l'ultimo messaggio — su cui la chat si apre — finiva tagliato. E niente
            `lazy`: sono proprio le ultime a dover esserci subito.
          */
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.fileName} style={{ display: 'block', height: 200 }}>
            <img
              src={a.url}
              alt={a.fileName}
              style={{ display: 'block', height: 200, maxWidth: '100%', borderRadius: 10, objectFit: 'cover' }}
            />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 10,
              background: 'rgba(0,0,0,.06)', color: 'inherit', textDecoration: 'none', fontSize: 12.5,
            }}
          >
            <i className={a.mimeType === 'application/pdf' ? 'ti ti-file-type-pdf' : 'ti ti-file-download'} style={{ fontSize: 18 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</span>
            <span style={{ opacity: 0.7 }}>{pesoDetto(a.sizeBytes)}</span>
          </a>
        ),
      )}
    </div>
  );
}
