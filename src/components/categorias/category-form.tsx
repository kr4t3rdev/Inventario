"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCategoriasQuery } from "@/lib/redux/services/categoriasApi";
import { Categoria } from "../../app/models/model";
import { useCategoryForm } from "@/hooks/use-category-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Folder, ArrowLeft, Sparkles, Layers } from "lucide-react";
import { useDispatch } from "react-redux";
import { apiSlice } from "@/lib/redux/services/apiSlice";
import { motion, AnimatePresence } from "framer-motion";

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
  const dispatch = useDispatch()
  const { data: categorias, isLoading: isLoadingCategorias } = useGetCategoriasQuery();
  
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
    onSuccess: onSuccess || (() => {
      router.push("/busy/categoria");
      router.refresh();
      dispatch(apiSlice.util.invalidateTags(['Categorias']))
    }),
  });

  // Filter available parent categories (max depth: 2 levels)
  const availableParentCategories = (categorias || []).filter(cat => {
    // Exclude self when editing
    if (initialData?.catId === cat.catId) return false;
    
    // Calculate depth (max 2 levels deep to maintain 3 levels total)
    let depth = 0;
    let current = cat;
    while (current.parentId) {
      depth++;
      const parent = categorias?.find(c => c.catId === current.parentId);
      if (!parent) break;
      current = parent;
      if (depth >= 2) return false; // Max depth reached
    }
    
    return true;
  });

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
              className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg relative"
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
                          placeholder="Ingrese el nombre de la categoría" 
                          {...field} 
                          disabled={isLoading}
                          className={`transition-all duration-200 ${getFieldError("nombre") ? "border-destructive focus:ring-destructive" : "focus:ring-primary"}`}
                        />
                      </FormControl>
                      <FormDescription>Ingrese el nombre de la categoría.</FormDescription>
                      <FormMessage>{getFieldError("nombre")}</FormMessage>
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
                          {availableParentCategories.map((categoria, index) => (
                            <motion.div
                              key={categoria.catId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + index * 0.05 }}
                            >
                              <SelectItem value={categoria.catId}>
                                <div className="flex items-center gap-2">
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  {categoria.nombre}
                                  {categoria.descripcion && (
                                    <span className="text-muted-foreground ml-2">
                                      - {categoria.descripcion}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            </motion.div>
                          ))}
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
              
              <motion.div 
                className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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
                </motion.div>
                
                <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }} whileTap={{ scale: isLoading ? 1 : 0.98 }}>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !isDirty || !isValid}
                    className="min-w-[160px] gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
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
