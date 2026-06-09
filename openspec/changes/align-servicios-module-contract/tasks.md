# Tasks: Alinear Módulo Servicios al Module Contract

**Estado**: Tasks  
**Fecha**: 2026-06-08  

---

## Task 1: Actualizar schemas.ts

**Archivo**: `src/features/servicios/schemas.ts`  
**Dependencias**: ninguna  

**Cambios**:
- [ ] Agregar `.strict()` a `servicioSchema` y `servicioUpdateSchema`
- [ ] Agregar campo `moneda` como opcional a `servicioSchema`
- [ ] Agregar campo `moneda` como opcional a `servicioUpdateSchema`
- [ ] Exportar tipos `ServicioInput` y `ServicioUpdateInput`

---

## Task 2: Actualizar types.ts

**Archivo**: `src/features/servicios/types.ts`  
**Dependencias**: Task 1  

**Cambios**:
- [ ] Agregar interface `ServicioResponse` con campos serializados (string en vez de Date)
- [ ] Re-exportar `ServicioInput`, `ServicioUpdateInput` desde schemas
- [ ] Mantener re-export de `Servicios` desde model

---

## Task 3: Actualizar actions.ts

**Archivo**: `src/features/servicios/actions.ts`  
**Dependencias**: Task 1, Task 2  

**Cambios**:
- [ ] Agregar JSDoc a todas las funciones exportadas
- [ ] Reemplazar tipo `ServicioInput`/`ServicioUpdateInput` con import desde types
- [ ] Reemplazar `serializeServicio` con `serialize()` tipado a `ServicioResponse`
- [ ] Agregar guarded deletion en `deleteServicioAction`:
  - Contar `VentaServicios` where servicioId
  - Contar `CompraServicio` where servicioId
  - Contar `OfertaItem` where servicioId
  - Si count > 0, lanzar `ActionError` con código `HAS_REFERENCES`
- [ ] Quitar import de `requireManagerRole` (no cambiar — mantener)

---

## Task 4: Actualizar tests

**Archivo**: `src/features/servicios/__tests__/actions.test.ts`  
**Dependencias**: Task 3  

**Cambios**:
- [ ] Agregar mock de `prisma.ventaServicios.count`
- [ ] Agregar mock de `prisma.compraServicio.count`
- [ ] Agregar mock de `prisma.ofertaItem.count`
- [ ] Test: `getServicioByIdAction` retorna servicio existente
- [ ] Test: `getServicioByIdAction` lanza NOT_FOUND
- [ ] Test: `updateServicioAction` actualiza campos válidos
- [ ] Test: `updateServicioAction` lanza NOT_FOUND
- [ ] Test: `deleteServicioAction` bloquea si hay VentaServicios
- [ ] Test: `deleteServicioAction` bloquea si hay CompraServicio
- [ ] Test: `deleteServicioAction` bloquea si hay OfertaItem
- [ ] Test: `deleteServicioAction` elimina si no hay referencias

---

## Task 5: Actualizar barrel export (index.ts)

**Archivo**: `src/features/servicios/index.ts`  
**Dependencias**: Task 2, Task 3  

**Cambios**:
- [ ] Exportar schemas: `servicioSchema`, `servicioUpdateSchema`
- [ ] Exportar types: `ServicioResponse`, `ServicioInput`, `ServicioUpdateInput`

---

## Task 6: Limpiar servicios-form.tsx

**Archivo**: `src/features/servicios/components/servicios-form.tsx`  
**Dependencias**: Task 1  

**Cambios**:
- [ ] Reemplazar schema local con import desde `@/features/servicios/schemas`
- [ ] Quitar campos `precioCosto`, `codigoInterno`, `codigoNegocio` del schema
- [ ] Quitar campo `vendorId` del schema (y dependencia de `useVendors`)
- [ ] Quitar UI de `precioCosto` (Input + FormField)
- [ ] Quitar UI de `vendorId` (select + FormField)
- [ ] Quitar import de `useVendors`
- [ ] Quitar import de `Vendor` type

---

## Task 7: Alinear enhanced-servicios-form.tsx

**Archivo**: `src/features/servicios/components/enhanced-servicios-form.tsx`  
**Dependencias**: Task 1  

**Cambios**:
- [ ] Reemplazar schema local con import desde `@/features/servicios/schemas`
- [ ] Schema oficial ya incluye `moneda`, queda compatible
- [ ] Nota: el schema oficial usa `z.coerce.number().int().positive()` — verificar compatibilidad con CurrencyInput

---

## Task 8: Verificar pages que importan del módulo

**Archivos**: 
- `src/app/busy/servicios/page.tsx`
- `src/app/busy/servicios/new/page.tsx`
- `src/app/busy/servicios/update/[id]/page.tsx`
- `src/app/busy/servicios/prestados/page.tsx`
- `src/app/busy/servicios/recibidos/page.tsx`

**Dependencias**: Task 5  

- [ ] Verificar que todos los imports sigan funcionando con barrel export actualizado
- [ ] No deberían requerir cambios (solo verificación)

---

## Task 9: Typecheck y tests finales

**Dependencias**: Todas las anteriores  

- [ ] `pnpm run typecheck` sin errores
- [ ] `pnpm run test:run -- src/features/servicios/__tests__/actions.test.ts` todos pasan
- [ ] `pnpm exec eslint src/features/servicios/` sin errores
