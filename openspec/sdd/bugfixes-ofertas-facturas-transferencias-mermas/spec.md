# Spec: Bugfixes de ofertas, facturas, transferencias y mermas

## Scope

Seis bugs independientes en cuatro módulos. No hay dependencias entre fixes, pero el orden de aplicación recomendado es: H1 → H2 → H5 → H6 → H3 → H4 (de más simple a más complejo).

## H1 — Oferta update: campo `ofertaId` → `id`

### Archivo
`src/features/ofertas/actions.ts`

### Cambios
1. Línea ~101-102: Cambiar `where: { ofertaId, tenantId }` → `where: { id: ofertaId, tenantId }` en `findFirst`
2. Línea ~108-109: Cambiar `where: { ofertaId }` → `where: { id: ofertaId }` en `update`
3. Eliminar ambos `// @ts-expect-error`
4. Verificar que `OfertaUpdateInput` defina `ofertaId: string` en el schema Zod (no cambiar el nombre del campo de input, solo el mapeo a Prisma)

### Scenarios

**Scenario: Update oferta existente**
Given una oferta con `id = "of-1"` en el tenant
When se llama `updateOfertaAction({ ofertaId: "of-1", estado: "APROBADA" })`
Then `prisma.oferta.findFirst` usa `where: { id: "of-1", tenantId }`
And `prisma.oferta.update` usa `where: { id: "of-1" }`
And retorna la oferta actualizada sin error

**Scenario: @ts-expect-error eliminado**
When se compila con TypeScript estricto
Then no hay errores en las líneas de findFirst/update

---

## H2 — Factura update: campo `facturaId` → `idFactura`

### Archivo
`src/features/facturas/actions.ts`

### Cambios
1. Línea ~64: Cambiar `where: { facturaId, tenantId }` → `where: { idFactura: facturaId, tenantId }` en `findFirst`
2. Línea ~72: Cambiar `where: { facturaId }` → `where: { idFactura: facturaId }` en `update`
3. Eliminar ambos `// @ts-expect-error`
4. Verificar que `UpdateFacturaInput` defina `facturaId: string` (no cambiar el input, solo el mapeo)

### Scenarios

**Scenario: Update factura existente**
Given una factura con `idFactura = "fac-1"` en el tenant
When se llama `updateFacturaAction({ facturaId: "fac-1", estado: "PAGADA" })`
Then `prisma.factura.findFirst` usa `where: { idFactura: "fac-1", tenantId }`
And `prisma.factura.update` usa `where: { idFactura: "fac-1" }`
And retorna la factura actualizada sin error

---

## H5 — Transferencias count: agregar filtro tenantId

### Archivo
`src/features/transferencias/actions.ts`

### Cambio
Línea ~144: Cambiar `count({ where: { deletedAt: null } })` → `count({ where: { tenantId, deletedAt: null } })`

### Scenarios

**Scenario: Paginación correcta por tenant**
Given dos tenants A y B con distinta cantidad de transferencias
When `getTransferenciasAction` se ejecuta para tenant A
Then `total` refleja solo las transferencias de tenant A
And `getTransferenciasAction` para tenant B retorna su propio total independiente

---

## H3 — Transferencias delete: verificar estado antes de revertir stock

### Archivo
`src/features/transferencias/actions.ts:566-619`

### Cambios
1. En `deleteTransferenciaAction`, después de verificar que no está `CANCELADA`, leer el `estado` actual
2. Si `estado !== "COMPLETADA"`:
   - Solo marcar como `CANCELADA` + `deletedAt`
   - **No ejecutar** `upsertStockUbicacion`
3. Si `estado === "COMPLETADA"`:
   - Marcar como `CANCELADA` + `deletedAt`
   - Ejecutar `upsertStockUbicacion` para revertir stock (comportamiento actual)

### Scenarios

**Scenario: Cancelar transferencia PENDIENTE**
Given una transferencia PENDIENTE con cantidad 10
When `deleteTransferenciaAction(id)` se ejecuta
Then la transferencia se marca como `CANCELADA`
And stock NO se modifica

**Scenario: Cancelar transferencia COMPLETADA**
Given una transferencia COMPLETADA que movió 10 unidades de A a B
When `deleteTransferenciaAction(id)` se ejecuta
Then la transferencia se marca como `CANCELADA`
And stock de A se incrementa en 10
And stock de B se decrementa en 10

**Scenario: Cancelar transferencia ya CANCELADA**
Given una transferencia CANCELADA
When `deleteTransferenciaAction(id)` se ejecuta
Then lanza `ActionError("La transferencia ya está cancelada")` (comportamiento actual)

---

## H4 — Transferencias update: verificar estado antes de resincronizar stock

### Archivo
`src/features/transferencias/actions.ts:476-559`

### Cambios
1. En `updateTransferenciaAction`, después de obtener `existing`, verificar `estado`
2. Si `estado !== "COMPLETADA"`:
   - Actualizar datos de la transferencia (origen, destino, cantidad, producto)
   - **No ejecutar** `upsertStockUbicacion`
3. Si `estado === "COMPLETADA"`:
   - Comportamiento actual: validar stock, revertir movimiento anterior, aplicar nuevo

### Scenarios

**Scenario: Update transferencia PENDIENTE — solo datos**
Given una transferencia PENDIENTE de A→B con cantidad 10
When se actualiza origen a C
Then la transferencia se actualiza con nuevo origen
And stock NO se modifica (nunca se había movido)

**Scenario: Update transferencia COMPLETADA — resincroniza stock**
Given una transferencia COMPLETADA que movió 10 de A→B
When se cambia cantidad a 15
Then stock de A se decrementa en 5 adicionales (reversión de 10 + aplicación de 15)
And stock de B se incrementa en 5 adicionales

---

## H6 — Mermas update: manejar cambio de almacén independientemente

### Archivo
`src/features/mermas/actions.ts:136-208`

### Cambios
Refactorizar la lógica condicional para que detecte tres escenarios:

1. **Cambia productoId o cantidad** (comportamiento actual pero sin bug):
   - Si `productoId !== old.productoId`: revertir stock del producto anterior, descontar del nuevo
   - Si `cantidad !== old.cantidad` (mismo producto): ajustar stock por diferencia
   - Siempre actualizar `almacenId` si cambió

2. **Cambia solo almacenId** (productoId y cantidad iguales):
   - Restituir stock al almacén origen (increment)
   - Descontar stock del almacén nuevo (decrement)
   - Actualizar `almacenId` en la merma

3. **Cambia solo motivo** (nada más cambia):
   - Solo actualizar `motivo`, sin tocar stock (comportamiento actual correcto)

### Lógica propuesta (pseudocódigo)

```
const oldAlmacenId = mermaActual.almacenId
const nuevoAlmacenId = data.almacenId ?? mermaActual.almacenId
const productoCambia = productoId !== mermaActual.productoId
const cantidadCambia = cantidad !== mermaActual.cantidad
const almacenCambia = nuevoAlmacenId !== oldAlmacenId

if (productoCambia || cantidadCambia || almacenCambia) {
  // 1. Validar stock suficiente en destino
  // 2. En transacción:
  //    a. Revertir stock anterior (productoId original, oldAlmacenId)
  //    b. Aplicar stock nuevo (nuevo productoId, nuevoAlmacenId, nueva cantidad)
  //    c. Actualizar merma con todos los campos
} else {
  // Solo actualizar motivo
}
```

### Scenarios

**Scenario: Cambia solo almacén**
Given una merma con producto P, cantidad 5, almacén A
When se actualiza almacenId a B (mismo producto, misma cantidad)
Then stock en A se incrementa en 5 (restitución)
And stock en B se decrementa en 5
And merma.almacenId = B

**Scenario: Cambia producto y almacén**
Given una merma con producto P1, cantidad 5, almacén A
When se actualiza a producto P2, cantidad 3, almacén B
Then stock de P1 en A se incrementa en 5
And stock de P2 en B se decrementa en 3
And se verifica stock suficiente de P2 en B
And merma actualizada con P2, 3, B

**Scenario: Cambia solo motivo**
Given una merma existente
When se actualiza solo el motivo
Then solo se modifica el campo `motivo`
And stock no se modifica
