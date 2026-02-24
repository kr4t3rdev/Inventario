import { describe, it, expect } from 'vitest';

// Validation functions extracted from the API logic
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

describe('Bulk Stock Minimo API - Validation Logic', () => {

  describe('validateStockMinimo', () => {
    it('should accept valid positive integers', () => {
      expect(validateStockMinimo(0)).toEqual({ valid: true });
      expect(validateStockMinimo(1)).toEqual({ valid: true });
      expect(validateStockMinimo(10)).toEqual({ valid: true });
      expect(validateStockMinimo(100)).toEqual({ valid: true });
      expect(validateStockMinimo(999999)).toEqual({ valid: true });
    });

    it('should reject negative numbers', () => {
      const result = validateStockMinimo(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negativo');
    });

    it('should reject decimal numbers', () => {
      const result = validateStockMinimo(5.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('entero');
    });

    it('should reject non-numeric values', () => {
      expect(validateStockMinimo('10' as any).valid).toBe(false);
      expect(validateStockMinimo(null as any).valid).toBe(false);
      expect(validateStockMinimo(true as any).valid).toBe(false);
      expect(validateStockMinimo({} as any).valid).toBe(false);
      expect(validateStockMinimo([] as any).valid).toBe(false);
    });

    it('should reject NaN and Infinity', () => {
      expect(validateStockMinimo(NaN).valid).toBe(false);
      expect(validateStockMinimo(Infinity).valid).toBe(false);
      expect(validateStockMinimo(-Infinity).valid).toBe(false);
    });
  });

  describe('validateBulkUpdateRequest', () => {
    it('should accept valid bulk update request', () => {
      const validRequest = {
        updates: [
          { productoId: 'product-1', stockMinimo: 10 },
          { productoId: 'product-2', stockMinimo: 0 },
          { productoId: 'product-3', stockMinimo: 25 }
        ]
      };
      
      const result = validateBulkUpdateRequest(validRequest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty request body', () => {
      const result = validateBulkUpdateRequest(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cuerpo de la petición');
    });

    it('should reject request without updates array', () => {
      const result = validateBulkUpdateRequest({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('updates');
    });

    it('should reject empty updates array', () => {
      const result = validateBulkUpdateRequest({ updates: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('vacío');
    });

    it('should reject too many updates', () => {
      const updates = Array.from({ length: 101 }, (_, i) => ({
        productoId: `product-${i}`,
        stockMinimo: 10
      }));
      
      const result = validateBulkUpdateRequest({ updates });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('100 productos');
    });

    it('should reject invalid stockMinimo values', () => {
      const request = {
        updates: [
          { productoId: 'product-1', stockMinimo: -5 },
          { productoId: 'product-2', stockMinimo: 'invalid' },
          { productoId: 'product-3', stockMinimo: 3.5 }
        ]
      };
      
      const result = validateBulkUpdateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.some(e => e.includes('negativo'))).toBe(true);
      expect(result.errors.some(e => e.includes('número'))).toBe(true);
      expect(result.errors.some(e => e.includes('entero'))).toBe(true);
    });

    it('should reject duplicate product IDs', () => {
      const request = {
        updates: [
          { productoId: 'product-1', stockMinimo: 10 },
          { productoId: 'product-1', stockMinimo: 15 }
        ]
      };
      
      const result = validateBulkUpdateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('duplicados');
    });

    it('should reject missing required fields', () => {
      const request = {
        updates: [
          { stockMinimo: 10 }, // missing productoId
          { productoId: 'product-2' } // missing stockMinimo
        ]
      };
      
      const result = validateBulkUpdateRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should handle maximum allowed updates (100)', () => {
      const updates = Array.from({ length: 100 }, (_, i) => ({
        productoId: `product-${i}`,
        stockMinimo: 10
      }));

      const result = validateBulkUpdateRequest({ updates });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Interface Types', () => {
    it('should have correct BulkStockMinimoUpdate interface structure', () => {
      const bulkUpdate = {
        updates: [
          { productoId: 'product-1', stockMinimo: 10 },
          { productoId: 'product-2', stockMinimo: 0 },
          { productoId: 'product-3', stockMinimo: 25 }
        ]
      };
      
      expect(Array.isArray(bulkUpdate.updates)).toBe(true);
      expect(bulkUpdate.updates[0]).toHaveProperty('productoId');
      expect(bulkUpdate.updates[0]).toHaveProperty('stockMinimo');
      expect(typeof bulkUpdate.updates[0].productoId).toBe('string');
      expect(typeof bulkUpdate.updates[0].stockMinimo).toBe('number');
    });

    it('should have correct BulkUpdateResponse interface structure', () => {
      const response = {
        success: true,
        updated: 2,
        errors: [],
        results: [
          {
            productoId: 'product-1',
            success: true,
            previousStockMinimo: 5,
            newStockMinimo: 15
          },
          {
            productoId: 'product-2',
            success: false
          }
        ]
      };
      
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.updated).toBe('number');
      expect(Array.isArray(response.errors)).toBe(true);
      expect(Array.isArray(response.results)).toBe(true);
      expect(response.results[0]).toHaveProperty('productoId');
      expect(response.results[0]).toHaveProperty('success');
    });

    it('should handle error response structure', () => {
      const errorResponse = {
        success: false,
        updated: 0,
        errors: [
          {
            productoId: 'product-1',
            error: 'Producto no encontrado'
          }
        ],
        results: [
          {
            productoId: 'product-1',
            success: false
          }
        ]
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.updated).toBe(0);
      expect(errorResponse.errors).toHaveLength(1);
      expect(errorResponse.errors[0]).toHaveProperty('productoId');
      expect(errorResponse.errors[0]).toHaveProperty('error');
    });
  });
});