# SDD Proposal: Conectar superficies huérfanas y limpiar código muerto

## Business Problem

Tres superficies completas y probadas (`ProductoDetailSurface`, `BulkStockSurface`, `ProfileSurface`) no son alcanzables desde la navegación, pese a estar listadas como evidencia en `PRODUCT.md`. En paralelo, SDD-01 dejó un conjunto de archivos sin consumidor (superficies contables antiguas y sus wrappers) y existen varios hooks `use-*-surface` y componentes (`BusinessDashboard`) muertos que aumentan la superficie de mantenimiento y finge funcionalidad que no está expuesta. La pestaña Configuración aún muestra un botón "Contratos" muerto (no tiene `case` en el shell).

## Hallazgos (Evidence)

### H1 — Detalle de producto inaccesible

**Archivo:** `mobile/src/ProductoDetailSurface.tsx` y `mobile/src/ProductsSurface.tsx`

`ProductoDetailSurface` (detalle con precio, margen, stock por ubicación) solo es importado por su test. `ProductsSurface` lista productos (`ProductRow`) sin `onPress`, por lo que el comprador no puede abrir el detalle.

### H2 — Stock masivo inaccesible

**Archivo:** `mobile/src/BulkStockSurface.tsx`

`BulkStockSurface` (consulta de stock por ubicación) no tiene entrada en `GestionSurface` ni `case` en `BusinessShell.renderGestionScreen`.

### H3 — Perfil inaccesible

**Archivo:** `mobile/src/ProfileSurface.tsx`

`ProfileSurface` (cuenta, selector de apariencia Claro/Oscuro/Sistema, cerrar sesión) solo es importado por su test. `PRODUCT.md` exige "Perfil/Ajustes permitirá seleccionar los temas ... y cerrar sesión".

### H4 — Botón muerto "Contratos" en Configuración

**Archivo:** `mobile/src/ConfiguracionSurface.tsx:28` y `mobile/src/BusinessShell.tsx`

`onSelectContratos` fija `configuracionScreen` a `'contratos'`, pero `renderConfiguracionScreen` no tiene `case 'contratos'`. El botón vuelve al menú sin efecto. Contratos ya vive en la pestaña Acciones.

### H5 — Código muerto verificado (sin consumidor no-test)

- Superficies: `ContabilidadSurface`, `BankAccountsSurface`, `ExchangeSurface`, `BusinessDashboard`.
- Wrappers API: `bank-accounts-api`, `accounts-receivable-api`, `accounts-payable-api`, `exchange-converter-api`.
- Hooks: `use-business-surface`, `use-advances-surface`, `use-client-surface`, `use-product-surface`, `use-provider-surface`, `use-warehouse-surface`.
- Hooks de bajo nivel: `client-surface`, `product-surface`, `provider-surface`, `warehouse-surface` (solo consumidos por los hooks muertos).

Todos confirmados por grep de importadores non-test (0 consumidores tras SDD-01).

## Target Users

- Compradores que consultan el detalle de un producto y el stock por ubicación.
- Usuarios que ajustan la apariencia (tema) y cierran sesión.

## Scope

### Incluye

- Navegación lista→detalle en `ProductsSurface`.
- Entrada "Stock Masivo" en `GestionSurface`.
- Entrada "Perfil" en `ConfiguracionSurface` (sustituye a "Contratos").
- Eliminar el botón muerto "Contratos".
- Borrado físico de los archivos muertos listados en H5 y sus tests.
- Actualizar `PRODUCT.md` (5 pestañas, no 7) y README (conteo de tests).

### Excluye

- POS/turno/cuadre, reparaciones y reportes contables (fuera de oleada A+B).
- Implementar la funcionalidad de "Contratos" en Config (ya existe en Acciones).

## Data Sources

- Ninguno nuevo. Se reutilizan `ProductsApiClient`, `useAppearance` y el prop `user`/`onLogout` ya presentes en `BusinessShell`.

## Rollback

Reversible: revert del commit de la fase (solo repo móvil).