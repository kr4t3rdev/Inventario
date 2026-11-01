/**
 * @description Loader de Node que resuelve los modulos de Next.js que exigen
 * contexto de request hacia stubs equivalentes, permitiendo ejecutar Server
 * Actions reales desde un script operativo.
 *
 * Uso:
 *   node --import tsx --import ./scripts/ops/runtime/register.mjs <script.ts>
 */
const STUBS = {
	'next/headers': new URL('./next-headers.stub.mjs', import.meta.url).href,
	'next/cache': new URL('./next-cache.stub.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
	const stub = STUBS[specifier];
	if (stub) {
		return { url: stub, shortCircuit: true, format: 'module' };
	}
	return nextResolve(specifier, context);
}
