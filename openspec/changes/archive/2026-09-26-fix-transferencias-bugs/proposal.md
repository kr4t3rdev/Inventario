# Proposal: Corregir errores críticos en transferencias de productos

## Intent

La feature de transferencias de productos tiene 5 bugs identificados que afectan la creación, edición y consulta de transferencias. El más crítico (ReferenceError) **bloquea completamente** la página de nueva transferencia. Los demás afectan la corrección de datos en multi-tenant, el cálculo de stock disponible, y la edición de transferencias con puntos de venta.

## Scope

### In Scope

1. **BUG-1: `transferenciaSchema` / `TransferenciaFormValues` / `TransferenciaFormProps` no definidos**
   - Archivo: `src/features/transferencias/components/transferencias-form.tsx`
   - Definir `transferenciaSchema` (Zod) que valide todo el form: productos array, tipoOrigen, origenId, tipoDestino, destinoId, descripcion
   - Definir `TransferenciaFormValues = z.infer<typeof transferenciaSchema>`
   - Definir interface `TransferenciaFormProps { initialData?: ... }`
   - Corregir: el form necesita schema de grupo completo (usa `useFieldArray` para productos internamente)

2. **BUG-2: `count()` sin filtro de tenantId en paginación**
   - Archivo: `src/features/transferencias/actions.ts` — `getTransferenciasAction`
   - Agregar `tenantId` al where del `prisma.transferencia.count()`

3. **BUG-3: `getStockDisponibleEnPuntoVenta` no excluye transferencias canceladas**
   - Archivo: `src/features/transferencias/actions.ts`
   - Agregar `deletedAt: null` y `estado: { notIn: ['CANCELADA', 'RECHAZADA'] }` en los aggregates de entrada/salida
   - Considerar migrar a `StockUbicacion` para tener la fuente única de verdad

4. **BUG-4: `updateTransferenciaAction` siempre setea `puntoDeVentaOrigenId: null` y `puntoDeVentaDestinoId: null`**
   - Archivo: `src/features/transferencias/actions.ts`
   - Agregar `puntoDeVentaOrigenId` y `puntoDeVentaDestinoId` al schema `updateTransferenciaSchema`
   - En la action, usar los valores del schema en vez de hardcodear null

5. **BUG-5: Validación de stock en almacén no usa StockUbicacion**
   - Archivo: `src/features/transferencias/actions.ts` — `createTransferenciaAction`
   - Cuando origen es `almacen`, consultar `StockUbicacion` en vez de `producto.stock` global
   - Usar `upsertStockUbicacion` o query directa a `prisma.stockUbicacion.findUnique`

### Out of Scope

- Cambiar la UI visual del formulario de transferencias
- Migrar el reporte de movimientos (ya cubierto en `migrar-transferencias-server-first`)
- Eliminar `transferenciasApi.ts` (ya cubierto en cambio anterior)
- Agregar nuevas funcionalidades a transferencias (ej. transferencias parciales, follow-up)

## Affected Modules

- `src/features/transferencias/components/transferencias-form.tsx` — BUG-1
- `src/features/transferencias/actions.ts` — BUG-2, BUG-3, BUG-4, BUG-5
- `src/features/transferencias/schemas.ts` — BUG-4 (agregar campos al schema)
- `src/features/transferencias/__tests__/actions.test.ts` — actualizar tests existentes

## Validation Boundaries

- El formulario de nueva transferencia debe cargar sin ReferenceError
- La creación de transferencias debe funcionar con todos los tipos de origen/destino
- El conteo de páginas en el listado debe ser correcto en multi-tenant
- El stock disponible en punto de venta no debe incluir transferencias canceladas
- La edición de transferencias debe preservar relaciones con puntos de venta
- Los tests existentes deben seguir pasando

## Rollback Plan

Cada bug tiene un fix independiente. Si uno introduce una regresión:
- BUG-1: revertir los cambios en `transferencias-form.tsx` (solo agregar definiciones faltantes)
- BUG-2: revertir el filtro `tenantId` en el count
- BUG-3: revertir los filtros en `getStockDisponibleEnPuntoVenta`
- BUG-4: revertir `updateTransferenciaSchema` y la action
- BUG-5: revertir a `producto.stock` en lugar de `StockUbicacion`

## Success Criteria

- [ ] `ReferenceError: transferenciaSchema is not defined`不再 aparece en los logs del browser
- [ ] La página `/busy/transferencias/new` carga y permite crear transferencias
- [ ] La paginación reporta total correcto por tenant
- [ ] `getStockDisponibleEnPuntoVenta` ignora transferencias canceladas/rechazadas
- [ ] `updateTransferencia` preserva puntoDeVentaOrigenId y puntoDeVentaDestinoId
- [ ] Stock en almacén se valida contra StockUbicacion, no contra producto.stock global
- [ ] Todos los tests de `actions.test.ts` pasan
