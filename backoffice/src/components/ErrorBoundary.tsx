import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * Confine di errore globale del backoffice: un errore di rendering non azzera più tutta
 * l'interfaccia (schermo bianco). Mostra un messaggio con "Ricarica".
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 380 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Qualcosa è andato storto</h2>
          <p style={{ color: '#5F6E6B', fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' }}>
            Ricarica la pagina. Se il problema resta, segnalalo indicando cosa stavi facendo.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#12A386', color: '#fff', border: 0, borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Ricarica
          </button>
        </div>
      </div>
    );
  }
}
