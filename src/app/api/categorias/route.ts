import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { CategoriaValidator } from "@/lib/categoria-validation";
import { CategoriaApiErrorHandler } from "@/lib/categoria-errors";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const categorias = await prisma.categoria.findMany({
            select: {
                catId: true,
                nombre: true,
                descripcion: true,
                parentId: true,
                createdAt: true,
                updatedAt: true,
                parent: {
                    select: {
                        catId: true,
                        nombre: true
                    }
                },
                subcategorias: {
                    select: {
                        catId: true,
                        nombre: true,
                        descripcion: true
                    }
                }
            }
        })
        return NextResponse.json(categorias)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[GET /api/categorias]', message, error)
        return NextResponse.json(
          { error: 'Error al obtener categorias', detail: message },
          { status: 500 }
        )
    }
}
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Comprehensive validation using the new validation system
        const validation = await CategoriaValidator.validateCategoryCreation(body)

        if (!validation.success) {
            return CategoriaApiErrorHandler.handleValidationErrors(validation.errors!)
        }

        const validatedData = validation.data!

        const categoria = await prisma.categoria.create({
            data: {
                nombre: validatedData.nombre,
                descripcion: validatedData.descripcion,
                parentId: validatedData.parentId
            },
            select: {
                catId: true,
                nombre: true,
                descripcion: true,
                parentId: true,
                createdAt: true,
                updatedAt: true,
                parent: {
                    select: {
                        catId: true,
                        nombre: true
                    }
                },
                subcategorias: {
                    select: {
                        catId: true,
                        nombre: true
                    }
                }
            }
        })
        
        return CategoriaApiErrorHandler.createSuccessResponse(categoria, 'Categoría creada exitosamente')
    } catch (error) {
        console.error('Error creating category:', error)
        return CategoriaApiErrorHandler.handleUnknownError(error, { operation: 'create' })
    }
}