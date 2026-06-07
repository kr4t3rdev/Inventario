/**
 * @description Server Action para obtener los datos del cuadre de turno POS.
 * Retorna productos del punto de venta con su stock actual, cantidades vendidas
 * en el turno, y resumen de ventas vs arqueo.
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { getStockPorUbicacionBatch } from "@/lib/services/stock-ubicacion-queries";
import { z } from "zod";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── Schema ───────────────────────────────────────────────

const getCuadreTurnoSchema = z.object({
	turnoId: z.string().min(1, "El turno es requerido"),
});

// ─── Tipos de retorno ─────────────────────────────────────

export interface ProductoCuadre {
	id: string;
	nombre: string;
	codigoInterno: string | null;
	stockEnUbicacion: number;
	vendidoEnTurno: number;
	precioVenta: number;
	restante: number;
	foto: string | null;
	unidad: string | null;
}

export interface CuadreTurnoData {
	turno: {
		id: string;
		puntoDeVentaId: string;
		puntoDeVentaNombre: string;
		fondoInicialCup: number;
		fondoInicialUsd: number;
		fechaApertura: Date;
		tipo: string;
		empleado: { nombre: string; apellido: string } | null;
	};
	arqueo: {
		id: string;
		totalEfectivoCup: number;
		totalEfectivoUsd: number;
		totalTarjeta: number;
		totalTransferencia: number;
		totalCredito: number;
		diferenciaCup: number;
		diferenciaUsd: number;
	} | null;
	totalVentaTurno: number;
	productos: ProductoCuadre[];
	resumen: {
		totalStock: number;
		totalVendido: number;
		totalVentaMonto: number;
	};
}

// ─── Server Action ────────────────────────────────────────

/**
 * @description Obtiene los datos completos para la pantalla de cuadre de turno POS.
 * Incluye: datos del turno, arqueo registrado, productos del PV con stock y ventas.
 *
 * @param {string} turnoId - ID del turno a cuadrar
 * @returns {Promise<CuadreTurnoData>} Datos completos del cuadre
 * @throws {ActionError} Si el turno no existe, no está abierto, o no tiene arqueo
 */
export const getCuadreTurnoAction = withAction(
	async (turnoId: string, user: AuthenticatedUser) => {
		const parsed = getCuadreTurnoSchema.parse({ turnoId });
		const tenantId = requireTenant(user);

		// 1. Obtener turno con arqueos y empleado
		const turno = await prisma.turnoPuntoVenta.findFirst({
			where: { id: parsed.turnoId, tenantId },
			include: {
				arqueos: { orderBy: { createdAt: "desc" }, take: 1 },
				empleado: { select: { nombre: true, apellido: true } },
				puntoDeVenta: { select: { pvId: true, nombre: true, almacenId: true } },
			},
		});

		if (!turno) throw new ActionError("Turno no encontrado", "NOT_FOUND");
		const ultimoArqueo = turno.arqueos[0] ?? null;
		if (!ultimoArqueo) {
			throw new ActionError(
				"Debe realizar el arqueo de caja primero",
				"NO_ARQUEO",
			);
		}

		// 2. Obtener VentaItems del turno (productos vendidos)
		const ventaItems = await prisma.ventaItem.findMany({
			where: { venta: { turnoId: parsed.turnoId } },
			select: {
				productoId: true,
				cantidad: true,
				precioUnitario: true,
				producto: {
					select: {
						id: true,
						nombre: true,
						precioVenta: true,
						fotos: true,
						codigoInterno: true,
						unidad: { select: { simbolo: true } },
					},
				},
			},
		});

		// 3. Agrupar por productoId (un producto puede aparecer en varias ventas)
		const ventasPorProducto = new Map<
			string,
			{
				cantidad: number;
				precioUnitario: number;
				producto: (typeof ventaItems)[0]["producto"];
			}
		>();

		for (const vi of ventaItems) {
			const existing = ventasPorProducto.get(vi.productoId);
			if (existing) {
				existing.cantidad += vi.cantidad;
			} else {
				ventasPorProducto.set(vi.productoId, {
					cantidad: vi.cantidad,
					precioUnitario: vi.precioUnitario,
					producto: vi.producto,
				});
			}
		}

		// 4. Obtener stock actual del PV via StockUbicacion (Fase 4).
		// StockUbicacion.cantidad = stock restante después de las ventas del turno
		// (las ventas descuentan StockUbicacion del PV desde Fase 3).
		const productIds = Array.from(ventasPorProducto.keys());
		let stockActualMap = new Map<string, number>();

		if (productIds.length > 0) {
			const stockBatch = await getStockPorUbicacionBatch(prisma as any, {
				productoIds: productIds,
				tipoUbicacion: "punto_venta",
				ubicacionId: turno.puntoDeVentaId,
			});
			for (const [pid, s] of stockBatch) {
				stockActualMap.set(pid, s.cantidad);
			}
		}

		// 5. Armar array de productos
		let totalStock = 0;
		let totalVendido = 0;
		let totalVentaMonto = 0;

		const productos: ProductoCuadre[] = [];

		for (const [productoId, data] of ventasPorProducto) {
			const stockActual = stockActualMap.get(productoId) ?? 0;
			const vendido = data.cantidad;
			const precioUnitario = data.precioUnitario;
			const precioTotal = vendido * precioUnitario;

			// Con StockUbicacion como fuente de verdad única:
			// - stockActual = cantidad en StockUbicacion (stock restante tras ventas)
			// - stockInicial = stockActual + vendido (reconstruir stock al inicio del turno)
			// - restante = stockActual (lo que debería quedar en el PV)
			const stockInicial = stockActual + vendido;
			const restante = stockActual;

			totalStock += stockInicial;
			totalVendido += vendido;
			totalVentaMonto += precioTotal;

			productos.push({
				id: productoId,
				nombre: data.producto.nombre,
				codigoInterno: data.producto.codigoInterno,
				stockEnUbicacion: stockInicial,
				vendidoEnTurno: vendido,
				precioVenta: precioTotal,
				restante,
				foto: (data.producto.fotos as string[])?.[0] ?? null,
				unidad: data.producto.unidad?.simbolo ?? null,
			});
		}

		// 6. Ordenar por nombre
		productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

		// 7. Calcular total de venta del turno (desde Venta.total)
		const ventasTurno = await prisma.venta.aggregate({
			where: { turnoId: parsed.turnoId },
			_sum: { total: true },
		});
		const totalVentaTurno = ventasTurno._sum.total ?? 0;

		return {
			turno: {
				id: turno.id,
				puntoDeVentaId: turno.puntoDeVentaId,
				puntoDeVentaNombre: turno.puntoDeVenta.nombre,
				fondoInicialCup: turno.fondoInicialCup,
				fondoInicialUsd: turno.fondoInicialUsd,
				fechaApertura: turno.fechaApertura,
				tipo: turno.tipo,
				empleado: turno.empleado,
			},
			arqueo: ultimoArqueo,
			totalVentaTurno,
			productos,
			resumen: {
				totalStock,
				totalVendido,
				totalVentaMonto,
			},
		};
	},
);
