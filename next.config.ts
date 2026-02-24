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
  
  // Configuración de webpack optimizada
  webpack: (config, { isServer, dev }) => {
    if (!dev) {
      // Desactivar completamente los mapas fuente
      config.devtool = false;

      // Caché de webpack persistida con ruta absoluta
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [path.resolve(process.cwd(), 'next.config.ts')],
        },
        cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      };

      // Limitar workers para evitar sobrecarga
      config.parallelism = 2;

      // Optimizaciones de performance
      config.performance = {
        hints: false,
      };
    }

    // Excluir directorio e2e del build
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.ts$/,
      exclude: [/node_modules/, /e2e/],
    });

    return config;
  },
  
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
  
  // ESLint y TypeScript
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
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
};

export default nextConfig;
