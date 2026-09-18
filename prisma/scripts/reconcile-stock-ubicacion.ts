/**
 * @description Script de reconciliación de StockUbicacion.
 *
 *   Compara los valores actuales de StockUbicacion contra el estado
 *   esperado derivado de (producto.stock, transferencias, ventas).
 *   Reporta discrepancias y ofrece modo dry-run/fix.
 *
 *   USO:
 *     npx tsx prisma/scripts/reconcile-stock-ubicacion.ts         # dry-run
 *     npx tsx prisma/scripts/reconcile-stock-ubicacion.ts --fix   # corregir
 *
 * @module prisma/scripts/reconcile-stock-ubicacion
 */

import { prisma } from "../../src/lib/prisma";

interface Discrepancia {
	tipo: "almacen" | "punto_venta";
	ubicacionNombre: string;
	productoId: string;
	productoNombre: string;
	esperado: number;
	actual: number;
	diferencia: number;
}

async function main() {
	const args = process.argv.slice(2);
	const modoFix = args.includes("--fix");
	const modoSeed = args.includes("--seed"); // también poblar registros faltantes

	console.log("══════════════════════════════════════════════");
	console.log("  Reconciliación de StockUbicacion");
	console.log(
		`  Modo: ${modoFix ? "FIX" : "DRY-RUN"}${modoSeed ? " + SEED" : ""}`,
	);
	console.log("══════════════════════════════════════════════");
	console.log();

	const discrepancias: Discrepancia[] = [];
	const sinRegistro: Discrepancia[] = [];

	// ─── Almacenes ──────────────────────────────────────────

	console.log("▶ Almacenes...");
	console.log(
		"  ! Omitidos en reconciliación automática: producto.stock ya no es una fuente confiable para almacenes.",
	);
	const productos = await prisma.producto.findMany({
		select: {
			id: true,
			nombre: true,
			almacenId: true,
			tenantId: true,
		},
	});

	// ─── Puntos de Venta ────────────────────────────────────

	console.log("▶ Puntos de Venta...");
	const puntosDeVenta = await prisma.puntoDeVenta.findMany({
		select: { pvId: true, nombre: true },
	});

	// Pre-cargar transferencias y ventas agrupadas para cada PV
	for (const pv of puntosDeVenta) {
		const entradas = await prisma.transferencia.findMany({
			where: { puntoDeVentaDestinoId: pv.pvId },
			select: { productoId: true, cantidad: true },
		});
		const salidas = await prisma.transferencia.findMany({
			where: { puntoDeVentaOrigenId: pv.pvId },
			select: { productoId: true, cantidad: true },
		});
		const ventasItems = await prisma.ventaItem.findMany({
			where: { venta: { puntoDeVentaId: pv.pvId } },
			select: { productoId: true, cantidad: true },
		});
		const ventasLegacy = await prisma.venta.findMany({
			where: { puntoDeVentaId: pv.pvId, items: { none: {} } },
			select: { productoId: true, cantidad: true },
		});

		// Calcular esperado
		const stockEsperado = new Map<string, number>();
		for (const t of entradas)
			stockEsperado.set(
				t.productoId,
				(stockEsperado.get(t.productoId) ?? 0) + t.cantidad,
			);
		for (const t of salidas)
			stockEsperado.set(
				t.productoId,
				(stockEsperado.get(t.productoId) ?? 0) - t.cantidad,
			);
		for (const v of ventasItems)
			stockEsperado.set(
				v.productoId,
				(stockEsperado.get(v.productoId) ?? 0) - v.cantidad,
			);
		for (const v of ventasLegacy) {
			if (v.productoId)
				stockEsperado.set(
					v.productoId,
					(stockEsperado.get(v.productoId) ?? 0) - v.cantidad,
				);
		}

		const reales = await prisma.stockUbicacion.findMany({
			where: {
				tipoUbicacion: "punto_venta",
				ubicacionId: pv.pvId,
			},
			select: { productoId: true, cantidad: true },
		});
		const stockReal = new Map(reales.map((r) => [r.productoId, r.cantidad]));

		const stockEsperadoEntries = Array.from(stockEsperado.entries());
		for (let i = 0; i < stockEsperadoEntries.length; i++) {
			const [productoId, esperado] = stockEsperadoEntries[i];
			const final = Math.max(0, esperado);
			const actual = stockReal.get(productoId) ?? 0;

			if (final === 0 && actual === 0) continue; // ambos cero, no hay issue

			if (!stockReal.has(productoId) && final > 0) {
				const prod = await prisma.producto.findUnique({
					where: { id: productoId },
					select: { nombre: true },
				});
				sinRegistro.push({
					tipo: "punto_venta",
					ubicacionNombre: pv.nombre,
					productoId,
					productoNombre: prod?.nombre ?? "(desconocido)",
					esperado: final,
					actual: 0,
					diferencia: final,
				});
			} else if (final !== actual) {
				const prod = await prisma.producto.findUnique({
					where: { id: productoId },
					select: { nombre: true },
				});
				discrepancias.push({
					tipo: "punto_venta",
					ubicacionNombre: pv.nombre,
					productoId,
					productoNombre: prod?.nombre ?? "(desconocido)",
					esperado: final,
					actual,
					diferencia: actual - final,
				});
			}
		}

		// StockUbicacion con registros que ya no tienen movimientos
		const stockRealEntries = Array.from(stockReal.entries());
		for (let i = 0; i < stockRealEntries.length; i++) {
			const [productoId, actual] = stockRealEntries[i];
			if (!stockEsperado.has(productoId) && actual > 0) {
				const prod = await prisma.producto.findUnique({
					where: { id: productoId },
					select: { nombre: true },
				});
				discrepancias.push({
					tipo: "punto_venta",
					ubicacionNombre: pv.nombre,
					productoId,
					productoNombre: prod?.nombre ?? "(desconocido)",
					esperado: 0,
					actual,
					diferencia: actual,
				});
			}
		}
	}

	// ─── Reporte ─────────────────────────────────────────────

	console.log();
	console.log("══════════════════════════════════════════════");
	console.log("  REPORTE DE RECONCILIACIÓN");
	console.log("══════════════════════════════════════════════");
	console.log();

	if (sinRegistro.length > 0) {
		console.log(
			`⚠  ${sinRegistro.length} producto(s) sin registro en StockUbicacion:`,
		);
		for (const s of sinRegistro) {
			console.log(
				`   [${s.tipo.toUpperCase()}] ${s.ubicacionNombre} → ${s.productoNombre} (${s.productoId}): esperado=${s.esperado}`,
			);
		}
		console.log();
	}

	if (discrepancias.length > 0) {
		console.log(`✗  ${discrepancias.length} discrepancia(s) encontradas:`);
		for (const d of discrepancias) {
			const signo = d.diferencia > 0 ? "+" : "";
			console.log(
				`   [${d.tipo.toUpperCase()}] ${d.ubicacionNombre} → ${d.productoNombre} (${d.productoId}): esperado=${d.esperado}, actual=${d.actual} (${signo}${d.diferencia})`,
			);
		}
		console.log();
	} else {
		console.log("✓  No hay discrepancias — StockUbicacion está reconciliado.");
		console.log();
	}

	// ─── Fix ────────────────────────────────────────────────

	if (
		(modoFix || modoSeed) &&
		(sinRegistro.length > 0 || discrepancias.length > 0)
	) {
		console.log("▶ Aplicando correcciones...");

		let corregidos = 0;

		// Corregir almacenes faltantes/discrepantes
		for (const s of sinRegistro) {
			if (s.tipo !== "almacen") continue;
			const p = productos.find((x) => x.id === s.productoId);
			if (!p || !p.almacenId) continue;

			await prisma.stockUbicacion.upsert({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: p.id,
						tipoUbicacion: "almacen",
						ubicacionId: p.almacenId,
					},
				},
				update: { cantidad: s.esperado, cantidadDisponible: s.esperado },
				create: {
					productoId: p.id,
					tipoUbicacion: "almacen",
					ubicacionId: p.almacenId,
					cantidad: s.esperado,
					cantidadReservada: 0,
					cantidadDisponible: s.esperado,
					tenantId: p.tenantId,
				},
			});
			corregidos++;
		}

		for (const d of discrepancias) {
			if (d.tipo !== "almacen") continue;
			const p = productos.find((x) => x.id === d.productoId);
			if (!p || !p.almacenId) continue;

			await prisma.stockUbicacion.upsert({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: p.id,
						tipoUbicacion: "almacen",
						ubicacionId: p.almacenId,
					},
				},
				update: { cantidad: d.esperado, cantidadDisponible: d.esperado },
				create: {
					productoId: p.id,
					tipoUbicacion: "almacen",
					ubicacionId: p.almacenId,
					cantidad: d.esperado,
					cantidadReservada: 0,
					cantidadDisponible: d.esperado,
					tenantId: p.tenantId,
				},
			});
			corregidos++;
		}

		// Corregir PV (solo faltantes o discrepancias tipo PV)
		// Reusa seed logic inline
		const pvSinRegistro = sinRegistro.filter((s) => s.tipo === "punto_venta");
		const pvDiscrepancias = discrepancias.filter(
			(d) => d.tipo === "punto_venta",
		);

		for (const item of [...pvSinRegistro, ...pvDiscrepancias]) {
			const prod = await prisma.producto.findUnique({
				where: { id: item.productoId },
				select: { tenantId: true },
			});
			if (!prod) continue;

			const pv = puntosDeVenta.find(
				(p) =>
					p.nombre === item.ubicacionNombre || p.pvId === item.ubicacionNombre,
			);
			if (!pv) continue;

			await prisma.stockUbicacion.upsert({
				where: {
					productoId_tipoUbicacion_ubicacionId: {
						productoId: item.productoId,
						tipoUbicacion: "punto_venta",
						ubicacionId: pv.pvId,
					},
				},
				update: { cantidad: item.esperado, cantidadDisponible: item.esperado },
				create: {
					productoId: item.productoId,
					tipoUbicacion: "punto_venta",
					ubicacionId: pv.pvId,
					cantidad: item.esperado,
					cantidadReservada: 0,
					cantidadDisponible: item.esperado,
					tenantId: prod.tenantId,
				},
			});
			corregidos++;
		}

		console.log(`✓  ${corregidos} registro(s) corregidos.`);
	}

	console.log();
	console.log("Reconciliación finalizada.");
	await prisma.$disconnect();
}

main().catch((err) => {
	console.error("Error en reconciliación:", err);
	process.exit(1);
});
