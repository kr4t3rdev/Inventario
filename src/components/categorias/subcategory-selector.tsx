"use client"

import React, { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useGetCategoriasQuery, useGetSubcategoriasQuery } from "@/lib/redux/services/categoriasApi"
import { Categoria } from "../../app/models/model"

interface SubcategorySelectorProps {
  selectedCategoryId?: string
  selectedSubcategoryId?: string
  onCategoryChange: (categoryId: string) => void
  onSubcategoryChange: (subcategoryId: string | undefined) => void
  disabled?: boolean
  required?: boolean
  showLabels?: boolean
  className?: string
}

export function SubcategorySelector({
  selectedCategoryId,
  selectedSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  disabled = false,
  required = false,
  showLabels = true,
  className
}: SubcategorySelectorProps) {
  const [internalCategoryId, setInternalCategoryId] = useState(selectedCategoryId || "")
  const [internalSubcategoryId, setInternalSubcategoryId] = useState(selectedSubcategoryId || "")

  // Fetch all categories
  const { 
    data: categories = [], 
    isLoading: isLoadingCategories, 
    error: categoriesError 
  } = useGetCategoriasQuery()

  // Fetch subcategories for selected category
  const { 
    data: subcategories = [], 
    isLoading: isLoadingSubcategories, 
    error: subcategoriesError 
  } = useGetSubcategoriasQuery(internalCategoryId, {
    skip: !internalCategoryId
  })

  // Filter only parent categories (categories without parentId)
  const parentCategories = categories.filter((cat: Categoria) => !cat.parentId)

  // Update internal state when props change
  useEffect(() => {
    if (selectedCategoryId !== internalCategoryId) {
      setInternalCategoryId(selectedCategoryId || "")
    }
  }, [selectedCategoryId, internalCategoryId])

  useEffect(() => {
    if (selectedSubcategoryId !== internalSubcategoryId) {
      setInternalSubcategoryId(selectedSubcategoryId || "")
    }
  }, [selectedSubcategoryId, internalSubcategoryId])

  // Handle category selection
  const handleCategoryChange = (categoryId: string) => {
    setInternalCategoryId(categoryId)
    setInternalSubcategoryId("") // Clear subcategory when category changes
    onCategoryChange(categoryId)
    onSubcategoryChange(undefined)
  }

  // Handle subcategory selection
  const handleSubcategoryChange = (subcategoryId: string) => {
    const newSubcategoryId = subcategoryId === "none" ? undefined : subcategoryId
    setInternalSubcategoryId(subcategoryId)
    onSubcategoryChange(newSubcategoryId)
  }

  if (isLoadingCategories) {
    return (
      <div className={className}>
        {showLabels && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" data-testid="skeleton" />
            <Skeleton className="h-9 w-full" data-testid="skeleton" />
          </div>
        )}
        {!showLabels && <Skeleton className="h-9 w-full" data-testid="skeleton" />}
      </div>
    )
  }

  if (categoriesError) {
    return (
      <div className={className}>
        <div className="text-sm text-destructive">
          Error al cargar las categorías
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Category Selector */}
      <div className="space-y-2">
        {showLabels && (
          <Label htmlFor="category-select">
            Categoría {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <Select
          value={internalCategoryId}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        >
          <SelectTrigger id="category-select">
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent>
            {parentCategories.map((category: Categoria) => (
              <SelectItem key={category.catId} value={category.catId}>
                {category.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subcategory Selector */}
      {internalCategoryId && (
        <div className="space-y-2">
          {showLabels && (
            <Label htmlFor="subcategory-select">
              Subcategoría (Opcional)
            </Label>
          )}
          {isLoadingSubcategories ? (
            <Skeleton className="h-9 w-full" data-testid="skeleton" />
          ) : subcategoriesError ? (
            <div className="text-sm text-destructive">
              Error al cargar las subcategorías
            </div>
          ) : (
            <Select
              value={internalSubcategoryId}
              onValueChange={handleSubcategoryChange}
              disabled={disabled}
            >
              <SelectTrigger id="subcategory-select">
                <SelectValue placeholder="Seleccionar subcategoría (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin subcategoría</SelectItem>
                {subcategories.map((subcategory: Categoria) => (
                  <SelectItem key={subcategory.catId} value={subcategory.catId}>
                    {subcategory.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}