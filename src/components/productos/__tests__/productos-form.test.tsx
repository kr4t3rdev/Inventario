import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProductoForm } from '../productos-form'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockAddProducto = vi.fn()
const mockUpdateProducto = vi.fn()
const mockUseGetUnidadesQuery = vi.fn()
const mockUseGetAlmacenesQuery = vi.fn()
const mockUseGetListasPreciosQuery = vi.fn()
const mockUseGetCategoriasQuery = vi.fn()
const mockUseGetSubcategoriasQuery = vi.fn()
const mockUseGetVendorsQuery = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag: string) => {
      const Component = ({
        children,
        whileHover,
        whileTap,
        initial,
        animate,
        transition,
        ...props
      }: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) =>
        React.createElement(tag, props, children)
      Component.displayName = `motion.${tag}`
      return Component
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

vi.mock('@/lib/redux/services/productosApi', () => ({
  useAddProductoMutation: () => [mockAddProducto],
  useUpdateProductoMutation: () => [mockUpdateProducto],
}))

vi.mock('@/lib/redux/services/unidadesApi', () => ({
  useGetUnidadesQuery: (...args: unknown[]) => mockUseGetUnidadesQuery(...args),
}))

vi.mock('@/lib/redux/services/almacenesApi', () => ({
  useGetAlmacenesQuery: (...args: unknown[]) => mockUseGetAlmacenesQuery(...args),
}))

vi.mock('@/lib/redux/services/listasPreciosApi', () => ({
  useGetListasPreciosQuery: (...args: unknown[]) => mockUseGetListasPreciosQuery(...args),
}))

vi.mock('@/lib/redux/services/categoriasApi', () => ({
  useGetCategoriasQuery: (...args: unknown[]) => mockUseGetCategoriasQuery(...args),
  useGetSubcategoriasQuery: (...args: unknown[]) => mockUseGetSubcategoriasQuery(...args),
}))

vi.mock('@/lib/redux/services/vendorsApi', () => ({
  useGetVendorsQuery: (...args: unknown[]) => mockUseGetVendorsQuery(...args),
}))

vi.mock('@/components/categorias/subcategory-selector', () => ({
  SubcategorySelector: () => <div data-testid='subcategory-selector'>selector</div>,
}))

vi.mock('../product-photo-upload', () => ({
  ProductPhotoUpload: () => <div data-testid='product-photo-upload'>upload</div>,
}))

vi.mock('../compound-product-section', () => ({
  CompoundProductSection: () => <div data-testid='compound-product-section'>compound</div>,
}))

describe('ProductoForm', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockRefresh.mockReset()
    mockAddProducto.mockReset()
    mockUpdateProducto.mockReset()
    mockUseGetUnidadesQuery.mockReturnValue({
      data: [{ unidadId: 'u1', nombre: 'Unidad', simbolo: 'u' }],
      isLoading: false,
    })
    mockUseGetAlmacenesQuery.mockReturnValue({
      data: [{ almacenId: 'a1', nombre: 'Principal' }],
      isLoading: false,
    })
    mockUseGetListasPreciosQuery.mockReturnValue({ data: [], isLoading: false })
    mockUseGetCategoriasQuery.mockReturnValue({ data: [], isLoading: false })
    mockUseGetSubcategoriasQuery.mockReturnValue({ data: [], isLoading: false })
    mockUseGetVendorsQuery.mockReturnValue({
      data: [{ vendorId: 'vendor-1', nombre: 'Distribuidora XYZ', proveedorCodigo: '01' }],
      isLoading: false,
    })
  })

  it('en creación muestra selector de proveedor y oculta inputs manuales de segmentos', () => {
    render(<ProductoForm />)

    expect(screen.getAllByText('Proveedor').length).toBeGreaterThan(0)
    expect(screen.getByText('Selecciona un proveedor')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código del proveedor')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Id Sección (2)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Específico (4)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Surtido (4)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Código de negocio (preview)')).toBeInTheDocument()
  })
})
