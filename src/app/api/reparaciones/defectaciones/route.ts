
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withAuthGet } from "@/lib/auth-middleware";

export const GET = withAuthGet(async (req) => {
  try {
    const defectaciones = await prisma.defectacionCatalogo.findMany({
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

export const POST = withAuth(async (req) => {
  try {
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
