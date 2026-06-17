import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.JWT_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fix } = await request.json();

    const discrepancias: any[] = [];
    const sinRegistro: any[] = [];

    const productos = await prisma.producto.findMany({
      select: {
        id: true,
        nombre: true,
        stock: true,
        almacenId: true,
        tenantId: true,
      },
    });

    for (const p of productos) {
      if (!p.almacenId) continue;

      const actual = await prisma.stockUbicacion.findUnique({
        where: {
          productoId_tipoUbicacion_ubicacionId: {
            productoId: p.id,
            tipoUbicacion: "almacen",
            ubicacionId: p.almacenId,
          },
        },
        select: { cantidad: true },
      });

      const esperado = p.stock;

      if (!actual && esperado > 0) {
        sinRegistro.push({
          tipo: "almacen",
          ubicacionNombre: p.almacenId,
          productoId: p.id,
          productoNombre: p.nombre,
          esperado,
          actual: 0,
          diferencia: esperado,
          tenantId: p.tenantId,
        });
      } else if (actual && actual.cantidad !== esperado) {
        discrepancias.push({
          tipo: "almacen",
          ubicacionNombre: p.almacenId,
          productoId: p.id,
          productoNombre: p.nombre,
          esperado,
          actual: actual.cantidad,
          diferencia: actual.cantidad - esperado,
          tenantId: p.tenantId,
        });
      }
    }

    const puntosDeVenta = await prisma.puntoDeVenta.findMany({
      select: { pvId: true, nombre: true },
    });

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

      const stockEsperado = new Map<string, number>();
      for (const t of entradas)
        stockEsperado.set(
          t.productoId,
          (stockEsperado.get(t.productoId) ?? 0) + t.cantidad
        );
      for (const t of salidas)
        stockEsperado.set(
          t.productoId,
          (stockEsperado.get(t.productoId) ?? 0) - t.cantidad
        );
      for (const v of ventasItems)
        stockEsperado.set(
          v.productoId,
          (stockEsperado.get(v.productoId) ?? 0) - v.cantidad
        );
      for (const v of ventasLegacy) {
        if (v.productoId)
          stockEsperado.set(
            v.productoId,
            (stockEsperado.get(v.productoId) ?? 0) - v.cantidad
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
      for (const [productoId, esperado] of stockEsperadoEntries) {
        const final = Math.max(0, esperado);
        const actual = stockReal.get(productoId) ?? 0;

        if (final === 0 && actual === 0) continue;

        if (!stockReal.has(productoId) && final > 0) {
          const prod = await prisma.producto.findUnique({
            where: { id: productoId },
            select: { nombre: true, tenantId: true },
          });
          sinRegistro.push({
            tipo: "punto_venta",
            ubicacionNombre: pv.nombre,
            productoId,
            productoNombre: prod?.nombre ?? "(desconocido)",
            esperado: final,
            actual: 0,
            diferencia: final,
            tenantId: prod?.tenantId,
            ubicacionId: pv.pvId,
          });
        } else if (final !== actual) {
          const prod = await prisma.producto.findUnique({
            where: { id: productoId },
            select: { nombre: true, tenantId: true },
          });
          discrepancias.push({
            tipo: "punto_venta",
            ubicacionNombre: pv.nombre,
            productoId,
            productoNombre: prod?.nombre ?? "(desconocido)",
            esperado: final,
            actual,
            diferencia: actual - final,
            tenantId: prod?.tenantId,
            ubicacionId: pv.pvId,
          });
        }
      }

      const stockRealEntries = Array.from(stockReal.entries());
      for (const [productoId, actual] of stockRealEntries) {
        if (!stockEsperado.has(productoId) && actual > 0) {
          const prod = await prisma.producto.findUnique({
            where: { id: productoId },
            select: { nombre: true, tenantId: true },
          });
          discrepancias.push({
            tipo: "punto_venta",
            ubicacionNombre: pv.nombre,
            productoId,
            productoNombre: prod?.nombre ?? "(desconocido)",
            esperado: 0,
            actual,
            diferencia: actual,
            tenantId: prod?.tenantId,
            ubicacionId: pv.pvId,
          });
        }
      }
    }

    let corregidos = 0;

    if (fix && (sinRegistro.length > 0 || discrepancias.length > 0)) {
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

      const pvSinRegistro = sinRegistro.filter((s) => s.tipo === "punto_venta");
      const pvDiscrepancias = discrepancias.filter((d) => d.tipo === "punto_venta");

      for (const item of [...pvSinRegistro, ...pvDiscrepancias]) {
        const prod = await prisma.producto.findUnique({
          where: { id: item.productoId },
          select: { tenantId: true },
        });
        if (!prod) continue;

        const pv = puntosDeVenta.find(
          (p) => p.nombre === item.ubicacionNombre || p.pvId === item.ubicacionId
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
    }

    return NextResponse.json({
      sinRegistro: sinRegistro.length,
      discrepancias: discrepancias.length,
      corregidos,
      detalles: { sinRegistro, discrepancias },
    });
  } catch (error) {
    console.error("Error en reconciliación:", error);
    return NextResponse.json(
      { error: "Error en reconciliación", details: String(error) },
      { status: 500 }
    );
  }
}
