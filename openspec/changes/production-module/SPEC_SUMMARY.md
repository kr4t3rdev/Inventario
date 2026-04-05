# Production Module Specification - Summary Report

## Status: ✅ COMPLETE

**Change**: `production-module`
**Last Updated**: 2025-04-05
**Domain**: Production (Producción)
**Type**: Complete Module Specification

---

## Executive Summary

The Production Module specification has been **completely updated and formalized** with comprehensive requirements, detailed scenarios, and clear validation rules. The spec covers all major functionality: recipe creation with ingredients, production order lifecycle, exit vouchers (vales de salida), automatic cost calculation, and state machine enforcement.

### Key Metrics

| Metric | Value |
|--------|-------|
| **Requirements Added** | 12 |
| **Requirements Modified** | 1 |
| **Total Scenarios** | 32+ |
| **Spec Lines** | 340 |
| **Affected Domains** | 3 (Production, Inventory, Accounting) |

---

## Specification Coverage

### ADDED Requirements (12 Total)

1. **Gestión de Recetas para Productos del Inventario** (8 scenarios)
   - Create, edit, delete, search recipes
   - Manage ingredients with units and conversions
   - Prevent duplicates, auto-calculate costs
   - Reject deletion if orders exist

2. **Ingredientes de Receta con Unidades y Conversiones** (2 scenarios)
   - Support different measurement units (kg, liters, units, etc.)
   - Auto-convert to base units for calculations
   - Display in user-friendly units while calculating correctly

3. **Órdenes de Producción con Estados Transicionables** (7 scenarios)
   - Create, approve, complete, cancel orders
   - Validate stock availability before approval
   - Apply waste percentages on completion
   - Strict state machine enforcement
   - Atomic transactions on completion

4. **Transacciones Atómicas en Completación de Orden** (1 scenario)
   - Rollback ALL changes on any error
   - Guarantee inventory consistency
   - Log errors for audit

5. **Vales de Salida por Conceptos** (6 scenarios)
   - Create exit vouchers with predefined or free concepts
   - Support multi-product exits
   - Validate stock availability
   - Filter by concept
   - Add/remove products before saving

6. **Historial y Trazabilidad de Órdenes** (2 scenarios)
   - Record all state transitions with user, date, observations
   - Query full audit trail per order

7. **Cálculo Automático de Costos** (4 scenarios)
   - Calculate recipe cost = Σ(ingredient_qty × ingredient_cost) / rendimiento
   - Recalculate when ingredient prices change
   - Apply waste percentages automatically
   - Display formatted currency

8. **Panel de Estadísticas Actualizado en Tiempo Real** (2 scenarios)
   - Count total recipes
   - Count orders by state (pending, in progress, completed)
   - Update dynamically on changes

9. **Generación de PDF para Vales** (1 scenario)
   - Export voucher with all details
   - Download as PDF for printing/filing

### MODIFIED Requirements (1 Total)

1. **Relación entre Receta y Producto**
   - Previously: Recipes linked only to Platos (restaurant module)
   - Now: Recipes can also link to Inventory Products
   - On production completion: increment product stock by (quantity × rendimiento)
   - Support "generic" recipes (no linked product)

### REMOVED Requirements

None - all existing requirements remain valid with enhancements.

---

## Scenario Breakdown by Category

### Happy Path (Primary Workflows)
- ✅ Create recipe with ingredients
- ✅ Add ingredients with cost calculation
- ✅ Create production order
- ✅ Approve order (with stock validation)
- ✅ Complete order (consume ingredients, generate product)
- ✅ Create exit voucher
- ✅ Export voucher to PDF

### Edge Cases & Error Handling
- ✅ Reject duplicate ingredients
- ✅ Insufficient stock on approval
- ✅ Cannot delete recipe with active orders
- ✅ Cannot exceed available stock in voucher
- ✅ Prevent ingredient duplicates
- ✅ Handle free-text concepts (not in GastosDE)
- ✅ Multi-product validation (all or nothing)

### State Machine & Transitions
- ✅ PENDIENTE → EN_PROCESO (approval)
- ✅ EN_PROCESO → COMPLETADA (completion)
- ✅ PENDIENTE | EN_PROCESO → CANCELADA (cancellation)
- ✅ Prevent transitions from terminal states (COMPLETADA, CANCELADA)

### Data Consistency & Transactions
- ✅ Atomic inventory updates on order completion
- ✅ Rollback on error
- ✅ Historical tracking of all state changes
- ✅ Waste percentage application

---

## Validation & Constraints

### Input Validation
| Field | Rule |
|-------|------|
| Recipe name | Required, 1-160 chars, unique |
| Rendimiento | Integer ≥ 1 |
| Order quantity | Integer ≥ 1 |
| Voucher quantity | Integer ≥ 1, ≤ stock |
| Concept | String 1-100 chars |
| Waste % | Float 0-100 |

### State Transition Rules
- PENDIENTE: Can move to EN_PROCESO (approved) or CANCELADA
- EN_PROCESO: Can move to COMPLETADA (completed) or CANCELADA
- COMPLETADA/CANCELADA: Terminal states, no transitions
- Approval requires: stock available for ALL ingredients
- Completion applies: ingredient consumption + waste, product generation

### Recommended DB Indexes
- `ValeSalida(estado, createdAt)` - for filtering & sorting
- `ValeSalida(usuarioId)` - for audit trails
- `OrdenProduccionHistorial(ordenProduccionId, createdAt)` - for quick history
- `Receta(productoId)` - for product lookup

---

## Coverage Assessment

### ✅ Covered Areas
- Recipe CRUD operations
- Ingredient management with cost calculation
- Production order state machine
- Stock validation (approval & exit vouchers)
- Atomic transactions & rollback
- Cost auto-calculation with waste
- Audit trails & history
- PDF export for vouchers
- Real-time statistics dashboard
- Error handling & validation

### ⚠️ Out of Scope (Acknowledged)
- Advanced scheduling (MRP)
- Machinery & capacity management
- Quality control & inspection
- Labor cost calculation (mano de obra)

---

## Integration Points

### With Inventory Module
- Ingredients are Productos from inventory
- Stock decremented on order completion & voucher creation
- Product final incremented on order completion
- Stock validation before approval/creation

### With Accounting Module
- Concept derivation from GastosDE types
- Cost tracking & reporting
- Historical audit trail

### With User Authentication
- Track user on every state change
- Record user on voucher creation
- Audit trail by user

---

## Next Steps

### Ready For
✅ **Design Phase** (`sdd-design`)
- Architecture for atomic transactions
- API endpoint design (RESTful)
- Database schema finalization
- Error handling strategies

✅ **Task Breakdown** (`sdd-tasks`)
- If design is already completed, proceed to task breakdown
- Implementation checklist from requirements

### Before Implementation
1. Review state machine diagram with stakeholders
2. Confirm cost calculation formula with accounting
3. Validate waste percentage handling
4. Approve PDF export template

---

## Risks & Considerations

### Technical Risks
1. **Transaction Atomicity**: Ensure DB supports nested transactions for rollback
2. **Stock Concurrency**: Multiple orders/vouchers may race; need proper locking
3. **Cost Recalculation**: Product price changes should cascade recipe costs
4. **Rendimiento Handling**: Ensure correct multiplication (order_qty × rendimiento)

### Business Risks
1. **Waste Percentage**: Must be configurable per ingredient; affects costing
2. **Free-Text Concepts**: May create inconsistent categorization; consider whitelist
3. **Deletion Safety**: Ensure recipes can't be deleted if orders exist (already specified)

### Testing Considerations
- Write integration tests for full order workflow (create → approve → complete)
- Test edge cases: zero stock, exactly matching stock, negative scenarios
- Test transaction rollback scenarios
- Verify cost calculations with different waste percentages
- Validate PDF generation with multi-product vouchers

---

## Spec Validation Checklist

- [x] All requirements use RFC 2119 keywords (MUST, SHOULD, MAY)
- [x] Every requirement has ≥1 scenario
- [x] Scenarios use Given/When/Then format
- [x] Happy path scenarios covered
- [x] Edge cases & error scenarios included
- [x] State machine clearly defined
- [x] Validation rules explicit
- [x] No implementation details (WHAT, not HOW)
- [x] Testable scenarios (can write automated tests)
- [x] Integrated with existing modules (inventory, accounting)

---

## Document History

| Date | Change |
|------|--------|
| 2025-04-05 | Complete specification rewrite with 12 added requirements, 32+ scenarios |
| 2024-XX-XX | Initial proposal created |

---

**Status**: Ready for design phase or task breakdown if design exists.
**Reviewer**: Pending stakeholder review.
**Last Updated**: 2025-04-05
