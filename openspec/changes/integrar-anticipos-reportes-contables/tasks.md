# Tasks: Integrar Anticipos en Reportes Contables

## Phase 1: Foundation — Contract and Mapping

- [ ] 1.1 En `src/app/api/contabilidad/reportes/movimientos/route.ts`, agregar una proyección inicial de `AnticipoMovimiento` al mapa normalizado, excluyendo `CREACION_RESERVA`.
- [ ] 1.2 En `src/app/api/contabilidad/cuentas/[id]/historial/route.ts`, agregar la misma proyección de `AnticipoMovimiento` al arreglo de transacciones unificadas.
- [ ] 1.3 En `src/app/models/model.ts`, confirmar/ajustar los tipos necesarios para describir anticipos proyectados en reportes sin romper los contratos existentes.

## Phase 2: Core Implementation — API Reports

- [ ] 2.1 En `src/app/api/contabilidad/reportes/movimientos/route.ts`, mapear `AnticipoMovimiento.EJECUCION` a un tipo visible en reportes y completar `descripcion`, `referencia` y `detalles`.
- [ ] 2.2 En `src/app/api/contabilidad/reportes/movimientos/route.ts`, mapear `AnticipoMovimiento.REVERSO` con su saldo antes/después y relación al anticipo original.
- [ ] 2.3 En `src/app/api/contabilidad/cuentas/[id]/historial/route.ts`, integrar los mismos tipos y mantener el orden cronológico descendente.
- [ ] 2.4 En ambos routes, excluir `CREACION_RESERVA` de las tablas bancarias.

## Phase 3: UI Wiring — Movimientos y Por Cuenta

- [ ] 3.1 En `src/components/contabilidad/movimientos-table.tsx`, agregar labels, colores e iconos para los tipos de anticipo proyectados.
- [ ] 3.2 En `src/components/contabilidad/account-transaction-history.tsx`, agregar labels, colores e iconos para los tipos de anticipo proyectados.
- [ ] 3.3 En ambos componentes, mostrar referencias legibles al anticipo y mantener el comportamiento actual de filtros y paginación.

## Phase 4: Testing — RED/GREEN/Verification

- [ ] 4.1 Crear test de API en `src/app/api/contabilidad/reportes/movimientos/__tests__/anticipo-movimientos.test.ts` que falle si `EJECUCION`/`REVERSO` no aparecen y `CREACION_RESERVA` sí aparece.
- [ ] 4.2 Crear test de API en `src/app/api/contabilidad/cuentas/[id]/historial/__tests__/anticipo-movimientos.test.ts` con la misma cobertura para historial por cuenta.
- [ ] 4.3 Crear/ajustar tests de `src/components/contabilidad/__tests__/movimientos-table.test.tsx` para validar badge/label de anticipo.
- [ ] 4.4 Crear/ajustar tests de `src/components/contabilidad/__tests__/account-transaction-history.test.tsx` para validar badge/label de anticipo.
- [ ] 4.5 Ejecutar `pnpm test --run` sobre los tests tocados y corregir regresiones.

## Phase 5: Cleanup — Consistencia y documentación

- [ ] 5.1 Revisar textos visibles y asegurar que la terminología de anticipo coincide con el módulo existente.
- [ ] 5.2 Eliminar cualquier duplicación de lógica de mapeo si aparece durante la implementación.
