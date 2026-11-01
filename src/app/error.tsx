'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/error-reporting-client';

/**
 * @description Boundary de errores de la App Router a nivel de `src/app`.
 *
 * Atrapa los fallos de render de los segmentos hijos (Server Components y
 * Client Components) y los muestra con un mensaje accionable en lugar del
 * error genérico "This page couldn't load" de Next.js. El error se reenvía al
 * log del servidor mediante `POST /api/errors`.
 *
 * @module app/error
 */

/** @description Props que Next.js inyecta en un boundary de error. */
interface ErrorBoundaryProps {
  /** Error capturado, con `digest` opcional asignado por el servidor. */
  error: Error & { digest?: string };
  /** Reintenta el render del segmento que falló. */
  reset: () => void;
}

/**
 * @description Pantalla de error recuperable para fallos de render de la ruta.
 * @param {ErrorBoundaryProps} props - Error capturado y callback de reintento.
 * @returns {JSX.Element} Mensaje de error con acciones de reintento y salida.
 */
export default function AppErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const reportedRef = useRef<Error | null>(null);

  useEffect(() => {
    // En desarrollo React ejecuta los efectos dos veces (StrictMode): el ref
    // evita enviar el mismo error dos veces al log del servidor.
    if (reportedRef.current === error) return;
    reportedRef.current = error;

    // Reporte a Sentry (alertas y trazas) y al log del servidor via
    // /api/errors. Ambos son best-effort: no deben interferir con el manejo
    // del error original, que ya esta a cargo del boundary.
    Sentry.captureException(error, {
      tags: { boundary: 'app-error' },
    });

    void reportClientError({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-5 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-destructive/10 p-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">No pudimos cargar esta sección</h1>
            <p className="text-sm text-muted-foreground">
              Ocurrió un error inesperado. El fallo se registró en el servidor para que el
              equipo de soporte pueda revisarlo.
            </p>
          </div>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Código de referencia: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Ir al inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
