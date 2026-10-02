import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Qué se estaba mostrando, para el mensaje. */
  label: string;
  /** Acción extra además de recargar (ej.: volver a la vista 2D). */
  fallbackAction?: { text: string; run: () => void };
  children: ReactNode;
}

/** Evita la pantalla en blanco: si algo falla al dibujar, muestra el error y cómo seguir. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Tras publicar una versión nueva, una pestaña que quedó abierta pide archivos que ya no existen.
    const stale = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading/i.test(error.message);
    const button = 'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500';
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center text-slate-100" role="alert">
        <h2 className="text-lg font-semibold">No se pudo mostrar {this.props.label}</h2>
        <p className="max-w-md text-sm text-slate-300">
          {stale ? 'Hay una versión nueva del sitio y esta pestaña quedó con la anterior. Recarga la página; tu estrategia está guardada.' : 'Ocurrió un error al dibujar. Tu estrategia está guardada.'}
        </p>
        <code className="max-w-md break-words rounded bg-slate-800 px-2 py-1 text-xs text-amber-200">{error.message}</code>
        <div className="flex gap-2">
          <button className={button} onClick={() => location.reload()}>Recargar la página</button>
          {this.props.fallbackAction && (
            <button className={`${button} bg-slate-600 hover:bg-slate-500`} onClick={() => { this.props.fallbackAction!.run(); this.setState({ error: null }); }}>
              {this.props.fallbackAction.text}
            </button>
          )}
        </div>
      </div>
    );
  }
}
