# Bulk Stock Mínimo Manager

## Overview

The Bulk Stock Mínimo Manager is a comprehensive UI component that allows administrators to efficiently manage minimum stock levels for multiple products simultaneously. This component provides a table interface with inline editing, batch selection, and bulk update functionality with progress indicators and error handling.

## Features

### Core Functionality
- **Table Interface**: Displays all products with their current stock and minimum stock levels
- **Inline Editing**: Edit minimum stock values directly in the table
- **Batch Selection**: Select multiple products for bulk updates
- **Search & Filter**: Search products by name or category
- **Progress Indicators**: Real-time progress tracking during bulk updates
- **Error Handling**: Detailed error reporting for failed updates
- **Validation**: Client-side and server-side validation for stock minimum values

### User Experience
- **Visual Feedback**: Modified products are highlighted
- **Status Indicators**: Clear status badges showing product states
- **Responsive Design**: Works on desktop and mobile devices
- **Loading States**: Skeleton loading and progress indicators
- **Toast Notifications**: Success and error notifications

## Component Structure

### Main Component
- `BulkStockMinimoManager` - The main component located in `src/components/productos/bulk-stock-minimo-manager.tsx`

### API Integration
- Uses `useBulkUpdateStockMinimoMutation` from `productosApi`
- Integrates with existing Redux store and RTK Query

### UI Components Used
- Card, CardContent, CardHeader, CardTitle
- Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- Button, Input, Checkbox, Badge, Progress, Alert, Skeleton
- Various Lucide React icons

## Usage

### Basic Usage
```tsx
import { BulkStockMinimoManager } from "@/components/productos/bulk-stock-minimo-manager"

export default function ProductManagementPage() {
  return (
    <div>
      <BulkStockMinimoManager />
    </div>
  )
}
```

### Integration with Existing Pages
The component is integrated into the product management system:

1. **Main Products Page**: Added a "Stock Mínimo Masivo" button in `/busy/products`
2. **Dedicated Page**: Available at `/busy/products/bulk-stock-minimo`

## API Endpoints

### Bulk Update Endpoint
- **URL**: `POST /api/productos/bulk-stock-minimo`
- **Request Body**:
```typescript
{
  updates: {
    productoId: string
    stockMinimo: number
  }[]
}
```
- **Response**:
```typescript
{
  success: boolean
  updated: number
  errors: {
    productoId: string
    error: string
  }[]
  results: {
    productoId: string
    success: boolean
    previousStockMinimo?: number
    newStockMinimo?: number
  }[]
}
```

## State Management

### Local State
- `productosState`: Array of products with modification tracking
- `searchTerm`: Current search filter
- `selectAll`: Select all checkbox state
- `updateProgress`: Bulk update progress tracking

### Redux Integration
- Fetches products using `useGetProductosQuery`
- Updates products using `useBulkUpdateStockMinimoMutation`
- Invalidates cache tags: `["Productos", "Dashboard"]`

## Validation Rules

### Stock Mínimo Validation
- Must be a non-negative integer
- Value of 0 means "use default threshold (10 units)"
- Maximum 100 products can be updated at once
- No duplicate product IDs in a single request

### Business Logic
- Products with `stockMinimo = 0` use default threshold of 10 units
- Products with `stockMinimo > 0` use custom threshold
- Only modified products can be selected for updates
- Bulk updates are performed within database transactions

## Error Handling

### Client-Side Validation
- Input validation for numeric values
- Duplicate product ID detection
- Empty update array prevention

### Server-Side Error Handling
- Product existence validation
- Database transaction safety
- Detailed error reporting per product
- Partial success handling (207 Multi-Status responses)

### User Feedback
- Toast notifications for success/error states
- Inline error display in alert components
- Progress indicators during updates
- Status badges for individual products

## Accessibility

### Keyboard Navigation
- Full keyboard navigation support
- Proper tab order
- Enter key support for actions

### Screen Reader Support
- Proper ARIA labels
- Semantic HTML structure
- Status announcements

### Visual Indicators
- High contrast status badges
- Clear visual hierarchy
- Loading states and progress indicators

## Performance Considerations

### Optimization Strategies
- Efficient state updates using React hooks
- Debounced search functionality
- Pagination support for large product lists
- Optimistic updates for better UX

### Database Optimization
- Bulk updates in single transaction
- Efficient query patterns
- Proper indexing on stockMinimo field

## Testing

### Component Testing
- Unit tests for validation logic
- Integration tests for API calls
- UI interaction tests
- Error scenario testing

### API Testing
- Bulk update endpoint testing
- Validation error testing
- Transaction rollback testing
- Performance testing with large datasets

## Future Enhancements

### Planned Features
- Export/Import functionality for stock minimums
- Bulk update templates
- Category-based bulk updates
- Historical tracking of minimum stock changes
- Advanced filtering and sorting options

### Performance Improvements
- Virtual scrolling for large product lists
- Background processing for very large updates
- Real-time progress updates via WebSocket

## Dependencies

### Required Packages
- React 19+
- Redux Toolkit with RTK Query
- Tailwind CSS
- Radix UI components
- Lucide React icons
- Sonner for toast notifications

### Internal Dependencies
- `productosApi` Redux service
- UI component library
- Existing product management infrastructure

## Troubleshooting

### Common Issues
1. **Component not loading**: Check Redux store configuration
2. **API errors**: Verify bulk update endpoint is available
3. **Validation errors**: Check input value formats
4. **Performance issues**: Consider pagination for large datasets

### Debug Information
- Enable Redux DevTools for state inspection
- Check network tab for API request/response details
- Use React DevTools for component state debugging

## Contributing

### Code Style
- Follow existing TypeScript patterns
- Use proper error handling
- Include comprehensive JSDoc comments
- Follow accessibility guidelines

### Testing Requirements
- Unit tests for new functionality
- Integration tests for API changes
- Manual testing on different screen sizes
- Accessibility testing with screen readers