import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // First verify that the parent category exists
        const parentCategory = await prisma.categoria.findUnique({
            where: { catId: id }
        });

        if (!parentCategory) {
            return NextResponse.json(
                { error: "Categoría padre no encontrada" }, 
                { status: 404 }
            );
        }

        // Get all subcategories for this parent category
        const subcategorias = await prisma.categoria.findMany({
            where: {
                parentId: id
            },
            include: {
                productos: true,
                subcategorias: {
                    include: {
                        productos: true
                    }
                }
            },
            orderBy: {
                nombre: 'asc'
            }
        });

        return NextResponse.json(subcategorias);
    } catch (error) {
        console.error("Error al obtener subcategorías:", error);
        return NextResponse.json(
            { error: "Error al obtener subcategorías" }, 
            { status: 500 }
        );
    }
}