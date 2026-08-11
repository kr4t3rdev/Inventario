"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LazyMotion, m as motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ChevronDown, Folder, Layers, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategoriasAction } from "@/features/categorias/actions";
import { fetchMiEmpresaSettings } from '@/features/mi-empresa/lib/client-mi-empresa'
import { getCategoryLabels } from '@/features/categorias/lib/category-labels'
import { useCategoryForm } from "@/features/categorias/hooks/use-category-form";
import { ClasificadorInfoNote } from "@/features/productos/components/clasificador-info-note";
import { useAuth } from "@/contexts/auth-context";

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

export interface ClasSpecificOption {
  id: string;
  name: string;
  sectionId: string;
}

/**
 * @description Filtra específicos CLAS por nombre o ID parcial.
 * @param {ClasSpecificOption[]} specifics - Lista de específicos disponibles.
 * @param {string} searchTerm - Término de búsqueda.
 * @returns {ClasSpecificOption[]} Específicos que coinciden con el término.
 */
export function filterSpecifics(
  specifics: ClasSpecificOption[],
  searchTerm: string
): ClasSpecificOption[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return specifics;
  }

  return specifics.filter(
    (sp) =>
      sp.name.toLowerCase().includes(term) ||
      sp.id.includes(term)
  );
}

/**
 * @description Formulario dedicado para crear o editar subcategorías/específicos CLAS.
 * Usa Server Actions (getCategoriasAction / createCategoriaAction / updateCategoriaAction)
 * en lugar de RTK Query.
 *
 * @param {SubcategoryFormProps} props - Props del formulario.
 * @returns {ReactElement} Formulario de subcategorías/específicos CLAS.
 */
export function SubcategoryForm({ initialData, onSuccess }: SubcategoryFormProps): ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [usaEan13, setUsaEan13] = useState<boolean | null>(null);
  const labels = usaEan13 === null ? null : getCategoryLabels(usaEan13);
  const [clasClassifierData, setClasClassifierData] = useState<CLASClassifierData | null>(null);
  const [isClassifierLoading, setIsClassifierLoading] = useState(false);
  const [classifierError, setClassifierError] = useState<string | null>(null);
  const [specificSearch, setSpecificSearch] = useState('');
  const [specificOpen, setSpecificOpen] = useState(false);

  // Fetch categories via Server Action instead of RTK Query
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const categoriasEan13Habilitado =
    user?.role === 'admin' || user?.planFeatures?.['categorias-ean13'] === true;

  useEffect(() => {
    getCategoriasAction().then(result => {
      if (result.success) {
        setCategories((result.data ?? []) as unknown as Categoria[]);
      } else {
        setCategoriesError(true);
      }
      setIsLoadingCategories(false);
    });
  }, []);

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

  const filteredSpecifics = useMemo(() => {
    return filterSpecifics(availableSpecifics, specificSearch);
  }, [availableSpecifics, specificSearch]);

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
    setSpecificSearch('');
  }, [clasSectionId]);

  useEffect(() => {
    fetchMiEmpresaSettings(() => setUsaEan13(false))
      .then((r) => {
        if (r.success) {
          setUsaEan13(
            categoriasEan13Habilitado && r.data?.usaCodigoEan13 === true,
          )
        }
        else setUsaEan13(false)
      })
      .catch(() => setUsaEan13(false));
  }, [categoriasEan13Habilitado]);

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
  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );
  const clasTitle = initialData ? 'Editar Específico CLAS' : 'Nuevo Específico CLAS';

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
        <CardContent className="pt-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 flex items-center gap-2"
            >
            <motion.div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Layers className="h-5 w-5 text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Crea una subcategoría jerárquica estándar para organizar tus productos.
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
                        Nombre *
                        <span className="text-xs font-normal text-muted-foreground">
                          (requerido)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={usaEan13 ? "Ingrese el nombre del específico" : "Ingrese el nombre de la subcategoría"}
                          {...field}
                          disabled={isLoading}
                          className={`transition-all duration-200 ${getFieldError('nombre') ? 'border-destructive focus:ring-destructive' : 'focus:ring-primary'}`}
                        />
                      </FormControl>
                      <FormDescription>
                        {usaEan13 ? 'Nombre del específico CLAS dentro de la sección.' : 'Nombre visible de la subcategoría dentro de la categoría padre.'}
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
                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        Categoría Padre
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || (initialData?.parentId ?? '')}
                        disabled={isLoading || isLoadingCategories}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={`transition-all duration-200 ${getFieldError('parentId') ? 'border-destructive' : ''}`}
                          >
                            <SelectValue placeholder="Seleccione una categoría padre" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rootCategories.map((category) => (
                            <SelectItem key={category.catId} value={category.catId}>
                              {category.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {rootCategories.length > 0
                          ? usaEan13 ? 'Selecciona la sección bajo la cual va a vivir este específico CLAS.' : 'Selecciona la categoría raíz bajo la cual va a vivir esta subcategoría.'
                          : 'Primero necesitas crear al menos una categoría principal.'}
                      </FormDescription>
                      {categoriesError && (
                        <p className="text-sm text-destructive">
                          Error al cargar las categorías disponibles.
                        </p>
                      )}
                      <FormMessage>{getFieldError('parentId')}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={usaEan13 ? "Descripción opcional del específico CLAS" : "Descripción opcional de la subcategoría"}
                          className={`resize-none transition-all duration-200 ${getFieldError('descripcion') ? 'border-destructive' : ''}`}
                          disabled={isLoading}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        {usaEan13 ? 'Descripción opcional del específico CLAS.' : 'Descripción opcional para dar contexto adicional a la subcategoría.'}
                      </FormDescription>
                      <FormMessage>{getFieldError('descripcion')}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                className="flex flex-col justify-end gap-4 border-t pt-4 sm:flex-row"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => router.push('/busy/categoria')}
                    disabled={isLoading}
                    className="cursor-pointer gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancelar
                  </Button>
                </motion.div>

                <motion.div
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={
                      isLoading ||
                      !form.watch('parentId') ||
                      rootCategories.length === 0
                    }
                    className="min-w-40 cursor-pointer gap-2 bg-linear-to-r from-primary to-purple hover:from-primary/90 hover:to-purple/90"
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Loader2 className="h-4 w-4" />
                        </motion.div>
                        {initialData ? 'Actualizando...' : 'Creando...'}
                      </>
                    ) : initialData ? (
                      usaEan13 ? 'Actualizar específico CLAS' : 'Actualizar subcategoría'
                    ) : (
                      usaEan13 ? 'Crear específico CLAS' : 'Crear subcategoría'
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>
          </Form>
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
              className="w-10 h-10 bg-linear-to-br from-primary to-purple rounded-xl flex items-center justify-center shadow-lg relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Folder className="h-5 w-5 text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {clasTitle}
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
                      ? usaEan13 ? 'Debe crear secciones CLAS para después elegir los específicos correspondientes.' : 'Debe crear categorías para después elegir las subcategorías correspondientes.'
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
                  <FormLabel>{usaEan13 ? 'Específico CLAS *' : 'Subcategoría *'}</FormLabel>
                  <Popover open={specificOpen} onOpenChange={setSpecificOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLoading || !clasSectionId}
                        className="w-full justify-between font-normal"
                      >
                        {clasSpecificId && selectedSpecificName ? (
                          <span className="flex items-center gap-2 truncate">
                            <span className="font-mono text-xs text-muted-foreground">{clasSpecificId}</span>
                            <span className="truncate">{selectedSpecificName}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {clasSectionId ? 'Seleccione un específico' : 'Primero seleccione una sección'}
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <div className="p-2">
                        <div className="flex items-center gap-2 px-2 pb-2">
                          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input
                            placeholder="Buscar por nombre o ID…"
                            value={specificSearch}
                            onChange={(e) => setSpecificSearch(e.target.value)}
                            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                          />
                          {specificSearch && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => setSpecificSearch('')}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <ScrollArea className="h-60">
                          {filteredSpecifics.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                              Sin resultados
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {filteredSpecifics.map((specific) => (
                                <button
                                  key={specific.id}
                                  type="button"
                                  onClick={() => {
                                    const parentCategoryId = resolveClasParentCategoryId(availableSections, clasSectionId ?? '');
                                    if (parentCategoryId) {
                                      form.setValue('nombre', specific.name);
                                      form.setValue('clasSectionId', specific.sectionId);
                                      form.setValue('clasSpecificId', specific.id);
                                      form.setValue('parentId', parentCategoryId);
                                      setSpecificOpen(false);
                                    }
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted rounded-sm transition-colors"
                                >
                                  <span className="font-mono text-xs font-semibold text-primary shrink-0 w-10">
                                    {specific.id}
                                  </span>
                                  <span className="truncate">{specific.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>El específico se filtra según la sección seleccionada. Podés buscar por nombre o ID.</FormDescription>
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
                    <div>{usaEan13 ? 'Específico:' : 'Subcategoría:'} {selectedSpecificName || (usaEan13 ? 'Sin seleccionar' : 'Sin seleccionar')}</div>
                  </div>
                </FormItem>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
              >
                <ClasificadorInfoNote mode="all-specifics" />
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
                  disabled={isLoading || !clasSpecificId}
                  className="min-w-40 gap-2 bg-linear-to-r from-primary to-purple hover:from-primary/90 hover:to-purple/90 cursor-pointer"
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
