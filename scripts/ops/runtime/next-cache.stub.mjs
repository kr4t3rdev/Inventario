/**
 * @description Stub de `next/cache` para scripts operativos: fuera del runtime
 * de Next.js `revalidatePath` no tiene sentido (solo refresca la UI), asi que
 * se convierte en un no-op. La transaccion de base de datos ya ocurrio.
 */
export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_cache(fn) {
	return fn;
}
export function unstable_noStore() {}
export function cacheTag() {}
export function cacheLife() {}
export const unstable_expirePath = revalidatePath;
export const unstable_expireTag = revalidateTag;
