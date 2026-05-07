"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCategoriasQuery } from "@/features/categorias/api/categoriasApi";
import { useCategoryForm } from "@/features/categorias/hooks/use-category-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Folder, ArrowLeft, Sparkles, Layers } from "lucide-react";
import { useDispatch } from "react-redux";
import { apiSlice } from "@/lib/redux/services/apiSlice";
import { motion } from "framer-motion";
import { ClasificadorInfoNote } from "@/components/productos/clasificador-info-note";
import { getAuthToken } from "@/lib/token";
import { 
  CLASClassifierData,
  parseClasClassifierMarkdown,
} from "@/lib/clas-classifier";

interface CategoryFormProps {
  initialData?: {
    catId: string;
    nombre: string;
    descripcion?: string | null;
    parentId?: string | null;
  };
  onSuccess?: () => void;
}

// Loading spinner component
function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="border-2 border-primary border-t-transparent rounded-full"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  )
}

// Pulse skeleton
function PulseSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  )
}

export function CategoryForm({ initialData, onSuccess }: CategoryFormProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isLoading: isLoadingCategorias } = useGetCategoriasQuery();
  const [usaEan13, setUsaEan13] = useState(false)
  const [clasClassifierData, setClasClassifierData] = useState<CLASClassifierData | null>(null)
  const [selectedSection, setSelectedSection] = useState('')

  const clasSections = useMemo(() => {
    return clasClassifierData?.sections ?? []
  }, [clasClassifierData])

  const selectedSectionName = useMemo(() => {
    if (!clasClassifierData || !selectedSection) {
      return ''
    }

    return clasClassifierData.sectionNameById[selectedSection] ?? ''
  }, [clasClassifierData, selectedSection])

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
    usaEan13,
    clasClassifierData,
    onSuccess: onSuccess || (() => {
      router.push("/busy/categoria");
      router.refresh();
      dispatch(apiSlice.util.invalidateTags(['Categorias']))
    }),
  });

  useEffect(() => {
    const token = getAuthToken()
    fetch('/api/mi-empresa', {
      headers: token ? { Authorization: token } : undefined,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => setUsaEan13(data?.usaCodigoEan13 ?? false))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!usaEan13) {
      setClasClassifierData(null)
      return
    }

    let cancelled = false

    fetch('/clasificador.md', { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('No se pudo cargar el clasificador CLAS')
        }

        return response.text()
      })
      .then((markdown) => {
        if (cancelled) {
          return
        }

        setClasClassifierData(parseClasClassifierMarkdown(markdown))
      })
      .catch((error) => {
        console.error('Error loading CLAS classifier:', error)
      })

    return () => {
      cancelled = true
    }
  }, [usaEan13])

  useEffect(() => {
    if (!usaEan13 || !clasClassifierData || !initialData?.nombre) {
      return
    }

    const normalizedName = initialData.nombre.trim().toUpperCase()
    const sectionMatch = clasClassifierData.sections.find(
      (section) => section.name.trim().toUpperCase() === normalizedName
    )

    if (sectionMatch) {
      setSelectedSection(sectionMatch.id)
      form.setValue('clasSectionId', sectionMatch.id)
      form.setValue('clasSpecificId', null)
      return
    }

    const specificMatch = clasClassifierData.specifics.find(
      (specific) => specific.name.trim().toUpperCase() === normalizedName
    )

    if (specificMatch) {
      setSelectedSection(specificMatch.sectionId)
      form.setValue('clasSectionId', specificMatch.sectionId)
      form.setValue('clasSpecificId', specificMatch.id)
    }
  }, [usaEan13, clasClassifierData, form, initialData?.nombre])

  // Loading state for the form
  const isLoading = isSubmitting || isValidating;

  // Show loading skeleton when categories are loading
  if (isLoadingCategorias) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <PulseSkeleton className="h-6 w-6" />
                <PulseSkeleton className="h-6 w-48" />
              </div>
              <PulseSkeleton className="h-10 w-full" />
              <PulseSkeleton className="h-20 w-full" />
              <PulseSkeleton className="h-10 w-full" />
              <div className="flex justify-end space-x-4">
                <PulseSkeleton className="h-10 w-24" />
                <PulseSkeleton className="h-10 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
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
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </motion.div>
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold">
                {initialData ? "Editar Categoría" : "Nueva Categoría"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialData 
                  ? "Modifica los datos de la categoría existente" 
                  : "Crea una nueva categoría para organizar tus productos"
                }
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
                        <span className="text-xs text-muted-foreground font-normal">(requerido)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={usaEan13 ? "Seleccione clasificación CLAS abajo" : "Ingrese el nombre de la categoría"}
                          {...field}
                          disabled={isLoading || usaEan13}
                          className={`transition-all duration-200 ${getFieldError("nombre") ? "border-destructive focus:ring-destructive" : "focus:ring-primary"}`}
                          readOnly={usaEan13}
                        />
                      </FormControl>
                      <FormDescription>
                        {usaEan13 ? "Nombre auto-asignado según clasificación CLAS" : "Ingrese el nombre de la categoría."}
                      </FormDescription>
                      <FormMessage>{getFieldError("nombre")}</FormMessage>
                    </FormItem>
                  )}
                />
              </motion.div>

              {usaEan13 && (
                <>
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                    <FormItem>
                      <FormLabel>Sección del Clasificador *</FormLabel>
                      <Select
                        value={selectedSection}
                        onValueChange={(val) => {
                          setSelectedSection(val)
                          const sectionName = clasClassifierData?.sectionNameById[val] ?? ''
                          if (sectionName) {
                            form.setValue('nombre', sectionName)
                            form.setValue('clasSectionId', val)
                            form.setValue('clasSpecificId', null)
                          }
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione una sección" />
                        </SelectTrigger>
                        <SelectContent>
                          {clasSections.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Sección del clasificador para una categoría raíz en modo EAN-13.</FormDescription>
                    </FormItem>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.29 }}>
                    <FormItem>
                      <FormLabel>Resumen CLAS</FormLabel>
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground space-y-1">
                        <div>Sección: {selectedSectionName || 'Sin seleccionar'}</div>
                      </div>
                    </FormItem>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                    <ClasificadorInfoNote />
                  </motion.div>
                </>
              )}

              {!usaEan13 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
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
                          value={field.value || (initialData?.parentId ? initialData.parentId : "none")}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger className={`transition-all duration-200 ${getFieldError("parentId") ? "border-destructive" : ""}`}>
                              <SelectValue placeholder="Seleccione una categoría padre (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-primary" />
                                Sin categoría padre (categoría principal)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Seleccione una categoría padre para crear una subcategoría.
                          <br />
                          <span className="text-amber-600 dark:text-amber-400">
                            Máximo 3 niveles de profundidad permitidos.
                          </span>
                        </FormDescription>
                        <FormMessage>{getFieldError("parentId")}</FormMessage>
                      </FormItem>
                    )}
                  />
                </motion.div>
              )}

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
                          placeholder="Descripción opcional de la categoría"
                          className={`resize-none transition-all duration-200 ${getFieldError("descripcion") ? "border-destructive" : ""}`}
                          disabled={isLoading}
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Descripción opcional para mejor organización de la categoría.
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
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => router.push("/busy/categoria")}
                    disabled={isLoading}
                    className="gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Cancelar
                  </Button>
                </motion.div>
                
                <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !isDirty || !isValid}
                    className="min-w-40 gap-2 bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-4 w-4" />
                        </motion.div>
                        {initialData ? "Actualizando..." : "Creando..."}
                      </>
                    ) : initialData ? (
                      "Actualizar categoría"
                    ) : (
                      "Crear categoría"
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
