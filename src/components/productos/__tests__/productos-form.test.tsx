import React from 'react'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProductoForm, buildProductosSchema } from '../productos-form'

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
const mockFetch = vi.fn()
const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastWarning = vi.fn()
const mockToastInfo = vi.fn()
const mockToastDismiss = vi.fn()

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
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
    warning: mockToastWarning,
    info: mockToastInfo,
    dismiss: mockToastDismiss,
  },
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

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}))

vi.mock('@/components/categorias/subcategory-selector', () => ({
  SubcategorySelector: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid='subcategory-selector' data-disabled={String(Boolean(disabled))}>
      selector
    </div>
  ),
}))

vi.mock('../product-photo-upload', () => ({
  ProductPhotoUpload: () => <div data-testid='product-photo-upload'>upload</div>,
}))

vi.mock('../clasificador-info-note', () => ({
  ClasificadorInfoNote: (props: Record<string, unknown>) => <div data-testid='clasificador-info-note' data-mode={props.mode}>clasificador</div>,
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
    mockFetch.mockResolvedValue({
      json: async () => ({ usaCodigoEan13: false }),
    })
    mockToastError.mockReset()
    mockToastSuccess.mockReset()
    mockToastWarning.mockReset()
    mockToastInfo.mockReset()
    mockToastDismiss.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('requiere proveedor y subcategoría cuando EAN-13 está activo', () => {
    const result = buildProductosSchema(true).safeParse({
      nombre: 'Producto demo',
      descripcion: '',
      codigoInterno: '12345678901',
      proveedorCodigo: '',
      vendorId: '',
      categoriaId: 'cat-1',
      subcategoriaId: '',
      precioCosto: 100,
      precioVenta: 120,
      stock: 10,
      stockMinimo: 2,
      fotos: [],
      unidadId: 'u1',
      almacenId: 'a1',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.vendorId).toContain(
        'Seleccione un proveedor para generar el EAN-13'
      )
      expect(result.error.flatten().fieldErrors.subcategoriaId).toContain(
        'Selecciona una subcategoría para generar el EAN-13'
      )
    }
  })

  it('no requiere proveedor ni subcategoría cuando EAN-13 está desactivado', () => {
    const result = buildProductosSchema(false).safeParse({
      nombre: 'Producto demo',
      descripcion: '',
      codigoInterno: '12345678901',
      proveedorCodigo: '',
      vendorId: '',
      categoriaId: 'cat-1',
      subcategoriaId: '',
      precioCosto: 100,
      precioVenta: 120,
      stock: 10,
      stockMinimo: 2,
      fotos: [],
      unidadId: 'u1',
      almacenId: 'a1',
    })

    expect(result.success).toBe(true)
  })

  it('en creación muestra selector de proveedor y oculta inputs manuales de segmentos', () => {
    render(<ProductoForm />)

    expect(screen.getAllByText('Proveedor').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Código del proveedor')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Id Sección (2)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Específico (4)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Surtido (4)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Código de negocio (EAN-13)')).not.toBeInTheDocument()
  })

  it('en edición con EAN-13 desactivado muestra selector de proveedor y oculta campos EAN-13', async () => {
    render(
      <ProductoForm
        initialData={{
          id: 'prod-1',
          nombre: 'Producto 1',
          descripcion: null,
          codigoInterno: null,
          categoriaId: 'cat-1',
          precioCosto: 100,
          precioVenta: 120,
          stock: 10,
          stockMinimo: 2,
          fotos: [],
          unidadId: 'u1',
          almacenId: 'a1',
          vendorId: 'vendor-1',
        }}
      />
    )

    expect(screen.getAllByText('Proveedor').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Proveedor (2)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Código de negocio (EAN-13)')).not.toBeInTheDocument()
  })

  it('en edición con EAN-13 activado muestra selector de proveedor y campos EAN-13', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ usaCodigoEan13: true }),
    })

    render(
      <ProductoForm
        initialData={{
          id: 'prod-2',
          nombre: 'Producto 2',
          descripcion: null,
          codigoInterno: null,
          codigoNegocio: '1234567890123',
          proveedorCodigo: '01',
          idSeccionCodigo: '12',
          especificoCodigo: '3456',
          surtidoCodigo: '7890',
          categoriaId: 'cat-1',
          precioCosto: 100,
          precioVenta: 120,
          stock: 10,
          stockMinimo: 2,
          fotos: [],
          unidadId: 'u1',
          almacenId: 'a1',
          vendorId: 'vendor-1',
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText('Proveedor').length).toBeGreaterThan(0)
      expect(screen.getByLabelText('Proveedor (2)')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Código de negocio (EAN-13)')).toBeInTheDocument()
  })

  it('en edición con EAN-13 activado bloquea la taxonomía del producto', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ usaCodigoEan13: true }),
    })

    render(
      <ProductoForm
        initialData={{
          id: 'prod-3',
          nombre: 'Producto 3',
          descripcion: null,
          codigoInterno: '12345678901',
          codigoNegocio: '1234567890123',
          proveedorCodigo: '01',
          idSeccionCodigo: '12',
          especificoCodigo: '3456',
          surtidoCodigo: '0000',
          categoriaId: 'cat-1',
          subcategoriaId: 'sub-1',
          precioCosto: 100,
          precioVenta: 120,
          stock: 10,
          stockMinimo: 2,
          fotos: [],
          unidadId: 'u1',
          almacenId: 'a1',
          vendorId: 'vendor-1',
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('subcategory-selector')).toHaveAttribute('data-disabled', 'true')
    })

    expect(
      screen.getByText('La categoría y la subcategoría quedan bloqueadas cuando el producto ya tiene EAN-13 emitido.')
    ).toBeInTheDocument()
  })

  it('muestra en toast el primer mensaje de validación al enviar un formulario inválido', async () => {
    render(<ProductoForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled()
    })

    expect(mockToastError.mock.calls[0]?.[0]).toBe('El campo Nombre no ha sido rellenado')
  })
})
