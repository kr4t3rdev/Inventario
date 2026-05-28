# Design: Cuentas por Pagar — Fixes

## Resumen de cambios

```
┌─────────────────────────────────────────────────────────────┐
│                     ESTRATEGIA GENERAL                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Unificar flujo de pago CxP → applyPagoGastoWorkflow      │
│ 2. `reconciliarGastoAction` acepta distribución multi-cuenta │
│ 3. Eliminar `pagarCuentaPorPagarAction` (código muerto)     │
│ 4. Agregar tests al flujo real                              │
│ 5. Fix validación duplicado (factura + proveedor)           │
│ 6. Extraer lógica CxP del form genérico                     │
└─────────────────────────────────────────────────────────────┘
```

## RF-1 y RF-2: Unificar flujo + multi-distribución

### Problema actual

`reconciliarGastoAction` en `actions-reconciliacion.ts` (líneas 618-720) maneja el pago CxP inline:
1. Crea una sola `ReconciliacionGasto`
2. Descuenta de una sola cuenta bancaria
3. Calcula nuevo saldo y estado
4. Crea `PagoCuentaPorPagar`

Paralelamente, `pagarCuentaPorPagarAction` en `actions-cuentas.ts` (líneas 552-650) llama a `applyPagoGastoWorkflow` que hace TODO lo anterior **pero con soporte multi-distribución, transacciones, FOR UPDATE, y manejo de moneda**.

### Solución

**Eliminar la lógica inline de CxP en `reconciliarGastoAction` y delegar a `applyPagoGastoWorkflow`**.

#### Paso 1: Modificar `reconciliarGastoAction`

Cambiar la firma para aceptar distribución multi-cuenta:

```typescript
interface ReconciliarGastoInput {
  // ... campos existentes ...
  cuentaPorPagarId?: string
  // NUEVO: distribución multi-cuenta (opcional, para compatibilidad)
  distribucion?: Array<{
    cuentaId: string
    monto: number
    porcentaje?: number
  }>
}
```

Cuando `cuentaPorPagarId` esté presente:
1. Construir el objeto `ApplyPagoGastoWorkflowParams`
2. Si hay `distribucion`, pasarla; si no, crear distribución simple con `cuentaId`
3. Llamar `applyPagoGastoWorkflow(tx, params)` dentro de `$transaction`
4. Retornar el resultado normalizado

Cuando NO haya `cuentaPorPagarId` (salarios, gastosDE, servicios, venta_servicio):
- Mantener la lógica actual inline (no tocar estos flujos)

#### Paso 2: Modificar `ReconciliacionGastosForm`

En `onSubmit`, cuando `isCuentaPorPagar = true`:
- Pasar `distribucion` completa al action en lugar de solo `data.distribuciones[0]`
- Incluir `porcentaje` calculado para compatibilidad con `applyPagoGastoWorkflow`

```typescript
// Antes (solo primera distribución):
const result = await reconciliarGastoAction({
  cuentaId: data.distribuciones[0].cuentaId,
  ...
})

// Después (distribución completa):
const result = await reconciliarGastoAction({
  cuentaPorPagarId,
  distribucion: data.distribuciones.map(d => ({
    cuentaId: d.cuentaId,
    monto: d.monto,
    tipoPagoId: d.tipoPagoId,
    moneda: d.moneda,
    tasaCambio: d.tasaCambio,
    numeroTransaccion: d.numeroTransaccion,
    observaciones: d.observaciones,
    porcentaje: Math.round((d.monto / gasto.monto) * 100 * 100) / 100
  })),
  ... // mantener campos comunes
})
```

#### Paso 3: Eliminar `pagarCuentaPorPagarAction`

Una vez que `reconciliarGastoAction` delegue a `applyPagoGastoWorkflow`:
1. Eliminar la función `pagarCuentaPorPagarAction` de `actions-cuentas.ts`
2. Eliminar su export de `index.ts`
3. Refactorizar los tests existentes para que prueben `reconciliarGastoAction` en lugar de `pagarCuentaPorPagarAction`
4. Eliminar `pagarCuentaPorPagarSchema` de `schemas-cuentas.ts` si no se usa más
5. Eliminar `PagarCuentaPorPagarInput` type

### Flujo final (después)

```
page.tsx → ReconciliacionGastosForm
  → reconciliarGastoAction({ cuentaPorPagarId, distribucion: [...] })
    → prisma.$transaction(tx => applyPagoGastoWorkflow(tx, params))
      → Crea ReconciliacionGasto por cada distribución
      → Descuenta saldo de cada cuenta bancaria
      → Actualiza CuentaPorPagar (montoPagado, saldoPendiente, estado)
      → Crea PagoCuentaPorPagar
      → Registra TransaccionMoneda si aplica
      → Actualiza CompraProducto/CompraDocumento si estado = PAGADA
    → revalidatePath
```

## RF-3: Validar duplicado factura + proveedor

### Cambio

En `createCuentaPorPagarAction` (`actions-cuentas.ts`, línea ~520):

```typescript
// Antes:
const existente = await prisma.cuentaPorPagar.findFirst({
  where: { numeroFactura: p.numeroFactura, tenantId, deletedAt: null },
});

// Después:
const existente = await prisma.cuentaPorPagar.findFirst({
  where: {
    numeroFactura: p.numeroFactura,
    proveedorId: p.proveedorId,
    tenantId,
    deletedAt: null,
  },
});
```

## RF-4: Tests

### Tests a crear/modificar

Reemplazar el archivo `cuentas-por-pagar-pagar.test.ts` (que prueba `pagarCuentaPorPagarAction`) por uno que pruebe `reconciliarGastoAction` con `cuentaPorPagarId`.

**Mock strategy**:
- Mock `@/lib/server-actions/get-current-user` (igual que el actual)
- Mock `@/lib/prisma` para el find inicial de CxP
- Mock `@/lib/services/pago-gastos-workflow` para `applyPagoGastoWorkflow` e `isGastoWorkflowError`

**Casos de test**:

| # | Escenario | Expected |
|---|-----------|----------|
| 1 | Pago total con distribución simple | success, estado → PAGADA, saldo → 0 |
| 2 | Pago parcial | success, estado → PARCIAL, saldo > 0 |
| 3 | Pago multi-cuenta (2 distribuciones) | success, 2 reconciliaciones, saldos descontados |
| 4 | Monto excede saldo pendiente | error MONTO_EXCEDE_SALDO |
| 5 | CxP ya pagada | error CUENTA_YA_PAGADA |
| 6 | Sin `cuentaPorPagarId` (flujo normal no-CxP) | no debe cambiar comportamiento existente |

### Archivo destino

`src/features/contabilidad/__tests__/reconciliar-gasto-cxp.test.ts`

## RF-5: Extraer lógica CxP del form genérico

### Estrategia

Extraer la lógica específica de CxP a un hook `usePagoCuentaPorPagar`:

```typescript
// src/features/contabilidad/hooks/use-pago-cuenta-por-pagar.ts
export function usePagoCuentaPorPagar(cuentaPorPagarId: string) {
  // Lógica de:
  // - Validar saldo pendiente
  // - Construir distribución
  // - Callback onSubmit que llama a reconciliarGastoAction con distribucion
  // - Manejo de errores específicos CxP
  // - Estados loading/success/error
}
```

El `ReconciliacionGastosForm` mantiene su interfaz actual pero cuando `isCuentaPorPagar = true` delega al hook.

**Cambios mínimos** para mantener el presupuesto de revisión bajo:
- Mover lógica de CxP a un hook
- El form sigue igual pero usa `usePagoCuentaPorPagar` condicionalmente
- No refactorizar el form entero

## Archivos afectados (resumen)

| Archivo | Cambio |
|---------|--------|
| `src/features/contabilidad/actions-reconciliacion.ts` | Agregar `distribucion` al input; delegar a `applyPagoGastoWorkflow` cuando hay `cuentaPorPagarId` |
| `src/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form.tsx` | Pasar `distribucion` completa; usar hook opcional |
| `src/features/contabilidad/hooks/use-pago-cuenta-por-pagar.ts` | **NUEVO** — hook con lógica CxP |
| `src/features/contabilidad/actions-cuentas.ts` | Eliminar `pagarCuentaPorPagarAction`; fix duplicado |
| `src/features/contabilidad/schemas-cuentas.ts` | Eliminar `pagarCuentaPorPagarSchema` (opcional) |
| `src/features/contabilidad/index.ts` | Eliminar export de `pagarCuentaPorPagarAction` y `PagarCuentaPorPagarResult` |
| `src/features/contabilidad/__tests__/reconciliar-gasto-cxp.test.ts` | **NUEVO** — tests del flujo real |
| `src/features/contabilidad/api/__tests__/cuentas-por-pagar-pagar.test.ts` | ELIMINAR (reemplazado por el nuevo) |

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Romper flujo de gastos no-CxP (salario, gastoDE, servicios) | Media | La lógica inline actual se mantiene cuando NO hay `cuentaPorPagarId`. Agregar tests de regresión. |
| `applyPagoGastoWorkflow` tiene side effects no esperados para CxP | Baja | Ya fue diseñado para CxP. Verificar que recibe todos los parámetros necesarios. |
| Migración de tests existentes pierde cobertura | Baja | Los casos del test anterior se mantienen en el nuevo archivo. |

## Criterios de aceptación

- [ ] Pago CxP con distribución simple funciona igual que antes
- [ ] Pago CxP con múltiples cuentas descuenta de todas
- [ ] `pagarCuentaPorPagarAction` eliminada sin impacto
- [ ] Validación de duplicado incluye `proveedorId`
- [ ] Tests nuevos pasan en `pnpm run test:run`
- [ ] Flujo de salarios, gastosDE, servicios y venta_servicio no afectado
