# Transaction Handling Documentation

## Overview

The restock API implements comprehensive database transaction handling to ensure data consistency and atomicity during product restock operations. This document outlines the transaction implementation, error handling, and rollback mechanisms.

## Transaction Architecture

### Core Transaction Wrapper

All restock operations are wrapped in a Prisma transaction with the following configuration:

```typescript
await prisma.$transaction(async (tx) => {
  // All database operations
}, {
  maxWait: 5000,      // Maximum time to wait for a transaction slot (5 seconds)
  timeout: 10000,     // Maximum time the transaction can run (10 seconds)
  isolationLevel: 'ReadCommitted' // Ensure read committed isolation level
})
```

### Transaction Operations

The transaction includes the following atomic operations:

1. **Product Validation**: Verify product exists and detect concurrent modifications
2. **Product Instance Creation**: Create new product instances when prices change
3. **Product Updates**: Update existing products with new stock and weighted averages
4. **Expense Tracking**: Create GastoCompra entries for purchase tracking
5. **Data Validation**: Ensure all calculations are valid before committing

## Optimistic Locking

### Concurrent Modification Detection

The system implements optimistic locking to detect concurrent modifications:

```typescript
// Check for concurrent modifications
if (currentProduct.stock !== producto.stock || 
    currentProduct.precioCosto !== producto.precioCosto || 
    currentProduct.precioVenta !== producto.precioVenta) {
  throw new Error("Product has been modified by another operation. Please refresh and try again.")
}
```

### Benefits

- Prevents lost updates from concurrent operations
- Maintains data integrity across multiple users
- Provides clear error messages for conflict resolution

## Error Handling and Rollback

### Automatic Rollback Scenarios

The transaction automatically rolls back in the following cases:

1. **Product Not Found**: Product was deleted during operation
2. **Concurrent Modifications**: Product was modified by another user
3. **Validation Failures**: Invalid stock or price calculations
4. **Database Constraints**: Foreign key or unique constraint violations
5. **Incomplete Operations**: Missing required data after operations

### Error Classification

#### Business Logic Errors (400-409 status codes)

- **Validation Errors**: Invalid input data
- **Calculation Errors**: Invalid price or stock calculations
- **Concurrent Modifications**: Optimistic locking conflicts
- **Reference Errors**: Missing foreign key references

#### System Errors (500 status codes)

- **Transaction Failures**: Database transaction errors
- **Timeout Errors**: Operations exceeding time limits
- **Unexpected Errors**: Unhandled system failures

### Error Response Format

```typescript
{
  error: "Error category",
  message: "Detailed error description",
  // Additional context when applicable
}
```

## Transaction Flow Diagrams

### Simple Restock (No Price Changes)

```
Start Transaction
    ↓
Validate Product Exists
    ↓
Check Concurrent Modifications
    ↓
Validate Stock Calculation
    ↓
Update Product Stock
    ↓
Create GastoCompra Entry
    ↓
Validate All Operations Complete
    ↓
Commit Transaction
```

### Complex Restock (With New Instance)

```
Start Transaction
    ↓
Validate Product Exists
    ↓
Check Concurrent Modifications
    ↓
Create New Product Instance
    ↓
Update Original Product (Weighted Averages)
    ↓
Create GastoCompra Entry (Linked to New Instance)
    ↓
Validate All Operations Complete
    ↓
Commit Transaction
```

## Testing Strategy

### Unit Tests

The transaction handling includes comprehensive tests for:

1. **Successful Operations**: Normal restock scenarios
2. **Rollback Scenarios**: Various failure conditions
3. **Concurrent Modifications**: Optimistic locking validation
4. **Error Handling**: Proper error classification and responses
5. **Data Integrity**: Validation of all calculations and constraints

### Test Scenarios

#### Successful Transactions
- Simple restock without price changes
- Complex restock with new product instance creation
- Weighted average calculations

#### Rollback Scenarios
- Product update failures
- GastoCompra creation failures
- New product instance creation failures
- Concurrent modification detection
- Product deletion during operation

#### Error Handling
- Invalid cost calculations
- Invalid stock calculations
- Database constraint violations
- Transaction timeouts

### Running Tests

```bash
# Run integration tests
node src/app/api/productos/restock/__tests__/transaction-integration.test.js

# Expected output: All tests pass with proper rollback statistics
```

## Performance Considerations

### Transaction Optimization

1. **Minimal Transaction Scope**: Only essential operations within transactions
2. **Efficient Queries**: Optimized database queries with proper indexing
3. **Timeout Management**: Reasonable timeout values to prevent deadlocks
4. **Connection Pooling**: Prisma connection pooling for scalability

### Monitoring

- Transaction duration tracking
- Rollback rate monitoring
- Concurrent modification frequency
- Error rate analysis

## Security Considerations

### Data Integrity

- All operations are atomic (all-or-nothing)
- Optimistic locking prevents data corruption
- Input validation before transaction execution
- Proper error handling without data leakage

### Audit Trail

- All transaction errors are logged with context
- Successful operations include detailed tracking
- User identification for all operations
- Timestamp tracking for all changes

## Best Practices

### Transaction Design

1. **Keep Transactions Short**: Minimize transaction duration
2. **Handle Errors Gracefully**: Provide meaningful error messages
3. **Validate Early**: Check inputs before starting transactions
4. **Log Appropriately**: Log errors without exposing sensitive data
5. **Test Thoroughly**: Cover all success and failure scenarios

### Error Recovery

1. **Retry Logic**: Implement retry for transient failures
2. **User Guidance**: Provide clear instructions for error resolution
3. **Graceful Degradation**: Handle partial failures appropriately
4. **Data Consistency**: Ensure no partial updates remain

## Troubleshooting

### Common Issues

#### Transaction Timeouts
- **Cause**: Long-running operations or database locks
- **Solution**: Optimize queries, reduce transaction scope
- **Prevention**: Monitor transaction duration

#### Concurrent Modifications
- **Cause**: Multiple users modifying same product
- **Solution**: User refreshes data and retries
- **Prevention**: Implement UI-level optimistic locking

#### Constraint Violations
- **Cause**: Invalid foreign key references
- **Solution**: Validate references before transaction
- **Prevention**: Implement proper data validation

### Debugging

1. **Check Transaction Logs**: Review error messages and context
2. **Verify Data State**: Ensure no partial updates occurred
3. **Test Isolation**: Reproduce issues in isolated environment
4. **Monitor Performance**: Check for deadlocks or slow queries

## Future Enhancements

### Potential Improvements

1. **Distributed Transactions**: Support for multiple database operations
2. **Advanced Retry Logic**: Exponential backoff for transient failures
3. **Performance Metrics**: Detailed transaction performance tracking
4. **Batch Operations**: Support for bulk restock operations
5. **Event Sourcing**: Track all changes for audit and replay capabilities

### Scalability Considerations

- Connection pool optimization
- Read replica support for validation queries
- Caching strategies for frequently accessed data
- Horizontal scaling support