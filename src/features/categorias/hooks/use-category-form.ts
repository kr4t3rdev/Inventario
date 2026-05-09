import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createCategoriaAction, updateCategoriaAction } from '@/features/categorias/actions';
import { validateCLASSection, validateCLASSpecific, CLASClassifierData } from '@/lib/clas-classifier';

// Define the form schema using Zod
const categoryFormSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder los 100 caracteres')
    .trim(),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  parentId: z.string().optional().nullable(),
  clasSectionId: z.string().optional().nullable(),
  clasSpecificId: z.string().optional().nullable(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface UseCategoryFormProps {
  initialData?: {
    catId: string;
    nombre: string;
    descripcion?: string | null;
    parentId?: string | null;
    clasSectionId?: string | null;
    clasSpecificId?: string | null;
  };
  onSuccess?: () => void;
  usaEan13?: boolean;
  clasClassifierData?: CLASClassifierData | null;
  requireSpecificSelection?: boolean;
}

const normalizeParentId = (parentId: string | null | undefined) => {
  if (!parentId || parentId === 'none') {
    return null;
  }

  return parentId;
};

const normalizeSectionId = (sectionId: string | null | undefined) => {
  if (!sectionId) {
    return null;
  }

  return sectionId.trim();
};

const normalizeSpecificId = (specificId: string | null | undefined) => {
  if (!specificId) {
    return null;
  }

  return specificId.trim();
};

export function useCategoryForm({
  initialData,
  onSuccess,
  usaEan13 = false,
  clasClassifierData,
  requireSpecificSelection = false,
}: UseCategoryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize the form
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      descripcion: initialData?.descripcion || '',
      parentId: initialData?.parentId || 'none',
      clasSectionId: undefined,
      clasSpecificId: undefined,
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Validate category against CLAS mapping in EAN-13 mode
  const validateCLASMapping = (data: CategoryFormValues): { valid: boolean; error?: string } => {
    try {
      const sectionId = normalizeSectionId(data.clasSectionId)
      const specificId = normalizeSpecificId(data.clasSpecificId)
      const needsSpecificSelection = requireSpecificSelection || !!specificId
      const normalizedParentId = normalizeParentId(data.parentId)

      if (!needsSpecificSelection) {
        // Root category: must match a CLAS section
        if (!sectionId) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador' }
        }
        if (normalizedParentId) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador' }
        }
        // Verify the nombre matches the selected section
        const matchedSectionId = validateCLASSection(data.nombre)
        if (matchedSectionId !== sectionId) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador' }
        }
      } else {
        // Subcategory: must match a CLAS specific
        if (!sectionId || !specificId || !normalizedParentId) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador' }
        }

        const matchedSpecificId = validateCLASSpecific(data.nombre)
        if (matchedSpecificId !== specificId) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador' }
        }

        if (!clasClassifierData) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador' }
        }

        const specificSection = clasClassifierData.specificSectionById[specificId]
        if (specificSection !== sectionId) {
          return { valid: false, error: 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador' }
        }
      }
      return { valid: true }
    } catch {
      const isRootCategory = !requireSpecificSelection && !normalizeSpecificId(data.clasSpecificId)
      return {
        valid: false,
        error: isRootCategory
          ? 'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador'
          : 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador',
      }
    }
  }

  // Handle form submission
  const onSubmit = async (data: CategoryFormValues) => {
    const parentId = normalizeParentId(data.parentId)

    // Validate CLAS mapping if EAN-13 is enabled
    if (usaEan13) {
      const clasValidation = validateCLASMapping(data)

      if (!clasValidation.valid) {
        toast.error(clasValidation.error!)
        return
      }
    }

    setIsSubmitting(true);

    try {
      let result;

      if (initialData) {
        result = await updateCategoriaAction({
          catId: initialData.catId,
          nombre: data.nombre.trim(),
          descripcion: data.descripcion?.trim() || null,
          parentId,
          clasSectionId: normalizeSectionId(data.clasSectionId),
          clasSpecificId: normalizeSpecificId(data.clasSpecificId),
        });
      } else {
        result = await createCategoriaAction({
          nombre: data.nombre.trim(),
          descripcion: data.descripcion?.trim() || null,
          parentId,
          clasSectionId: normalizeSectionId(data.clasSectionId),
          clasSpecificId: normalizeSpecificId(data.clasSpecificId),
        });
      }

      if (!result.success) {
        throw new Error(result.error?.message || 'Error al guardar la categoría');
      }

      // Show success message
      toast.success(
        initialData
          ? 'Categoría actualizada correctamente'
          : 'Categoría creada correctamente'
      );

      // Call the success callback if provided
      if (onSuccess) {
        onSuccess();
      } else {
        // Default behavior: navigate to categories list
        router.push('/busy/categoria');
        router.refresh();
      }
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Ocurrió un error al guardar la categoría'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form errors
  const getFieldError = (fieldName: keyof CategoryFormValues) => {
    const error = form.formState.errors[fieldName];
    if (error) {
      return error.message as string;
    }

    return undefined;
  };

  return {
    form,
    isSubmitting,
    isValidating: false,
    onSubmit: form.handleSubmit(onSubmit),
    getFieldError,
    isDirty: form.formState.isDirty,
    isValid: form.formState.isValid,
  };
}
