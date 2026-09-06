/**
 * @description Backfill idempotente del kardex a partir de los documentos
 * históricos (ventas, compras, transferencias, mermas, producción).
 * Gracias a la clave de evento (`eventoKey`), re-ejecutarlo no duplica líneas.
 *
 * Ejecutar: DATABASE_URL=... npx tsx prisma/scripts/backfill-stock-move.ts [tenantId]
 */
import { PrismaClient } from '../../src/generated/prisma';
import {
	registrarMovimiento,
	type TipoMovimientoInventario,
} from '../../src/features/inventario/movimientos';
import {
	calcularCantidadRequeridaMaterial,
} from '../../src/lib/utils/produccion';

const prisma = new PrismaClient();

interface ResumenBackfill {
	ventas: number;
	compras: number;
	transferencias: number;
	mermas: number;
	produccion: number;
	errores: string[];
}

export async function backfillStockMoves(
	tenantId?: string,
): Promise<ResumenBackfill> {
	const resumen: ResumenBackfill = {
		ventas: 0,
		compras: 0,
		transferencias: 0,
		mermas: 0,
		produccion: 0,
		errores: [],
	};

	const whereTenant = tenantId ? { tenantId } : {};

	// 1. Ventas (items modernos + legacy de columna única)
	const ventasItems = await prisma.ventaItem.findMany({
		where: { venta: { ...whereTenant, deletedAt: null } },
		include: {
			producto: { select: { id: true, precioCosto: true, almacenId: true } },
			venta: { select: { ventaId: true, tenantId: true, puntoDeVentaId: true } },
		},
		orderBy: { createdAt: 'asc' },
	});
	for (const [idx, item] of ventasItems.entries()) {
		try {
			await registrarMovimiento(prisma as never, {
				tenantId: item.venta.tenantId,
				productoId: item.productoId,
				tipoOrigen: 'VENTA' as TipoMovimientoInventario,
				origenId: item.venta.ventaId,
				tipoUbicacion: 'punto_venta',
				ubicacionId: item.venta.puntoDeVentaId,
				cantidad: -item.cantidad,
				costoUnitario: item.producto.precioCosto,
				secuencia: `ITEM-${idx}`,
			});
			resumen.ventas++;
		} catch (error) {
			resumen.errores.push(`VENTA ${item.venta.ventaId}: ${(error as Error).message}`);
		}
	}

	// 2. Compras (ítems de documento)
	const compraItems = await prisma.compraDocumentoItem.findMany({
		where: { compraDocumento: { ...whereTenant, deletedAt: null } },
		include: {
			producto: { select: { id: true, almacenId: true } },
			compraDocumento: { select: { compraDocumentoId: true, tenantId: true } },
		},
		orderBy: { createdAt: 'asc' },
	});
	for (const [idx, item] of compraItems.entries()) {
		if (!item.producto.almacenId) continue;
		try {
			await registrarMovimiento(prisma as never, {
				tenantId: item.compraDocumento.tenantId,
				productoId: item.productoId,
				tipoOrigen: 'COMPRA',
				origenId: item.compraDocumento.compraDocumentoId,
				tipoUbicacion: 'almacen',
				ubicacionId: item.producto.almacenId,
				cantidad: item.cantidad,
				costoUnitario: item.precioUnitario,
				secuencia: `ITEM-${idx}`,
			});
			resumen.compras++;
		} catch (error) {
			resumen.errores.push(
				`COMPRA ${item.compraDocumento.compraDocumentoId}: ${(error as Error).message}`,
			);
		}
	}

	// 3. Transferencias completadas
	const transferencias = await prisma.transferencia.findMany({
		where: { ...whereTenant, deletedAt: null, estado: 'COMPLETADA' },
		include: { producto: { select: { id: true, precioCosto: true } } },
		orderBy: { createdAt: 'asc' },
	});
	for (const t of transferencias) {
		const costo = t.costoUnitario ?? t.producto.precioCosto;
		const origen = t.origenId
			? { tipoUbicacion: 'almacen', ubicacionId: t.origenId }
			: t.puntoDeVentaOrigenId
				? { tipoUbicacion: 'punto_venta', ubicacionId: t.puntoDeVentaOrigenId }
				: null;
		const destino = t.destinoId
			? { tipoUbicacion: 'almacen', ubicacionId: t.destinoId }
			: t.puntoDeVentaDestinoId
				? { tipoUbicacion: 'punto_venta', ubicacionId: t.puntoDeVentaDestinoId }
				: null;
		if (!origen || !destino) continue;
		try {
			await registrarMovimiento(prisma as never, {
				tenantId: t.tenantId,
				productoId: t.productoId,
				tipoOrigen: 'TRANSFERENCIA',
				origenId: t.transferenciaId,
				tipoUbicacion: origen.tipoUbicacion,
				ubicacionId: origen.ubicacionId,
				cantidad: -t.cantidad,
				costoUnitario: costo,
				secuencia: 'SALIDA-0',
			});
			await registrarMovimiento(prisma as never, {
				tenantId: t.tenantId,
				productoId: t.productoId,
				tipoOrigen: 'TRANSFERENCIA',
				origenId: t.transferenciaId,
				tipoUbicacion: destino.tipoUbicacion,
				ubicacionId: destino.ubicacionId,
				cantidad: t.cantidad,
				costoUnitario: costo,
				secuencia: 'ENTRADA-0',
			});
			resumen.transferencias += 2;
		} catch (error) {
			resumen.errores.push(
				`TRANSFERENCIA ${t.transferenciaId}: ${(error as Error).message}`,
			);
		}
	}

	// 4. Mermas
	const mermas = await prisma.merma.findMany({
		where: whereTenant,
		include: { producto: { select: { precioCosto: true, almacenId: true } } },
		orderBy: { createdAt: 'asc' },
	});
	for (const merma of mermas) {
		const almacenId = merma.almacenId ?? merma.producto.almacenId;
		if (!almacenId) continue;
		try {
			await registrarMovimiento(prisma as never, {
				tenantId: merma.tenantId,
				productoId: merma.productoId,
				tipoOrigen: 'MERMA',
				origenId: merma.mermaId,
				tipoUbicacion: 'almacen',
				ubicacionId: almacenId,
				cantidad: -merma.cantidad,
				costoUnitario: merma.producto.precioCosto,
				secuencia: 'SALIDA-0',
			});
			resumen.mermas++;
		} catch (error) {
			resumen.errores.push(`MERMA ${merma.mermaId}: ${(error as Error).message}`);
		}
	}

	// 5. Producción: consumo en órdenes activas/completadas e ingreso en completadas
	const ordenes = await prisma.ordenProduccion.findMany({
		where: { ...whereTenant, estado: { in: ['EN_PROCESO', 'COMPLETADA'] } },
		include: {
			Receta: {
				include: {
					RecetaIngrediente: true,
					Producto: { select: { id: true, almacenId: true } },
				},
			},
		},
	});
	for (const orden of ordenes) {
		for (const [idx, ingrediente] of orden.Receta.RecetaIngrediente.entries()) {
			const productoIng = await prisma.producto.findUnique({
				where: { id: ingrediente.productoId },
				select: { almacenId: true, precioCosto: true },
			});
			if (!productoIng?.almacenId) continue;
			const cantidad = calcularCantidadRequeridaMaterial(
				{
					productoId: ingrediente.productoId,
					cantidad: ingrediente.cantidad,
					unidadSimbolo: ingrediente.unidadSimbolo,
					desperdicio: ingrediente.desperdicio,
				},
				orden.cantidad,
			);
			try {
				await registrarMovimiento(prisma as never, {
					tenantId: orden.tenantId,
					productoId: ingrediente.productoId,
					tipoOrigen: 'PRODUCCION',
					origenId: orden.ordenProduccionId,
					tipoUbicacion: 'almacen',
					ubicacionId: productoIng.almacenId,
					cantidad: -Math.round(cantidad),
					costoUnitario: productoIng.precioCosto,
					secuencia: `ING-${idx}`,
				});
				resumen.produccion++;
			} catch (error) {
				resumen.errores.push(
					`PRODUCCION ${orden.ordenProduccionId}: ${(error as Error).message}`,
				);
			}
		}

		if (orden.estado === 'COMPLETADA' && orden.Receta.Producto?.almacenId) {
			const cantidadFinal = orden.cantidad * orden.Receta.rendimiento;
			const costoUnitarioFinal =
				orden.costoMateriales && cantidadFinal > 0
					? Math.round(orden.costoMateriales / cantidadFinal)
					: 0;
			try {
				await registrarMovimiento(prisma as never, {
					tenantId: orden.tenantId,
					productoId: orden.Receta.Producto.id,
					tipoOrigen: 'PRODUCCION',
					origenId: orden.ordenProduccionId,
					tipoUbicacion: 'almacen',
					ubicacionId: orden.Receta.Producto.almacenId,
					cantidad: cantidadFinal,
					costoUnitario: costoUnitarioFinal,
					secuencia: 'PRODUCTO-0',
				});
				resumen.produccion++;
			} catch (error) {
				resumen.errores.push(
					`PRODUCCION ${orden.ordenProduccionId}: ${(error as Error).message}`,
				);
			}
		}
	}

	return resumen;
}

if (require.main === module) {
	const tenantId = process.argv[2];
	backfillStockMoves(tenantId)
		.then((resumen) => {
			console.log(`✅ Backfill completado: ${JSON.stringify(resumen, null, 2)}`);
			if (resumen.errores.length > 0) {
				console.error(`⚠️ Errores (no bloquean): ${resumen.errores.length}`);
				process.exitCode = 0;
			}
		})
		.catch((error) => {
			console.error('Error en backfill:', error);
			process.exitCode = 1;
		})
		.finally(() => prisma.$disconnect());
}
