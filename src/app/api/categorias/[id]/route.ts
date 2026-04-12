import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { CategoriaValidator } from "@/lib/categoria-validation";
import { CategoriaApiErrorHandler, CategoriaDeletionValidator } from "@/lib/categoria-errors";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const {id} = await params
        const categoria = await prisma.categoria.findUnique({
            where: { catId: id},
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
            },
        })

        if (!categoria) {
            return NextResponse.json({ error: "Categoria no encontrada" }, { status: 404 })
        }

        return NextResponse.json(categoria)
    } catch (error) {
        console.error("Error al obtener categoria:", error)
        return NextResponse.json({ error: "Error al obtener categoria" }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    try {
        const body = await request.json()

        // Comprehensive validation using the new validation system
        const validation = await CategoriaValidator.validateCategoryUpdate(id, body)
        
        if (!validation.success) {
            return CategoriaApiErrorHandler.handleValidationErrors(validation.errors!)
        }

        const validatedData = validation.data!

        const categoria = await prisma.categoria.update({
            where: {
                catId: id
            },
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
                        nombre: true,
                        descripcion: true
                    }
                }


export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        // Validate deletion using the new validation system
        const deletionValidation = await CategoriaDeletionValidator.validateDeletion(id)
        
        if (!deletionValidation.canDelete) {
            return CategoriaApiErrorHandler.handleValidationErrors(deletionValidation.errors!)
        }

        // Get the category data for reassignment logic
        const categoria = await prisma.categoria.findUnique({
            where: { catId: id },
            include: {
                productosSubcategoria: true
            }
        });

        if (!categoria) {
            return CategoriaApiErrorHandler.handleSingleError({
                code: 'CATEGORY_NOT_FOUND',
                message: 'Categoría no encontrada'
            })
        }

        let reassignedProducts = 0

        // Handle product reassignment for subcategories
        if (categoria.productosSubcategoria.length > 0 && categoria.parentId) {
            // Reassign products to parent category and clear subcategory
            await prisma.producto.updateMany({
                where: { subcategoriaId: id },
                data: {
                    subcategoriaId: null,
                    categoriaId: categoria.parentId
                }
            });
            reassignedProducts = categoria.productosSubcategoria.length
        }

        // Delete the category
        await prisma.categoria.delete({
            where: { catId: id }
        });

        return CategoriaApiErrorHandler.createDeletionSuccessResponse(
            id,
            reassignedProducts
        )
    } catch (error) {
        console.error("Error deleting category:", error);
        return CategoriaApiErrorHandler.handleUnknownError(error, { operation: 'delete', categoryId: id })
    }
}
