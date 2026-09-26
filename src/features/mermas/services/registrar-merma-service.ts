/**
 * @description Núcleo compartido del alta de merma dentro de una transacción
 * Prisma. Es el ÚNICO punto donde se escriben los efectos derivados de una
 * merma: registro (con autoría), decremento de stock por ubicación, kardex
 * idempotente (`StockMoveLine` secuencia `SALIDA-0`) y el espejo legacy
 * `AjusteInventario` (documento unificado de valorización). Tanto
 * `createMermaAction` (escritorio) como `POST /api/mobile/mermas` delegan
 * aquí, de modo que ningún canal pueda volver a divergir; los efectos
 * posteriores (p. ej. el evento contable de la capa formal) se enganchan en
 * este punto único y cubren ambos canales.
 *
 * @module features/mermas/services/registrar-merma-service
 */
import { mapearMotivoLegacy, registrarMovimiento } from '@/features/inventario/movimientos';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';

/** Parámetros de negocio del alta de merma (validados por el llamador). */
export interface RegistrarMermaParams {
	tenantId: string;
	productoId: string;
	cantidad: number;
	motivo: string | null;
	almacenId: string;
	creadoPorId: string;
	/** Costo unitario vigente del producto al momento de la merma. */
	costoUnitario: number;
	/** `cantidadDisponible` de la ubicación antes del decremento (para el espejo). */
	stockDisponibleAntes: number;
}

/** Opciones de proyección que se propagan al `merma.create`. */
export interface RegistrarMermaCreateOptions {
	include?: Record<string, unknown>;
	select?: Record<string, unknown>;
}

type MermaTx = Parameters<typeof registrarMovimiento>[0] & {
	merma: { create: (args: Record<string, unknown>) => Promise<unknown> };
	ajusteInventario: { create: (args: Record<string, unknown>) => Promise<unknown> };
};

/**
 * @description Registra una merma y todos sus efectos derivados dentro de la
 * transacción recibida.
 * @param {MermaTx} tx - Cliente de transacción Prisma.
 * @param {RegistrarMermaParams} params - Datos de la merma ya validados.
 * @param {RegistrarMermaCreateOptions} createOptions - include/select para el create.
 * @returns {Promise<M>} Fila de merma creada proyectada según createOptions.
 */
export async function registrarMermaEnTransaccion<M = Record<string, unknown>>(
	tx: MermaTx,
	params: RegistrarMermaParams,
	createOptions: RegistrarMermaCreateOptions = {},
): Promise<M> {
	const { tenantId, productoId, cantidad, motivo, almacenId, creadoPorId, costoUnitario, stockDisponibleAntes } =
		params;

	const creada = (await tx.merma.create({
		data: {
			productoId,
			cantidad,
			motivo,
			costoTotal: costoUnitario * cantidad,
			tenantId,
			almacenId,
			creadoPorId,
		},
		...(createOptions.include !== undefined && { include: createOptions.include }),
		...(createOptions.select !== undefined && { select: createOptions.select }),
	})) as M;

	await upsertStockUbicacion(tx as Parameters<typeof upsertStockUbicacion>[0], {
		tenantId,
		productoId,
		tipoUbicacion: 'almacen',
		ubicacionId: almacenId,
		modo: 'increment',
		delta: -cantidad,
	});

	await registrarMovimiento(tx, {
		tenantId,
		productoId,
		tipoOrigen: 'MERMA',
		origenId: String((creada as Record<string, unknown>).mermaId),
		tipoUbicacion: 'almacen',
		ubicacionId: almacenId,
		cantidad: -cantidad,
		costoUnitario,
		secuencia: 'SALIDA-0',
		creadoPorId,
	});

	// Puente legacy: la merma produce su AjusteInventario espejo
	// (documento unificado de valorización; no duplica kardex).
	await tx.ajusteInventario.create({
		data: {
			tenantId,
			productoId,
			tipoUbicacion: 'almacen',
			ubicacionId: almacenId,
			motivo: mapearMotivoLegacy(motivo),
			cantidadTeorica: stockDisponibleAntes,
			cantidadContada: stockDisponibleAntes - cantidad,
			diferencia: -cantidad,
			costoUnitario,
			costoTotal: -cantidad * costoUnitario,
			estado: 'APLICADO',
			origenMermaId: String((creada as Record<string, unknown>).mermaId),
			creadoPorId,
		},
	});

	return creada;
}
