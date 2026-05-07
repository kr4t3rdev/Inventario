'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  field?: string;
}

export function useCategoryValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const router = useRouter();

  /**
   * Validate category data before submission
   */
  const validateCategory = useCallback(
    async (data: { categoryId?: string; name: string; parentId?: string | null }) => {
      setIsValidating(true);
      
      try {
        const token = sessionStorage.getItem('token');
        const response = await fetch('/api/categorias/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({
            categoryId: data.categoryId,
            name: data.name,
            parentId: data.parentId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error de validación');
        }

        if (!result.isValid) {
          return {
            isValid: false,
            error: result.error || 'Datos de categoría no válidos',
            field: result.field,
          } as ValidationResult;
        }

        return { isValid: true } as ValidationResult;
      } catch (error) {
        console.error('Error validating category:', error);
        toast.error('Error al validar la categoría. Por favor, intente nuevamente.');
        return {
          isValid: false,
          error: 'Error de conexión. Por favor, intente nuevamente.',
        } as ValidationResult;
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  /**
   * Validate if a category can be deleted
   */
  const validateCategoryDeletion = useCallback(
    async (categoryId: string) => {
      setIsValidating(true);
      
      try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`/api/categorias/${categoryId}/can-delete`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al validar eliminación');
        }

        if (!result.canDelete) {
          return {
            canDelete: false,
            error: result.reason || 'No se puede eliminar esta categoría',
            details: result,
          };
        }

        return { canDelete: true };
      } catch (error) {
        console.error('Error validating category deletion:', error);
        toast.error('Error al validar la eliminación. Por favor, intente nuevamente.');
        return {
          canDelete: false,
          error: 'Error de conexión. Por favor, intente nuevamente.',
        };
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  return {
    validateCategory,
    validateCategoryDeletion,
    isValidating,
  };
}
