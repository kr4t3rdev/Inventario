import { z } from "zod"

/**
 * Validation schema for weighted average calculation inputs
 */
export const WeightedAverageInputSchema = z.object({
  currentStock: z.number().min(0, "Current stock must be non-negative"),
  currentPrice: z.number().min(0, "Current price must be non-negative"),
  restockQuantity: z.number().min(1, "Restock quantity must be positive"),
  newPrice: z.number().min(0, "New price must be non-negative"),
})

export type WeightedAverageInput = z.infer<typeof WeightedAverageInputSchema>

/**
 * Result of weighted average calculation
 */
export interface WeightedAverageResult {
  weightedAverage: number
  totalQuantity: number
  totalValue: number
}

/**
 * Calculates weighted average price based on current inventory and new stock
 * 
 * Formula: ((currentStock × currentPrice) + (restockQuantity × newPrice)) / (currentStock + restockQuantity)
 * 
 * @param input - The calculation parameters
 * @returns WeightedAverageResult with calculated values
 * @throws Error if validation fails
 */
export function calculateWeightedAverage(input: WeightedAverageInput): WeightedAverageResult {
  // Validate input parameters
  const validatedInput = WeightedAverageInputSchema.parse(input)
  
  const { currentStock, currentPrice, restockQuantity, newPrice } = validatedInput
  
  // Calculate total quantities and values
  const totalQuantity = currentStock + restockQuantity
  const currentValue = currentStock * currentPrice
  const newValue = restockQuantity * newPrice
  const totalValue = currentValue + newValue
  
  // Handle edge case where total quantity is 0 (shouldn't happen with validation, but safety check)
  if (totalQuantity === 0) {
    return {
      weightedAverage: 0,
      totalQuantity: 0,
      totalValue: 0,
    }
  }
  
  // Calculate weighted average
  const weightedAverage = totalValue / totalQuantity
  
  return {
    weightedAverage: Math.round(weightedAverage * 100) / 100, // Round to 2 decimal places
    totalQuantity,
    totalValue: Math.round(totalValue * 100) / 100, // Round to 2 decimal places
  }
}

/**
 * Calculates weighted average for both cost and selling prices
 * 
 * @param params - Object containing current and new pricing information
 * @returns Object with weighted averages for both cost and selling prices
 */
export interface RestockPriceCalculationParams {
  currentStock: number
  currentCostPrice: number
  currentSellingPrice: number
  restockQuantity: number
  newCostPrice?: number
  newSellingPrice?: number
}

export interface RestockPriceCalculationResult {
  costPrice: WeightedAverageResult
  sellingPrice: WeightedAverageResult
  pricesChanged: {
    costPriceChanged: boolean
    sellingPriceChanged: boolean
  }
}

export function calculateRestockPrices(params: RestockPriceCalculationParams): RestockPriceCalculationResult {
  const {
    currentStock,
    currentCostPrice,
    currentSellingPrice,
    restockQuantity,
    newCostPrice,
    newSellingPrice,
  } = params
  
  // Use current prices as defaults if new prices not provided
  const finalNewCostPrice = newCostPrice ?? currentCostPrice
  const finalNewSellingPrice = newSellingPrice ?? currentSellingPrice
  
  // Calculate weighted averages for both prices
  const costPrice = calculateWeightedAverage({
    currentStock,
    currentPrice: currentCostPrice,
    restockQuantity,
    newPrice: finalNewCostPrice,
  })
  
  const sellingPrice = calculateWeightedAverage({
    currentStock,
    currentPrice: currentSellingPrice,
    restockQuantity,
    newPrice: finalNewSellingPrice,
  })
  
  // Determine if prices actually changed
  const costPriceChanged = newCostPrice !== undefined && newCostPrice !== currentCostPrice
  const sellingPriceChanged = newSellingPrice !== undefined && newSellingPrice !== currentSellingPrice
  
  return {
    costPrice,
    sellingPrice,
    pricesChanged: {
      costPriceChanged,
      sellingPriceChanged,
    },
  }
}

/**
 * Validates restock input parameters
 * 
 * @param quantity - Quantity to restock
 * @param costPrice - Optional new cost price
 * @param sellingPrice - Optional new selling price
 * @throws Error if validation fails
 */
export function validateRestockInput(
  quantity: number,
  costPrice?: number,
  sellingPrice?: number
): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer")
  }
  
  if (costPrice !== undefined && (costPrice < 0 || !Number.isFinite(costPrice))) {
    throw new Error("Cost price must be a non-negative number")
  }
  
  if (sellingPrice !== undefined && (sellingPrice < 0 || !Number.isFinite(sellingPrice))) {
    throw new Error("Selling price must be a non-negative number")
  }
  
  // Business rule: selling price should be greater than or equal to cost price
  if (costPrice !== undefined && sellingPrice !== undefined && sellingPrice < costPrice) {
    throw new Error("Selling price cannot be less than cost price")
  }
}

/**
 * Interface for product instance creation parameters
 */
export interface ProductInstanceParams {
  currentProduct: {
    id: string
    nombre: string
    descripcion: string | null
    precioCosto: number
    precioVenta: number
    stock: number
    fotos: string[]
    categoriaId: string
    unidadId: string | null
    vendorId: string | null
    almacenId: string
    puntoDeVentaId: string | null
  }
  newCostPrice?: number
  newSellingPrice?: number
}

/**
 * Interface for new instance data
 */
export interface NewInstanceData {
  nombre: string
  descripcion: string | null
  precioCosto: number
  precioVenta: number
  stock: number
  fotos: string[]
  categoriaId: string
  unidadId: string | null
  vendorId: string | null
  almacenId: string
  puntoDeVentaId: string | null
}

/**
 * Type for product instance creation result
 */
export type ProductInstanceResult =
  | { needsNewInstance: false }
  | {
      needsNewInstance: true
      reason: 'cost_price_changed' | 'selling_price_changed' | 'both_prices_changed'
      newInstanceData: NewInstanceData
    }

/**
 * Determines if a new product instance is needed based on price changes
 * 
 * @param params - Product instance parameters
 * @returns ProductInstanceResult indicating if new instance is needed and the data
 */
export function determineProductInstanceNeed(params: ProductInstanceParams): ProductInstanceResult {
  const { currentProduct, newCostPrice, newSellingPrice } = params
  
  // Check if prices are actually changing
  const costPriceChanged = newCostPrice !== undefined && newCostPrice !== currentProduct.precioCosto
  const sellingPriceChanged = newSellingPrice !== undefined && newSellingPrice !== currentProduct.precioVenta
  
  // If no prices changed, no new instance needed
  if (!costPriceChanged && !sellingPriceChanged) {
    return {
      needsNewInstance: false
    }
  }
  
  // Determine the reason for new instance
  let reason: 'cost_price_changed' | 'selling_price_changed' | 'both_prices_changed'
  if (costPriceChanged && sellingPriceChanged) {
    reason = 'both_prices_changed'
  } else if (costPriceChanged) {
    reason = 'cost_price_changed'
  } else {
    reason = 'selling_price_changed'
  }
  
  // Create new instance data with updated prices
  const newInstanceData = {
    nombre: currentProduct.nombre,
    descripcion: currentProduct.descripcion,
    precioCosto: newCostPrice ?? currentProduct.precioCosto,
    precioVenta: newSellingPrice ?? currentProduct.precioVenta,
    stock: 0, // New instance starts with 0 stock, will be updated during restock
    fotos: currentProduct.fotos, // Inherit photos from original product
    categoriaId: currentProduct.categoriaId,
    unidadId: currentProduct.unidadId,
    vendorId: currentProduct.vendorId,
    almacenId: currentProduct.almacenId,
    puntoDeVentaId: currentProduct.puntoDeVentaId,
  }
  
  return {
    needsNewInstance: true,
    reason,
    newInstanceData
  }
}

/**
 * Interface for product instance linking parameters
 */
export interface ProductInstanceLinkingParams {
  originalProductId: string
  newProductId: string
  sharedAttributes: {
    nombre: string
    categoriaId: string
    vendorId: string | null
    almacenId: string
    puntoDeVentaId: string | null
  }
}

/**
 * Creates linking information for product instances
 * This function prepares the data structure that shows how product instances are related
 * 
 * @param params - Product instance linking parameters
 * @returns Object containing linking information
 */
export function createProductInstanceLinking(params: ProductInstanceLinkingParams) {
  const { originalProductId, newProductId, sharedAttributes } = params
  
  return {
    originalProductId,
    newProductId,
    sharedAttributes,
    linkingType: 'price_variant' as const,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Interface for complete product instance creation workflow
 */
export interface ProductInstanceCreationWorkflow {
  currentProduct: ProductInstanceParams['currentProduct']
  restockQuantity: number
  newCostPrice?: number
  newSellingPrice?: number
}

/**
 * Interface for product instance creation workflow result
 */
export interface ProductInstanceCreationResult {
  needsNewInstance: boolean
  reason?: 'cost_price_changed' | 'selling_price_changed' | 'both_prices_changed'
  originalProductUpdate: {
    id: string
    newStock: number
    newPrecioCosto: number
    newPrecioVenta: number
  }
  newInstance?: {
    data: NewInstanceData
    stock: number
    linking: ReturnType<typeof createProductInstanceLinking>
  }
  weightedAverages: {
    costPrice: WeightedAverageResult
    sellingPrice: WeightedAverageResult
  }
}

/**
 * Complete workflow for product instance creation during restock
 * This function orchestrates the entire process of determining if a new instance is needed,
 * calculating weighted averages, and preparing all the data for database operations
 * 
 * @param workflow - Complete workflow parameters
 * @returns Complete result with all necessary data for restock operation
 */
export function executeProductInstanceCreationWorkflow(
  workflow: ProductInstanceCreationWorkflow
): ProductInstanceCreationResult {
  const { currentProduct, restockQuantity, newCostPrice, newSellingPrice } = workflow
  
  // Validate inputs
  validateRestockInput(restockQuantity, newCostPrice, newSellingPrice)
  
  // Determine if new instance is needed
  const instanceResult = determineProductInstanceNeed({
    currentProduct,
    newCostPrice,
    newSellingPrice
  })
  
  // Calculate weighted averages for the original product
  const priceCalculation = calculateRestockPrices({
    currentStock: currentProduct.stock,
    currentCostPrice: currentProduct.precioCosto,
    currentSellingPrice: currentProduct.precioVenta,
    restockQuantity,
    newCostPrice,
    newSellingPrice,
  })
  
  // Prepare the result
  const result: ProductInstanceCreationResult = {
    needsNewInstance: instanceResult.needsNewInstance,
    reason: instanceResult.needsNewInstance ? instanceResult.reason : undefined,
    originalProductUpdate: {
      id: currentProduct.id,
      newStock: currentProduct.stock + restockQuantity,
      newPrecioCosto: priceCalculation.costPrice.weightedAverage,
      newPrecioVenta: priceCalculation.sellingPrice.weightedAverage,
    },
    weightedAverages: {
      costPrice: priceCalculation.costPrice,
      sellingPrice: priceCalculation.sellingPrice,
    }
  }
  
  // If new instance is needed, prepare the instance data
  if (instanceResult.needsNewInstance) {
    // The new instance gets the restock quantity as its initial stock
    const newInstanceWithStock = {
      ...instanceResult.newInstanceData,
      stock: restockQuantity
    }

    result.newInstance = {
      data: newInstanceWithStock,
      stock: restockQuantity,
      linking: createProductInstanceLinking({
        originalProductId: currentProduct.id,
        newProductId: 'temp-id', // Will be replaced with actual ID after database creation
        sharedAttributes: {
          nombre: currentProduct.nombre,
          categoriaId: currentProduct.categoriaId,
          vendorId: currentProduct.vendorId,
          almacenId: currentProduct.almacenId,
          puntoDeVentaId: currentProduct.puntoDeVentaId,
        }
      })
    }

    // When creating a new instance, the original product stock doesn't change
    // Only the new instance gets the restock quantity
    result.originalProductUpdate.newStock = currentProduct.stock
  }
  
  return result
}