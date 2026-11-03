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
import { emitirReconocimientoMerma } from '@/features/contabilidad-formal/services/inventory-adjustment-posting-service';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import type { PostingTx } from '@/features/contabilidad-formal/services/posting-engine';

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
export async function registrarMermaEnTransaccion<
	M extends Record<string, unknown> = { mermaId: string } & Record<string, unknown>,
>(
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

	const mermaId = (creada as Record<string, unknown>).mermaId;
	if (typeof mermaId !== 'string' || mermaId.length === 0) {
		throw new Error(
			'registrarMermaEnTransaccion: la proyección (include/select) debe incluir mermaId',
		);
	}

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
		origenId: mermaId,
		tipoUbicacion: 'almacen',
		ubicacionId: almacenId,
		cantidad: -cantidad,
		costoUnitario,
		secuencia: 'SALIDA-0',
		creadoPorId,
	});

	// Puente legacy: la merma produce su AjusteInventario espejo
	// (documento unificado de valorización; no duplica kardex).
	const ajuste = await tx.ajusteInventario.create({
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
			origenMermaId: mermaId,
			creadoPorId,
		},
	});
	const ajusteRow = ajuste as { id?: unknown; createdAt?: unknown };
	if (typeof ajusteRow.id !== 'string' || ajusteRow.id.length === 0) {
		throw new Error('registrarMermaEnTransaccion: el ajuste debe devolver su id');
	}
	await emitirReconocimientoMerma(tx as unknown as PostingTx, {
		tenantId,
		userId: creadoPorId,
	}, {
		ajusteInventarioId: ajusteRow.id,
		fecha: ajusteRow.createdAt instanceof Date ? ajusteRow.createdAt : new Date(),
		costoTotal: -cantidad * costoUnitario,
	});

	return creada;
}
