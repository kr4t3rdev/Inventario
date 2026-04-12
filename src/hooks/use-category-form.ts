import { useState, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Categoria } from '../app/models/model';
import { useDispatch } from 'react-redux';
import { categoriasApi } from '@/lib/redux/services/categoriasApi';
import { mapCategoryToSection, mapSubcategoryToSpecific } from '@/lib/category-mapping';

// Define the form schema using Zod
const categoryFormSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder los 100 caracteres')
    .trim(),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  parentId: z.string().optional().nullable(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface UseCategoryFormProps {
  initialData?: {
    catId: string;
    nombre: string;
    descripcion?: string | null;
    parentId?: string | null;
  };
  onSuccess?: () => void;
  usaEan13?: boolean;
}

export function useCategoryForm({ initialData, onSuccess, usaEan13 = false }: UseCategoryFormProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});

  // Initialize the form
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      descripcion: initialData?.descripcion || '',
      parentId: initialData?.parentId || 'none',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        nombre: initialData.nombre,
        descripcion: initialData.descripcion || '',
        parentId: initialData.parentId || 'none',
      });
    }
  }, [initialData, form]);

  // Validate category data on the server
  const validateCategory = async (data: CategoryFormValues) => {
    setIsValidating(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/categorias/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          categoryId: initialData?.catId,
          name: data.nombre,
          parentId: data.parentId === 'none' ? null : data.parentId,
          descripcion: data.descripcion,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error de validación');
      }

      if (!result.isValid) {
        const message = result.error || 'Error de validación';
        if (result.field === 'name') {
          form.setError('nombre', { type: 'server', message });
        }
        toast.error(message);
        return false;
      }

      return result.isValid;
    } catch (error) {
      console.error('Error validating category:', error);
      toast.error('Error al validar la categoría. Por favor, intente nuevamente.');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Validate category against CLAS mapping in EAN-13 mode
  const validateCLASMapping = (nombre: string, parentId: string | null): boolean => {
    try {
      if (!parentId || parentId === 'none') {
        // Root category: validate against sections
        mapCategoryToSection(nombre);
      } else {
        // Subcategory: validate against specifics
        mapSubcategoryToSpecific(nombre);
      }
      return true;
    } catch (error) {
      return false;
    }
  };

  // Handle form submission
  const onSubmit = async (data: CategoryFormValues) => {
    // Clear previous errors
    setServerErrors({});
    
    // Validate CLAS mapping if EAN-13 is enabled
    if (usaEan13) {
      const parentId = data.parentId === 'none' ? null : data.parentId;
      const isCLASValid = validateCLASMapping(data.nombre, parentId);
      
      if (!isCLASValid) {
        const isRootCategory = !parentId;
        const errorMessage = isRootCategory
          ? 'Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador'
          : 'Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador';
        toast.error(errorMessage);
        return;
      }
    }
    
    // Validate on the server
    const isValid = await validateCategory(data);
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = sessionStorage.getItem('token');
      const url = initialData
        ? `/api/categorias/${initialData.catId}`
        : '/api/categorias';
      const method = initialData ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          nombre: data.nombre.trim(),
          descripcion: data.descripcion?.trim() || null,
          parentId: data.parentId === 'none' ? null : data.parentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 400 && result.errors) {
          // Handle validation errors from the server
          setServerErrors(result.errors);
          return;
        }
        throw new Error(result.message || 'Error al guardar la categoría');
      }

      // Show success message
      toast.success(
        initialData
          ? 'Categoría actualizada correctamente'
          : 'Categoría creada correctamente'
      );

      await Promise.allSettled([
        dispatch(
          categoriasApi.endpoints.getCategorias.initiate(undefined, {
            forceRefetch: true,
            subscribe: false,
          })
        ),
        dispatch(
          categoriasApi.endpoints.getCategoriaHierarchy.initiate(undefined, {
            forceRefetch: true,
            subscribe: false,
          })
        ),
      ]);

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
    
    const serverError = serverErrors[fieldName];
    if (serverError && serverError.length > 0) {
      return serverError[0];
    }
    
    return undefined;
  };

  return {
    form,
    isSubmitting,
    isValidating,
    onSubmit: form.handleSubmit(onSubmit),
    getFieldError,
    isDirty: form.formState.isDirty,
    isValid: form.formState.isValid,
  };
}
