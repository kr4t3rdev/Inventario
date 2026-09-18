// prisma/scripts/seed-stock-ubicacion.ts
import { prisma } from "../../src/lib/prisma";

/**
 * @description Pobla StockUbicacion con datos calculados del estado actual del sistema.
 * Ejecutar una sola vez después de la migración.
 *
 * ⚠️ IMPORTANTE:
 * Ya NO siembra stock de almacenes desde `producto.stock`, porque ese agregado legacy
 * puede estar desalineado y reintroducir stock fantasma. El script solo conserva la
 * materialización derivable para puntos de venta.
 */
async function main() {
	console.log("Iniciando seed de StockUbicacion...");

	console.log(
		"  Almacenes: omitidos intencionalmente. `producto.stock` ya no es una fuente confiable para seed.",
	);

	// 2. Puntos de venta: calcular stock materializado a partir de transferencias y ventas
	const puntosDeVenta = await prisma.puntoDeVenta.findMany({
		select: { pvId: true, nombre: true },
	});

	for (const pv of puntosDeVenta) {
		// Entradas al PV (transferencias donde este PV es destino)
		const entradas = await prisma.transferencia.findMany({
			where: { puntoDeVentaDestinoId: pv.pvId },
			select: { productoId: true, cantidad: true },
		});

		// Salidas del PV (transferencias donde este PV es origen)
		const salidas = await prisma.transferencia.findMany({
			where: { puntoDeVentaOrigenId: pv.pvId },
			select: { productoId: true, cantidad: true },
		});

		// Ventas en el PV con items detallados (VentaItem)
		const ventasItems = await prisma.ventaItem.findMany({
			where: { venta: { puntoDeVentaId: pv.pvId } },
			select: { productoId: true, cantidad: true },
		});

		// Ventas legacy en el PV (Venta sin items, con productoId directo)
		const ventasLegacy = await prisma.venta.findMany({
			where: { puntoDeVentaId: pv.pvId, items: { none: {} } },
			select: { productoId: true, cantidad: true },
		});

		// Calcular stock neto por producto
		const stockMap = new Map<string, number>();

		entradas.forEach((t) => {
			stockMap.set(
				t.productoId,
				(stockMap.get(t.productoId) ?? 0) + t.cantidad,
			);
		});
		salidas.forEach((t) => {
			stockMap.set(
				t.productoId,
				(stockMap.get(t.productoId) ?? 0) - t.cantidad,
			);
		});
		ventasItems.forEach((v) => {
			stockMap.set(
				v.productoId,
				(stockMap.get(v.productoId) ?? 0) - v.cantidad,
			);
		});
		ventasLegacy.forEach((v) => {
			if (v.productoId) {
				stockMap.set(
					v.productoId,
					(stockMap.get(v.productoId) ?? 0) - v.cantidad,
				);
			}
		});

		// Upsert por producto con cantidad final >= 0
		const stockEntries = Array.from(stockMap.entries());
		for (let i = 0; i < stockEntries.length; i++) {
			const [productoId, cantidad] = stockEntries[i];
			const cantidadFinal = Math.max(0, cantidad);
			if (cantidadFinal > 0) {
				const productoData = await prisma.producto.findUnique({
					where: { id: productoId },
					select: { tenantId: true },
				});
				if (!productoData) continue;
				await prisma.stockUbicacion.upsert({
					where: {
						productoId_tipoUbicacion_ubicacionId: {
							productoId,
							tipoUbicacion: "punto_venta",
							ubicacionId: pv.pvId,
						},
					},
					update: {
						cantidad: cantidadFinal,
						cantidadDisponible: cantidadFinal,
					},
					create: {
						productoId,
						tipoUbicacion: "punto_venta",
						ubicacionId: pv.pvId,
						cantidad: cantidadFinal,
						cantidadReservada: 0,
						cantidadDisponible: cantidadFinal,
						tenantId: productoData.tenantId,
					},
				});
			}
		}
		console.log(`  PV "${pv.nombre}": ${stockMap.size} productos procesados`);
	}

	console.log("Seed de StockUbicacion completado.");
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
