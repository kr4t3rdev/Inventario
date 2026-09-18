# Tasks: Superficies huérfanas y limpieza de código muerto

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-220 (incluye borrados) |
| 400-line budget risk | Low |
| Chained PRs recommended | No — single PR |
| Files touched | ~24 (wiring 5 + borrado 13 + docs 2 + tests 2) |

## Priority & Dependency Order

Conectar primero (1→2→3), luego limpiar (4) una vez que los wrappers ya no tengan consumidor, y docs al final (5).

---

## Task 1: Navegación lista→detalle en ProductsSurface

### Files
- `mobile/src/ProductsSurface.tsx`

### Changes
- [ ] Añadir `selectedProductId` (state).
- [ ] `ProductRow` pasa a `Pressable` con `onPress` que fija el ID.
- [ ] Renderizar `ProductoDetailSurface` con `onBack` cuando haya ID.
- [ ] Importar `ProductoDetailSurface`.

### Verification
- [ ] `pnpm run typecheck` limpio.

---

## Task 2: Entrada "Stock Masivo" en Gestión

### Files
- `mobile/src/GestionSurface.tsx`, `mobile/src/BusinessShell.tsx`

### Changes
- [ ] Módulo `bulkStock` + prop `onSelectBulkStock` en `GestionSurface`.
- [ ] `case 'bulkStock'` en `renderGestionScreen` + import `BulkStockSurface`.

### Verification
- [ ] `pnpm run typecheck` limpio.

---

## Task 3: Entrada "Perfil" y quitar "Contratos" en Configuración

### Files
- `mobile/src/ConfiguracionSurface.tsx`, `mobile/src/BusinessShell.tsx`

### Changes
- [ ] Sustituir módulo `contratos` por `perfil` y prop `onSelectContratos` → `onSelectPerfil`.
- [ ] `case 'perfil'` en `renderConfiguracionScreen` + import `ProfileSurface`.

### Verification
- [ ] `pnpm run typecheck` limpio.

---

## Task 4: Borrar archivos muertos

### Files
- 7 superficies/wrappers: `ContabilidadSurface`, `BankAccountsSurface`, `ExchangeSurface`, `bank-accounts-api` (+tests), `accounts-receivable-api` (+tests), `accounts-payable-api` (+tests), `exchange-converter-api` (+test).
- `BusinessDashboard` (+test), `use-business-surface`.
- 5 hooks `use-advances/use-client/use-product/use-provider/use-warehouse-surface`.
- 4 hooks bajos `client-surface/product-surface/provider-surface/warehouse-surface` (+tests).

### Changes
- [ ] Verificar 0 importadores no-test por grep antes de borrar.
- [ ] `git rm` los archivos y sus tests.

### Verification
- [ ] `pnpm run typecheck` limpio (sin imports rotos).

---

## Task 5: Actualizar tests de navegación y docs

### Files
- `mobile/src/BusinessShell.test.tsx`, `mobile/PRODUCT.md`, `mobile/README.md`

### Changes
- [ ] Añadir aserciones: "Stock Masivo" en Gestión, "Perfil" en Configuración (opcional "Contratos" ausente).
- [ ] `PRODUCT.md`: cinco pestañas; ajustar Evidence on Hand.
- [ ] `README.md`: nuevo conteo de tests.

### Verification
- [ ] `pnpm run typecheck` + `pnpm test` verde.

---

## Task 6: Verificación integral

- [ ] `cd mobile && pnpm run typecheck`.
- [ ] `cd mobile && pnpm test`.
- [ ] `grep -rln "ContabilidadSurface\|BankAccountsSurface\|ExchangeSurface\|BusinessDashboard\|use-business-surface" src App.tsx` → vacío.