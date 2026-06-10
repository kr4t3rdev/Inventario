# Design: Bugfixes de ofertas, facturas, transferencias y mermas

## Technical Approach

Seis bugs independientes sin dependencia técnica entre sí. Cada fix es local a un archivo. La estrategia es:

1. **H1, H2, H5**: Fixes de una línea — cambiar nombre de campo en query Prisma.
2. **H3, H4**: Agregar guard condicional basado en `estado` antes de operaciones de stock.
3. **H6**: Refactorizar condicional de `updateMermaAction` para incluir `almacenId` en la detección de cambios.

## Detailed Design

### H1 — Ofertas update (`src/features/ofertas/actions.ts`)

**Current code (lines ~95-120):**
```typescript
export const updateOfertaAction = withAction(async (input: OfertaUpdateInput, user: AuthenticatedUser) => {
  const parsed = ofertaUpdateSchema.parse(input);
  const { ofertaId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.oferta.findFirst({
  // @ts-expect-error
  where: { ofertaId, tenantId }
  });
  if (!existing) throw new ActionError('Oferta no encontrada', 'NOT_FOUND');

  const oferta = await prisma.oferta.update({
    where: {
  // @ts-expect-error
    ofertaId
    },
    ...
  });
```

**Fix:**
```typescript
  const existing = await prisma.oferta.findFirst({
  where: { id: ofertaId, tenantId }
  });
  ...
  const oferta = await prisma.oferta.update({
    where: { id: ofertaId },
    ...
  });
```
Eliminar ambos `// @ts-expect-error`.

### H2 — Facturas update (`src/features/facturas/actions.ts`)

Mismo patrón que H1: cambiar `facturaId` → `idFactura` en findFirst y update, eliminar `@ts-expect-error`.

### H5 — Transferencias count (`src/features/transferencias/actions.ts`)

**Current code (lines ~143-145):**
```typescript
const total = await prisma.transferencia.count({
  where: { deletedAt: null },
});
```

**Fix:**
```typescript
const total = await prisma.transferencia.count({
  where: { tenantId, deletedAt: null },
});
```

### H3 — Transferencias delete (`src/features/transferencias/actions.ts`)

**Current flow:**
```
validate not CANCELADA → update estado=CANCELADA + deletedAt → revert stock (unconditional)
```

**Fixed flow:**
```
validate not CANCELADA →
  if estado === "COMPLETADA":
    revert stock (current behavior)
  else (PENDIENTE or APROBADA):
    skip stock revert
  update estado=CANCELADA + deletedAt (always)
```

**Implementation (lines ~575-625):**
```typescript
if (transferencia.estado === "CANCELADA")
  throw new ActionError("La transferencia ya está cancelada", "VALIDATION_ERROR");

await prisma.$transaction(async (tx: any) => {
  await tx.transferencia.update({
    where: { transferenciaId: id },
    data: { estado: "CANCELADA", deletedAt: new Date() },
  });

  // Solo revertir stock si la transferencia estaba COMPLETADA
  if (transferencia.estado === "COMPLETADA") {
    const tipoOrigen = transferencia.origenId
      ? ("almacen" as const)
      : ("punto_venta" as const);
    const tipoDestino = transferencia.destinoId
      ? ("almacen" as const)
      : ("punto_venta" as const);
    const origenUbicacionId = (transferencia.origenId ||
      transferencia.puntoDeVentaOrigenId)!;
    const destinoUbicacionId = (transferencia.destinoId ||
      transferencia.puntoDeVentaDestinoId)!;

    await upsertStockUbicacion(tx, {
      productoId: transferencia.productoId,
      tipoUbicacion: tipoOrigen,
      ubicacionId: origenUbicacionId,
      modo: "increment",
      delta: transferencia.cantidad,
    });
    await upsertStockUbicacion(tx, {
      productoId: transferencia.productoId,
      tipoUbicacion: tipoDestino,
      ubicacionId: destinoUbicacionId,
      modo: "increment",
      delta: -transferencia.cantidad,
    });
  }
});
```

### H4 — Transferencias update (`src/features/transferencias/actions.ts`)

**Current flow:**
```
get existing → compute old/new values → 
  if any change (origen/destino/cantidad/producto):
    in transaction:
      update transferencia data
      revert old stock movement (unconditional)
      apply new stock movement (unconditional)
```

**Fixed flow:**
```
get existing → compute old/new values →
  if no changes: return early "Sin cambios"
  if estado === "COMPLETADA":
    in transaction:
      update transferencia data
      revert old stock movement
      apply new stock movement
  else (PENDIENTE, APROBADA):
    in transaction:
      update transferencia data only
      skip stock operations
```

**Implementation sketch (around lines ~510-560):**
```typescript
if (!origenCambio && !destinoCambio && !cantidadCambio && !productoCambio) {
  return { message: "Sin cambios", transferencia: existing as any };
}

const isCompleted = existing.estado === "COMPLETADA";

const result = await prisma.$transaction(async (tx: any) => {
  // Siempre actualizar datos de la transferencia
  const updateData: Record<string, unknown> = {
    productoId,
    cantidad,
  };
  // ... (origen/destino mapping igual)
  await tx.transferencia.update({
    where: { transferenciaId },
    data: updateData,
  });

  // Solo tocar stock si estaba COMPLETADA
  if (isCompleted) {
    // ... revert old + apply new (código actual)
  }

  const updated = await tx.transferencia.findUnique({
    where: { transferenciaId },
  });
  return updated;
});
```

### H6 — Mermas update (`src/features/mermas/actions.ts`)

**Current conditional (lines ~159-208):**
```
if (productoId !== mermaActual.productoId || cantidad !== mermaActual.cantidad) {
  → validate stock → transaction: update merma + upsertStock (revert old, apply new)
} else {
  → solo update motivo
}
```

**Fixed conditional:**
La condición debe incluir `almacenId`:

```typescript
const productoCambia = productoId !== mermaActual.productoId;
const cantidadCambia = cantidad !== mermaActual.cantidad;
const almacenCambia = (data.almacenId !== undefined && data.almacenId !== mermaActual.almacenId);

if (productoCambia || cantidadCambia || almacenCambia) {
  // Calcular oldAlmacenId y nuevoAlmacenId correctamente
  const nuevoAlmacenId = data.almacenId ?? mermaActual.almacenId;
  const oldAlmacenId = mermaActual.almacenId;
  
  // Validar stock solo si la cantidad neta aumenta
  const cantidadNeta = productoCambia
    ? cantidad  // producto nuevo: validar cantidad completa
    : cantidad - mermaActual.cantidad;  // mismo producto: validar diferencia
  if (cantidadNeta > 0) {
    // validar stock suficiente en destino
  }
  
  // Transaction: revert old stock, apply new
  await prisma.$transaction(async (tx: any) => {
    await tx.merma.update({
      where: { mermaId },
      data: {
        productoId,
        cantidad,
        motivo: data.motivo ?? undefined,
        almacenId: nuevoAlmacenId,
      },
      include: MERMA_INCLUDE,
    });
    
    // Revertir stock del producto/almacén anterior
    await upsertStockUbicacion(tx, {
      productoId: mermaActual.productoId,
      tipoUbicacion: "almacen",
      ubicacionId: oldAlmacenId,
      modo: "increment",
      delta: mermaActual.cantidad,
    });
    // Aplicar stock al nuevo producto/almacén
    await upsertStockUbicacion(tx, {
      productoId,
      tipoUbicacion: "almacen",
      ubicacionId: nuevoAlmacenId,
      modo: "increment",
      delta: -cantidad,
    });
  });
} else {
  // Solo actualizar motivo (sin cambios de stock o almacén)
  // ... current code
}
```

## Validation Rules

### H1, H2
- TypeScript no debe mostrar errores en las líneas modificadas
- Los tests deben pasar sin `@ts-expect-error`

### H3, H4
- El `estado` de la transferencia determina si se ejecutan operaciones de stock
- La máquina de estados respetada: `PENDIENTE` → (sin stock) → `APROBADA` → (sin stock) → `COMPLETADA` → (stock movido)

### H5
- `count` siempre incluye `tenantId` cuando `findMany` también lo incluye

### H6
- La condición de cambio en mermas incluye explícitamente `almacenId`
- El stock se mueve correctamente entre almacenes aunque solo cambie el almacén

## Testing Strategy

| Fix | Tipo test | Cobertura |
|-----|-----------|-----------|
| H1 | Actualizar test existente de `updateOfertaAction` | Mock de Prisma debe usar `id` no `ofertaId` |
| H2 | Actualizar test existente de `updateFacturaAction` | Mock de Prisma debe usar `idFactura` no `facturaId` |
| H5 | Actualizar test de `getTransferenciasAction` | Verificar que count recibe `tenantId` |
| H3 | Agregar test: delete con PENDIENTE no toca stock | No debe llamar a `upsertStockUbicacion` |
| H4 | Agregar test: update con PENDIENTE no toca stock | No debe llamar a `upsertStockUbicacion` |
| H6 | Agregar test: update solo almacén mueve stock | Verificar `upsertStockUbicacion` llamado con old/new almacén |

## Affected Files

| File | Fixes |
|------|-------|
| `src/features/ofertas/actions.ts` | H1 |
| `src/features/ofertas/__tests__/actions.test.ts` | H1 (tests) |
| `src/features/facturas/actions.ts` | H2 |
| `src/features/facturas/__tests__/actions.test.ts` | H2 (tests) |
| `src/features/transferencias/actions.ts` | H3, H4, H5 |
| `src/features/transferencias/__tests__/actions.test.ts` | H3, H4, H5 (tests) |
| `src/features/mermas/actions.ts` | H6 |
| `src/features/mermas/__tests__/actions.test.ts` | H6 (tests) |
