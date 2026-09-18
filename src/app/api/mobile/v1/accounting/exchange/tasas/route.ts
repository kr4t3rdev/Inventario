import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authenticateUser } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  try {
    const [monedas, tasas] = await Promise.all([
      prisma.moneda.findMany({ orderBy: { nombre: "asc" } }),
      prisma.tasaCambio.findMany({ orderBy: { fechaVigencia: "desc" }, take: 50 }),
    ]);

    const monedaPrincipal = monedas.find((m) => m.esPrincipal) ?? monedas[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        monedaPrincipal,
        tasas: tasas.map((tasa) => ({
          tasaId: tasa.tasaId,
          monedaOrigenId: tasa.monedaOrigenId,
          monedaDestino: tasa.monedaDestino,
          tasa: Number(tasa.tasa),
          fechaVigencia: tasa.fechaVigencia,
        })),
      },
    });
  } catch (error) {
    console.error("[Mobile Exchange/Tasas] Error al obtener tasas:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener tasas" },
      { status: 500 },
    );
  }
}
