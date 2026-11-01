"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, type JSX } from "react";

interface GlobalErrorProps {
  /** Error capturado por el boundary (puede incluir `digest` de Next.js) */
  error: Error & { digest?: string };
  /** Callback de Next.js para intentar re-renderizar el segmento */
  reset: () => void;
}

/**
 * @description Error boundary global de Next.js. Captura errores que
 * escapan de todos los demás boundaries (incluyendo errores en el layout
 * raíz) y los reporta a Sentry.
 *
 * Next.js renderiza este componente en lugar del layout raíz, por lo que
 * debe definir su propio <html> y <body>.
 *
 * @param {GlobalErrorProps} props - Error capturado y callback de reintento
 * @returns {JSX.Element} Página de error con opción de reintentar
 */
export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#09090b",
          color: "#fafafa",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Algo salió mal
        </h1>
        <p style={{ color: "#a1a1aa", maxWidth: "28rem", textAlign: "center" }}>
          Ocurrió un error inesperado. El equipo ya fue notificado
          automáticamente.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
