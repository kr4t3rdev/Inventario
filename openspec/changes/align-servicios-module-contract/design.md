# Design: Align Servicios Module Contract

**Estado**: Design  
**Fecha**: 2026-06-08  
**Change**: align-servicios-module-contract  

---

## Technical Approach

Realign the feature downward to the persisted Prisma contract instead of expanding the database. The implementation starts with the Schema Zod strict contract, then narrows TypeScript types, Server Action payloads, and form fields to the minimal supported service shape.

### Context actual del código

| Aspecto | Estado |
|---------|--------|
| API Routes para Servicios | **No existen** — no hay `src/app/api/servicios/` |
| API Routes para VentaServicios | **No existen** — no hay `src/app/api/venta-servicios/` |
| RTK Query | **No existe** — no hay `src/lib/redux/`, no hay `createApi`, el proyecto migró a Server Actions |
| Server Actions | **Sí existen** — CRUD en `src/features/servicios/actions.ts` con `withAction` |
| Componente form | `src/features/servicios/components/servicios-form.tsx` (no `src/components/servicios/`) |

### Implicaciones

El design original asumía REST API routes y RTK Query. En la realidad del código actual:

1. **No creamos API Routes nuevas** porque AGENTS.md las reserva para exportación de archivos e integraciones externas. El contrato CRUD se maneja con Server Actions.
2. **No creamos RTK Query nuevo** porque AGENTS.md lo desaconseja explícitamente. La hidratación cliente se maneja con Server Actions + `useState`/`useEffect`.
3. **El "API" del spec** se implementa como Server Actions con `withAction`. Los errores HTTP 400/404/409 se traducen a `ActionError` con códigos (`VALIDATION_ERROR`, `NOT_FOUND`, `HAS_REFERENCES`).
4. **El "RTK Query base URL"** del spec de VentaServicios no aplica — no hay RTK Query que corregir. El contrato de rutas ya es correcto por definición (Server Actions no tienen route resolution issues).

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source of truth | Prisma `Servicios` model es canónico | Fastest safe fix; evita migración especulativa |
| Unknown payload keys | Reject con Zod `.strict()` → ActionError code VALIDATION_ERROR | Silent stripping oculta drift y pierde datos invisiblemente |
| Delete behavior | Guarded hard delete con ActionError code HAS_REFERENCES | Preserva historial de ventas sin schema change |
| Servicios type interface | NO se modifica `@/app/models/model.ts` (scope externo al feature) | El módulo servicios no debe depender de `deletedAt` ni campos fantasma aunque la interfaz los tenga |
| RTK Query / API Routes | No se crean | Proyecto migró a Server Actions; AGENTS.md desaconseja ambos |

---

## Data Flow

### Servicios CRUD

```
ServicioForm (client)
  → createServicioAction / updateServicioAction (server action withAction)
    → Zod servicioSchema.strict() parse → rechaza campos extra con 400
    → Prisma servicios.create / update
    → revalidatePath('/busy/servicios')
    → ServicioResponse serializado
```

### Delete flow

```
deleteServicioAction (server action)
  → requireManagerRole
  → requireTenant
  → count VentaServicios where servicioId
  → count CompraServicio where servicioId
  → count OfertaItem where servicioId
  → si count > 0 → ActionError HAS_REFERENCES (409 equivalente)
  → si no → Prisma servicios.delete
  → revalidatePath
```

### Venta Servicios (sin cambios)

El módulo `venta-servicios` ya usa Server Actions. No hay API routes que corregir ni RTK Query que arreglar. Solo se verifica que no haya issues de ruteo (no los hay por definición).

---

## ServicioResponse — Contract público

```typescript
interface ServicioResponse {
  servicioId: string;
  nombre: string;
  descripcion: string;
  precio: number;
  moneda: string;       // Persistido en Prisma con default "CUP"
  createdAt: string;    // ISO string (serializado)
  updatedAt: string;    // ISO string (serializado)
}

// Payloads aceptados (validados con Zod strict)
type CreateServicioPayload = {
  nombre: string;
  descripcion: string;
  precio: number;
  moneda?: string;      // Opcional, default "CUP" en Prisma
};

type UpdateServicioPayload = {
  servicioId: string;
  nombre?: string;
  descripcion?: string;
  precio?: number;
  moneda?: string;
};
```

**NO aceptados** (rechazados por `.strict()`): `precioCosto`, `codigoInterno`, `codigoNegocio`, `vendorId`, `proveedorCodigo`, `idSeccionCodigo`, `especificoCodigo`, `surtidoCodigo`, `dcCodigo`, `categoriaId`, `subcategoriaId`, `unidadId`, `activo`, `deletedAt` y cualquier otro campo no persistido.

---

## File Changes

### 1. `src/features/servicios/schemas.ts`
| Acción | Descripción |
|--------|-------------|
| Modificar | Agregar `.strict()` a servicioSchema y servicioUpdateSchema |
| Modificar | Agregar campo `moneda` opcional |
| Mantener | `nombre`, `descripcion`, `precio` existentes |

### 2. `src/features/servicios/types.ts`
| Acción | Descripción |
|--------|-------------|
| Crear | Interface `ServicioResponse` con campos serializados |
| Modificar | Agregar re-export de tipos inferidos de Zod: `ServicioInput`, `ServicioUpdateInput` |
| Mantener | Re-export de `Servicios` desde `@/app/models/model` |

### 3. `src/features/servicios/actions.ts`
| Acción | Descripción |
|--------|-------------|
| Modificar | `serialize()` tipado a `ServicioResponse` |
| Agregar | Guarded deletion en `deleteServicioAction` — contar VentaServicios, CompraServicio, OfertaItem |
| Agregar | JSDoc completo a todas las funciones exportadas |
| Mantener | Firmas de funciones existentes |
| Mantener | `requireManagerRole`, `requireTenant`, `withAction` |

### 4. `src/features/servicios/index.ts`
| Acción | Descripción |
|--------|-------------|
| Modificar | Exportar schemas (`servicioSchema`, `servicioUpdateSchema`) |
| Modificar | Exportar types (`ServicioResponse`, `ServicioInput`, `ServicioUpdateInput`) |

### 5. `src/features/servicios/components/servicios-form.tsx`
| Acción | Descripción |
|--------|-------------|
| Modificar | Reemplazar schema local por import de `@/features/servicios/schemas` |
| Quitar | Campos no persistidos del schema local: `precioCosto`, `codigoInterno`, `codigoNegocio`, `vendorId` |
| Quitar | UI de `precioCosto` (Input + FormField) |
| Quitar | UI de `vendorId` (select + FormField + dependencia useVendores) |
| Quitar | Import de `useVendors` y `Vendor` type |

### 6. `src/features/servicios/components/enhanced-servicios-form.tsx`
| Acción | Descripción |
|--------|-------------|
| Modificar | Reemplazar schema local por import de `@/features/servicios/schemas` |
| Mantener | Campo `moneda` (está en schema oficial) |
| Nota | Schema oficial usa `z.coerce.number().int().positive()` — verificar compatibilidad con CurrencyInput |

### 7. `src/features/servicios/__tests__/actions.test.ts`
| Acción | Descripción |
|--------|-------------|
| Modificar | Agregar mocks de `prisma.ventaServicios.count`, `prisma.compraServicio.count`, `prisma.ofertaItem.count` |
| Crear | Tests: `getServicioByIdAction` (éxito + NOT_FOUND) |
| Crear | Tests: `updateServicioAction` (éxito + NOT_FOUND) |
| Crear | Tests: `deleteServicioAction` guarded (VentaServicios, CompraServicio, OfertaItem, sin referencias) |

### 8. Pages (solo verificación)
| Archivo | Acción |
|---------|--------|
| `src/app/busy/servicios/page.tsx` | Verificar imports |
| `src/app/busy/servicios/new/page.tsx` | Verificar imports |
| `src/app/busy/servicios/update/[id]/page.tsx` | Verificar imports |
| `src/app/busy/servicios/prestados/page.tsx` | Verificar imports |
| `src/app/busy/servicios/recibidos/page.tsx` | Verificar imports |

### No se modifican (por decisión de diseño)

| Archivo | Razón |
|---------|-------|
| `src/app/models/model.ts` | Fuera del scope del feature module |
| Cualquier API route (`/api/servicios/`) | No existen; no se crean nuevas API routes |
| `src/lib/redux/` | No existe; no se crea RTK Query nuevo |
| `src/features/venta-servicios/` | Ya usa Server Actions, no tiene RTK Query que arreglar |

---

## Testing Strategy

| Layer | Qué testear | Approach |
|-------|-------------|----------|
| Unit (actions) | CRUD con mocked prisma | Vitest, cubrir éxito + errores (NOT_FOUND, HAS_REFERENCES, VALIDATION_ERROR) |
| Component | `ServicioForm` campos removidos | Testing Library + mocked Server Actions |
| Typecheck | Compilación sin errores | `pnpm run typecheck` |
| Build | Build exitoso | `pnpm run build` |

---

## Migration / Rollout

No migration required. Es una corrección de contrato sobre el schema existente.

**Rollback**: `git checkout -- src/features/servicios/`

---

## Open Questions

- [ ] Ninguna.
