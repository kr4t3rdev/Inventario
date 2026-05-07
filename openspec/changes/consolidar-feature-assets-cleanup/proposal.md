# Proposal: Consolidar Feature Assets y Limpieza Post-Migración

## Intent

La migración masiva de ~40 features a `src/features/` con Thin App Directory está completa, pero dejó deuda técnica significativa:

1. **Componentes duplicados**: 22 features tienen copias en `src/features/*/components/` Y originales en `src/components/*/`. Los imports en `app/busy/` aún apuntan a los originales para ~21 imports feature-specific.
2. **Hooks huérfanos**: 24 hooks en `src/hooks/` pertenecen a features específicas pero solo 2 fueron migrados a `src/features/*/hooks/`.
3. **Componentes faltantes**: ~19 carpetas en `src/components/` (ej: `compras/`, `cuadre_diario/`, `reportes/`, `tenant-users/`) no tienen copia en `src/features/`.
4. **Re-exports de compatibilidad**: 49 archivos en `lib/redux/services/` y 18 en `lib/services/` existen solo para backward compat; ningún import directo en `app/` los usa, pero el codebase aún puede tener imports indirectos.

Esta deuda técnica viola el principio de co-locación de Feature-Based Architecture: un desarrollador no puede razonar sobre un feature mirando solo su directorio. El objetivo es **consolidar todos los assets de cada feature en su directorio correspondiente** y eliminar duplicados.

## Scope

### In Scope

- **Fase 1 — Consolidar imports de componentes feature-specific en `app/busy/`**:
  - Actualizar ~21 imports desde `@/components/<feature>/` a `@/features/<feature>/components/` en páginas de `app/busy/`.
  - Validar que los componentes destino existen en `src/features/*/components/`.

- **Fase 2 — Migrar hooks a features**:
  - Mover los 24 hooks de `src/hooks/` a `src/features/<feature>/hooks/` según su dominio.
  - Actualizar todos los imports en `app/busy/`, `src/components/` y `src/features/`.
  - Eliminar `src/hooks/` una vez vacío.

- **Fase 3 — Copiar componentes faltantes a features**:
  - Copiar componentes de ~19 carpetas en `src/components/` que NO tienen equivalente en `src/features/*/components/`.
  - Incluye: `compras/`, `cuadre_diario/`, `reportes/`, `tenant-users/`, `catalog/`, `economia/`, etc.
  - Excluye componentes shared genuinos (`ui/`, `animations/`, `cards/`, `Loaders/`).

- **Fase 4 — Cleanup: eliminar duplicados y re-exports**:
  - Eliminar directorios duplicados en `src/components/<feature>/` una vez consolidados todos los imports.
  - Eliminar re-exports en `src/lib/redux/services/` y `src/lib/services/` tras verificar que ningún import en el codebase los consume.
  - Actualizar `tsconfig.json` paths si es necesario.

### Out of Scope

- Cambios de lógica o comportamiento en componentes/hooks (refactor puro).
- Migración de componentes shared (`ui/`, `animations/`, `cards/`, `Loaders/`) — estos NO son feature-specific y pueden permanecer en `src/components/`.
- Cambios en la API o handlers ya migrados.
- Eliminación de `src/components/ui/` (shadcn/ui — esto es shared design system).

## Approach

### Fase 1: Consolidar imports de componentes (rápida, bajo riesgo)

1. Identificar todos los imports feature-specific desde `@/components/` en `app/busy/`.
2. Para cada import, verificar que el componente existe en `src/features/<feature>/components/`.
3. Reemplazar el import (`@/components/productos/productos-form` → `@/features/productos/components/productos-form`).
4. Correr `pnpm run typecheck` para validar.

### Fase 2: Migrar hooks (media complejidad)

1. Mapear cada hook en `src/hooks/` a su feature owner:
   - `use-category-form.ts`, `use-category-validation.tsx` → `categorias/`
   - `use-admin-users-filters.ts` → `admin/`
   - `use-ventas.tsx` → `ventas/`
   - `use-transferencias.tsx` → `transferencias/`
   - `use-profile.ts` → `profile/`
   - `use-real-time-exchange.ts` → `exchange/` (contabilidad)
   - `use-treasury-integration.ts` → `contabilidad/`
   - `use-notifications.ts` → `notificaciones/`
   - Hooks genéricos (`use-debounce.ts`, `use-mobile.ts`, `use-pagination.ts`, `use-breakpoints.ts`, `use-cache.ts`, `use-error-handler.ts`, `use-loading-states.ts`, `use-retry-mechanism.ts`, `use-is-mounted.ts`, `use-keyboard-shortcuts.ts`, `use-input-validation.ts`, `use-table-filters.ts`) → **debatir si van a `src/hooks/` compartido o a un feature `shared/`**
2. Mover archivos y actualizar imports con buscar/reemplazar.
3. Eliminar `src/hooks/` si queda vacío; si quedan hooks genuinamente shared, renombrar a `src/shared/hooks/` o mantener con justificación documentada.

### Fase 3: Copiar componentes faltantes (alta complejidad, muchos archivos)

1. Para cada carpeta en `src/components/` que sea feature-specific y no exista en `src/features/`:
   - Copiar archivos a `src/features/<feature>/components/`.
   - Actualizar imports internos (relativos → `@/`).
2. Features afectadas: `compras`, `cuadre_diario`, `reportes`, `tenant-users`, `catalog`, `economia`, `gastoDE`, `restaurante`, `vendor`, `almacen`, `unidad`, `moneda`, `PtoVenta`.

### Fase 4: Cleanup final (riesgo moderado)

1. Buscar con `grep` todos los imports a `@/components/<feature>/` en TODO el codebase (`src/`).
2. Si no quedan imports, eliminar el directorio duplicado en `src/components/<feature>/`.
3. Buscar imports a `@/lib/redux/services/` y `@/lib/services/` en TODO el codebase.
4. Si no hay imports directos, eliminar los re-exports.
5. Commit separado por fase para facilitar rollback.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/busy/**/page.tsx` | Modified | Imports actualizados de `@/components/<feature>/` → `@/features/<feature>/components/` |
| `src/features/*/components/` | New/Modified | Nuevos componentes copiados (Fase 3) o ya existentes |
| `src/features/*/hooks/` | New | Hooks migrados desde `src/hooks/` (Fase 2) |
| `src/components/<feature>/` | Removed | Eliminados tras consolidar imports (Fase 4) |
| `src/hooks/` | Removed | Migrado a features o `src/shared/hooks/` (Fase 2) |
| `src/lib/redux/services/` | Removed | Re-exports eliminados si no hay consumers (Fase 4) |
| `src/lib/services/` | Removed | Re-exports eliminados si no hay consumers (Fase 4) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Import roto por componente no copiado en destino | Med | Verificar existencia del archivo destino ANTES de cambiar el import. Usar `ls` programático. |
| Hook genérico usado por múltiples features → duplicación | Med | Hooks genuinamente shared (`use-debounce`, `use-mobile`) se mantienen en `src/shared/hooks/` con documentación clara. |
| Componente en `src/components/` tiene dependencias cruzadas no evidentes | Med | Copiar con `cp -r` primero, no `mv`. Validar con `pnpm run typecheck` después de cada fase. |
| Re-export eliminado pero aún usado indirectamente | Low | Buscar `grep -r "from '@/lib/redux/services/"` y `grep -r "from '@/lib/services/"` en TODO `src/` antes de eliminar. |
| TypeScript path alias no resuelve `@/features/` | Low | `@/features/` ya está funcionando (la migración previa lo usa). Validar con `tsc --noEmit` en cada fase. |

## Rollback Plan

Cada fase se commiteará de forma independiente. Si algo falla:

1. **Fase 1**: `git revert HEAD` (solo cambios de imports en `app/busy/`).
2. **Fase 2**: `git revert HEAD` + restaurar `src/hooks/` desde backup si es necesario.
3. **Fase 3**: `git revert HEAD` elimina los directorios nuevos en `src/features/*/components/`; los originales en `src/components/` nunca se tocan en esta fase.
4. **Fase 4**: `git revert HEAD` restaura directorios eliminados en `src/components/<feature>/` y re-exports en `lib/`.

Además, se mantendrá una rama `backup/pre-cleanup` antes de iniciar Fase 4.

## Dependencies

- Ninguna externa.
- Prerequisito: la migración de features a `src/features/` debe estar estable (lo está).

## Success Criteria

- [ ] Cero imports desde `@/components/<feature>/` (feature-specific) en todo `src/app/` y `src/features/`.
- [ ] Cero hooks en `src/hooks/` que pertenezcan a un feature específico (solo shared o vacío).
- [ ] Todo componente feature-specific vive en `src/features/<feature>/components/`.
- [ ] `pnpm run typecheck` pasa sin errores nuevos.
- [ ] `pnpm run lint` pasa sin errores nuevos.
- [ ] `pnpm run test:run` pasa sin fallos nuevos.
- [ ] Número de carpetas en `src/components/` reducido a solo shared (`ui/`, `animations/`, `cards/`, `Loaders/` y similares).
- [ ] `src/lib/redux/services/` y `src/lib/services/` eliminados o reducidos a solo shared utilities.
