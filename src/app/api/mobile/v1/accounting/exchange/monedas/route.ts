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
    const monedas = await prisma.moneda.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: monedas,
    });
  } catch (error) {
    console.error("[Mobile Exchange/Monedas] Error al obtener monedas:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener monedas" },
      { status: 500 },
    );
  }
}
