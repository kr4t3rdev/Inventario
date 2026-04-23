"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Folder, Layers, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiSlice } from "@/lib/redux/services/apiSlice";
import { useGetCategoriasQuery } from "@/lib/redux/services/categoriasApi";
import { useCategoryForm } from "@/hooks/use-category-form";
import { ClasificadorInfoNote } from "@/components/productos/clasificador-info-note";
import { getAuthToken } from "@/lib/token";
import type { Categoria } from "@/app/models/model";
import {
  CLASClassifierData,
  getSpecificsForSection,
  parseClasClassifierMarkdown,
  validateCLASSection,
} from "@/lib/clas-classifier";

interface SubcategoryFormProps {
  initialData?: {
    catId: string;
    nombre: string;
    descripcion?: string | null;
    parentId?: string | null;
    clasSectionId?: string | null;
    clasSpecificId?: string | null;
  };
  onSuccess?: () => void;
}

interface AvailableClasSection {
  sectionId: string;
  sectionName: string;
  parentCategoryId: string;
  parentCategoryName: string;
}

/**
 * @description Deriva las secciones CLAS que ya tienen una categoría raíz creada.
 * @param {Categoria[]} categories - Categorías disponibles en el sistema.
 * @param {CLASClassifierData | null} classifier - Clasificador CLAS cargado.
 * @returns {AvailableClasSection[]} Secciones válidas para crear subcategorías.
 */
export function buildAvailableClasSections(
  categories: Categoria[],
  classifier: CLASClassifierData | null
): AvailableClasSection[] {
  if (!classifier) {
    return [];
  }

  const sectionsById = new Map<string, AvailableClasSection>();

  categories
    .filter((category) => !category.parentId)
    .forEach((category) => {
      const sectionId = validateCLASSection(category.nombre);
      if (!sectionId || sectionsById.has(sectionId)) {
        return;
      }

      const sectionName = classifier.sectionNameById[sectionId];
      if (!sectionName) {
        return;
      }

      sectionsById.set(sectionId, {
        sectionId,
        sectionName,
        parentCategoryId: category.catId,
        parentCategoryName: category.nombre,
      });
    });

  return Array.from(sectionsById.values()).sort((left, right) =>
    left.sectionName.localeCompare(right.sectionName)
  );
}

/**
 * @description Resuelve la categoría padre real asociada a una sección CLAS seleccionada.
 * @param {AvailableClasSection[]} availableSections - Secciones CLAS disponibles en el form.
 * @param {string} sectionId - Sección seleccionada.
 * @returns {string | null} Id de la categoría padre creada o null si no existe.
 */
export function resolveClasParentCategoryId(
  availableSections: AvailableClasSection[],
  sectionId: string
): string | null {
  return availableSections.find((section) => section.sectionId === sectionId)?.parentCategoryId ?? null;
}

/**
 * @description Formulario dedicado para crear o editar subcategorías/específicos CLAS.
 * @param {SubcategoryFormProps} props - Props del formulario.
 * @returns {ReactElement} Formulario de subcategorías/específicos CLAS.
 */
export function SubcategoryForm({ initialData, onSuccess }: SubcategoryFormProps): ReactElement {
  const router = useRouter();
  const dispatch = useDispatch();
  const [usaEan13, setUsaEan13] = useState<boolean | null>(null);
  const [clasClassifierData, setClasClassifierData] = useState<CLASClassifierData | null>(null);
  const [isClassifierLoading, setIsClassifierLoading] = useState(false);
  const [classifierError, setClassifierError] = useState<string | null>(null);

  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useGetCategoriasQuery();

  const availableSections = useMemo(() => {
    return buildAvailableClasSections(categories, clasClassifierData);
  }, [categories, clasClassifierData]);

  const {
    form,
    isSubmitting,
    isValidating,
    onSubmit,
    getFieldError,
    isDirty,
    isValid,
  } = useCategoryForm({
    initialData,
    usaEan13: usaEan13 === true,
    clasClassifierData,
    requireSpecificSelection: true,
    onSuccess: onSuccess || (() => {
      router.push('/busy/categoria');
      router.refresh();
      dispatch(apiSlice.util.invalidateTags(['Categorias']));
    }),
  });

  const clasSectionId = form.watch('clasSectionId');
  const clasSpecificId = form.watch('clasSpecificId');

  const availableSpecifics = useMemo(() => {
    if (!clasClassifierData || !clasSectionId) {
      return [];
    }

    return getSpecificsForSection(clasClassifierData, clasSectionId);
  }, [clasClassifierData, clasSectionId]);

  const selectedSectionName = useMemo(() => {
    return availableSections.find((section) => section.sectionId === clasSectionId)?.sectionName ?? '';
  }, [availableSections, clasSectionId]);

  const selectedSpecificName = useMemo(() => {
    if (!clasClassifierData || !clasSpecificId) {
      return '';
    }

    return clasClassifierData.specificNameById[clasSpecificId] ?? '';
  }, [clasClassifierData, clasSpecificId]);

  useEffect(() => {
    const token = getAuthToken();
    fetch('/api/mi-empresa', {
      headers: token ? { Authorization: token } : undefined,
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((data) => setUsaEan13(data?.usaCodigoEan13 ?? false))
      .catch(() => setUsaEan13(false));
  }, []);

  useEffect(() => {
    if (usaEan13 !== true) {
      setClasClassifierData(null);
      setIsClassifierLoading(false);
      return;
    }

    let cancelled = false;
    setIsClassifierLoading(true);
    setClassifierError(null);

    fetch('/clasificador.md', { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('No se pudo cargar el clasificador CLAS');
        }

        return response.text();
      })
      .then((markdown) => {
        if (cancelled) {
          return;
        }

        setClasClassifierData(parseClasClassifierMarkdown(markdown));
      })
      .catch((error) => {
        console.error('Error loading CLAS classifier:', error);
        if (!cancelled) {
          setClassifierError('No se pudo cargar el clasificador CLAS');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsClassifierLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [usaEan13]);

  useEffect(() => {
    if (
      usaEan13 !== true ||
      !clasClassifierData ||
      !initialData ||
      !initialData.clasSectionId ||
      !initialData.clasSpecificId
    ) {
      return;
    }

    const parentCategoryId = resolveClasParentCategoryId(availableSections, initialData.clasSectionId);
    const specificName = clasClassifierData.specificNameById[initialData.clasSpecificId];

    form.setValue('clasSectionId', initialData.clasSectionId);
    form.setValue('clasSpecificId', initialData.clasSpecificId);
    form.setValue('parentId', parentCategoryId ?? initialData.parentId ?? null);
    if (specificName) {
      form.setValue('nombre', specificName);
    }
  }, [usaEan13, clasClassifierData, initialData, availableSections, form]);

  const isLoading = isSubmitting || isValidating;
  const showMissingSectionsMessage =
    !isLoadingCategories &&
    !categoriesError &&
    availableSections.length === 0;

  if (usaEan13 === null || isClassifierLoading) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="flex min-h-80 items-center justify-center py-10">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="font-medium text-foreground">Cargando formulario CLAS</p>
              <p className="text-sm">Estamos preparando el clasificador oficial para subcategorías.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usaEan13) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="space-y-4 py-10">
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-semibold">Formulario disponible solo en modo EAN-13</h3>
              <p className="text-sm text-muted-foreground">
                Para usar este flujo de subcategoría o específico, primero activa la generación EAN-13 en la empresa.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="gap-2">
            <Link href="/busy/categoria">
              <ArrowLeft className="h-4 w-4" />
              Volver a categorías
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (classifierError) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="space-y-4 py-10">
          <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-semibold">No se pudo cargar el clasificador</h3>
              <p className="text-sm text-muted-foreground">{classifierError}</p>
            </div>
          </div>

          <Button asChild variant="outline" className="gap-2">
            <Link href="/busy/categoria">
              <ArrowLeft className="h-4 w-4" />
              Volver a categorías
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden border-dashed">
        <CardContent className="pt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 mb-6"
          >
            <motion.div
              className="w-10 h-10 bg-linear-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Folder className="h-5 w-5 text-white" />
              <motion.div
                animate={{
                  rotate: 360,
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </motion.div>
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? 'Editar Subcategoría / Específico' : 'Nueva Subcategoría / Específico'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Selecciona la sección CLAS y luego el específico que deseas registrar.
              </p>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Nombre específico *
                        <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Seleccione sección y específico CLAS"
                          {...field}
                          disabled={isLoading}
                          className={`transition-all duration-200 ${getFieldError('nombre') ? 'border-destructive focus:ring-destructive' : 'focus:ring-primary'}`}
                          readOnly
                        />
                      </FormControl>
                      <FormDescription>
                        El nombre se completa automáticamente con el específico seleccionado.
                      </FormDescription>
                      <FormMessage>{getFieldError('nombre')}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
                <FormItem>
                  <FormLabel>Sección del Clasificador *</FormLabel>
                  <Select
                    value={clasSectionId ?? ''}
                    onValueChange={(val) => {
                      const parentCategoryId = resolveClasParentCategoryId(availableSections, val);
                      if (parentCategoryId) {
                        form.setValue('nombre', '');
                        form.setValue('clasSectionId', val);
                        form.setValue('clasSpecificId', null);
                        form.setValue('parentId', parentCategoryId);
                      }
                    }}
                    disabled={isLoading || isLoadingCategories || showMissingSectionsMessage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una sección" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.map((section) => (
                        <SelectItem key={section.sectionId} value={section.sectionId}>
                          {section.sectionName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {showMissingSectionsMessage
                      ? 'Debe crear secciones o categorias para despues elegir las subcategorias correspondientes'
                      : 'Selecciona la sección oficial del clasificador CLAS que ya existe como categoría.'}
                  </FormDescription>
                  {categoriesError && (
                    <p className="text-sm text-destructive">
                      Error al cargar las categorías disponibles.
                    </p>
                  )}
                </FormItem>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.27 }}
              >
                <FormItem>
                  <FormLabel>Específico (subcategoría) *</FormLabel>
                  <Select
                    value={clasSpecificId ?? ''}
                    onValueChange={(val) => {
                      const parentCategoryId = resolveClasParentCategoryId(availableSections, clasSectionId ?? '');
                      const specific = availableSpecifics.find((sp) => sp.id === val);
                      if (specific && parentCategoryId) {
                        form.setValue('nombre', specific.name);
                        form.setValue('clasSectionId', specific.sectionId);
                        form.setValue('clasSpecificId', val);
                        form.setValue('parentId', parentCategoryId);
                      }
                    }}
                    disabled={isLoading || !clasSectionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={clasSectionId ? 'Seleccione un específico' : 'Primero seleccione una sección'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSpecifics.map((specific) => (
                        <SelectItem key={specific.id} value={specific.id}>
                          {specific.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>El específico se filtra según la sección seleccionada.</FormDescription>
                </FormItem>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.29 }}
              >
                <FormItem>
                  <FormLabel>Resumen CLAS</FormLabel>
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground space-y-1">
                    <div>Sección: {selectedSectionName || 'Sin seleccionar'}</div>
                    <div>Subcategoría: {selectedSpecificName || 'Sin seleccionar'}</div>
                  </div>
                </FormItem>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
              >
                <ClasificadorInfoNote />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
              >
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descripción opcional para el específico"
                          className="resize-none"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription>Agrega una descripción corta si quieres identificar mejor el específico.</FormDescription>
                      <FormMessage>{getFieldError('descripcion')}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/busy/categoria')}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !isDirty || !isValid || !clasSpecificId}
                  className="min-w-40 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Layers className="h-4 w-4" />
                      {initialData ? 'Actualizar específico' : 'Crear específico'}
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
