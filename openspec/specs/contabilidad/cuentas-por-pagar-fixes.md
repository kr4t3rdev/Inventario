# Specification: Cuentas por Pagar — Fixes y Consolidación

## Resumen

El módulo de Cuentas por Pagar (CxP) presenta 6 issues identificados en revisión de código que afectan correctness, mantenibilidad y consistencia arquitectónica. Este spec define los requerimientos para resolverlos.

## Issues

### I-1: Dualidad de flujos de pago (CxP-1)

**Problema**: Existen dos caminos para pagar una CxP:

| Camino | Action | Workflow | Estado |
|--------|--------|----------|--------|
| UI actual | `reconciliarGastoAction` | No usa `pago-gastos-workflow.ts`, actualiza CxP directo en `actions-reconciliacion.ts` | **En uso** |
| Alternativo | `pagarCuentaPorPagarAction` | Usa `applyPagoGastoWorkflow` (transacción completa con `pago-gastos-workflow.ts`) | **Código muerto** |

`pagarCuentaPorPagarAction` está exportada, tiene tests, pero **nunca se invoca desde ningún componente**. El UI usa exclusivamente `reconciliarGastoAction`.

**Impacto**: Código muerto con costo de mantenimiento. Riesgo de que alguien intente usar el camino alternativo y genere inconsistencias.

**Archivos afectados**:
- `src/features/contabilidad/actions-cuentas.ts` (líneas 552-650)
- `src/features/contabilidad/index.ts` (export)
- `src/features/contabilidad/api/__tests__/cuentas-por-pagar-pagar.test.ts`

### I-2: Distribución múltiple solo visual (CxP-2)

**Problema**: El `ReconciliacionGastosForm` permite agregar múltiples distribuciones de pago (varias cuentas bancarias), pero `reconciliarGastoAction` solo usa la primera distribución (`data.distribuciones[0].cuentaId`). Las distribuciones extra se ignoran sin feedback al usuario.

```typescript
// reconciliacion-gastos-form.tsx (onSubmit)
const result = await reconciliarGastoAction({
  cuentaId: data.distribuciones[0].cuentaId,  // Solo la primera
  tipoPagoId: baseData.tipoPagoId,
  monto: baseData.monto,
  ...
})
```

**Impacto**: **ALTO** — el usuario cree que está pagando desde múltiples cuentas y solo se descuenta de una. Inconsistencia contable.

**Archivos afectados**:
- `src/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form.tsx`
- `src/features/contabilidad/actions-reconciliacion.ts`

### I-3: `reconciliarGastoAction` sin soporte multi-cuenta (CxP-3)

**Problema**: La firma de `reconciliarGastoAction` no acepta distribución multi-cuenta, mientras que `applyPagoGastoWorkflow` sí. La UI pide multi-cuenta pero el action no lo soporta.

```typescript
reconciliarGastoAction(input: {
  cuentaId: string;     // única
  tipoPagoId: string;   // única
  monto: number;        // único
  ...
})
```

**Impacto**: Feature incompleta. El botón "Agregar Pago" del form no cumple su función.

**Archivos afectados**:
- `src/features/contabilidad/actions-reconciliacion.ts` (líneas 618-720)
- `src/lib/services/pago-gastos-workflow.ts` (ya soporta distribución — aplicar integración)

### I-4: Tests ausentes para el flujo real (CxP-4)

**Problema**: Existen tests solo para `pagarCuentaPorPagarAction` (código muerto). El flujo real (`reconciliarGastoAction` con `cuentaPorPagarId`) no tiene cobertura de tests.

**Impacto**: Riesgo de regresión al modificar el flujo real.

**Archivos afectados**:
- `src/features/contabilidad/api/__tests__/cuentas-por-pagar-pagar.test.ts` (tests existentes, candidate a refactor)
- `src/features/contabilidad/actions-reconciliacion.ts` (código a testear)

### I-5: Duplicado por factura sin validar proveedor (CxP-5)

**Problema**: La validación de duplicado en `createCuentaPorPagarAction` solo checkea `numeroFactura` + `tenantId`, sin incluir `proveedorId`. Si dos proveedores emiten factura "FAC-001", la segunda falla como duplicado.

```typescript
const existente = await prisma.cuentaPorPagar.findFirst({
  where: { numeroFactura: p.numeroFactura, tenantId, deletedAt: null },
});
```

**Impacto**: Error de negocio potencial. Proveedores diferentes pueden tener el mismo número de factura.

**Archivos afectados**:
- `src/features/contabilidad/actions-cuentas.ts` (líneas 511-540)

### I-6: `ReconciliacionGastosForm` sobrecargado (CxP-6)

**Problema**: El componente en `reconciliacion-gastos-form.tsx` maneja 5 tipos de gasto (`salario`, `gastoDE`, `compra`, `servicio`, `venta_servicio`) en ~600 líneas con lógica condicional para CxP. Esto dificulta el mantenimiento.

**Impacto**: Mantenimiento costoso. Alto riesgo de side effects al tocar lógica de un tipo de gasto que afecte a otro.

**Archivos afectados**:
- `src/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form.tsx`

## Requerimientos Funcionales

### RF-1: Consolidar flujo de pago CxP

**Given** un usuario quiere pagar una cuenta por pagar desde la UI
**When** completa el formulario de pago
**Then** MUST usar un único flujo que pase por `applyPagoGastoWorkflow` (el workflow completo con transacciones, validaciones y distribución multi-cuenta)
**And** `pagarCuentaPorPagarAction` SHOULD ser deprecada/eliminada si su lógica queda cubierta por `reconciliarGastoAction`
**And** MUST mantener compatibilidad con el contrato de `reconciliarGastoAction` para los otros tipos de gasto (salario, gastoDE, venta_servicio)

### RF-2: Soportar distribución multi-cuenta en pagos CxP

**Given** un usuario registra un pago de CxP
**When** distribuye el monto entre múltiples cuentas bancarias
**Then** MUST descontar de **todas** las cuentas seleccionadas, no solo de la primera
**And** MUST validar que la suma de las distribuciones no exceda el saldo pendiente
**And** MUST crear una `ReconciliacionGasto` por cada distribución (no una sola con el total)
**And** MUST mostrar error claro si alguna distribución es inválida

### RF-3: Validar duplicado por factura + proveedor

**Given** se intenta crear una CxP
**When** ya existe una con el mismo `numeroFactura` **y** el mismo `proveedorId`
**Then** MUST rechazar con error `DUPLICATE`
**And** SHOULD permitir el mismo `numeroFactura` si el `proveedorId` es diferente

### RF-4: Testear el flujo real

**Given** el flujo de pago CxP vía `reconciliarGastoAction`
**When** se ejecutan los tests
**Then** MUST cubrir:
  - Pago total (saldo pendiente → 0, estado → PAGADA)
  - Pago parcial (saldo pendiente > 0, estado → PARCIAL)
  - Pago multi-cuenta (2+ cuentas bancarias)
  - Rechazo por monto que excede saldo
  - Rechazo por CxP ya pagada

### RF-5: Extraer lógica CxP del form genérico (opcional, según presupuesto de revisión)

**Given** `ReconciliacionGastosForm` es un componente genérico
**When** se trabaja en lógica específica de CxP
**Then** SHOULD extraer la lógica de pago CxP a un subcomponente dedicado o hook
**And** MUST mantener el form genérico funcionando para los otros tipos de gasto

## No Objetivos

- NO rediseñar la UI de la página de CxP
- NO migrar las API routes de DeudaCash
- NO cambiar el modelo de datos Prisma
- NO afectar el flujo de pagos de salarios, gastosDE o venta_servicio
