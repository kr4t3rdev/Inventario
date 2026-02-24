import { NextResponse } from 'next/server';
import { isCategoryNameUnique, validateParentAssignment } from '@/lib/enhanced-category-validation';

export async function POST(request: Request) {
  try {
    const { categoryId, name, parentId } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre de la categoría es requerido' },
        { status: 400 }
      );
    }

    // Validate name uniqueness within parent scope
    const isNameUnique = await isCategoryNameUnique(name, parentId || null, categoryId);
    if (!isNameUnique) {
      return NextResponse.json(
        { 
          isValid: false, 
          error: 'Ya existe una categoría con este nombre en el mismo nivel jerárquico',
          field: 'name'
        },
        { status: 200 } // 200 because this is a validation response, not an error
      );
    }

    // If parentId is provided, validate the parent assignment
    if (parentId) {
      const parentValidation = await validateParentAssignment(
        categoryId || 'new', // For new categories, pass a dummy ID
        parentId
      );

      if (!parentValidation.isValid) {
        return NextResponse.json(
          { 
            isValid: false, 
            error: parentValidation.reason,
            field: 'parentId'
          },
          { status: 200 }
        );
      }
    }

    // If we get here, all validations passed
    return NextResponse.json(
      { isValid: true },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error validating category:', error);
    return NextResponse.json(
      { 
        error: 'Ocurrió un error al validar la categoría',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
