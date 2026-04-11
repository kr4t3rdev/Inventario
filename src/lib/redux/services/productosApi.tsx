import { apiSlice } from "./apiSlice";
import { Producto, RestockRequest, RestockResponse, RestockHistory, RestockHistoryResponse } from '../../../app/models/model';

// Interface for bulk minimum stock update
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

// Interface for search parameters
interface ProductSearchParams {
  search?: string;
  categoryId?: string;
  subcategoryId?: string;
}

export const productosApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
      getProductos: builder.query<Producto[], void>({
        query: () => "/productos",
        transformResponse: (response: { productos: Producto[] }) => response.productos,
        providesTags: ["Productos"],
      }),
      searchProductos: builder.query<Producto[], ProductSearchParams>({
        query: (params) => {
          const searchParams = new URLSearchParams();
          if (params.search) searchParams.append('search', params.search);
          if (params.categoryId) searchParams.append('categoryId', params.categoryId);
          if (params.subcategoryId) searchParams.append('subcategoryId', params.subcategoryId);
          
          return `/productos?${searchParams.toString()}`;
        },
        providesTags: ["Productos"],
      }),
      getProducto: builder.query<Producto, string>({
        query: (id) => `/productos/${id}`,
        providesTags: (result, error, id) => [{ type: "Productos", id }],
      }),
      addProducto: builder.mutation<Producto, Omit<Producto, "id" | "createdAt" | "updatedAt">>({
        query: (producto) => ({
          url: "/productos",
          method: "POST",
          body: producto,
        }),
        transformResponse: (response: { producto?: Producto } | Producto) => {
          if (response && typeof response === 'object' && 'producto' in response && response.producto) {
            return response.producto;
          }

          return response as Producto;
        },
        invalidatesTags: ["Productos", "Dashboard", "StockUbicacion"],
      }),
      updateProducto: builder.mutation<Producto, Partial<Producto> & { id: string }>({
        query: ({ id, ...patch }) => ({
          url: `/productos/${id}`,
          method: "PATCH",
          body: patch,
        }),
        invalidatesTags: (result, error, { id }) => [{ type: "Productos", id }, "Dashboard", "StockUbicacion"],
        // Optimistic update for minimum stock changes
        async onQueryStarted({ id, stockMinimo, ...patch }, { dispatch, queryFulfilled }) {
          if (stockMinimo !== undefined) {
            // Optimistically update the individual product query
            const patchResult = dispatch(
              productosApi.util.updateQueryData('getProducto', id, (draft) => {
                if (draft) {
                  draft.stockMinimo = stockMinimo;
                }
              })
            );

            // Optimistically update the products list query
            const listPatchResult = dispatch(
              productosApi.util.updateQueryData('getProductos', undefined, (draft) => {
                const product = draft.find(p => p.id === id);
                if (product) {
                  product.stockMinimo = stockMinimo;
                }
              })
            );

            try {
              await queryFulfilled;
            } catch {
              // Revert optimistic updates on failure
              patchResult.undo();
              listPatchResult.undo();
            }
          }
        },
      }),
      updateProductoStockMinimo: builder.mutation<Producto, { id: string; stockMinimo: number }>({
        query: ({ id, stockMinimo }) => ({
          url: `/productos/${id}`,
          method: "PATCH",
          body: { stockMinimo },
        }),
        invalidatesTags: (result, error, { id }) => [
          { type: "Productos", id }, 
          "Productos", 
          "Dashboard",
          "StockUbicacion"
        ],
        // Optimistic update for minimum stock changes
        async onQueryStarted({ id, stockMinimo }, { dispatch, queryFulfilled }) {
          // Optimistically update the individual product query
          const patchResult = dispatch(
            productosApi.util.updateQueryData('getProducto', id, (draft) => {
              if (draft) {
                draft.stockMinimo = stockMinimo;
              }
            })
          );

          // Optimistically update the products list query
          const listPatchResult = dispatch(
            productosApi.util.updateQueryData('getProductos', undefined, (draft) => {
              const product = draft.find(p => p.id === id);
              if (product) {
                product.stockMinimo = stockMinimo;
              }
            })
          );

          try {
            await queryFulfilled;
          } catch {
            // Revert optimistic updates on failure
            patchResult.undo();
            listPatchResult.undo();
          }
        },
      }),
      deleteProducto: builder.mutation<{ success: boolean; id: string }, string>({
        query: (id) => ({
          url: `/productos/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Productos", "Dashboard", "StockUbicacion"],
      }),
      restockProducto: builder.mutation<RestockResponse, RestockRequest>({
        query: (restockData) => ({
          url: `/productos/restock`,
          method: "POST",
          body: restockData,
        }),
        invalidatesTags: (result, error, { productoId }) => [
          "Productos", 
          "GastosCompra", 
          "Dashboard",
          "StockUbicacion",
          { type: "Productos", id: productoId }
        ],
      }),
      getRestockHistory: builder.query<RestockHistoryResponse, string>({
        query: (productoId) => `/productos/${productoId}/restock-history`,
        providesTags: (result, error, productoId) => [
          { type: "Productos", id: productoId }
        ],
      }),
      bulkUpdateStockMinimo: builder.mutation<BulkUpdateResponse, BulkStockMinimoUpdate>({
        query: (bulkUpdate) => ({
          url: `/productos/bulk-stock-minimo`,
          method: "POST",
          body: bulkUpdate,
        }),
        invalidatesTags: ["Productos", "Dashboard"],
        // Optimistic updates for bulk minimum stock changes
        async onQueryStarted(bulkUpdate, { dispatch, queryFulfilled }) {
          const patchResults: { undo: () => void }[] = [];

          // Apply optimistic updates for each product in the bulk update
          bulkUpdate.updates.forEach(({ productoId, stockMinimo }) => {
            // Update individual product queries
            const patchResult = dispatch(
              productosApi.util.updateQueryData('getProducto', productoId, (draft) => {
                if (draft) {
                  draft.stockMinimo = stockMinimo;
                }
              })
            );
            patchResults.push(patchResult);

            // Update products list query
            const listPatchResult = dispatch(
              productosApi.util.updateQueryData('getProductos', undefined, (draft) => {
                const product = draft.find(p => p.id === productoId);
                if (product) {
                  product.stockMinimo = stockMinimo;
                }
              })
            );
            patchResults.push(listPatchResult);
          });

          try {
            await queryFulfilled;
          } catch {
            // Revert all optimistic updates on failure
            patchResults.forEach(patchResult => patchResult.undo());
          }
        },
      }),
    }),
  })
  
  export const {
    useGetProductosQuery,
    useSearchProductosQuery,
    useGetProductoQuery,
    useAddProductoMutation,
    useUpdateProductoMutation,
    useUpdateProductoStockMinimoMutation,
    useDeleteProductoMutation,
    useRestockProductoMutation,
    useGetRestockHistoryQuery,
    useBulkUpdateStockMinimoMutation,
  } = productosApi

