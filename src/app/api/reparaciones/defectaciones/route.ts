
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withAuthGet, type AuthenticatedUser } from "@/lib/auth-middleware";
import { requireTenant } from "@/lib/services/tenant-scope";

export const GET = withAuthGet(async (_req: any, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const defectaciones = await prisma.defectacionCatalogo.findMany({
      where: { tenantId },
      orderBy: { defecto: 'asc' }
    });
    return NextResponse.json(defectaciones);
  } catch (error) {
    console.error("Error fetching defectaciones:", error);
    return NextResponse.json(
      { error: "Error al obtener defectaciones" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req: any, _ctx: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const body = await req.json();
    const { defecto, costo } = body;

    if (!defecto || costo === undefined) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    const defectacion = await prisma.defectacionCatalogo.create({
      data: {
        tenantId,
        defecto,
        costo: Number(costo)
      }
    });

    return NextResponse.json(defectacion);
  } catch (error) {
    console.error("Error creating defectacion:", error);
    return NextResponse.json(
      { error: "Error al crear defectación" },
      { status: 500 }
    );
  }
});
