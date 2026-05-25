import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Desactivar características que ralentizan el build
  productionBrowserSourceMaps: false,
  generateEtags: false,
  poweredByHeader: false,
  compress: true,
  
  // Optimizaciones de imágenes
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [],
    unoptimized: true,
  },
  
  // Nota: Webpack no se usa con Turbopack en Next.js 15
  // Solo usamos configuración de turbopack a través de experimental.turbopack

  // Incluir archivos del engine de Prisma en el output standalone de Next.js.
  // Sin esto, next tracing omite los .node cargados dinámicamente y Vercel falla con 500.
  outputFileTracingIncludes: {
    '/**': ['./src/generated/prisma/**'],
  },
  
  // Packages that should not be bundled by the server runtime
  serverExternalPackages: ['@vercel/blob'],

  // Optimizaciones experimentales
  experimental: {
    // Optimizar imports de paquetes grandes
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'jspdf',
      'pdf-lib',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      'react-hook-form',
    ],
  },
  
  // TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Output optimizado
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  distDir: '.next',
  cleanDistDir: true,
  
  // Exclusiones de build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].filter((ext) => 
    !['unlighthouse.config.ts', 'playwright.config.ts'].includes(ext)
  ),
  
  // Configuración de headers básicos
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
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
    NEXT_TELEMETRY_DISABLED: '1',
  },

  // Developer Experience Logging
  // Forwardea logs del browser a la terminal durante desarrollo para mejor visibilidad
  // durante debugging. Este es un nivel intermedio que maximiza señal/ruido sin
  // introducir observabilidad completa (OpenTelemetry/instrumentation.ts aún no).
  //
  // Next escalation path (cuando sea necesario):
  // Si terminal logging no es suficiente para diagnosticar problemas complejos,
  // el siguiente paso es crear `src/instrumentation.ts` con OpenTelemetry y exporters
  // para tracing distribuido y métricas. Ese nivel proporciona observabilidad completa
  // pero requiere setup más pesado (SDK init, trace exporters, etc.).
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
