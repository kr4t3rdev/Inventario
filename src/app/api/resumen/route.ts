import prisma from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";

export async function GET(request:NextRequest){
    try {
        // Since 'resumen' model doesn't exist in the schema, return an empty array
        // This appears to be a placeholder or the model needs to be added to the schema
        const resumen: any[] = []
    return NextResponse.json(resumen)
  } catch (error) {
    console.error("Error al obtener reporte financiero:", error)
    return NextResponse.json({ error: "Error al obtener reporte financiero" }, { status: 500 })
  }
}

