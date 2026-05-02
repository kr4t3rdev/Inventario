import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware";
import { requireTenant } from "@/lib/services/tenant-scope";
import { CategoriaValidator } from "@/lib/categoria-validation";
import { CategoriaApiErrorHandler } from "@/lib/categoria-errors";

export const dynamic = 'force-dynamic';

export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
    try {
        const tenantId = requireTenant(user);
        const categorias = await prisma.categoria.findMany({
            where: { tenantId },
            select: {
                catId: true,
                nombre: true,
                descripcion: true,
                parentId: true,
                clasSectionId: true,
                clasSpecificId: true,
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
})
export const POST = withAuthPost(async (req: NextRequest, _context: unknown, user: AuthenticatedUser) => {
    try {
        const tenantId = requireTenant(user);
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
                parentId: validatedData.parentId,
                clasSectionId: validatedData.clasSectionId,
                clasSpecificId: validatedData.clasSpecificId,
                tenantId
            },
            select: {
                catId: true,
                nombre: true,
                descripcion: true,
                parentId: true,
                clasSectionId: true,
                clasSpecificId: true,
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
})