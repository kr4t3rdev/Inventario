import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { CategoriaValidator } from "@/lib/categoria-validation";
import { CategoriaApiErrorHandler } from "@/lib/categoria-errors";

export async function GET() {
    try {
        const categorias = await prisma.categoria.findMany({
            include: {
                productos: true,
                parent: true,
                subcategorias: {
                    include: {
                        productos: true
                    }
                }
            }
        })
        return NextResponse.json(categorias)
    } catch (error) {
        console.log(error)
        return NextResponse.json({error: 'Error al obtener categorias'}, {status:500})        
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
            include: {
                parent: true,
                subcategorias: true
            }
        })
        
        return CategoriaApiErrorHandler.createSuccessResponse(categoria, 'Categoría creada exitosamente')
    } catch (error) {
        console.error('Error creating category:', error)
        return CategoriaApiErrorHandler.handleUnknownError(error, { operation: 'create' })
    }
}