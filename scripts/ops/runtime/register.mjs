import { registerHooks } from 'node:module';

/**
 * @description Hooks sincronos de Node (>=22.15) que resuelven los modulos de
 * Next.js que exigen contexto de request hacia stubs equivalentes, de modo
 * que un script operativo pueda ejecutar Server Actions reales.
 *
 * Se usan hooks sincronos (y no `module.register`) porque tsx transpila el
 * proyecto a CommonJS: el loader ESM no intercepta `require()`.
 */
const STUBS = {
	'next/headers': new URL('./next-headers.stub.mjs', import.meta.url).href,
	'next/cache': new URL('./next-cache.stub.mjs', import.meta.url).href,
};

registerHooks({
	resolve(specifier, context, nextResolve) {
		const stub = STUBS[specifier];
		if (stub) {
			return { url: stub, shortCircuit: true, format: 'module' };
		}
		return nextResolve(specifier, context);
	},
});
