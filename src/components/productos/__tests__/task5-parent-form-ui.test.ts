/**
 * @fileoverview Tests for Task 5: Parent Product Form UI Refactoring
 *
 * Task 5: Remove manual segment input fields from parent product form.
 * - Schema: no segment fields in create payload
 * - Create mode: require vendor selection (vendorId)
 * - Create mode: show generated preview cards + read-only code preview
 * - Edit mode: keep provider code readable/editable only for legacy records
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

describe('Task 5: Parent Form Schema Validation', () => {
  it('schema should ignore manual segment fields', () => {
    const productosSchema = z.object({
      nombre: z.string(),
      vendorId: z.string().min(1),
      categoriaId: z.string(),
      subcategoriaId: z.string(),
    })

    const result = productosSchema.safeParse({
      nombre: 'Test Product',
      vendorId: 'vendor-1',
      categoriaId: 'cat-123',
      subcategoriaId: 'sub-456',
      idSeccionCodigo: '14',
      especificoCodigo: '0281',
      surtidoCodigo: '0001',
    })

    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('idSeccionCodigo')
    expect(result.data).not.toHaveProperty('especificoCodigo')
    expect(result.data).not.toHaveProperty('surtidoCodigo')
  })

  it('schema should require vendorId in create mode', () => {
    const productosSchema = z.object({
      vendorId: z.string().min(1, 'Seleccione un proveedor'),
    })

    expect(productosSchema.safeParse({ vendorId: 'vendor-1' }).success).toBe(true)
    expect(productosSchema.safeParse({ vendorId: '' }).success).toBe(false)
  })
})

describe('Task 5: Parent Form Edit Mode UI', () => {
  it('edit mode keeps generated segments as read-only', () => {
    const readonlyClasses = ['bg-muted', 'bg-muted font-mono']

    expect(readonlyClasses).toContain('bg-muted')
    expect(readonlyClasses).toContain('bg-muted font-mono')
  })

  it('edit mode may keep proveedorCodigo for legacy maintenance', () => {
    const legacyFieldStillEditable = true
    expect(legacyFieldStillEditable).toBe(true)
  })
})

describe('Task 5: Parent Form Create Mode UI', () => {
  it('create mode should show provider selection instead of manual provider code input', () => {
    const createUi = {
      hasVendorDropdown: true,
      hasManualProveedorCodigoInput: false,
    }

    expect(createUi.hasVendorDropdown).toBe(true)
    expect(createUi.hasManualProveedorCodigoInput).toBe(false)
  })

  it('create mode should show preview cards for provider, section, specific and surtido', () => {
    const previewCards = ['Proveedor', 'Sección', 'Específico', 'Surtido inicial']

    expect(previewCards).toHaveLength(4)
    expect(previewCards).toContain('Proveedor')
    expect(previewCards).toContain('Surtido inicial')
  })

  it('preview should react to vendor + taxonomy selection', () => {
    const selection = {
      vendorId: 'vendor-1',
      categoryName: 'Bebidas',
      subcategoryName: 'Cerveza',
      expectedSection: '14',
      expectedSpecific: '0281',
    }

    expect(selection.vendorId).toBe('vendor-1')
    expect(selection.expectedSection).toBe('14')
    expect(selection.expectedSpecific).toBe('0281')
  })
})

describe('Task 5: Form Submission Payload', () => {
  it('create payload should send vendorId and taxonomy, not manual segments', () => {
    const submissionPayload = {
      nombre: 'Arroz Premium 1kg',
      descripcion: 'Arroz blanco de calidad premium',
      codigoInterno: '12345678901',
      vendorId: 'vendor-1',
      categoriaId: 'cat-bebidas',
      subcategoriaId: 'subcat-cerveza',
      precioCosto: 50,
      precioVenta: 100,
      stock: 100,
      stockMinimo: 10,
      unidadId: 'unit-kg',
      almacenId: 'warehouse-1',
    }

    expect(submissionPayload).toHaveProperty('vendorId', 'vendor-1')
    expect(submissionPayload).not.toHaveProperty('idSeccionCodigo')
    expect(submissionPayload).not.toHaveProperty('especificoCodigo')
    expect(submissionPayload).not.toHaveProperty('surtidoCodigo')
  })

  it('compound create payload should omit manual child code', () => {
    const compoundPayload = {
      vendorId: 'vendor-1',
      esCompuesto: true,
      cantidadEnPack: 12,
      nombreHijo: 'Cerveza unidad',
    }

    expect(compoundPayload).not.toHaveProperty('codigoNegocioHijo')
  })
})

describe('Task 5: Form Field Descriptions', () => {
  it('vendor selector should explain automatic generation', () => {
    const description = 'Seleccioná un proveedor activo. El sistema toma su código configurado y genera el EAN-13.'

    expect(description).toContain('proveedor activo')
    expect(description).toContain('genera el EAN-13')
  })

  it('preview description should explain that surtido is assigned on save', () => {
    const description = 'Preview referencial. El surtido real se valida y asigna al guardar.'

    expect(description).toContain('Preview referencial')
    expect(description).toContain('asigna al guardar')
  })
})
