'use client'

import { useEffect, useMemo } from 'react'
import { LazyMotion, m as motion, AnimatePresence } from 'framer-motion'
import { Filter, X, Tag, Tags } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCategorias } from '@/features/categorias/hooks/use-categorias'

interface ProductFiltersProps {
  onCategoryFilter: (categoryId: string | null) => void
  onSubcategoryFilter: (subcategoryId: string | null) => void
  selectedCategory: string | null
  selectedSubcategory: string | null
}

/**
 * @description Filtros visuales para categoría y subcategoría en la tabla de productos.
 * @param {ProductFiltersProps} props - Estado actual de filtros y handlers de cambio.
 * @returns {JSX.Element} Tarjeta de filtros con animaciones y soporte de modo oscuro.
 */
export function ProductFilters({
  onCategoryFilter,
  onSubcategoryFilter,
  selectedCategory,
  selectedSubcategory,
}: ProductFiltersProps): React.JSX.Element {
  const { categorias, isLoading: isLoadingCategorias } = useCategorias()
  const subcategorias = useMemo(() => {
    if (!selectedCategory) return []
    return categorias.filter((cat) => cat.parentId === selectedCategory)
  }, [categorias, selectedCategory])
  const isLoadingSubcategorias = false

  useEffect(() => {
    if (!selectedCategory || !selectedSubcategory) return

    const subcategoryBelongsToCategory = subcategorias?.some(
      (subcategoria) => subcategoria.catId === selectedSubcategory
    )

    if (!subcategoryBelongsToCategory) {
      onSubcategoryFilter(null)
    }
  }, [selectedCategory, selectedSubcategory, subcategorias, onSubcategoryFilter])

  const handleCategoryChange = (value: string) => {
    if (value === 'all') {
      onCategoryFilter(null)
      onSubcategoryFilter(null)
      return
    }

    onCategoryFilter(value)
    onSubcategoryFilter(null)
  }

  const handleSubcategoryChange = (value: string) => {
    if (value === 'all') {
      onSubcategoryFilter(null)
      return
    }

    onSubcategoryFilter(value)
  }

  const clearAllFilters = () => {
    onCategoryFilter(null)
    onSubcategoryFilter(null)
  }

  const hasActiveFilters = Boolean(selectedCategory || selectedSubcategory)
  const parentCategories = categorias?.filter((category) => !category.parentId) || []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="mb-4 overflow-hidden border-dashed bg-linear-to-br from-primary/[0.06] via-background to-purple/[0.08] dark:from-primary/10 dark:to-purple/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-lg">
            <motion.div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple text-white shadow-lg"
              whileHover={{ scale: 1.05, rotate: 4 }}
              transition={{ duration: 0.2 }}
            >
              <Filter className="h-5 w-5" />
            </motion.div>
            <div>
              <p>Filtros por Categoría</p>
              <p className="text-sm font-normal text-muted-foreground">
                Refina la tabla por categorías y subcategorías
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <Select
                value={selectedCategory || 'all'}
                onValueChange={handleCategoryChange}
                disabled={isLoadingCategorias}
              >
                <SelectTrigger className="w-full min-w-[230px] bg-background/90 transition-all duration-200 focus-visible:ring-primary/30 md:w-[260px]">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {parentCategories.map((category) => (
                    <SelectItem key={category.catId} value={category.catId}>
                      {category.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AnimatePresence mode="wait">
              {selectedCategory && (
                <motion.div
                  key="subcategory-filter"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tags className="h-4 w-4 text-primary" />
                  <Select
                    value={selectedSubcategory || 'all'}
                    onValueChange={handleSubcategoryChange}
                    disabled={isLoadingSubcategorias}
                  >
                    <SelectTrigger className="w-full min-w-[230px] bg-background/90 transition-all duration-200 focus-visible:ring-primary/30 md:w-[260px]">
                      <SelectValue placeholder="Seleccionar subcategoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las subcategorías</SelectItem>
                      {subcategorias?.map((subcategoria) => (
                        <SelectItem key={subcategoria.catId} value={subcategoria.catId}>
                          {subcategoria.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            {hasActiveFilters && (
              <motion.div
                className="md:ml-auto"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="gap-1 border-dashed"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              </motion.div>
            )}
          </div>

          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                className="flex flex-wrap items-center gap-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <span className="text-sm text-muted-foreground">Activos:</span>
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-1 rounded-full border border-border/60">
                    <Tag className="h-3 w-3" />
                    {parentCategories.find((category) => category.catId === selectedCategory)?.nombre}
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('all')}
                      aria-label="Quitar filtro de categoría"
                      className="ml-1 rounded-full p-0.5 transition-colors hover:bg-secondary-foreground/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
                {selectedSubcategory && (
                  <Badge variant="outline" className="gap-1 rounded-full border-border/70 bg-background/80">
                    <Tags className="h-3 w-3" />
                    {subcategorias?.find((subcategoria) => subcategoria.catId === selectedSubcategory)?.nombre}
                    <button
                      type="button"
                      onClick={() => handleSubcategoryChange('all')}
                      aria-label="Quitar filtro de subcategoría"
                      className="ml-1 rounded-full p-0.5 transition-colors hover:bg-muted"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}
