# Design: Superficies huérfanas y limpieza de código muerto

## Technical Approach

Cambio exclusivo del repo móvil. Dos frentes: (1) conectar tres superficies existentes usando el patrón de navegación vigente, y (2) borrar archivos sin consumidor verificado por grep. La navegación del detalle de producto se resuelve con estado interno del propio `ProductsSurface` (espejo del patrón de `AccountingShell`), evitando propagar estado por `BusinessShell`.

## Detailed Design

### 1. ProductoDetailSurface (ProductsSurface.tsx)

`ProductsSurface` mantiene `selectedProductId: string | null`. `ProductRow` pasa a ser `Pressable` con `onPress` que fija el ID. Si hay ID seleccionado, se renderiza `<ProductoDetailSurface api={api} productId={selectedProductId} onBack={() => setSelectedProductId(null)} />` en lugar de la lista.

### 2. BulkStockSurface (GestionSurface + BusinessShell)

- `GestionSurface`: añadir módulo `{ id: 'bulkStock', title: 'Stock Masivo', ... onSelect: 'onSelectBulkStock' }` y prop `onSelectBulkStock`.
- `BusinessShell.renderGestionScreen`: `case 'bulkStock': return <BulkStockSurface api={productsApi} />;` e importar `BulkStockSurface`.

### 3. ProfileSurface (ConfiguracionSurface + BusinessShell)

- `ConfiguracionSurface`: sustituir el módulo `contratos` por `perfil` (`title: 'Perfil'`), cambiar `onSelectContratos` por `onSelectPerfil`.
- `BusinessShell.renderConfiguracionScreen`: `case 'perfil': return <ProfileSurface user={user} onLogout={onLogout} />;` e importar `ProfileSurface`.

### 4. Limpieza de archivos muertos

Borrar (con `git rm` o `rm` + git add) con verificación previa de 0 importadores no-test:
- `ContabilidadSurface.tsx`, `BankAccountsSurface.tsx`, `ExchangeSurface.tsx`.
- `bank-accounts-api.ts` (+ test + integración), `accounts-receivable-api.ts` (+ tests), `accounts-payable-api.ts` (+ tests), `exchange-converter-api.ts` (+ test).
- `BusinessDashboard.tsx` (+ test).
- `use-business-surface.ts`, `use-advances-surface.ts`, `use-client-surface.ts`, `use-product-surface.ts`, `use-provider-surface.ts`, `use-warehouse-surface.ts`.
- `client-surface.ts`, `product-surface.ts`, `provider-surface.ts`, `warehouse-surface.ts` (+ sus tests).

### 5. Docs

- `PRODUCT.md`: corregir "siete pestañas" → cinco pestañas (dashboard, gestion, acciones, contabilidad, configuracion) y ajustar la sección "Evidence on Hand" si enumera archivos eliminados.
- `README.md`: actualizar conteo de tests y superficies.

## Riesgos y mitigación

- **`advances-api.ts` se conserva:** `AccountingShell` y `AdvancesSurface` lo usan (adaptador `anticiposFromAccountingClient`). No se borra.
- **Tests eliminados:** al borrar `*-api.test.ts` e `*.integration.test.ts`, el total de tests baja; se compensa con los nuevos tests de navegación de SDD-02. Se reporta el nuevo conteo.
- **Falso positivo de importador:** verificación por grep del literal `from './x'` antes de cada borrado.