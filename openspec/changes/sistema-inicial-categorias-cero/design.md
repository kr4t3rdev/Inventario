# Design: Sistema inicial de categorías (categorías en 0)

## Technical Approach
Implementar un **modo de clasificación de catálogo** persistido en `CatalogoReparacionConfig` para gobernar creación de productos.
- `clasificador_oficial`: mantiene flujo actual de código EAN-13 por segmentos.
- `estructura_usuario`: desactiva generación automática de código y oculta previews/segmentos en UI.

Se extiende el backend para exponer el modo en `/api/reparaciones/catalogo/config` y se consume en formulario de productos para habilitar comportamiento condicional.

## Architecture Decisions

| Decisión | Opciones evaluadas | Tradeoff | Elección |
|---|---|---|---|
| Persistencia del modo | (A) `CatalogoReparacionConfig` existente, (B) tabla nueva | A evita nueva tabla/más joins; B aísla dominios | **A** |
| Representación del modo | (A) `enum`, (B) `string` libre | Enum valida a nivel DB/API; string es flexible pero frágil | **A** |
| Alcance del surtido | (A) por `proveedor+sección+específico`, (B) por `proveedor` | A preserva unicidad local actual; B simplifica pero puede romper expectativa actual | **A** (y documentar reinicio por proveedor) |
| Integración UI productos | (A) fetch directo en form, (B) RTK service dedicado | B reutilizable/testeable y consistente con patrón del repo | **B** |

**Rationale clave**: el código actual (`FindNextAvailableSurtido`) calcula por sección/específico; para cumplir “reinicia al cambiar proveedor” sin romper integridad, se agrega filtro por `proveedorCodigo` y se mantiene seccion/específico.

## Data Flow

```text
Catalogo Config Page
  └─ PUT /api/reparaciones/catalogo/config (monedaId, modoClasificacion)

ProductoForm
  └─ GET /api/reparaciones/catalogo/config
      ├─ modo=clasificador_oficial -> preview EAN habilitado
      └─ modo=estructura_usuario   -> preview EAN oculto + payload sin lógica EAN

POST /api/productos
  ├─ lee modoClasificacion
  ├─ oficial: resolve taxonomy + FindNextAvailableSurtido(proveedor,sección,específico)
  └─ usuario: omite generación segmentos/codigoNegocio
```

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | Agregar enum `ModoClasificacionCatalogo` y campo en `CatalogoReparacionConfig` con default `clasificador_oficial`. |
| `prisma/migrations/*` | Create | Migración para nuevo enum/campo y backfill default para `id=1`. |
| `src/app/api/reparaciones/catalogo/config/route.ts` | Modify | GET/PUT incluyen validación y persistencia de `modoClasificacion`. |
| `src/lib/redux/services/catalogoConfigApi.ts` | Create | RTK Query para leer/actualizar config de catálogo. |
| `src/app/busy/configuracion/catalogo/page.tsx` | Modify | UI con dos opciones y descripción de impacto operativo. |
| `src/components/productos/productos-form.tsx` | Modify | Condicionar preview EAN, validaciones de proveedor y payload según modo. |
| `src/app/api/productos/route.ts` | Modify | Ramas por modo; en oficial generar EAN, en usuario omitir generación. |
| `src/lib/ean13-utils.ts` | Modify | `FindNextAvailableSurtido` recibe y filtra por `proveedorCodigo`. |
| `src/lib/product-business-code.ts` | Modify | Ajustar helpers para usar lookup de surtido por proveedor. |
| `src/lib/ean13-utils-surtido.test.ts` | Modify | Casos de reinicio/aislamiento por proveedor. |
| `src/components/productos/__tests__/task5-parent-form-ui.test.ts` | Modify | Cobertura de UI según modo. |

## Interfaces / Contracts

```ts
export type ModoClasificacionCatalogo = 'clasificador_oficial' | 'estructura_usuario'

interface CatalogoConfigResponse {
  id: number
  monedaId: string
  modoClasificacion: ModoClasificacionCatalogo
}

interface CatalogoConfigUpdatePayload {
  monedaId: string
  modoClasificacion: ModoClasificacionCatalogo
}
```

```ts
// Nuevo contrato sugerido
FindNextAvailableSurtido(
  prismaClient: SurtidoLookupClient,
  proveedorCodigo: string,
  sectionCode: string,
  specificCode: string
): Promise<string>
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Cálculo de surtido por proveedor | Extender `ean13-utils-surtido.test.ts` con proveedores distintos y overflow. |
| Unit | Validación de modo en config API | Tests de PUT con valores válidos/invalidos y permisos admin. |
| Integration | `POST /api/productos` según modo | Casos: oficial genera código; usuario crea sin `codigoNegocio`. |
| UI | Formulario producto según modo | Tests RTL: visibilidad de preview/proveedor y mensajes de ayuda. |

## Migration / Rollout
1. Aplicar migración Prisma con default `clasificador_oficial`.
2. Desplegar API config (compatibilidad hacia atrás por default).
3. Desplegar cambios UI producto/catálogo.
4. Monitorear creación de productos en ambos modos.

No requiere migración de datos históricos de productos.

## Open Questions
- [ ] En `estructura_usuario`, ¿`codigoNegocio` debe quedar `null` siempre o permitir entrada manual futura?
- [ ] ¿El modo será global del sistema (id=1) o por almacén/sucursal en una fase posterior?
