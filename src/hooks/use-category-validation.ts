import { useState, useEffect } from 'react';
import { Categoria } from '../app/models/model';

type ValidationResult = {
  isValid: boolean;
  error?: string;
};

export function useCategoryValidation() {
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // This would be replaced with your actual data fetching logic
  // For now, it's a placeholder that assumes you'll set categories from a parent component
  const setCategoryData = (data: Categoria[]) => {
    setCategories(data);
    setIsLoading(false);
  };

  /**
   * Validate category name uniqueness within the same parent scope
   */
  const validateNameUniqueness = (
    name: string, 
    parentId: string | undefined, 
    currentCategoryId?: string
  ): ValidationResult => {
    if (!name.trim()) {
      return { 
        isValid: false, 
        error: 'El nombre de la categoría es requerido' 
      };
    }

    const isDuplicate = categories.some(
      cat => 
        cat.nombre.toLowerCase() === name.toLowerCase() &&
        cat.parentId === parentId &&
        (!currentCategoryId || cat.catId !== currentCategoryId)
    );

    return {
      isValid: !isDuplicate,
      error: isDuplicate ? 'Ya existe una categoría con este nombre en el mismo nivel jerárquico' : undefined
    };
  };

  /**
   * Validate category hierarchy depth
   */
  const validateHierarchyDepth = (
    parentId: string | undefined, 
    maxDepth: number = 3
  ): ValidationResult => {
    if (!parentId) {
      return { isValid: true }; // Root category is always valid
    }

    const depth = getCategoryDepth(parentId);
    const isValid = depth < maxDepth - 1; // -1 because we're adding one more level

    return {
      isValid,
      error: isValid ? undefined : `No se pueden crear más de ${maxDepth} niveles de categorías`
    };
  };

  /**
   * Check if moving a category would create a circular reference
   */
  const checkCircularReference = (
    categoryId: string, 
    newParentId: string | undefined
  ): ValidationResult => {
    if (!newParentId) {
      return { isValid: true }; // Moving to root is always valid
    }

    if (categoryId === newParentId) {
      return {
        isValid: false,
        error: 'No se puede asignar una categoría como padre de sí misma'
      };
    }

    // Check if new parent is a descendant of the current category
    let currentId = newParentId;
    while (currentId) {
      const parent = categories.find(cat => cat.catId === currentId);
      if (!parent) break;
      
      if (parent.catId === categoryId) {
        return {
          isValid: false,
          error: 'No se puede asignar una subcategoría como padre de una de sus categorías superiores'
        };
      }
      currentId = parent.parentId || '';
    }

    return { isValid: true };
  };

  /**
   * Get the depth of a category in the hierarchy
   */
  const getCategoryDepth = (categoryId: string): number => {
    const category = categories.find(cat => cat.catId === categoryId);
    if (!category || !category.parentId) return 0;
    return 1 + getCategoryDepth(category.parentId);
  };

  /**
   * Validate if a category can be deleted
   */
  const validateDeletion = (categoryId: string): ValidationResult => {
    const hasChildren = categories.some(cat => cat.parentId === categoryId);
    if (hasChildren) {
      return {
        isValid: false,
        error: 'No se puede eliminar una categoría que tiene subcategorías. Elimine primero las subcategorías.'
      };
    }

    // Note: You would need to check for products in this category
    // This would typically be done on the server side
    
    return { isValid: true };
  };

  return {
    categories,
    setCategoryData,
    isLoading,
    error,
    validateNameUniqueness,
    validateHierarchyDepth,
    checkCircularReference,
    validateDeletion,
    getCategoryDepth
  };
}
