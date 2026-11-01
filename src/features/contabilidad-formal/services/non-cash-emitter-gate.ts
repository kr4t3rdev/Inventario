/**
 * @description Gate de rollout del emisor formal no Cash (COBRO_CXC / PAGO_CXP).
 *
 * La capa formal global ya esta activa en todos los planes (flag
 * `contabilidad-formal`), pero los emisores de liquidacion CxC/CxP se activan
 * por separado y con su propio modo, para poder observar la evidencia antes
 * de exigir el asiento:
 *
 *   off      -> no se emite nada (por defecto; comportamiento inerte).
 *   shadow   -> se registra la evidencia simulada en la outbox, sin asientos.
 *   enforce  -> se exige el asiento formal (falla cerrado ante anomalias).
 *
 * La variable de entorno `CONTABILIDAD_FORMAL_NO_CASH_MODE` controla el modo.
 * El flag de licencia `contabilidad-formal` sigue siendo condicion necesaria
 * dentro del motor: sin el, ningun evento se contabiliza.
 */

/** Modos soportados por el emisor no Cash. */
export type ModoEmisorNoCash = 'off' | 'shadow' | 'enforce';

/** Nombre de la variable de entorno que gobierna el emisor no Cash. */
export const ENV_MODO_EMISOR_NO_CASH = 'CONTABILIDAD_FORMAL_NO_CASH_MODE';

/**
 * @description Resuelve el modo efectivo del emisor no Cash.
 * @param {NodeJS.ProcessEnv | undefined} env - Entorno a inspeccionar (inyectable en tests).
 * @returns {ModoEmisorNoCash} Modo configurado; `off` si no hay valor valido.
 */
export function resolveModoEmisorNoCash(env?: NodeJS.ProcessEnv): ModoEmisorNoCash {
	const valor = (env ?? process.env)[ENV_MODO_EMISOR_NO_CASH];
	if (typeof valor !== 'string') return 'off';
	const normalizado = valor.trim().toLowerCase();
	if (normalizado === 'shadow' || normalizado === 'enforce') return normalizado;
	return 'off';
}

/**
 * @description Indica si el emisor no Cash debe ejecutar el posteo formal.
 * @param {NodeJS.ProcessEnv | undefined} env - Entorno a inspeccionar (inyectable en tests).
 * @returns {boolean} True si el modo es `shadow` o `enforce`.
 */
export function emisorNoCashActivo(env?: NodeJS.ProcessEnv): boolean {
	return resolveModoEmisorNoCash(env) !== 'off';
}
