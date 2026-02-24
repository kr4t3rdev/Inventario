
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

export const PUT = withAuth(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { defecto, costo } = body;

    const defectacion = await prisma.defectacionCatalogo.update({
      where: { id },
      data: {
        defecto,
        costo: Number(costo)
      }
    });

    return NextResponse.json(defectacion);
  } catch (error) {
    console.error("Error updating defectacion:", error);
    return NextResponse.json(
      { error: "Error al actualizar defectación" },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (req, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    await prisma.defectacionCatalogo.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting defectacion:", error);
    return NextResponse.json(
      { error: "Error al eliminar defectación" },
      { status: 500 }
    );
  }
});
