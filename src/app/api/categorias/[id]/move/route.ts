import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { parentId } = body;
        const { id } = await params;

        // Validate that the category to move exists
        const categoryToMove = await prisma.categoria.findUnique({
            where: { catId: id },
            select: {
                catId: true,
                nombre: true,
                parentId: true,
                subcategorias: {
                    select: {
                        catId: true,
                        nombre: true
                    }
                }
            }
        });

        if (!categoryToMove) {
            return NextResponse.json(
                { error: "Categoría no encontrada" }, 
                { status: 404 }
            );
        }

        // If parentId is provided, validate that the new parent exists
        if (parentId) {
            const newParentCategory = await prisma.categoria.findUnique({
                where: { catId: parentId }
            });

            if (!newParentCategory) {
                return NextResponse.json(
                    { error: "Categoría padre no encontrada" }, 
                    { status: 400 }
                );
            }

            // Prevent circular references
            if (parentId === id) {
                return NextResponse.json(
                    { error: "Una categoría no puede ser su propia categoría padre" }, 
                    { status: 400 }
                );
            }

            // Check if the new parent is a descendant of the category being moved
            const isDescendant = await checkIfDescendant(id, parentId);
            if (isDescendant) {
                return NextResponse.json(
                    { error: "No se puede crear una referencia circular en las categorías" }, 
                    { status: 400 }
                );
            }

            // Check hierarchy depth - prevent more than 3 levels
            const newDepth = await calculateDepth(parentId) + 1;
            const currentSubtreeDepth = await calculateSubtreeDepth(id);
            
            if (newDepth + currentSubtreeDepth > 3) {
                return NextResponse.json(
                    { error: "Se ha excedido la profundidad máxima de categorías (3 niveles)" }, 
                    { status: 400 }
                );
            }
        }

        // Update the category's parent
        const updatedCategory = await prisma.categoria.update({
            where: { catId: id },
            data: { parentId },
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
        });

        return NextResponse.json(updatedCategory);
    } catch (error) {
        console.error("Error al mover categoría:", error);
        return NextResponse.json(
            { error: "Error al mover categoría" }, 
            { status: 500 }
        );
    }
}

// Helper function to check if a category is a descendant of another
async function checkIfDescendant(categoryId: string, potentialAncestorId: string): Promise<boolean> {
    const category = await prisma.categoria.findUnique({
        where: { catId: potentialAncestorId },
        include: { parent: true }
    });
    
    if (!category || !category.parent) {
        return false;
    }
    
    if (category.parent.catId === categoryId) {
        return true;
    }
    
    return await checkIfDescendant(categoryId, category.parent.catId);
}

// Helper function to calculate the depth of a category from root
async function calculateDepth(categoryId: string): Promise<number> {
    const category = await prisma.categoria.findUnique({
        where: { catId: categoryId },
        include: { parent: true }
    });
    
    if (!category || !category.parent) {
        return 0;
    }
    
    return 1 + await calculateDepth(category.parent.catId);
}

// Helper function to calculate the maximum depth of a subtree
async function calculateSubtreeDepth(categoryId: string): Promise<number> {
    const subcategories = await prisma.categoria.findMany({
        where: { parentId: categoryId }
    });
    
    if (subcategories.length === 0) {
        return 0;
    }
    
    const depths = await Promise.all(
        subcategories.map((sub: { catId: string }) => calculateSubtreeDepth(sub.catId))
    );
    
    return 1 + Math.max(...depths);
}