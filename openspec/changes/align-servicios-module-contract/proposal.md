# Alinear Módulo Servicios al Module Contract

**Estado**: Proposal  
**Fecha**: 2026-06-08  
**Change**: align-servicios-module-contract  

---

## 1. Problema

El módulo `src/features/servicios/` no cumple con el **module contract** definido en `AGENTS.md`. Tiene las siguientes desviaciones:

### Estructurales

| Aspecto | Estado actual | Contract esperado |
|---------|--------------|-------------------|
| `types.ts` | Solo re-exporta `Servicios` desde `@/app/models/model` | Tipos feature-specific: `ServicioInput`, `ServicioUpdateInput`, tipos de respuesta |
| `schemas.ts` | Incompleto — no incluye `moneda`, `precioCosto`, `codigoInterno`, `codigoNegocio`, `vendorId` | Schema completo como única fuente de verdad, compartido entre actions y forms |
| `index.ts` (barrel) | No exporta schemas, tipos incompletos | Exporta todo: actions, components, schemas, types |
| `hooks/` | No existe | Directorio para hooks reutilizables (opcional según AGENTS.md) |
| JSDoc | Parcial en components, ausente en actions | Toda función/componente público debe tener JSDoc |

### Schemas divergentes

Existen **3 schemas Zod distintos** para Servicio:

1. **`schemas.ts`** (oficial): `{ nombre, descripcion, precio }` — usado por `actions.ts`
2. **`servicios-form.tsx`**: `{ nombre, precio, descripcion, precioCosto, codigoInterno, codigoNegocio, vendorId }` — duplicado local
3. **`enhanced-servicios-form.tsx`**: `{ nombre, precio, descripcion, moneda }` — duplicado local

Esto significa que `actions.ts` solo valida 3 campos, pero los formularios envían más datos que no pasan validación del server action.

### Tests insuficientes

- Solo cubre `getServiciosAction`, `createServicioAction`, `deleteServicioAction`
- Falta: `getServicioByIdAction`, `updateServicioAction`, casos borde (not found, validación)
- Mock de prisma incompleto

### Exports inconsistentes

- Page components importan directamente de `actions` y de componentes individuales en vez de usar el barrel export
- `servicios-content.tsx` importa `deleteServicioAction` directamente de `actions` (debería ir por barrel)

---

## 2. Objetivo

Alinear `src/features/servicios/` al module contract de `AGENTS.md` **sin cambiar comportamiento**:

### Árbol target

```
src/features/servicios/
├── actions.ts              # Server Actions completas con JSDoc
├── schemas.ts              # Schema Zod único como fuente de verdad
├── types.ts                # Tipos feature-specific (inputs, responses)
├── index.ts                # Barrel export completo
├── components/
│   ├── index.ts            # Barrel de componentes
│   ├── servicios-content.tsx
│   ├── servicios-form.tsx
│   ├── enhanced-servicios-form.tsx
│   ├── servicios-cart.tsx
│   ├── servicios-prestados-form.tsx
│   ├── servicios-recibidos-form.tsx
│   └── servicios-recibidos-table.tsx
├── hooks/                  # (opcional, si hay lógica reusable)
└── __tests__/
    └── actions.test.ts     # Tests completos
```

### Lo que cambia

| Archivo | Cambio |
|---------|--------|
| `schemas.ts` | Unificar: agregar `moneda`, `precioCosto`, `codigoInterno`, `codigoNegocio`, `proveedorCodigo`, `idSeccionCodigo`, `especificoCodigo`, `surtidoCodigo`, `dcCodigo`, `categoriaId`, `subcategoriaId`, `unidadId`, `vendorId`, `activo` |
| `types.ts` | Agregar tipos feature-specific exportables: `ServicioInput`, `ServicioUpdateInput`, `ServicioActionItem`, `ServicioResponse` manteniendo re-export de `Servicios` |
| `actions.ts` | Agregar JSDoc, estandarizar nombres de parámetros, alinear schemas |
| `index.ts` | Agregar exports de schemas y tipos faltantes |
| `__tests__/actions.test.ts` | Agregar test de `getServicioByIdAction`, `updateServicioAction`, edge cases |
| `components/servicios-form.tsx` | Usar schema de `schemas.ts` en vez de schema local |
| `components/enhanced-servicios-form.tsx` | Usar schema de `schemas.ts` en vez de schema local |

### Lo que NO cambia

- No se modifica la lógica de negocio
- No se modifican componentes visuales (solo import de schema)
- No se agregan nuevas Server Actions
- No se modifica el modelo Prisma
- No se modifican páginas (solo sus imports si es necesario)

---

## 3. Dependencias

- `src/features/servicios/actions.ts` → `schemas.ts` (validación)
- `src/features/servicios/components/servicios-form.tsx` → `actions.ts` + `schemas.ts`
- `src/features/servicios/components/enhanced-servicios-form.tsx` → `actions.ts` + `schemas.ts`
- `src/app/busy/servicios/page.tsx` → barrel `@/features/servicios`
- `src/app/busy/servicios/new/page.tsx` → `@/features/servicios/components/servicios-form`
- `src/app/busy/servicios/update/[id]/page.tsx` → `@/features/servicios/components/servicios-form`

No hay dependencias externas que romper. El cambio es puramente estructural dentro del feature.

---

## 4. Riesgos

- **R1**: Cambiar schemas puede romper validación si los forms envían datos que el schema central no espera → mitigado: el schema central debe ser un superconjunto de todos los campos usados
- **R2**: Modificar imports en pages puede romper el build si los barrel exports cambian → mitigado: verificar con `pnpm run build` o typecheck
- **R3**: Tests existentes pueden fallar si cambian las firmas de actions → mitigado: no cambiamos firmas, solo agregamos JSDoc

---

## 5. Rollback Plan

Si algo sale mal:
1. Revertir cambios con `git checkout -- src/features/servicios/`
2. Revisar pages que importan de servicios y restaurar si es necesario
3. Correr `pnpm run build` antes de commitear cambios definitivos

---

## 6. Acceptance Criteria

- [ ] `schemas.ts` es la única fuente de verdad para validación de Servicios
- [ ] `types.ts` exporta tipos feature-specific (ServicioInput, ServicioUpdateInput, ServicioResponse)
- [ ] `index.ts` exporta schemas, types, actions y components
- [ ] Todos los actions tienen JSDoc completo
- [ ] Tests cubren: list, getById, create, update, delete + casos borde (not found, validación)
- [ ] `servicios-form.tsx` usa schema de `schemas.ts` (no schema local)
- [ ] `enhanced-servicios-form.tsx` usa schema de `schemas.ts` (no schema local)
- [ ] Build y tests pasan sin errores
- [ ] Sigue funcionando en navegador (same behavior)
