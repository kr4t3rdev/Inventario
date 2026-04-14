"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";
import { ArrowLeft, Folder, Layers, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiSlice } from "@/lib/redux/services/apiSlice";
import { useGetCategoriasQuery } from "@/lib/redux/services/categoriasApi";
import { useCategoryForm } from "@/hooks/use-category-form";
import { parseClasClassifierMarkdown, type CLASClassifierData, type CLASSpecific } from "@/lib/clas-classifier";
import type { Categoria } from "@/app/models/model";

interface SubcategoryHierarchyFormProps {
  initialData?: {
    catId: string;
    nombre: string;
    descripcion?: string | null;
    parentId?: string | null;
  };
  onSuccess?: () => void;
}

/**
 * @description Formulario para crear o editar una subcategoría basada en categorías ya existentes.
 * @param {SubcategoryHierarchyFormProps} props - Props del formulario.
 * @returns {ReactElement} Formulario de subcategoría dependiente de una categoría padre existente.
 */
export function SubcategoryHierarchyForm({ initialData, onSuccess }: SubcategoryHierarchyFormProps): ReactElement {
  const router = useRouter();
  const dispatch = useDispatch();
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.parentId ?? "");
  const [selectedSpecificId, setSelectedSpecificId] = useState("");
  const [clasClassifierData, setClasClassifierData] = useState<CLASClassifierData | null>(null);
  const [isLoadingClassifier, setIsLoadingClassifier] = useState(false);

  const { data: categories = [], isLoading: isLoadingCategories } = useGetCategoriasQuery();
  const parentCategories = useMemo(
    () => (categories as Categoria[]).filter((cat) => !cat.parentId),
    [categories]
  );

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
    usaEan13: false,
    onSuccess: onSuccess || (() => {
      router.push("/busy/categoria");
      router.refresh();
      dispatch(apiSlice.util.invalidateTags(["Categorias"]));
    }),
  });

  const isLoading = isSubmitting || isValidating;

  const clasSectionId = useMemo(() => {
    if (!selectedCategoryId || !categories.length || !clasClassifierData) return null;
    const cat = (categories as Categoria[]).find((c) => c.catId === selectedCategoryId);
    if (!cat) return null;
    return clasClassifierData.sectionIdByName[cat.nombre?.trim().toUpperCase()] ?? null;
  }, [selectedCategoryId, categories, clasClassifierData]);

  const clasSpecifics: CLASSpecific[] = useMemo(() => {
    if (!clasSectionId || !clasClassifierData) return [];
    return clasClassifierData.specificsBySection[clasSectionId] ?? [];
  }, [clasSectionId, clasClassifierData]);

  useEffect(() => {
    if (initialData?.parentId) {
      setSelectedCategoryId(initialData.parentId);
    }
  }, [initialData?.parentId]);

  useEffect(() => {
    form.setValue("parentId", selectedCategoryId || "none");
  }, [form, selectedCategoryId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingClassifier(true);
    fetch('/clasificador.md', { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el clasificador CLAS');
        return res.text();
      })
      .then((markdown) => {
        if (!cancelled) {
          setClasClassifierData(parseClasClassifierMarkdown(markdown));
          setIsLoadingClassifier(false);
        }
      })
      .catch((error) => {
        console.error('Error loading CLAS classifier:', error);
        if (!cancelled) setIsLoadingClassifier(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSpecificId("");
    form.setValue("clasSectionId", undefined);
    form.setValue("clasSpecificId", undefined);
  };

  const handleSpecificChange = (specificId: string) => {
    setSelectedSpecificId(specificId);
    const specific = clasSpecifics.find((s) => s.id === specificId);
    if (specific) {
      form.setValue("nombre", specific.name, { shouldDirty: true, shouldValidate: true });
      form.setValue("clasSectionId", specific.sectionId, { shouldDirty: true });
      form.setValue("clasSpecificId", specificId, { shouldDirty: true });
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!selectedCategoryId) {
      event.preventDefault();
      toast.error("Debes seleccionar una categoría existente antes de guardar la subcategoría.");
      return;
    }
    if (!selectedSpecificId) {
      event.preventDefault();
      toast.error("Debes seleccionar un específico CLAS para la subcategoría.");
      return;
    }

    return onSubmit(event);
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardContent className="flex min-h-80 items-center justify-center py-10">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="font-medium text-foreground">Guardando subcategoría</p>
              <p className="text-sm">Procesando la información seleccionada.</p>
            </div>
          </div>
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
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </motion.div>
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? "Editar Subcategoría" : "Nueva Subcategoría"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Selecciona la categoría padre y el específico CLAS. El nombre se completará automáticamente.
              </p>
            </div>
          </motion.div>

          <Form {...form}>
            <form onSubmit={handleFormSubmit} className="space-y-6">
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
                        Nombre de la subcategoría *
                        <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Ingrese el nombre de la subcategoría"
                          {...field}
                          disabled={isLoading}
                          className={`transition-all duration-200 ${getFieldError("nombre") ? "border-destructive focus:ring-destructive" : "focus:ring-primary"}`}
                        />
                      </FormControl>
                      <FormDescription>
                        Se completa automáticamente al seleccionar un específico CLAS. Podés editarlo si necesitás.
                      </FormDescription>
                      <FormMessage>{getFieldError("nombre")}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="space-y-4"
              >
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Categoría padre *
                    <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                  </FormLabel>
                  {isLoadingCategories ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <Select
                      value={selectedCategoryId}
                      onValueChange={handleCategoryChange}
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría ya creada" />
                      </SelectTrigger>
                      <SelectContent>
                        {parentCategories.map((cat: Categoria) => (
                          <SelectItem key={cat.catId} value={cat.catId}>
                            {cat.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormDescription>Selecciona la sección o categoría padre ya creada en el sistema.</FormDescription>
                </FormItem>

                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Específico CLAS *
                    <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                  </FormLabel>
                  {isLoadingClassifier ? (
                    <Skeleton className="h-9 w-full" />
                  ) : (
                    <Select
                      value={selectedSpecificId}
                      onValueChange={handleSpecificChange}
                      disabled={isLoading || !selectedCategoryId || !clasSectionId || clasSpecifics.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedCategoryId
                              ? "Primero seleccioná una categoría"
                              : !clasSectionId
                              ? "La categoría no tiene sección CLAS asociada"
                              : "Selecciona el específico CLAS"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {clasSpecifics.map((specific: CLASSpecific) => (
                          <SelectItem key={specific.id} value={specific.id}>
                            {specific.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormDescription>
                    Los específicos se cargan del clasificador CLAS según la sección seleccionada. Al elegir uno se completa el nombre automáticamente.
                  </FormDescription>
                </FormItem>
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
                          placeholder="Descripción opcional para la subcategoría"
                          className="resize-none"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription>
                        Puedes agregar una descripción corta para identificar mejor esta subcategoría.
                      </FormDescription>
                      <FormMessage>{getFieldError("descripcion")}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div
                className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/busy/categoria")}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !isDirty || !isValid || !selectedCategoryId || !selectedSpecificId}
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
                      {initialData ? "Actualizar subcategoría" : "Crear subcategoría"}
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
