import type {
  Producto as PrismaProducto,
} from '@/app/models/model';

export type Producto = PrismaProducto;

// ─── Restock History Types ─────────────────────────────────

export interface RestockHistoryItem {
  id: string
  fecha: string
  cantidad: number
  precioCostoAnterior: number
  precioCostoNuevo: number
  precioVentaAnterior: number
  precioVentaNuevo: number
  totalCompra: number
  descripcion: string | null
  tipoOperacion: 'restock_same_prices' | 'restock_new_instance' | 'restock_price_change'
  productInstance?: {
    id: string
    nombre: string
    precioCosto: number
    precioVenta: number
  }
  vendor: {
    nombre: string
    contacto: string | null
  }
}

export interface RestockHistoryResponse {
  history: RestockHistoryItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  summary: {
    totalRestocks: number
    totalQuantityAdded: number
    totalCostSpent: number
    averageCostPerRestock: number
    priceChanges: number
  }
}

export interface RestockHistoryQueryInput {
  productoId: string
  page?: number
  limit?: number
  sortBy?: 'fecha' | 'cantidad' | 'total'
  sortOrder?: 'asc' | 'desc'
}
