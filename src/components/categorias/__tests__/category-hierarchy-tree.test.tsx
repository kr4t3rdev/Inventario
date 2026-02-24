import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { CategoryHierarchyTree } from '../category-hierarchy-tree'

// Mock the categorias API hooks
const mockUseGetCategoriaHierarchyQuery = vi.fn()

vi.mock('@/lib/redux/services/categoriasApi', () => ({
  useGetCategoriaHierarchyQuery: () => mockUseGetCategoriaHierarchyQuery(),
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

const mockHierarchy = [
  {
    catId: 'cat1',
    nombre: 'Electrónicos',
    descripcion: 'Productos electrónicos',
    level: 0,
    path: [],
    productCount: 25,
    subcategorias: [
      {
        catId: 'sub1',
        nombre: 'Smartphones',
        descripcion: 'Teléfonos inteligentes',
        level: 1,
        path: ['cat1'],
        productCount: 15,
        subcategorias: []
      },
      {
        catId: 'sub2',
        nombre: 'Laptops',
        descripcion: 'Computadoras portátiles',
        level: 1,
        path: ['cat1'],
        productCount: 10,
        subcategorias: []
      }
    ]
  },
  {
    catId: 'cat2',
    nombre: 'Ropa',
    descripcion: 'Productos de vestir',
    level: 0,
    path: [],
    productCount: 30,
    subcategorias: [
      {
        catId: 'sub3',
        nombre: 'Camisas',
        level: 1,
        path: ['cat2'],
        productCount: 20,
        subcategorias: []
      }
    ]
  },
  {
    catId: 'cat3',
    nombre: 'Hogar',
    level: 0,
    path: [],
    productCount: 5,
    subcategorias: []
  }
]

describe('CategoryHierarchyTree', () => {
  const mockOnCategorySelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display loading state correctly', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    expect(screen.getByText('Jerarquía de Categorías')).toBeInTheDocument()
    // Should show skeleton loading elements
    expect(screen.getAllByTestId('skeleton')).toHaveLength(20)
  })

  it('should display error state correctly', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Network error' },
    })

    renderWithProvider(<CategoryHierarchyTree />)

    expect(screen.getByText('Jerarquía de Categorías')).toBeInTheDocument()
    expect(screen.getByText('Error al cargar la jerarquía de categorías')).toBeInTheDocument()
  })

  it('should display empty state correctly', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    expect(screen.getByText('Jerarquía de Categorías')).toBeInTheDocument()
    expect(screen.getByText('No hay categorías disponibles')).toBeInTheDocument()
  })

  it('should display hierarchy correctly', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    expect(screen.getByText('Jerarquía de Categorías')).toBeInTheDocument()
    expect(screen.getByText('Electrónicos')).toBeInTheDocument()
    expect(screen.getByText('Ropa')).toBeInTheDocument()
    expect(screen.getByText('Hogar')).toBeInTheDocument()
  })

  it('should show product counts when showProductCount is true', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree showProductCount={true} />)

    expect(screen.getByText('25 productos')).toBeInTheDocument()
    expect(screen.getByText('30 productos')).toBeInTheDocument()
    expect(screen.getByText('5 productos')).toBeInTheDocument()
  })

  it('should hide product counts when showProductCount is false', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree showProductCount={false} />)

    expect(screen.queryByText('25 productos')).not.toBeInTheDocument()
    expect(screen.queryByText('30 productos')).not.toBeInTheDocument()
    expect(screen.queryByText('5 productos')).not.toBeInTheDocument()
  })

  it('should expand/collapse categories with subcategories', async () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    // Root categories should be expanded by default, so subcategories should be visible
    expect(screen.getByText('Smartphones')).toBeInTheDocument()
    expect(screen.getByText('Laptops')).toBeInTheDocument()

    // Find the expand/collapse button for Electrónicos
    const electronicsRow = screen.getByText('Electrónicos').closest('div')
    const expandButton = electronicsRow?.querySelector('button')
    
    if (expandButton) {
      // Click to collapse
      fireEvent.click(expandButton)
      
      await waitFor(() => {
        expect(screen.queryByText('Smartphones')).not.toBeInTheDocument()
        expect(screen.queryByText('Laptops')).not.toBeInTheDocument()
      })

      // Click to expand again
      fireEvent.click(expandButton)
      
      await waitFor(() => {
        expect(screen.getByText('Smartphones')).toBeInTheDocument()
        expect(screen.getByText('Laptops')).toBeInTheDocument()
      })
    }
  })

  it('should call onCategorySelect when category is clicked', async () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree onCategorySelect={mockOnCategorySelect} />)

    const electronicsCategory = screen.getByText('Electrónicos')
    fireEvent.click(electronicsCategory)

    await waitFor(() => {
      expect(mockOnCategorySelect).toHaveBeenCalledWith(mockHierarchy[0])
    })
  })

  it('should highlight selected category', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree selectedCategoryId="cat1" />)

    const electronicsRow = screen.getByText('Electrónicos').parentElement?.parentElement?.parentElement
    expect(electronicsRow?.className).toContain('bg-accent text-accent-foreground')
  })

  it('should show different icons for categories with and without subcategories', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    // Categories with subcategories should have folder icons
    const electronicsRow = screen.getByText('Electrónicos').parentElement?.parentElement?.parentElement
    const ropaRow = screen.getByText('Ropa').parentElement?.parentElement?.parentElement
    const hogarRow = screen.getByText('Hogar').parentElement?.parentElement?.parentElement

    // Check that folder icons are present for categories with subcategories
    const electronicsIcon = electronicsRow?.querySelector('svg')
    const ropaIcon = ropaRow?.querySelector('svg')
    const hogarIcon = hogarRow?.querySelector('svg')

    expect(electronicsIcon).toBeInTheDocument()
    expect(ropaIcon).toBeInTheDocument()
    // Hogar doesn't have subcategories, so no icon
    expect(hogarIcon).toBe(null)
  })

  it('should display category descriptions when available', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    expect(screen.getByText('(Productos electrónicos)')).toBeInTheDocument()
    expect(screen.getByText('(Productos de vestir)')).toBeInTheDocument()
    expect(screen.getByText('(Teléfonos inteligentes)')).toBeInTheDocument()
  })

  it('should handle categories without descriptions', () => {
    const hierarchyWithoutDescriptions = [
      {
        catId: 'cat1',
        nombre: 'Categoría Sin Descripción',
        level: 0,
        path: [],
        productCount: 10,
        subcategorias: []
      }
    ]

    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: hierarchyWithoutDescriptions,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    expect(screen.getByText('Categoría Sin Descripción')).toBeInTheDocument()
    expect(screen.queryByText('(undefined)')).not.toBeInTheDocument()
  })

  it('should show proper indentation for subcategories', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    // Subcategories should have different styling/indentation
    const smartphonesRow = screen.getByText('Smartphones').parentElement?.parentElement?.parentElement
    const laptopsRow = screen.getByText('Laptops').parentElement?.parentElement?.parentElement

    // Check that subcategories have the ml-4 class for indentation
    expect(smartphonesRow?.className).toContain('ml-4')
    expect(laptopsRow?.className).toContain('ml-4')
  })

  it('should disable expand button for categories without subcategories', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    renderWithProvider(<CategoryHierarchyTree />)

    // Find the Hogar category (which has no subcategories)
    const hogarRow = screen.getByText('Hogar').parentElement?.parentElement?.parentElement
    const expandButton = hogarRow?.querySelector('button')

    expect(expandButton?.disabled).toBe(true)
  })

  it('should apply custom className when provided', () => {
    mockUseGetCategoriaHierarchyQuery.mockReturnValue({
      data: mockHierarchy,
      isLoading: false,
      error: null,
    })

    const { container } = renderWithProvider(
      <CategoryHierarchyTree className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})