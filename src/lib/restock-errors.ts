/**
 * Comprehensive error handling system for restock operations
 * Provides specific error codes, validation responses, and business logic error handling
 */

// Error codes for restock operations
export enum RestockErrorCode {
  // Validation errors
  INVALID_QUANTITY = "INVALID_QUANTITY",
  INVALID_COST_PRICE = "INVALID_COST_PRICE", 
  INVALID_SELLING_PRICE = "INVALID_SELLING_PRICE",
  INVALID_PRODUCT_ID = "INVALID_PRODUCT_ID",
  INVALID_DESCRIPTION = "INVALID_DESCRIPTION",
  INVALID_NUMERO_FACTURA = "INVALID_NUMERO_FACTURA",
  INVALID_FACTURA_URL = "INVALID_FACTURA_URL",
  INVALID_FORMA_PAGO = "INVALID_FORMA_PAGO",
  INVALID_ESTADO_COMPRA = "INVALID_ESTADO_COMPRA",
  INVALID_FECHA_VENCIMIENTO = "INVALID_FECHA_VENCIMIENTO",
  PRICE_RELATIONSHIP_INVALID = "PRICE_RELATIONSHIP_INVALID",
  
  // Business logic errors
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",
  PRODUCT_INACTIVE = "PRODUCT_INACTIVE",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
  CALCULATION_ERROR = "CALCULATION_ERROR",
  STOCK_OVERFLOW = "STOCK_OVERFLOW",
  
  // Database/Transaction errors
  DATABASE_ERROR = "DATABASE_ERROR",
  TRANSACTION_FAILED = "TRANSACTION_FAILED",
  TRANSACTION_TIMEOUT = "TRANSACTION_TIMEOUT",
  CONSTRAINT_VIOLATION = "CONSTRAINT_VIOLATION",
  FOREIGN_KEY_ERROR = "FOREIGN_KEY_ERROR",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  
  // System errors
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  OPERATION_TIMEOUT = "OPERATION_TIMEOUT"
}

// Error severity levels
export enum RestockErrorSeverity {
  LOW = "low",
  MEDIUM = "medium", 
  HIGH = "high",
  CRITICAL = "critical"
}

// Base error interface
export interface RestockError {
  code: RestockErrorCode
  message: string
  severity: RestockErrorSeverity
  field?: string
  details?: Record<string, any>
  timestamp: string
}

// Validation error with field details
export interface RestockValidationError extends RestockError {
  field: string
  value?: any
  constraints?: string[]
}

// Business logic error
export interface RestockBusinessError extends RestockError {
  context?: {
    productoId?: string
    currentStock?: number
    requestedQuantity?: number
    maxAllowed?: number
    userId?: string
    currentPrices?: {
      cost: number
      selling: number
    }
  }
}

// Database error
export interface RestockDatabaseError extends RestockError {
  operation?: string
  table?: string
  constraint?: string
}

// Error response structure
export interface RestockErrorResponse {
  success: false
  error: RestockError
  errors?: RestockError[] // For multiple errors
  requestId?: string
}

// Success response structure for comparison
export interface RestockSuccessResponse {
  success: true
  message: string
  data: {
    producto: Record<string, unknown>
    compraProducto?: Record<string, unknown>
    gastoCompra?: Record<string, unknown> | null
    cuentaPorPagar?: Record<string, unknown> | null
    reconciliacionGasto?: Record<string, unknown> | null
    productInstance?: Record<string, unknown> | null
    restockDetails: Record<string, unknown>
    weightedAverages: Record<string, unknown>
  }
  requestId?: string
}

// Union type for all possible responses
export type RestockResponse = RestockSuccessResponse | RestockErrorResponse

/**
 * Error factory class for creating standardized restock errors
 */
export class RestockErrorFactory {
  static generateRequestId(): string {
    return `restock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  static createBaseError(
    code: RestockErrorCode,
    message: string,
    severity: RestockErrorSeverity,
    field?: string,
    details?: Record<string, any>
  ): RestockError {
    return {
      code,
      message,
      severity,
      field,
      details,
      timestamp: new Date().toISOString()
    }
  }

  // Validation errors
  static invalidQuantity(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_QUANTITY,
        "Quantity must be a positive integer",
        RestockErrorSeverity.MEDIUM,
        "cantidad"
      ),
      field: "cantidad",
      value,
      constraints: ["positive", "integer", "required"]
    }
  }

  static invalidCostPrice(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_COST_PRICE,
        "Cost price must be a positive number",
        RestockErrorSeverity.MEDIUM,
        "precioCosto"
      ),
      field: "precioCosto",
      value,
      constraints: ["positive", "number"]
    }
  }

  static invalidSellingPrice(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_SELLING_PRICE,
        "Selling price must be a positive number",
        RestockErrorSeverity.MEDIUM,
        "precioVenta"
      ),
      field: "precioVenta",
      value,
      constraints: ["positive", "number"]
    }
  }

  static invalidProductId(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_PRODUCT_ID,
        "Product ID is required and must be a valid string",
        RestockErrorSeverity.HIGH,
        "productoId"
      ),
      field: "productoId",
      value,
      constraints: ["required", "string", "min_length:1"]
    }
  }

  static priceRelationshipInvalid(costPrice: number, sellingPrice: number): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.PRICE_RELATIONSHIP_INVALID,
        "Selling price cannot be less than cost price",
        RestockErrorSeverity.HIGH,
        "precioVenta"
      ),
      field: "precioVenta",
      value: sellingPrice,
      constraints: ["greater_than_or_equal_to_cost_price"],
      details: {
        costPrice,
        sellingPrice,
        difference: costPrice - sellingPrice
      }
    }
  }

  static invalidNumeroFactura(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_NUMERO_FACTURA,
        "Invoice number is required",
        RestockErrorSeverity.MEDIUM,
        "numeroFactura"
      ),
      field: "numeroFactura",
      value,
      constraints: ["required", "string", "min_length:1"]
    }
  }

  static invalidFacturaUrl(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_FACTURA_URL,
        "Invoice screenshot is required",
        RestockErrorSeverity.MEDIUM,
        "facturaUrl"
      ),
      field: "facturaUrl",
      value,
      constraints: ["required", "string", "min_length:1"]
    }
  }

  static invalidFormaPago(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_FORMA_PAGO,
        "Payment method is invalid",
        RestockErrorSeverity.MEDIUM,
        "formaPago"
      ),
      field: "formaPago",
      value,
      constraints: ["enum:PAGO_PARCIAL,PAGO_COMPLETO"]
    }
  }

  static invalidEstadoCompra(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_ESTADO_COMPRA,
        "Purchase status is invalid",
        RestockErrorSeverity.MEDIUM,
        "estado"
      ),
      field: "estado",
      value,
      constraints: ["enum:PENDIENTE,PAGADA"]
    }
  }

  static invalidFechaVencimiento(value: any): RestockValidationError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INVALID_FECHA_VENCIMIENTO,
        "Due date is invalid",
        RestockErrorSeverity.MEDIUM,
        "fechaVencimiento"
      ),
      field: "fechaVencimiento",
      value,
      constraints: ["date"]
    }
  }

  // Business logic errors
  static productNotFound(productoId: string): RestockBusinessError {
    return {
      ...this.createBaseError(
        RestockErrorCode.PRODUCT_NOT_FOUND,
        "Product not found or has been deleted",
        RestockErrorSeverity.HIGH
      ),
      context: { productoId }
    }
  }

  static productInactive(productoId: string): RestockBusinessError {
    return {
      ...this.createBaseError(
        RestockErrorCode.PRODUCT_INACTIVE,
        "Product is inactive and cannot be restocked",
        RestockErrorSeverity.HIGH
      ),
      context: { productoId }
    }
  }

  static concurrentModification(productoId: string): RestockBusinessError {
    return {
      ...this.createBaseError(
        RestockErrorCode.CONCURRENT_MODIFICATION,
        "Product has been modified by another operation. Please refresh and try again.",
        RestockErrorSeverity.HIGH
      ),
      context: { productoId }
    }
  }

  static calculationError(operation: string, details?: Record<string, any>): RestockBusinessError {
    return {
      ...this.createBaseError(
        RestockErrorCode.CALCULATION_ERROR,
        `Invalid calculation detected: ${operation}`,
        RestockErrorSeverity.HIGH
      ),
      context: details
    }
  }

  static stockOverflow(productoId: string, currentStock: number, requestedQuantity: number): RestockBusinessError {
    const maxSafeInteger = Number.MAX_SAFE_INTEGER
    return {
      ...this.createBaseError(
        RestockErrorCode.STOCK_OVERFLOW,
        "Stock quantity would exceed maximum safe value",
        RestockErrorSeverity.HIGH
      ),
      context: {
        productoId,
        currentStock,
        requestedQuantity,
        maxAllowed: maxSafeInteger
      }
    }
  }

  static insufficientPermissions(userId?: string): RestockBusinessError {
    return {
      ...this.createBaseError(
        RestockErrorCode.INSUFFICIENT_PERMISSIONS,
        "User does not have permission to perform restock operations",
        RestockErrorSeverity.HIGH
      ),
      context: { userId }
    }
  }

  // Database errors
  static databaseError(operation: string, originalError?: Error): RestockDatabaseError {
    return {
      ...this.createBaseError(
        RestockErrorCode.DATABASE_ERROR,
        `Database operation failed: ${operation}`,
        RestockErrorSeverity.CRITICAL
      ),
      operation,
      details: originalError ? {
        originalMessage: originalError.message,
        stack: originalError.stack
      } : undefined
    }
  }

  static transactionFailed(details?: Record<string, any>): RestockDatabaseError {
    return {
      ...this.createBaseError(
        RestockErrorCode.TRANSACTION_FAILED,
        "Transaction could not be completed",
        RestockErrorSeverity.CRITICAL
      ),
      operation: "transaction",
      details
    }
  }

  static transactionTimeout(): RestockDatabaseError {
    return {
      ...this.createBaseError(
        RestockErrorCode.TRANSACTION_TIMEOUT,
        "Operation took too long to complete. Please try again.",
        RestockErrorSeverity.HIGH
      ),
      operation: "transaction"
    }
  }

  static constraintViolation(constraint: string, table?: string): RestockDatabaseError {
    return {
      ...this.createBaseError(
        RestockErrorCode.CONSTRAINT_VIOLATION,
        `Database constraint violation: ${constraint}`,
        RestockErrorSeverity.HIGH
      ),
      constraint,
      table
    }
  }

  static foreignKeyError(table: string, field: string): RestockDatabaseError {
    return {
      ...this.createBaseError(
        RestockErrorCode.FOREIGN_KEY_ERROR,
        `Referenced ${field} no longer exists`,
        RestockErrorSeverity.HIGH
      ),
      table,
      constraint: `foreign_key_${field}`
    }
  }

  static duplicateEntry(field: string, value: any): RestockDatabaseError {
    return {
      ...this.createBaseError(
        RestockErrorCode.DUPLICATE_ENTRY,
        `A record with this ${field} already exists`,
        RestockErrorSeverity.MEDIUM
      ),
      constraint: `unique_${field}`,
      details: { field, value }
    }
  }

  // System errors
  static authenticationFailed(): RestockError {
    return this.createBaseError(
      RestockErrorCode.AUTHENTICATION_FAILED,
      "Authentication failed - Invalid or missing token",
      RestockErrorSeverity.HIGH
    )
  }

  static internalServerError(details?: Record<string, any>): RestockError {
    return this.createBaseError(
      RestockErrorCode.INTERNAL_SERVER_ERROR,
      "An unexpected error occurred during the restock operation",
      RestockErrorSeverity.CRITICAL,
      undefined,
      details
    )
  }

  static operationTimeout(): RestockError {
    return this.createBaseError(
      RestockErrorCode.OPERATION_TIMEOUT,
      "The operation took too long to complete",
      RestockErrorSeverity.HIGH
    )
  }

  // Helper method to create error response
  static createErrorResponse(error: RestockError, requestId?: string): RestockErrorResponse {
    return {
      success: false,
      error,
      requestId: requestId || this.generateRequestId()
    }
  }

  // Helper method to create multiple errors response
  static createMultipleErrorsResponse(errors: RestockError[], requestId?: string): RestockErrorResponse {
    return {
      success: false,
      error: errors[0], // Primary error
      errors,
      requestId: requestId || this.generateRequestId()
    }
  }

  /**
   * Convert error to HTTP status code
   */
  static getHttpStatusCode(error: RestockError): number {
    switch (error.code) {
      // 400 Bad Request
      case RestockErrorCode.INVALID_QUANTITY:
      case RestockErrorCode.INVALID_COST_PRICE:
      case RestockErrorCode.INVALID_SELLING_PRICE:
      case RestockErrorCode.INVALID_PRODUCT_ID:
      case RestockErrorCode.INVALID_DESCRIPTION:
      case RestockErrorCode.INVALID_NUMERO_FACTURA:
      case RestockErrorCode.INVALID_FACTURA_URL:
      case RestockErrorCode.INVALID_FORMA_PAGO:
      case RestockErrorCode.INVALID_ESTADO_COMPRA:
      case RestockErrorCode.INVALID_FECHA_VENCIMIENTO:
      case RestockErrorCode.PRICE_RELATIONSHIP_INVALID:
      case RestockErrorCode.CALCULATION_ERROR:
      case RestockErrorCode.FOREIGN_KEY_ERROR:
        return 400

      // 401 Unauthorized
      case RestockErrorCode.AUTHENTICATION_FAILED:
        return 401

      // 403 Forbidden
      case RestockErrorCode.INSUFFICIENT_PERMISSIONS:
        return 403

      // 404 Not Found
      case RestockErrorCode.PRODUCT_NOT_FOUND:
        return 404

      // 408 Request Timeout
      case RestockErrorCode.OPERATION_TIMEOUT:
      case RestockErrorCode.TRANSACTION_TIMEOUT:
        return 408

      // 409 Conflict
      case RestockErrorCode.CONCURRENT_MODIFICATION:
      case RestockErrorCode.DUPLICATE_ENTRY:
      case RestockErrorCode.CONSTRAINT_VIOLATION:
        return 409

      // 422 Unprocessable Entity
      case RestockErrorCode.PRODUCT_INACTIVE:
      case RestockErrorCode.STOCK_OVERFLOW:
        return 422

      // 500 Internal Server Error
      case RestockErrorCode.DATABASE_ERROR:
      case RestockErrorCode.TRANSACTION_FAILED:
      case RestockErrorCode.INTERNAL_SERVER_ERROR:
      default:
        return 500
    }
  }

  /**
   * Process and categorize errors from various sources
   */
  static processError(error: unknown, context?: Record<string, unknown>): RestockError {
    // If it's already a RestockError, return it
    if (error && typeof error === 'object' && 'code' in error && 'message' in error && 'severity' in error) {
      return error as RestockError
    }

    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path?: string[]; received?: unknown; message?: string }> }
      if (zodError.issues && Array.isArray(zodError.issues)) {
        const firstIssue = zodError.issues[0]
        const field = firstIssue.path?.join('.') || 'unknown'
        
        switch (field) {
          case 'cantidad':
            return RestockErrorFactory.invalidQuantity(firstIssue.received)
          case 'precioCosto':
            return RestockErrorFactory.invalidCostPrice(firstIssue.received)
          case 'precioVenta':
            return RestockErrorFactory.invalidSellingPrice(firstIssue.received)
          case 'productoId':
            return RestockErrorFactory.invalidProductId(firstIssue.received)
          case 'numeroFactura':
            return RestockErrorFactory.invalidNumeroFactura(firstIssue.received)
          case 'facturaUrl':
            return RestockErrorFactory.invalidFacturaUrl(firstIssue.received)
          case 'formaPago':
            return RestockErrorFactory.invalidFormaPago(firstIssue.received)
          case 'estado':
            return RestockErrorFactory.invalidEstadoCompra(firstIssue.received)
          case 'fechaVencimiento':
            return RestockErrorFactory.invalidFechaVencimiento(firstIssue.received)
          default:
            return RestockErrorFactory.createBaseError(
              RestockErrorCode.DATABASE_ERROR,
              firstIssue.message || 'Validation failed',
              RestockErrorSeverity.MEDIUM,
              field
            )
        }
      }
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      // Business logic errors
      if (message.includes('product not found') || message.includes('product no longer exists')) {
        return RestockErrorFactory.productNotFound((context?.productoId as string) || 'unknown')
      }
      
      if (message.includes('modified by another operation')) {
        return RestockErrorFactory.concurrentModification((context?.productoId as string) || 'unknown')
      }
      
      if (message.includes('invalid cost calculation') || message.includes('invalid stock calculation')) {
        return RestockErrorFactory.calculationError('price_or_stock', { originalError: error.message })
      }
      
      if (message.includes('transaction incomplete')) {
        return RestockErrorFactory.transactionFailed({ originalError: error.message })
      }
      
      // Database constraint errors
      if (message.includes('unique constraint')) {
        return RestockErrorFactory.duplicateEntry('product_instance', context)
      }
      
      if (message.includes('foreign key constraint')) {
        return RestockErrorFactory.foreignKeyError('gastoCompra', 'vendor, category, or location')
      }
      
      // Transaction timeout errors
      if (message.includes('transaction timeout') || message.includes('transaction wait timeout')) {
        return RestockErrorFactory.transactionTimeout()
      }
      
      // Generic database error
      if (message.includes('prisma') || message.includes('database')) {
        return RestockErrorFactory.databaseError('unknown_operation', error)
      }
    }

    // Fallback for unknown errors
    return RestockErrorFactory.internalServerError({
      originalError: error,
      context
    })
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: RestockError): string {
    switch (error.code) {
      case RestockErrorCode.INVALID_QUANTITY:
        return "Por favor ingrese una cantidad válida mayor a cero."
      
      case RestockErrorCode.INVALID_COST_PRICE:
        return "El precio de costo debe ser un número positivo."
      
      case RestockErrorCode.INVALID_SELLING_PRICE:
        return "El precio de venta debe ser un número positivo."

      case RestockErrorCode.INVALID_NUMERO_FACTURA:
        return "El número de factura es obligatorio."

      case RestockErrorCode.INVALID_FACTURA_URL:
        return "Debe adjuntar la captura de la factura."

      case RestockErrorCode.INVALID_FORMA_PAGO:
        return "La forma de pago seleccionada no es válida."

      case RestockErrorCode.INVALID_ESTADO_COMPRA:
        return "El estado de la compra no es válido."

      case RestockErrorCode.INVALID_FECHA_VENCIMIENTO:
        return "La fecha de vencimiento no es válida."
      
      case RestockErrorCode.PRICE_RELATIONSHIP_INVALID:
        return "El precio de venta no puede ser menor al precio de costo."
      
      case RestockErrorCode.PRODUCT_NOT_FOUND:
        return "El producto no fue encontrado o ha sido eliminado."
      
      case RestockErrorCode.CONCURRENT_MODIFICATION:
        return "El producto fue modificado por otro usuario. Por favor actualice la página e intente nuevamente."
      
      case RestockErrorCode.INSUFFICIENT_PERMISSIONS:
        return "No tiene permisos para realizar operaciones de restock."
      
      case RestockErrorCode.TRANSACTION_TIMEOUT:
        return "La operación tardó demasiado tiempo. Por favor intente nuevamente."
      
      case RestockErrorCode.STOCK_OVERFLOW:
        return "La cantidad resultante excede el límite máximo permitido."
      
      default:
        return error.message
    }
  }
}

/**
 * Error handler utility for processing different types of errors
 */
export class RestockErrorHandler {
  /**
   * Check if error is retryable
   */
  static isRetryable(error: RestockError): boolean {
    const retryableCodes = [
      RestockErrorCode.TRANSACTION_TIMEOUT,
      RestockErrorCode.OPERATION_TIMEOUT,
      RestockErrorCode.CONCURRENT_MODIFICATION,
      RestockErrorCode.DATABASE_ERROR
    ]
    
    return retryableCodes.includes(error.code)
  }
}
