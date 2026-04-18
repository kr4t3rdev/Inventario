import React from 'react'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { SubcategorySelector } from '../subcategory-selector'

// Mock scrollIntoView for Radix UI compatibility
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// Mock the categorias API hooks
const mockUseGetCategoriasQuery = vi.fn()
const mockUseGetSubcategoriasQuery = vi.fn()

vi.mock('@/lib/redux/services/categoriasApi', () => ({
  useGetCategoriasQuery: () => mockUseGetCategoriasQuery(),
  useGetSubcategoriasQuery: (parentId: string, options?: { skip?: boolean }) => {
    if (options?.skip) {
      return {
        data: undefined,
        isLoading: false,
        error: null,
      }
    }
    return mockUseGetSubcategoriasQuery(parentId, options)
  },
}))

// Create a mock store
const createMockStore = () => configureStore({
  reducer: {
    test: (state = {}) => state,
  },
})

const renderWithProvider = (component: React.ReactElement) => {
  const store = createMockStore()
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  )
}


const mockCategories = [
  {
    catId: 'cat1',
    nombre: 'Electrónicos',
    descripcion: 'Productos electrónicos',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    catId: 'cat2',
    nombre: 'Ropa',
    descripcion: 'Productos de vestir',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    catId: 'sub1',
    nombre: 'Smartphones',
    descripcion: 'Teléfonos inteligentes',
    parentId: 'cat1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
]

const mockSubcategories = [
  {
    catId: 'sub1',
    nombre: 'Smartphones',
    descripcion: 'Teléfonos inteligentes',
    parentId: 'cat1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    catId: 'sub2',
    nombre: 'Laptops',
    descripcion: 'Computadoras portátiles',
    parentId: 'cat1',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
]

describe('SubcategorySelector', () => {
  const mockOnCategoryChange = vi.fn()
  const mockOnSubcategoryChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display loading state correctly', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    expect(screen.getAllByTestId('skeleton')).toHaveLength(2)
  })

  it('should display error state correctly', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Network error' },
    })

    renderWithProvider(
      <SubcategorySelector
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    expect(screen.getByText('Error al cargar las categorías')).toBeInTheDocument()
  })

  it('should display categories correctly', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    expect(screen.getByText('Categoría')).toBeInTheDocument()
    expect(screen.getByText('Seleccionar categoría')).toBeInTheDocument()
  })

  it('should filter parent categories correctly', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    // Click on category selector to open dropdown
    const categoryTrigger = screen.getByText('Seleccionar categoría')
    fireEvent.click(categoryTrigger)

    // Should only show parent categories (without parentId)
    expect(screen.getByText('Electrónicos')).toBeInTheDocument()
    expect(screen.getByText('Ropa')).toBeInTheDocument()
    // Should not show subcategories in the main category list
    expect(screen.queryByText('Smartphones')).not.toBeInTheDocument()
  })

  it('should call onCategoryChange when category is selected', async () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    // Click on category selector
    const categoryTrigger = screen.getByText('Seleccionar categoría')
    fireEvent.click(categoryTrigger)

    // Select a category
    const electronicsOption = screen.getByText('Electrónicos')
    fireEvent.click(electronicsOption)

    await waitFor(() => {
      expect(mockOnCategoryChange).toHaveBeenCalledWith('cat1')
      expect(mockOnSubcategoryChange).toHaveBeenCalledWith(undefined)
    })
  })

  it('should show subcategory selector when category is selected', async () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: mockSubcategories,
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Subcategoría')).toBeInTheDocument()
      expect(screen.getByText('Seleccionar subcategoría (opcional)')).toBeInTheDocument()
    })
  })

  it('should remove optional text and disallow empty subcategory when required', async () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: mockSubcategories,
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        required
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Subcategoría')).toBeInTheDocument()
      expect(screen.queryByText('Subcategoría (Opcional)')).not.toBeInTheDocument()
      expect(screen.getByText('Seleccionar subcategoría')).toBeInTheDocument()
      expect(screen.queryByText('Seleccionar subcategoría (opcional)')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Seleccionar subcategoría'))

    await waitFor(() => {
      expect(screen.queryByText('Sin subcategoría')).not.toBeInTheDocument()
      expect(screen.getByText('Smartphones')).toBeInTheDocument()
    })
  })

  it('should display subcategories correctly', async () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: mockSubcategories,
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    // Click on subcategory selector
    const subcategoryTrigger = screen.getByText('Seleccionar subcategoría (opcional)')
    fireEvent.click(subcategoryTrigger)

    // Should show subcategories
    await waitFor(() => {
      expect(screen.getByText('Sin subcategoría')).toBeInTheDocument()
      expect(screen.getByText('Smartphones')).toBeInTheDocument()
      expect(screen.getByText('Laptops')).toBeInTheDocument()
    })
  })

  it('should call onSubcategoryChange when subcategory is selected', async () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: mockSubcategories,
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    // Click on subcategory selector
    const subcategoryTrigger = screen.getByText('Seleccionar subcategoría (opcional)')
    fireEvent.click(subcategoryTrigger)

    // Select a subcategory
    const smartphonesOption = screen.getByText('Smartphones')
    fireEvent.click(smartphonesOption)

    await waitFor(() => {
      expect(mockOnSubcategoryChange).toHaveBeenCalledWith('sub1')
    })
  })

  it('should handle "Sin subcategoría" selection correctly', async () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: mockSubcategories,
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    // Click on subcategory selector
    const subcategoryTrigger = screen.getByText('Seleccionar subcategoría (opcional)')
    fireEvent.click(subcategoryTrigger)

    // Select "Sin subcategoría"
    const noneOption = screen.getByText('Sin subcategoría')
    fireEvent.click(noneOption)

    await waitFor(() => {
      expect(mockOnSubcategoryChange).toHaveBeenCalledWith(undefined)
    })
  })

  it('should show loading state for subcategories', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    expect(screen.getAllByTestId('skeleton')).toHaveLength(1)
  })

  it('should show error state for subcategories', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Subcategory error' },
    })

    renderWithProvider(
      <SubcategorySelector
        selectedCategoryId="cat1"
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    expect(screen.getByText('Error al cargar las subcategorías')).toBeInTheDocument()
  })

  it('should work without labels when showLabels is false', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        showLabels={false}
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    expect(screen.queryByText('Categoría')).not.toBeInTheDocument()
    expect(screen.getByText('Seleccionar categoría')).toBeInTheDocument()
  })

  it('should be disabled when disabled prop is true', () => {
    mockUseGetCategoriasQuery.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      error: null,
    })

    mockUseGetSubcategoriasQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderWithProvider(
      <SubcategorySelector
        disabled={true}
        onCategoryChange={mockOnCategoryChange}
        onSubcategoryChange={mockOnSubcategoryChange}
      />
    )

    const [categoryTrigger, subcategoryTrigger] = screen.getAllByRole('combobox')
    expect(categoryTrigger).toBeDisabled()
    expect(subcategoryTrigger).toBeDisabled()
  })
})