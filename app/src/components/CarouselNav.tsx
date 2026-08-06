/**
 * Navigazione dei caroselli orizzontali (`.meal-carousel`): pallini cliccabili + frecce.
 *
 * Perché esiste: su telefono il carosello si scorre col dito, ma sul WEB (mouse) la rotellina
 * scorre la pagina in verticale e non c'è alcun modo evidente di passare alla scheda successiva
 * — la barra di scorrimento è nascosta apposta. I pallini erano solo decorativi. Qui diventano
 * pulsanti, e sui dispositivi con mouse compaiono anche due frecce.
 *
 * Con un solo elemento non renderizza nulla: niente pallini, niente frecce, nessuna promessa
 * di scorrimento che poi non si può mantenere.
 */
export function scrollCarouselTo(el: HTMLElement | null, index: number) {
  if (!el) return;
  el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
}

export default function CarouselNav({
  count,
  index,
  onGo,
}: {
  count: number;
  index: number;
  onGo: (index: number) => void;
}) {
  if (count <= 1) return null;
  const at = Math.min(Math.max(index, 0), count - 1);
  return (
    <div className="carousel-nav">
      <button
        type="button"
        className="carousel-arrow"
        aria-label="Scheda precedente"
        disabled={at <= 0}
        onClick={() => onGo(at - 1)}
      >
        <i className="ti ti-chevron-left" />
      </button>
      <div className="home-dots">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            className={i === at ? 'on' : ''}
            aria-label={`Vai alla scheda ${i + 1} di ${count}`}
            aria-current={i === at ? 'true' : undefined}
            onClick={() => onGo(i)}
          />
        ))}
      </div>
      <button
        type="button"
        className="carousel-arrow"
        aria-label="Scheda successiva"
        disabled={at >= count - 1}
        onClick={() => onGo(at + 1)}
      >
        <i className="ti ti-chevron-right" />
      </button>
    </div>
  );
}
