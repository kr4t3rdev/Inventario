/**
 * Enhanced validation utilities for restock operations
 * Uses the comprehensive error handling system
 */

import { z } from "zod"
import { RestockErrorFactory, RestockError, RestockErrorCode, RestockErrorSeverity } from "./restock-errors"
import { WeightedAverageResult } from "./restock-utils"
import { hasPermission, UserRole } from "./permissions"
import { APP_USER_ROLES } from "@/lib/auth/roles"

// Enhanced Zod schema with custom error messages
export const RestockRequestSchema = z.object({
  productoId: z
    .string()
    .min(1, "Product ID is required")
    .refine((val) => val.trim().length > 0, "Product ID cannot be empty"),
  numeroFactura: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : "")),
  facturaUrl: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : "")),
  formaPago: z
    .enum(["PAGO_PARCIAL", "PAGO_COMPLETO"])
    .optional()
    .default("PAGO_COMPLETO"),
  estado: z
    .enum(["PENDIENTE", "PAGADA"])
    .optional()
    .default("PAGADA"),
  fechaVencimiento: z
    .string()
    .optional()
    .refine((value) => {
      if (!value) return true
      return !Number.isNaN(Date.parse(value))
    }, "Invalid due date"),
  cantidad: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be positive")
    .max(Number.MAX_SAFE_INTEGER, "Quantity exceeds maximum allowed value"),
  precioCosto: z
    .number()
    .positive("Cost price must be positive")
    .max(999999999, "Cost price exceeds maximum allowed value")
    .optional(),
  precioVenta: z
    .number()
    .positive("Selling price must be positive")
    .max(999999999, "Selling price exceeds maximum allowed value")
    .optional(),
  descripcion: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  // Currency exchange fields
  moneda: z
    .string()
    .optional(),
  tasaCambio: z
    .number()
    .positive("Exchange rate must be positive")
    .optional(),
  montoConvertido: z
    .number()
    .positive("Converted amount must be positive")
    .optional(),
  monedaOriginal: z
    .string()
    .optional(),
  montoOriginal: z
    .number()
    .positive("Original amount must be positive")
    .optional(),
  cuentaId: z
    .string()
    .optional(),
  // Tipo de restock: nueva_instancia (crear nuevo producto), sumar_stock (promediar precios), auto (comportamiento actual)
  tipoRestock: z
    .enum(['nueva_instancia', 'sumar_stock', 'auto'])
    .optional()
    .default("auto"),
}).refine(
  (data) => {
    // Business rule: selling price should be >= cost price * 1.1 (10% margin)
    if (data.precioCosto !== undefined && data.precioVenta !== undefined) {
      return data.precioVenta >= data.precioCosto * 1.1
    }
    return true
  },
  {
    message: "El precio de venta debe tener al menos un 10% de margen sobre el costo",
    path: ["precioVenta"]
  }
).refine(
  (data) => {
    if (data.formaPago === "PAGO_COMPLETO") {
      return data.estado === "PAGADA"
    }
    return data.estado === "PENDIENTE"
  },
  {
    message: "Estado no coincide con la forma de pago",
    path: ["estado"]
  }
)

export type RestockRequestInput = z.infer<typeof RestockRequestSchema>

/**
 * Validation result interface
 */
export interface ValidationResult {
  success: boolean
  data?: RestockRequestInput
  errors?: RestockError[]
}

export interface RestockUserContext {
  userId?: string
  id?: string
  role?: string
}

/**
 * Enhanced validation class with detailed error handling
 */
export class RestockValidator {
  /**
   * Validate restock request data
   */
  static validateRestockRequest(data: unknown): ValidationResult {
    try {
      const result = RestockRequestSchema.safeParse(data)
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        }
      }

      // Convert Zod errors to our error system
      const errors: RestockError[] = result.error.errors.map(zodError => {
        const field = zodError.path.join('.')
        const value = zodError.path.reduce((obj: Record<string, any> | undefined, key) => 
          obj && typeof obj === 'object' ? (obj as Record<string, any>)[key] : undefined, 
          data as Record<string, unknown>
        )
        
        switch (field) {
          case 'productoId':
            return RestockErrorFactory.invalidProductId(value)
          
          case 'cantidad':
            return RestockErrorFactory.invalidQuantity(value)

          case 'numeroFactura':
            return RestockErrorFactory.invalidNumeroFactura(value)

          case 'facturaUrl':
            return RestockErrorFactory.invalidFacturaUrl(value)

          case 'formaPago':
            return RestockErrorFactory.invalidFormaPago(value)

          case 'estado':
            return RestockErrorFactory.invalidEstadoCompra(value)

          case 'fechaVencimiento':
            return RestockErrorFactory.invalidFechaVencimiento(value)
          
          case 'precioCosto':
            return RestockErrorFactory.invalidCostPrice(value)
          
          case 'precioVenta':
            if (
              zodError.message.includes("less than cost price") ||
              zodError.message.includes("10% de margen")
            ) {
              const costPrice = (data as Record<string, unknown>)?.precioCosto as number || 0
              return RestockErrorFactory.priceRelationshipInvalid(costPrice, value as unknown as number)
            }
            return RestockErrorFactory.invalidSellingPrice(value)
          
          default:
            return RestockErrorFactory.createBaseError(
              RestockErrorCode.DATABASE_ERROR,
              zodError.message,
              RestockErrorSeverity.MEDIUM,
              field
            )
        }
      })

      return {
        success: false,
        errors
      }

    } catch (error) {
      return {
        success: false,
        errors: [RestockErrorFactory.internalServerError({ validationError: error })]
      }
    }
  }

  /**
   * Validate business rules for restock operation
   */
  static validateBusinessRules(
    producto: Record<string, unknown> | null,
    requestData: RestockRequestInput
  ): ValidationResult {
    const errors: RestockError[] = []

    // Check if product exists
    if (!producto) {
      errors.push(RestockErrorFactory.productNotFound(requestData.productoId))
      return { success: false, errors }
    }

    // Check if product is active (if there's an active field)
    if (producto.active === false) {
      errors.push(RestockErrorFactory.productInactive(requestData.productoId))
    }

    // Check for stock overflow
    const currentStock = typeof producto.stock === 'number' ? producto.stock : 0
    const newStock = currentStock + requestData.cantidad
    if (newStock > Number.MAX_SAFE_INTEGER) {
      errors.push(RestockErrorFactory.stockOverflow(
        requestData.productoId,
        currentStock,
        requestData.cantidad
      ))
    }

    // Validate price relationships with current product prices
    if (requestData.precioCosto !== undefined && requestData.precioVenta !== undefined) {
      if (requestData.precioVenta < requestData.precioCosto) {
        errors.push(RestockErrorFactory.priceRelationshipInvalid(
          requestData.precioCosto,
          requestData.precioVenta
        ))
      }
    }

    // Check if new cost price is reasonable (not too different from current)
    const currentCostPrice = typeof producto.precioCosto === 'number' ? producto.precioCosto : 0
    if (requestData.precioCosto !== undefined && currentCostPrice > 0) {
      const priceChangeRatio = Math.abs(requestData.precioCosto - currentCostPrice) / currentCostPrice
      if (priceChangeRatio > 10) { // More than 1000% change
        errors.push(RestockErrorFactory.calculationError('extreme_price_change', {
          currentPrice: currentCostPrice,
          newPrice: requestData.precioCosto,
          changeRatio: priceChangeRatio
        }))
      }
    }

    // Check if new selling price is reasonable
    const currentSellingPrice = typeof producto.precioVenta === 'number' ? producto.precioVenta : 0
    if (requestData.precioVenta !== undefined && currentSellingPrice > 0) {
      const priceChangeRatio = Math.abs(requestData.precioVenta - currentSellingPrice) / currentSellingPrice
      if (priceChangeRatio > 10) { // More than 1000% change
        errors.push(RestockErrorFactory.calculationError('extreme_price_change', {
          currentPrice: currentSellingPrice,
          newPrice: requestData.precioVenta,
          changeRatio: priceChangeRatio
        }))
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Validate user permissions for restock operations
   */
  static validatePermissions(user: RestockUserContext | null): ValidationResult {
    if (!user) {
      return {
        success: false,
        errors: [RestockErrorFactory.authenticationFailed()]
      }
    }

    // Check if user has restock permissions using the centralized permission system
    const userRole = user.role as string
    
    const normalizedRole = userRole as UserRole
    const userId = (user.userId || user.id) as string | undefined

    console.log("[RESTOCK_AUTH_DEBUG]", {
      userId,
      originalRole: user.role,
      normalizedRole,
      roleType: typeof userRole,
      hasRole: !!userRole
    })

    // Check if role is valid
    const validRoles: UserRole[] = [...APP_USER_ROLES]
    if (!normalizedRole || !validRoles.includes(normalizedRole)) {
      console.log("[RESTOCK_AUTH_DEBUG] Invalid or missing user role:", normalizedRole)
      return {
        success: false,
        errors: [RestockErrorFactory.insufficientPermissions(userId)]
      }
    }

    // Admins and the legacy platform role are allowed to perform restock operations.
    // We also explicitly allow 'dependiente' for restock.
    const permissionResult = hasPermission(normalizedRole, '/api/productos/restock', 'POST')
    const isDependiente = normalizedRole === 'dependiente'
    const isAuthorized = permissionResult || isDependiente

    console.log("[RESTOCK_AUTH_DEBUG] Authorization result:", {
      isAuthorized,
      permissionResult,
      isDependiente,
      normalizedRole
    })

    if (!isAuthorized) {
      return {
        success: false,
        errors: [RestockErrorFactory.insufficientPermissions(userId)]
      }
    }

    return { success: true }
  }

  /**
   * Validate calculation results
   */
  static validateCalculations(calculations: {
    newStock?: number
    totalCost?: number
    weightedAverages?: {
      costPrice: WeightedAverageResult
      sellingPrice: WeightedAverageResult
    }
  }): ValidationResult {
    const errors: RestockError[] = []

    // Validate stock calculation
    if (calculations.newStock !== undefined) {
      if (!Number.isInteger(calculations.newStock) || calculations.newStock < 0) {
        errors.push(RestockErrorFactory.calculationError('invalid_stock', {
          calculatedStock: calculations.newStock
        }))
      }
    }

    // Validate cost calculation
    if (calculations.totalCost !== undefined) {
      if (!Number.isFinite(calculations.totalCost) || calculations.totalCost <= 0) {
        errors.push(RestockErrorFactory.calculationError('invalid_total_cost', {
          calculatedCost: calculations.totalCost
        }))
      }
    }

    // Validate weighted averages
    if (calculations.weightedAverages) {
      const { costPrice, sellingPrice } = calculations.weightedAverages

      if (!Number.isFinite(costPrice.weightedAverage) || costPrice.weightedAverage < 0) {
        errors.push(RestockErrorFactory.calculationError('invalid_weighted_cost_price', {
          calculatedPrice: costPrice.weightedAverage
        }))
      }

      if (!Number.isFinite(sellingPrice.weightedAverage) || sellingPrice.weightedAverage < 0) {
        errors.push(RestockErrorFactory.calculationError('invalid_weighted_selling_price', {
          calculatedPrice: sellingPrice.weightedAverage
        }))
      }

      if (sellingPrice.weightedAverage < costPrice.weightedAverage) {
        errors.push(RestockErrorFactory.calculationError('weighted_price_relationship_invalid', {
          costPrice: costPrice.weightedAverage,
          sellingPrice: sellingPrice.weightedAverage
        }))
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Comprehensive validation that combines all validation steps
   */
  static async validateCompleteRestockOperation(
    requestData: unknown,
    user: RestockUserContext | null,
    producto?: Record<string, unknown> | null
  ): Promise<ValidationResult> {
    const allErrors: RestockError[] = []

    // Step 1: Validate request data structure
    const requestValidation = this.validateRestockRequest(requestData)
    if (!requestValidation.success) {
      allErrors.push(...(requestValidation.errors || []))
      return { success: false, errors: allErrors }
    }

    const validatedData = requestValidation.data!

    // Step 2: Validate user permissions
    const permissionValidation = this.validatePermissions(user)
    if (!permissionValidation.success) {
      allErrors.push(...(permissionValidation.errors || []))
    }

    // Step 3: Validate business rules (if product is provided)
    if (producto) {
      const businessValidation = this.validateBusinessRules(producto, validatedData)
      if (!businessValidation.success) {
        allErrors.push(...(businessValidation.errors || []))
      }
    }

    return {
      success: allErrors.length === 0,
      data: validatedData,
      errors: allErrors.length > 0 ? allErrors : undefined
    }
  }
}

/**
 * Utility functions for error handling in API routes
 */
export class RestockApiErrorHandler {
  /**
   * Handle validation errors in API routes
   */
  static handleValidationErrors(errors: RestockError[]): Response {
    const primaryError = errors[0]
    const statusCode = RestockErrorFactory.getHttpStatusCode(primaryError)

    return new Response(
      JSON.stringify(
        RestockErrorFactory.createMultipleErrorsResponse(errors)
      ),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  /**
   * Handle single error in API routes
   */
  static handleSingleError(error: RestockError): Response {
    const statusCode = RestockErrorFactory.getHttpStatusCode(error)

    return new Response(
      JSON.stringify(
        RestockErrorFactory.createErrorResponse(error)
      ),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  /**
   * Handle unknown errors in API routes
   */
  static handleUnknownError(error: unknown, context?: Record<string, unknown>): Response {
    const processedError = RestockErrorFactory.processError(error, context)
    return this.handleSingleError(processedError)
  }
}
