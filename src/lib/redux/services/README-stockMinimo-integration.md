# Redux Integration for Minimum Stock Functionality

## Overview

This document describes the Redux integration implemented for the minimum stock functionality as part of task 8. The integration provides optimistic updates, cache invalidation, and seamless state management for minimum stock operations.

## Implemented Features

### 1. New Mutation Endpoints

#### `updateProductoStockMinimo`
- **Purpose**: Update minimum stock for a single product
- **Hook**: `useUpdateProductoStockMinimoMutation`
- **Features**:
  - Optimistic updates for immediate UI feedback
  - Automatic cache invalidation for Dashboard and Products
  - Error handling with automatic rollback

```typescript
const [updateStockMinimo] = useUpdateProductoStockMinimoMutation();

await updateStockMinimo({ 
  id: productId, 
  stockMinimo: newValue 
});
```

#### Enhanced `updateProducto`
- **Purpose**: General product updates with stockMinimo support
- **Hook**: `useUpdateProductoMutation` (existing, enhanced)
- **Features**:
  - Conditional optimistic updates when stockMinimo is included
  - Maintains backward compatibility

```typescript
const [updateProduct] = useUpdateProductoMutation();

await updateProduct({
  id: productId,
  nombre: "New Name",
  stockMinimo: 25
});
```

#### Enhanced `bulkUpdateStockMinimo`
- **Purpose**: Bulk minimum stock updates
- **Hook**: `useBulkUpdateStockMinimoMutation` (existing, enhanced)
- **Features**:
  - Optimistic updates for all affected products
  - Automatic rollback on failure
  - Detailed error reporting

```typescript
const [bulkUpdate] = useBulkUpdateStockMinimoMutation();

await bulkUpdate({
  updates: [
    { productoId: "id1", stockMinimo: 10 },
    { productoId: "id2", stockMinimo: 15 }
  ]
});
```

### 2. Cache Invalidation Strategy

All minimum stock mutations invalidate the following cache tags:
- `"Dashboard"` - Ensures low stock calculations refresh
- `"Productos"` - Updates product lists
- `{ type: "Productos", id: productId }` - Updates specific product queries

### 3. Optimistic Updates

#### Individual Product Updates
```typescript
// Optimistically update both individual and list queries
const patchResult = dispatch(
  productosApi.util.updateQueryData('getProducto', id, (draft) => {
    if (draft) {
      draft.stockMinimo = stockMinimo;
    }
  })
);

const listPatchResult = dispatch(
  productosApi.util.updateQueryData('getProductos', undefined, (draft) => {
    const product = draft.find(p => p.id === id);
    if (product) {
      product.stockMinimo = stockMinimo;
    }
  })
);
```

#### Bulk Updates
```typescript
// Apply optimistic updates for each product in bulk operation
bulkUpdate.updates.forEach(({ productoId, stockMinimo }) => {
  // Update individual product queries
  dispatch(productosApi.util.updateQueryData('getProducto', productoId, ...));
  
  // Update products list query
  dispatch(productosApi.util.updateQueryData('getProductos', undefined, ...));
});
```

### 4. Dashboard Integration

Enhanced dashboard API with improved caching:
```typescript
getDashboardStats: builder.query<DashboardStats, ...>({
  // ... existing configuration
  keepUnusedDataFor: 30, // 30 seconds cache for dashboard stats
})
```

## Usage Examples

### Component Integration

```typescript
import { 
  useUpdateProductoStockMinimoMutation,
  useGetProductoQuery 
} from '@/lib/redux/services/productosApi';

function ProductStockEditor({ productId }: { productId: string }) {
  const { data: product } = useGetProductoQuery(productId);
  const [updateStockMinimo, { isLoading }] = useUpdateProductoStockMinimoMutation();

  const handleUpdate = async (newMinimum: number) => {
    try {
      await updateStockMinimo({ 
        id: productId, 
        stockMinimo: newMinimum 
      }).unwrap();
      
      // UI updates immediately (optimistic)
      // Dashboard refreshes automatically (cache invalidation)
    } catch (error) {
      // Optimistic updates reverted automatically
      console.error('Update failed:', error);
    }
  };

  return (
    <div>
      <p>Current: {product?.stockMinimo}</p>
      <button onClick={() => handleUpdate(20)}>
        Set to 20
      </button>
    </div>
  );
}
```

### Error Handling

```typescript
try {
  const result = await bulkUpdate({ updates }).unwrap();
  
  if (result.errors.length > 0) {
    // Handle partial failures
    console.warn('Some updates failed:', result.errors);
  }
} catch (error) {
  // Handle complete failure
  // All optimistic updates automatically reverted
  console.error('Bulk update failed:', error);
}
```

## Integration with Existing Components

### BulkStockMinimoManager
- ✅ Already using `useBulkUpdateStockMinimoMutation`
- ✅ Proper error handling and progress tracking
- ✅ Optimistic updates working correctly

### ProductosForm
- ✅ Includes `stockMinimo` field with validation
- ✅ Uses general `useUpdateProductoMutation` for updates
- ✅ Optimistic updates apply when stockMinimo is modified

### StockBajoTable
- ✅ Displays `stockMinimo` data from dashboard API
- ✅ Automatically refreshes when minimum stock changes
- ✅ Shows hybrid logic (custom vs default thresholds)

## Testing

Comprehensive test suite covers:
- ✅ Endpoint creation and configuration
- ✅ Hook exports and functionality
- ✅ Cache invalidation integration
- ✅ TypeScript interface compatibility
- ✅ Optimistic update behavior

Run tests:
```bash
npm test -- src/lib/redux/services/__tests__/productosApi-stockMinimo.test.ts
```

## Performance Considerations

1. **Optimistic Updates**: Immediate UI feedback without waiting for server response
2. **Cache Invalidation**: Targeted invalidation prevents unnecessary refetches
3. **Dashboard Caching**: 30-second cache reduces API calls while maintaining freshness
4. **Bulk Operations**: Efficient handling of multiple product updates

## Requirements Fulfilled

- ✅ **5.1**: Extended `productosApi` with minimum stock update mutations
- ✅ **5.2**: Added cache invalidation tags for dashboard stats
- ✅ **5.3**: Product queries include `stockMinimo` field (via Producto interface)
- ✅ **5.4**: Implemented optimistic updates for minimum stock changes
- ✅ **5.5**: Proper error handling and rollback mechanisms

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live stock updates
2. **Batch Processing**: Queue-based processing for very large bulk operations
3. **Audit Trail**: Track minimum stock changes for compliance
4. **Advanced Caching**: More granular cache invalidation strategies

## Conclusion

The Redux integration for minimum stock functionality provides a robust, performant, and user-friendly experience. The implementation follows Redux Toolkit Query best practices and integrates seamlessly with the existing codebase while maintaining backward compatibility.