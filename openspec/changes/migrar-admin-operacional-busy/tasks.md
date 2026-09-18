# Tasks: Migrar Administración Operativa a las Features de /busy

## Reglas de ejecución

- [ ] Ejecutar cada lote estrictamente RED -> GREEN -> REFACTOR; no implementar una action o card
  antes de que exista su test fallando.
- [ ] Mantener **100% de cobertura de líneas** por cada `actions-health.ts` nuevo.
- [ ] Mantener **>=80% de cobertura de líneas** por cada `*-health-card.tsx` nuevo.
- [ ] Ejecutar el test focalizado al terminar cada subtarea GREEN; no avanzar con un test fallando.
- [ ] No tocar CRUD, queries ni los props existentes de los content components.

## Phase 0: Preparación y línea base

- [ ] 0.1 Leer `src/lib/server-actions` y `src/lib/services/tenant-scope` para replicar los mocks y
  el contrato real de `withAction`, `ActionError`, `getCurrentUser` y `requireTenant`.
- [ ] 0.2 Localizar tests del feature `productos` y su configuración Vitest para fijar el patrón de
  mocks Prisma y Server Actions que se usará en los ocho lotes.
- [ ] 0.3 Ejecutar `pnpm run test:run` y registrar fallas preexistentes antes de editar.
- [ ] 0.4 Ejecutar `pnpm run typecheck` y registrar errores preexistentes antes de editar.
- [ ] 0.5 Buscar consumidores antes de borrado:
  `rg 'getGlobal.*HealthAction|getTenantFeatureDataAction|operaciones' src/`.
- [ ] 0.6 Confirmar que `/busy/ofertas/page.tsx` es la ruta real de ofertas y no modificar
  `/busy/oferta/print`.

## Phase 1: Datos Maestros (Productos)

### RED

- [ ] 1.1 Crear `src/features/productos/actions-health.test.ts` que cubra `getMastersHealthAction`:
  éxito con los seis counts, rol no-admin, falta de tenant y zeros.
- [ ] 1.2 Crear `src/features/productos/components/masters-health-card.test.tsx` que cubra loading,
  Crítico, Bajo, Saludable, no-admin y error toast.

### GREEN

- [ ] 1.3 Crear `src/features/productos/actions-health.ts`; implementar `getMastersHealthAction`
  con `requireTenant`, guard de admin y counts por tenant de productos, categorías, unidades,
  proveedores, puntos de venta y listas de precio.
- [ ] 1.4 Crear `src/features/productos/components/masters-health-card.tsx`; implementar card con
  las seis métricas y estados del spec.
- [ ] 1.5 Modificar `src/app/busy/products/page.tsx`: resolver usuario con `getCurrentUser()` y
  montar `MastersHealthCard` encima de `ProductosContent` solo si `user.role === 'admin'`.

### Verificación / REFACTOR

- [ ] 1.6 Ejecutar test focalizado y cobertura del action; confirmar 100% líneas.
- [ ] 1.7 Ejecutar test focalizado y cobertura del componente; confirmar >=80% líneas.
- [ ] 1.8 Eliminar duplicación local solo si los tests siguen verdes.

## Phase 2: Ventas y Facturación

### RED

- [ ] 2.1 Crear `src/features/ventas/actions-health.test.ts` para count, sum de `Venta.total`,
  no-admin, no-tenant y total null.
- [ ] 2.2 Crear `src/features/ventas/components/sales-health-card.test.tsx` para Inactivo, Bajo
  Volumen, Activo, formato total, no-admin y error.
- [ ] 2.3 Crear `src/features/facturas/actions-health.test.ts` para tasa de formalización: sin
  ventas, baja, media, alta, no-admin y no-tenant.
- [ ] 2.4 Crear `src/features/facturas/components/billing-health-card.test.tsx` para badges Bajo,
  Medio, Alto, no-admin y error.

### GREEN

- [ ] 2.5 Crear `src/features/ventas/actions-health.ts` con `getSalesHealthAction` por tenant.
- [ ] 2.6 Crear `src/features/ventas/components/sales-health-card.tsx`.
- [ ] 2.7 Modificar `src/app/busy/sales/page.tsx` para incorporar `SalesHealthCard` solo para admin
  sin alterar `VentasPageClient`.
- [ ] 2.8 Crear `src/features/facturas/actions-health.ts` con `getBillingHealthAction` por tenant.
- [ ] 2.9 Crear `src/features/facturas/components/billing-health-card.tsx`.
- [ ] 2.10 Modificar `src/app/busy/facturas/page.tsx` para incorporar `BillingHealthCard` solo para
  admin sin alterar sus `searchParams` ni `FacturasContent`.

### Verificación / REFACTOR

- [ ] 2.11 Ejecutar tests y cobertura del action de ventas (100%) y su componente (>=80%).
- [ ] 2.12 Ejecutar tests y cobertura del action de facturación (100%) y su componente (>=80%).
- [ ] 2.13 Refactorizar solo duplicación local posterior a tests verdes.

## Phase 3: Compras y Mermas

### RED

- [ ] 3.1 Crear `src/features/compras-productos/actions-health.test.ts` para counts, suma,
  no-admin y no-tenant.
- [ ] 3.2 Crear `src/features/compras-productos/components/purchase-health-card.test.tsx` para
  Crítico, Bajo Volumen, Saludable, no-admin y error.
- [ ] 3.3 Crear `src/features/mermas/actions-health.test.ts` para count, suma costo, no-admin y
  no-tenant.
- [ ] 3.4 Crear `src/features/mermas/components/wastage-health-card.test.tsx` para Saludable,
  Atención, Elevado, Crítico, no-admin y error.

### GREEN

- [ ] 3.5 Crear `src/features/compras-productos/actions-health.ts` con
  `getPurchaseHealthAction` por tenant.
- [ ] 3.6 Crear `src/features/compras-productos/components/purchase-health-card.tsx`.
- [ ] 3.7 Modificar `src/app/busy/compras-productos/page.tsx` para montar la card sobre
  `ComprasProductosContent`, preservando paginación existente.
- [ ] 3.8 Crear `src/features/mermas/actions-health.ts` con `getWastageHealthAction` por tenant.
- [ ] 3.9 Crear `src/features/mermas/components/wastage-health-card.tsx`.
- [ ] 3.10 Modificar `src/app/busy/mermas/page.tsx` para montar la card sobre `MermasContent`.

### Verificación / REFACTOR

- [ ] 3.11 Ejecutar tests y cobertura de compras: action 100%, componente >=80%.
- [ ] 3.12 Ejecutar tests y cobertura de mermas: action 100%, componente >=80%.
- [ ] 3.13 Refactorizar solo con todos los tests verdes.

## Phase 4: Gastos y Ofertas/Servicios

### RED

- [ ] 4.1 Crear `src/features/gastosDE/actions-health.test.ts` para count, suma, no-admin y
  no-tenant.
- [ ] 4.2 Crear `src/features/gastosDE/components/expense-health-card.test.tsx` para Sin actividad,
  Bajo Volumen, Activo, no-admin y error.
- [ ] 4.3 Crear `src/features/ofertas/actions-health.test.ts` para ambos counts, no-admin y
  no-tenant.
- [ ] 4.4 Crear `src/features/ofertas/components/offers-services-health-card.test.tsx` para Sin
  actividad, Solo ofertas, Activo, no-admin y error.

### GREEN

- [ ] 4.5 Crear `src/features/gastosDE/actions-health.ts` con `getExpenseHealthAction` por tenant.
- [ ] 4.6 Crear `src/features/gastosDE/components/expense-health-card.tsx`.
- [ ] 4.7 Modificar `src/app/busy/gastosDE/page.tsx` sin cambiar el fetch paralelo actual ni props
  de `GastosDEContent`.
- [ ] 4.8 Crear `src/features/ofertas/actions-health.ts` con
  `getOffersServicesHealthAction` por tenant.
- [ ] 4.9 Crear `src/features/ofertas/components/offers-services-health-card.tsx`.
- [ ] 4.10 Modificar `src/app/busy/ofertas/page.tsx`; no tocar `src/app/busy/oferta/print/**`.

### Verificación / REFACTOR

- [ ] 4.11 Ejecutar tests y cobertura de gastos: action 100%, componente >=80%.
- [ ] 4.12 Ejecutar tests y cobertura de ofertas: action 100%, componente >=80%.
- [ ] 4.13 Refactorizar solo con todos los tests verdes.

## Phase 5: Contabilidad

### RED

- [ ] 5.1 Crear `src/features/contabilidad/actions-health.test.ts` para periodo activo, sin
  periodos, último cerrado, no-admin y no-tenant.
- [ ] 5.2 Crear `src/features/contabilidad/components/accounting-health-card.test.tsx` para
  Bloqueado, Iniciando, Operativo, periodo activo, no-admin y error.

### GREEN

- [ ] 5.3 Crear `src/features/contabilidad/actions-health.ts` con
  `getAccountingHealthAction` por tenant.
- [ ] 5.4 Crear `src/features/contabilidad/components/accounting-health-card.tsx`.
- [ ] 5.5 Modificar `src/app/busy/contabilidad/page.tsx`: usar `user` del `useAuth` ya existente
  para montar la card donde encaje con el dashboard cliente; no convertir la page a Server Component.

### Verificación / REFACTOR

- [ ] 5.6 Ejecutar tests y cobertura: action 100%, componente >=80%.
- [ ] 5.7 Refactorizar solo con tests verdes.

## Phase 6: Eliminar Administración Operativa del panel global

- [ ] 6.1 Ejecutar `rg` de todas las imports/acciones de `operaciones.ts`; resolver cualquier
  consumidor real antes de eliminar.
- [ ] 6.2 Eliminar `src/app/admin/operaciones/maestros/page.tsx`.
- [ ] 6.3 Eliminar `src/app/admin/operaciones/ventas/page.tsx`.
- [ ] 6.4 Eliminar `src/app/admin/operaciones/compras/page.tsx`.
- [ ] 6.5 Eliminar `src/app/admin/operaciones/mermas/page.tsx`.
- [ ] 6.6 Eliminar `src/app/admin/operaciones/facturacion/page.tsx`.
- [ ] 6.7 Eliminar `src/app/admin/operaciones/ofertas-servicios/page.tsx`.
- [ ] 6.8 Eliminar `src/app/admin/operaciones/gastos/page.tsx`.
- [ ] 6.9 Eliminar `src/app/admin/operaciones/contabilidad/page.tsx` y el directorio vacío.
- [ ] 6.10 Modificar `src/components/admin-sidebar.tsx`: eliminar grupo, ítems, imports de íconos
  exclusivos y clave `groupToneByTitle` correspondiente.
- [ ] 6.11 Modificar `src/app/admin/page.tsx`: eliminar card y imports usados solo por ella.
- [ ] 6.12 Eliminar `src/features/admin/server/operaciones.ts` solo después de verificar cero
  consumidores.
- [ ] 6.13 Ejecutar `rg '/admin/operaciones|getGlobal.*HealthAction|getTenantFeatureDataAction' src/`
  y confirmar 0 resultados.

## Phase 7: Verificación final

- [ ] 7.1 Ejecutar la suite de tests nueva y focalizada por los ocho features.
- [ ] 7.2 Ejecutar cobertura por archivo y evidenciar 100% en actions-health y >=80% en cards.
- [ ] 7.3 Ejecutar `pnpm run typecheck`; clasificar cualquier error como nuevo o preexistente.
- [ ] 7.4 Ejecutar `pnpm exec eslint` únicamente sobre archivos modificados.
- [ ] 7.5 Ejecutar `pnpm run test:run`; registrar resultados y no atribuir fallas preexistentes al
  change.
- [ ] 7.6 Smoke test manual autenticado: un admin ve la card de cada ruta y un manager no la ve.
- [ ] 7.7 Ejecutar `rg '/admin/operaciones' src/` y confirmar 0 referencias.
- [ ] 7.8 Revisar `git diff` para confirmar que no se modificaron rutas de CRUD, impresiones ni
  archivos fuera del scope.
