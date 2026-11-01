'use client';

import { useEffect, useRef } from 'react';

import { reportClientError } from '@/lib/error-reporting-client';

/**
 * @description Boundary global de errores de la App Router.
 *
 * Es el último recurso: se activa cuando el fallo no puede contenerlo
 * `src/app/error.tsx` (por ejemplo, un error en el layout raíz). Reemplaza la
 * página completa, por lo que debe renderizar sus propias etiquetas `html` y
 * `body` e incluir estilos propios: los estilos globales de la aplicación no
 * están disponibles en este punto.
 *
 * @module app/global-error
 */

/** @description Props que Next.js inyecta en un boundary de error. */
interface GlobalErrorBoundaryProps {
  /** Error capturado, con `digest` opcional asignado por el servidor. */
  error: Error & { digest?: string };
  /** Reintenta el render del árbol de la aplicación. */
  reset: () => void;
}

/**
 * @description Estilos embebidos: `global-error.tsx` se renderiza fuera del
 * layout raíz, así que no puede depender de las hojas de estilo de la app.
 */
const GLOBAL_ERROR_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #f8fafc;
    color: #0f172a;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 30rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #ffffff;
    padding: 28px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    background: #fee2e2;
    color: #b91c1c;
  }
  h1 { margin: 16px 0 8px; font-size: 1.25rem; font-weight: 600; }
  p { margin: 0 0 16px; color: #475569; font-size: 0.9rem; line-height: 1.5; }
  .digest { font-size: 0.75rem; color: #64748b; margin-bottom: 20px; }
  .digest code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button, a.button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 8px;
    padding: 9px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid transparent;
  }
  button.primary { background: #0f172a; color: #ffffff; }
  button.primary:hover { background: #1e293b; }
  button.secondary { background: #ffffff; color: #0f172a; border-color: #e2e8f0; }
  button.secondary:hover { background: #f1f5f9; }
`;

/**
 * @description Lleva al usuario a la portada con una carga completa de la
 * aplicación. En el boundary global no se usa el router de Next: una
 * navegación del lado del cliente reutilizaría el árbol que acaba de fallar.
 * @returns {void}
 */
function handleGoHome(): void {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- carga completa intencional en el boundary global
  window.location.assign('/');
}

/**
 * @description Pantalla de error global para fallos no contenibles por el
 * boundary de ruta.
 * @param {GlobalErrorBoundaryProps} props - Error capturado y callback de reintento.
 * @returns {JSX.Element} Documento HTML completo con el mensaje de error.
 */
export default function GlobalErrorBoundary({ error, reset }: GlobalErrorBoundaryProps) {
  const reportedRef = useRef<Error | null>(null);

  useEffect(() => {
    if (reportedRef.current === error) return;
    reportedRef.current = error;

    void reportClientError({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="es">
      <head>
        <title>Error inesperado - FinanceMDM</title>
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_ERROR_STYLES }} />
      </head>
      <body>
        <main className="card">
          <span className="icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <h1>No pudimos cargar esta sección</h1>
          <p>
            Ocurrió un error inesperado. El fallo se registró en el servidor para que el
            equipo de soporte pueda revisarlo.
          </p>
          {error.digest && (
            <p className="digest">
              Código de referencia: <code>{error.digest}</code>
            </p>
          )}
          <div className="actions">
            <button type="button" className="primary" onClick={reset}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reintentar
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleGoHome}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Ir al inicio
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
