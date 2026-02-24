/**
 * Validation utilities for category and subcategory operations
 * Implements business rules for hierarchical category management
 */

import { z } from "zod"
import prisma from "@/lib/prisma"

// Zod schema for category creation/update
export const CategoriaSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .refine((val) => val.trim().length > 0, "El nombre no puede estar vacío"),
  
  descripcion: z
    .string()
    .max(500, "La descripción no puede exceder 500 caracteres")
    .optional(),
  
  parentId: z
    .string()
    .optional()
    .nullable()
})

export type CategoriaInput = z.infer<typeof CategoriaSchema>

/**
 * Validation result interface
 */
export interface CategoriaValidationResult {
  success: boolean
  data?: CategoriaInput
  errors?: CategoriaValidationError[]
}

/**
 * Category validation error interface
 */
export interface CategoriaValidationError {
  code: string
  message: string
  field?: string
  details?: Record<string, any>
}

/**
 * Error codes for category validation
 */
export enum CategoriaErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  DUPLICATE_NAME = 'DUPLICATE_NAME',
  PARENT_NOT_FOUND = 'PARENT_NOT_FOUND',
  CATEGORY_HAS_PRODUCTS = 'CATEGORY_HAS_PRODUCTS',
  CATEGORY_HAS_SUBCATEGORIES = 'CATEGORY_HAS_SUBCATEGORIES',
  SUBCATEGORY_MISMATCH = 'SUBCATEGORY_MISMATCH',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND'
}

/**
 * Error messages in Spanish
 */
export const CATEGORIA_ERROR_MESSAGES = {
  [CategoriaErrorCode.INVALID_INPUT]: "Datos de entrada inválidos",
  [CategoriaErrorCode.CIRCULAR_REFERENCE]: "No se puede crear una referencia circular en las categorías",
  [CategoriaErrorCode.MAX_DEPTH_EXCEEDED]: "Se ha excedido la profundidad máxima de categorías (3 niveles)",
  [CategoriaErrorCode.DUPLICATE_NAME]: "Ya existe una categoría con este nombre en el mismo nivel",
  [CategoriaErrorCode.PARENT_NOT_FOUND]: "Categoría padre no encontrada",
  [CategoriaErrorCode.CATEGORY_HAS_PRODUCTS]: "No se puede eliminar una categoría que tiene productos asignados",
  [CategoriaErrorCode.CATEGORY_HAS_SUBCATEGORIES]: "No se puede eliminar una categoría que tiene subcategorías",
  [CategoriaErrorCode.SUBCATEGORY_MISMATCH]: "La subcategoría debe pertenecer a la misma categoría padre",
  [CategoriaErrorCode.CATEGORY_NOT_FOUND]: "Categoría no encontrada"
}

/**
 * Maximum hierarchy depth allowed (3 levels: Category > Subcategory > Sub-subcategory)
 */
export const MAX_HIERARCHY_DEPTH = 3

/**
 * Category validation class with comprehensive business rule validation
 */
export class CategoriaValidator {
  /**
   * Validate category input data
   */
  static validateCategoriaInput(data: unknown): CategoriaValidationResult {
    try {
      const result = CategoriaSchema.safeParse(data)
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        }
      }

      const errors: CategoriaValidationError[] = result.error.errors.map(zodError => ({
        code: CategoriaErrorCode.INVALID_INPUT,
        message: zodError.message,
        field: zodError.path.join('.')
      }))

      return {
        success: false,
        errors
      }

    } catch (error) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.INVALID_INPUT,
          message: "Error al validar los datos de entrada",
          details: { error }
        }]
      }
    }
  }

  /**
   * Check if creating/updating a category would create a circular reference
   */
  static async validateCircularReference(
    categoryId: string | null,
    parentId: string | null
  ): Promise<CategoriaValidationResult> {
    if (!parentId || !categoryId) {
      return { success: true }
    }

    // Category cannot be its own parent
    if (categoryId === parentId) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.CIRCULAR_REFERENCE,
          message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.CIRCULAR_REFERENCE],
          details: { categoryId, parentId }
        }]
      }
    }

    // Check if the new parent is a descendant of the current category
    const isDescendant = await this.checkIfDescendant(categoryId, parentId)
    if (isDescendant) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.CIRCULAR_REFERENCE,
          message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.CIRCULAR_REFERENCE],
          details: { categoryId, parentId }
        }]
      }
    }

    return { success: true }
  }

  /**
   * Check if a category is a descendant of another category
   */
  private static async checkIfDescendant(categoryId: string, potentialAncestorId: string): Promise<boolean> {
    try {
      const category = await prisma.categoria.findUnique({
        where: { catId: potentialAncestorId },
        include: { parent: true }
      })
      
      if (!category || !category.parent) {
        return false
      }
      
      if (category.parent.catId === categoryId) {
        return true
      }
      
      return await this.checkIfDescendant(categoryId, category.parent.catId)
    } catch (error) {
      console.error('Error checking descendant relationship:', error)
      return false
    }
  }

  /**
   * Validate maximum hierarchy depth
   */
  static async validateHierarchyDepth(parentId: string | null): Promise<CategoriaValidationResult> {
    if (!parentId) {
      return { success: true } // Root categories are always valid
    }

    try {
      const depth = await this.calculateCategoryDepth(parentId)
      
      if (depth >= MAX_HIERARCHY_DEPTH) {
        return {
          success: false,
          errors: [{
            code: CategoriaErrorCode.MAX_DEPTH_EXCEEDED,
            message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.MAX_DEPTH_EXCEEDED],
            details: { currentDepth: depth, maxDepth: MAX_HIERARCHY_DEPTH }
          }]
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.INVALID_INPUT,
          message: "Error al validar la profundidad de la jerarquía",
          details: { error }
        }]
      }
    }
  }

  /**
   * Calculate the depth of a category in the hierarchy
   */
  private static async calculateCategoryDepth(categoryId: string): Promise<number> {
    try {
      const category = await prisma.categoria.findUnique({
        where: { catId: categoryId },
        include: { parent: true }
      })

      if (!category) {
        return 0
      }

      if (!category.parent) {
        return 1 // Root category
      }

      return 1 + await this.calculateCategoryDepth(category.parent.catId)
    } catch (error) {
      console.error('Error calculating category depth:', error)
      return 0
    }
  }

  /**
   * Validate unique name within parent scope
   */
  static async validateUniqueName(
    nombre: string,
    parentId: string | null,
    excludeCategoryId?: string
  ): Promise<CategoriaValidationResult> {
    try {
      const existingCategory = await prisma.categoria.findFirst({
        where: {
          nombre: nombre.trim(),
          parentId: parentId,
          ...(excludeCategoryId && { catId: { not: excludeCategoryId } })
        }
      })

      if (existingCategory) {
        return {
          success: false,
          errors: [{
            code: CategoriaErrorCode.DUPLICATE_NAME,
            message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.DUPLICATE_NAME],
            field: 'nombre',
            details: { 
              nombre, 
              parentId, 
              existingCategoryId: existingCategory.catId 
            }
          }]
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.INVALID_INPUT,
          message: "Error al validar la unicidad del nombre",
          details: { error }
        }]
      }
    }
  }

  /**
   * Validate that parent category exists
   */
  static async validateParentExists(parentId: string | null): Promise<CategoriaValidationResult> {
    if (!parentId) {
      return { success: true } // No parent is valid for root categories
    }

    try {
      const parentCategory = await prisma.categoria.findUnique({
        where: { catId: parentId }
      })

      if (!parentCategory) {
        return {
          success: false,
          errors: [{
            code: CategoriaErrorCode.PARENT_NOT_FOUND,
            message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.PARENT_NOT_FOUND],
            field: 'parentId',
            details: { parentId }
          }]
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.INVALID_INPUT,
          message: "Error al validar la categoría padre",
          details: { error }
        }]
      }
    }
  }

  /**
   * Validate product-subcategory consistency
   */
  static async validateProductSubcategoryConsistency(
    categoriaId: string,
    subcategoriaId: string | null
  ): Promise<CategoriaValidationResult> {
    if (!subcategoriaId) {
      return { success: true } // No subcategory is valid
    }

    try {
      const subcategoria = await prisma.categoria.findUnique({
        where: { catId: subcategoriaId },
        select: { parentId: true }
      })

      if (!subcategoria) {
        return {
          success: false,
          errors: [{
            code: CategoriaErrorCode.CATEGORY_NOT_FOUND,
            message: "Subcategoría no encontrada",
            field: 'subcategoriaId',
            details: { subcategoriaId }
          }]
        }
      }

      if (subcategoria.parentId !== categoriaId) {
        return {
          success: false,
          errors: [{
            code: CategoriaErrorCode.SUBCATEGORY_MISMATCH,
            message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.SUBCATEGORY_MISMATCH],
            field: 'subcategoriaId',
            details: { categoriaId, subcategoriaId, actualParentId: subcategoria.parentId }
          }]
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: CategoriaErrorCode.INVALID_INPUT,
          message: "Error al validar la consistencia producto-subcategoría",
          details: { error }
        }]
      }
    }
  }

  /**
   * Comprehensive validation for category creation
   */
  static async validateCategoryCreation(data: unknown): Promise<CategoriaValidationResult> {
    const allErrors: CategoriaValidationError[] = []

    // Step 1: Validate input data structure
    const inputValidation = this.validateCategoriaInput(data)
    if (!inputValidation.success) {
      return inputValidation
    }

    const validatedData = inputValidation.data!

    // Step 2: Validate parent exists
    const parentValidation = await this.validateParentExists(validatedData.parentId ?? null)
    if (!parentValidation.success) {
      allErrors.push(...(parentValidation.errors || []))
    }

    // Step 3: Validate hierarchy depth
    const depthValidation = await this.validateHierarchyDepth(validatedData.parentId ?? null)
    if (!depthValidation.success) {
      allErrors.push(...(depthValidation.errors || []))
    }

    // Step 4: Validate unique name
    const nameValidation = await this.validateUniqueName(
      validatedData.nombre,
      validatedData.parentId ?? null
    )
    if (!nameValidation.success) {
      allErrors.push(...(nameValidation.errors || []))
    }

    return {
      success: allErrors.length === 0,
      data: validatedData,
      errors: allErrors.length > 0 ? allErrors : undefined
    }
  }

  /**
   * Comprehensive validation for category update
   */
  static async validateCategoryUpdate(
    categoryId: string,
    data: unknown
  ): Promise<CategoriaValidationResult> {
    const allErrors: CategoriaValidationError[] = []

    // Step 1: Validate input data structure
    const inputValidation = this.validateCategoriaInput(data)
    if (!inputValidation.success) {
      return inputValidation
    }

    const validatedData = inputValidation.data!

    // Step 2: Validate parent exists
    const parentValidation = await this.validateParentExists(validatedData.parentId ?? null)
    if (!parentValidation.success) {
      allErrors.push(...(parentValidation.errors || []))
    }

    // Step 3: Validate circular reference
    const circularValidation = await this.validateCircularReference(categoryId, validatedData.parentId ?? null)
    if (!circularValidation.success) {
      allErrors.push(...(circularValidation.errors || []))
    }

    // Step 4: Validate hierarchy depth
    const depthValidation = await this.validateHierarchyDepth(validatedData.parentId ?? null)
    if (!depthValidation.success) {
      allErrors.push(...(depthValidation.errors || []))
    }

    // Step 5: Validate unique name (excluding current category)
    const nameValidation = await this.validateUniqueName(
      validatedData.nombre,
      validatedData.parentId ?? null,
      categoryId
    )
    if (!nameValidation.success) {
      allErrors.push(...(nameValidation.errors || []))
    }

    return {
      success: allErrors.length === 0,
      data: validatedData,
      errors: allErrors.length > 0 ? allErrors : undefined
    }
  }
}