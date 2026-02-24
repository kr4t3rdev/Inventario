import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";

// Interface for bulk update request
interface BulkStockMinimoUpdate {
  updates: {
    productoId: string;
    stockMinimo: number;
  }[];
}

// Interface for bulk update response
interface BulkUpdateResponse {
  success: boolean;
  updated: number;
  errors: {
    productoId: string;
    error: string;
  }[];
  results: {
    productoId: string;
    success: boolean;
    previousStockMinimo?: number;
    newStockMinimo?: number;
  }[];
}

// Validation function for stock minimo
const validateStockMinimo = (stockMinimo: number): { valid: boolean; error?: string } => {
  if (typeof stockMinimo !== 'number') {
    return { valid: false, error: "El stock mínimo debe ser un número" };
  }
  if (stockMinimo < 0) {
    return { valid: false, error: "El stock mínimo no puede ser negativo" };
  }
  if (!Number.isInteger(stockMinimo)) {
    return { valid: false, error: "El stock mínimo debe ser un número entero" };
  }
  return { valid: true };
};

// Validation function for bulk update request
const validateBulkUpdateRequest = (body: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!body || typeof body !== 'object') {
    errors.push("El cuerpo de la petición debe ser un objeto");
    return { valid: false, errors };
  }
  
  if (!Array.isArray(body.updates)) {
    errors.push("El campo 'updates' debe ser un array");
    return { valid: false, errors };
  }
  
  if (body.updates.length === 0) {
    errors.push("El array 'updates' no puede estar vacío");
    return { valid: false, errors };
  }
  
  if (body.updates.length > 100) {
    errors.push("No se pueden actualizar más de 100 productos a la vez");
    return { valid: false, errors };
  }
  
  body.updates.forEach((update: any, index: number) => {
    if (!update || typeof update !== 'object') {
      errors.push(`Actualización ${index + 1}: debe ser un objeto`);
      return;
    }
    
    if (!update.productoId || typeof update.productoId !== 'string') {
      errors.push(`Actualización ${index + 1}: productoId es requerido y debe ser una cadena`);
    }
    
    if (update.stockMinimo === undefined || update.stockMinimo === null) {
      errors.push(`Actualización ${index + 1}: stockMinimo es requerido`);
    } else {
      const validation = validateStockMinimo(update.stockMinimo);
      if (!validation.valid) {
        errors.push(`Actualización ${index + 1}: ${validation.error}`);
      }
    }
  });
  
  // Check for duplicate product IDs
  const productIds = body.updates.map((update: any) => update.productoId);
  const duplicates = productIds.filter((id: string, index: number) => productIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`IDs de productos duplicados: ${duplicates.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

export const POST = withAuth(async (request: NextRequest, _context: any, _user: any) => {
  try {
    const body = await request.json();
    
    // Validate request structure
    const validation = validateBulkUpdateRequest(body);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        updated: 0,
        errors: validation.errors.map(error => ({
          productoId: 'validation',
          error
        })),
        results: []
      } as BulkUpdateResponse, {
        status: 400
      });
    }
    
    const { updates }: BulkStockMinimoUpdate = body;
    
    // Perform bulk update within a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const results: BulkUpdateResponse['results'] = [];
      const errors: BulkUpdateResponse['errors'] = [];
      let successCount = 0;
      
      for (const update of updates) {
        try {
          // First, check if the product exists and get current stockMinimo
          const existingProduct = await tx.producto.findUnique({
            where: { id: update.productoId },
            select: { id: true, stockMinimo: true, nombre: true }
          });
          
          if (!existingProduct) {
            errors.push({
              productoId: update.productoId,
              error: "Producto no encontrado"
            });
            results.push({
              productoId: update.productoId,
              success: false
            });
            continue;
          }
          
          // Update the product
          const updatedProduct = await tx.producto.update({
            where: { id: update.productoId },
            data: { stockMinimo: update.stockMinimo },
            select: { id: true, stockMinimo: true }
          });
          
          results.push({
            productoId: update.productoId,
            success: true,
            previousStockMinimo: existingProduct.stockMinimo,
            newStockMinimo: updatedProduct.stockMinimo
          });
          
          successCount++;
          
        } catch (error) {
          console.error(`Error updating product ${update.productoId}:`, error);
          
          let errorMessage = "Error interno del servidor";
          if (error instanceof Error) {
            // Handle specific Prisma errors
            if (error.message.includes('Record to update not found')) {
              errorMessage = "Producto no encontrado";
            } else if (error.message.includes('Foreign key constraint')) {
              errorMessage = "Error de integridad de datos";
            } else {
              errorMessage = error.message;
            }
          }
          
          errors.push({
            productoId: update.productoId,
            error: errorMessage
          });
          
          results.push({
            productoId: update.productoId,
            success: false
          });
        }
      }
      
      return {
        success: errors.length === 0,
        updated: successCount,
        errors,
        results
      };
    });
    
    // Return appropriate status code based on results
    const statusCode = result.success ? 200 : (result.updated > 0 ? 207 : 400); // 207 = Multi-Status for partial success
    
    return NextResponse.json(result, { status: statusCode });
    
  } catch (error) {
    console.error("Error in bulk stock minimo update:", error);
    
    return NextResponse.json({
      success: false,
      updated: 0,
      errors: [{
        productoId: 'system',
        error: 'Error interno del servidor'
      }],
      results: []
    } as BulkUpdateResponse, {
      status: 500
    });
  }
})
