"use client"

import React, { useEffect, useState } from 'react';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { getParentCategories, getSubcategoriesForCategory } from './subcategory-selector.utils';

interface CategoriaOption {
  catId: string;
  nombre: string;
  parentId?: string | null;
}

interface SubcategorySelectorProps {
  categories: CategoriaOption[];
  selectedCategoryId?: string
  selectedSubcategoryId?: string
  onCategoryChange: (categoryId: string) => void
  onSubcategoryChange: (subcategoryId: string | undefined) => void
  disabled?: boolean
  required?: boolean
  showLabels?: boolean
  className?: string
  usaEan13?: boolean
}

export function SubcategorySelector({
  categories,
  selectedCategoryId,
  selectedSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  disabled = false,
  required = false,
  showLabels = true,
  className,
  usaEan13 = false
}: SubcategorySelectorProps) {
  const [internalCategoryId, setInternalCategoryId] = useState(selectedCategoryId || '');
  const [internalSubcategoryId, setInternalSubcategoryId] = useState(selectedSubcategoryId || '');

  const parentCategories = getParentCategories(categories);
  const subcategories = getSubcategoriesForCategory(categories, internalCategoryId);

  useEffect(() => {
    if (selectedCategoryId !== internalCategoryId) {
      setInternalCategoryId(selectedCategoryId || '');
    }
  }, [selectedCategoryId, internalCategoryId])

  useEffect(() => {
    if (selectedSubcategoryId !== internalSubcategoryId) {
      setInternalSubcategoryId(selectedSubcategoryId || '');
    }
  }, [selectedSubcategoryId, internalSubcategoryId])

  const handleCategoryChange = (categoryId: string) => {
    setInternalCategoryId(categoryId);
    setInternalSubcategoryId('');
    onCategoryChange(categoryId);
    onSubcategoryChange(undefined);
  };

  const handleSubcategoryChange = (subcategoryId: string) => {
    const newSubcategoryId = subcategoryId === 'none' ? undefined : subcategoryId;
    setInternalSubcategoryId(subcategoryId);
    onSubcategoryChange(newSubcategoryId);
  };

  return (
    <div className={`space-y-4 ${className}`}>
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
            {parentCategories.map((category) => (
              <SelectItem key={category.catId} value={category.catId}>
                {category.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {showLabels && (
          <Label htmlFor="subcategory-select">
            {usaEan13 ? 'Específico CLAS' : 'Subcategoría'} {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <Select
          value={internalSubcategoryId}
          onValueChange={handleSubcategoryChange}
          disabled={disabled || !internalCategoryId}
        >
          <SelectTrigger id="subcategory-select">
            <SelectValue
              placeholder={
                !internalCategoryId
                  ? 'Primero selecciona una categoría'
                  : required
                    ? usaEan13 ? 'Seleccionar específico CLAS' : 'Seleccionar subcategoría'
                    : usaEan13 ? 'Seleccionar específico CLAS (opcional)' : 'Seleccionar subcategoría (opcional)'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {internalCategoryId && (
              <>
                {!required && <SelectItem value="none">{usaEan13 ? 'Sin específico CLAS' : 'Sin subcategoría'}</SelectItem>}
                {subcategories.map((subcategory) => (
                  <SelectItem key={subcategory.catId} value={subcategory.catId}>
                    {subcategory.nombre}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
