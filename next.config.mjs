// @ts-check

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { withSentryConfig } from "@sentry/nextjs/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Desactivar características que ralentizan el build
  productionBrowserSourceMaps: false,
  generateEtags: false,
  poweredByHeader: false,
  compress: true,

  // Optimizaciones de imágenes
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    unoptimized: true,
  },

  // Preserve Prisma runtime files while avoiding platform engines and types on Vercel.
  outputFileTracingIncludes:
    process.env.VERCEL === "1"
      ? {
          "/**": [
            "./src/generated/prisma/**/*.so.node",
            "./src/generated/prisma/**/*.wasm",
            "./src/generated/prisma/**/*.js",
            "./src/generated/prisma/**/*.mjs",
            "./src/generated/prisma/**/*.cjs",
            "./src/generated/prisma/**/*.json",
            "./src/generated/prisma/**/*.prisma",
          ],
        }
      : {
          "/**": ["./src/generated/prisma/**"],
        },
  ...(process.env.VERCEL === "1"
    ? {
        outputFileTracingExcludes: {
          "/**": [
            "./src/generated/prisma/**/*.d.ts",
            "./src/generated/prisma/**/*.dylib.node",
          ],
        },
      }
    : {}),

  // Packages that should not be bundled by the server runtime.
  serverExternalPackages: ["@vercel/blob", "@prisma/client"],

  // Optimizaciones experimentales
  experimental: {
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "jspdf",
      "pdf-lib",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "react-hook-form",
    ],
  },

  // TypeScript
  // NOTA: ignoreBuildErrors: true se mantiene porque tsc --noEmit crashea con segfault
  // (Node OOM, no errores de TS). La compensación es el pre-commit hook con lint-staged
  // que corre eslint sobre archivos staged.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Output optimizado
  output: "standalone",
  outputFileTracingRoot: resolve(__dirname),
  distDir: ".next",
  cleanDistDir: true,

  // Exclusiones de build
  pageExtensions: ["tsx", "ts", "jsx", "js"].filter(
    (ext) => !["unlighthouse.config.ts", "playwright.config.ts"].includes(ext),
  ),

  // Configuración de headers básicos
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [];
  },

  async rewrites() {
    return [];
  },

  // Variables de entorno para el build
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },

  // OpenTelemetry
  // src/instrumentation.ts ya está configurado con @vercel/otel y
  // @prisma/instrumentation para tracing de Server Actions, Route Handlers
  // y queries de base de datos. Ver src/instrumentation.ts y src/lib/tracing.ts.
  logging: {
    browserToTerminal: true,
  },
};

/**
 * Envuelve la config con el plugin de build de Sentry.
 *
 * - En dev no hace nada especial (los errores ya se capturan en runtime).
 * - En build de producción sube source maps a Sentry para stack traces
 *   legibles (requiere SENTRY_AUTH_TOKEN en el entorno de CI/Vercel).
 * - Org y project son los slugs de la URL de Sentry:
 *   sentry.io/organizations/<org>/projects/<project>/
 */
export default withSentryConfig(nextConfig, {
  // Slugs de la organización y del proyecto en Sentry.
  // Se leen del entorno (Railway) para no fijarlos en el repositorio:
  //   SENTRY_ORG     -> sentry.io/organizations/<slug>/
  //   SENTRY_PROJECT -> sentry.io/organizations/<org>/projects/<slug>/
  // Sin estas variables el SDK sigue reportando errores (usa la DSN), pero el
  // plugin no sube los source maps.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Token de autenticación para subir source maps en CI (no es necesario en local)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Silencia el log del plugin en builds locales (ruidoso)
  silent: !process.env.CI,

  // Amplía el upload de artifacts del cliente para mejores stack traces
  widenClientFileUpload: true,

  // Elimina el logger de Sentry del bundle del cliente
  disableLogger: true,
});
