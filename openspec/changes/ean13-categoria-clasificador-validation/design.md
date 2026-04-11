# Design: Validación temprana de categorías CLAS en modo EAN-13

## Technical Approach

La solución se apoya en dos barreras complementarias.

1. Cliente: el submit del formulario de categorías valida el nombre antes de invocar la API. Si el usuario está creando una categoría raíz (`parentId` vacío), se usa `mapCategoryToSection(nombre)`. Si está creando o editando una subcategoría (`parentId` con valor), se usa `mapSubcategoryToSpecific(nombre)`. Cuando el helper lanza error, el flujo aborta y se muestra el toast exacto solicitado.
2. Servidor: `CategoriaValidator.validateCategoryCreation` y `validateCategoryUpdate` consultan `MiEmpresa.usaCodigoEan13`. Si está activo, ejecutan la misma validación semántica contra CLAS. Esto evita inconsistencias creadas por llamadas directas a la API o por futuros cambios de UI.

## Architecture Decisions

### Decision: Reutilizar category-mapping como fuente única

**Choice**: usar `mapCategoryToSection` y `mapSubcategoryToSpecific`.
**Rationale**: ya contienen la normalización case-insensitive y representan el clasificador oficial que usa la generación EAN-13.

### Decision: Toast exacto en cliente, error estructurado en backend

**Choice**: el cliente muestra el texto exacto exigido por negocio; el backend devuelve validación consistente pero no queda a cargo del copy UX principal.
**Rationale**: el requerimiento es explícitamente de UX temprana, pero sin perder defensa en profundidad.

## Data Flow

`CategoryForm` carga `usaEan13` desde `/api/mi-empresa`.

Cuando el usuario envía:
- Si `usaEan13` es `false`, el flujo actual sigue intacto.
- Si `usaEan13` es `true` y `parentId` está vacío, el hook valida el nombre como sección CLAS.
- Si `usaEan13` es `true` y `parentId` tiene valor, el hook valida el nombre como específico CLAS.
- Si falla, dispara toast y no hace `fetch`.
- Si pasa, continúa la validación remota existente y luego el create/update.

En backend:
- API de categorías llama `CategoriaValidator`.
- `CategoriaValidator` consulta `prisma.miEmpresa.findUnique({ where: { id: 1 } })`.
- Sólo con `usaCodigoEan13=true` ejecuta validación de nombre raíz/subcategoría contra CLAS.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/use-category-form.ts` | Modify | Agregar guard clause EAN-13 y toasts exactos antes del submit remoto |
| `src/components/categorias/category-form.tsx` | Modify | Pasar al hook el contexto mínimo de modo EAN-13 si hace falta |
| `src/lib/categoria-validation.ts` | Modify | Agregar validación condicional de CLAS para create/update |
| `src/lib/categoria-errors.ts` | Modify | Incorporar error estructurado si hace falta un código/mensaje específico |

## Testing Strategy

- Unit: pruebas para la validación EAN-13 en `categoria-validation.ts` con modo ON/OFF.
- Component/hook: prueba del submit del formulario cuando el nombre no existe en CLAS y verificación del toast esperado.
- Verification: lint del hook/form y test focalizado del validador.