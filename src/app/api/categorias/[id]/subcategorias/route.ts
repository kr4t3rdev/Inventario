import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

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
            select: {
                catId: true,
                nombre: true,
                descripcion: true,
                parentId: true,
                createdAt: true,
                updatedAt: true,
                subcategorias: {
                    select: {
                        catId: true,
                        nombre: true,
                        descripcion: true
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