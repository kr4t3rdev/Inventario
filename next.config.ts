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
		formats: ["image/webp"],
		minimumCacheTTL: 60,
		remotePatterns: [],
		unoptimized: true,
	},

	// Nota: Webpack no se usa con Turbopack en Next.js 15
	// Solo usamos configuración de turbopack a través de experimental.turbopack

	// Incluir archivos del engine de Prisma en el output standalone de Next.js.
	// Sin esto, next tracing omite los .node cargados dinámicamente y Vercel falla con 500.
	outputFileTracingIncludes: {
		"/**": ["./src/generated/prisma/**"],
	},

	// Packages that should not be bundled by the server runtime.
	// @prisma/client tiene native bindings (.so.node) que no pueden ser bundleados.
	serverExternalPackages: ["@vercel/blob", "@prisma/client"],

	// Optimizaciones experimentales
	experimental: {
		// Optimizar imports de paquetes grandes
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
	// que corre eslint sobre archivos staged. Ver .husky/pre-commit y lint-staged en package.json.
	// Para habilitar typecheck completo, primero hay que resolver el OOM (ej: --max-old-space-size=8192).
	typescript: {
		ignoreBuildErrors: true,
	},

	// Output optimizado
	output: "standalone",
	outputFileTracingRoot: path.resolve(__dirname),
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
	//
	// Para exportar trazas, configurar las variables de entorno:
	//   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
	//   OTEL_EXPORTER_OTLP_HEADERS=...
	logging: {
		browserToTerminal: true,
	},
};

export default nextConfig;
