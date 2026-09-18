/**
 * @description Inventario cerrado de raw SQL en producción (AS-03). El conteo
 * incluye cada referencia a $queryRaw/$executeRaw y sus variantes Unsafe; así,
 * agregar una llamada incluso dentro de un archivo permitido rompe CI hasta
 * revisar y actualizar explícitamente esta lista.
 * @module src/lib/db/raw-sql-allowlist
 */
export interface RawSqlAllowlistEntry {
  file: string;
  occurrences: number;
  reason: string;
  tenantGuarantee: string;
}

/**
 * @description Inventario verificado contra el árbol de producción.
 */
export const RAW_SQL_ALLOWLIST: readonly RawSqlAllowlistEntry[] = [
  {
    file: 'prisma/seed/backfill-tipos-pago-tenant.ts',
    occurrences: 1,
    reason: 'Lee TipoPago legacy sin tenantId antes de completar su backfill.',
    tenantGuarantee: 'Script offline; resuelve tenantId desde reconciliaciones o el primer tenant antes de actualizar.',
  },
  {
    file: 'prisma/seed/run-seed.js',
    occurrences: 1,
    reason: 'Ejecuta SQL de seed como operación administrativa offline.',
    tenantGuarantee: 'Solo seed; no procesa input ni requests de tenants.',
  },
  {
    file: 'scripts/backfill-ean13-segments.ts',
    occurrences: 3,
    reason: 'Inspección de columnas, lectura legacy y backfill EAN-13.',
    tenantGuarantee: 'Script administrativo offline; preserva tenantId de cada producto.',
  },
  {
    file: 'scripts/cleanup-ean13-test-tenants.ts',
    occurrences: 3,
    reason: 'Limpieza dinámica de tablas para tenants de prueba.',
    tenantGuarantee: 'Selecciona explícitamente tenantId de tenants marcados para prueba.',
  },
  {
    file: 'scripts/fix-mi-empresa-sequence.mjs',
    occurrences: 2,
    reason: 'Reparación administrativa de secuencia y detección de duplicados.',
    tenantGuarantee: 'Script offline revisado por operador, no expuesto a requests.',
  },
  {
    file: 'scripts/validate-tenant-migration.ts',
    occurrences: 1,
    reason: 'Audita duplicados antes/después de migraciones tenant.',
    tenantGuarantee: 'Solo lectura administrativa agrupada explícitamente por tenantId.',
  },
  {
    file: 'src/app/api/contabilidad/reconciliacion/ventas/route.ts',
    occurrences: 5,
    reason: 'Paginación agregada y locks FOR UPDATE de ventas/cuentas.',
    tenantGuarantee: 'Queries parametrizadas incluyen tenantId resuelto por autenticación.',
  },
  {
    file: 'src/features/compras-servicios/actions.ts',
    occurrences: 1,
    reason: 'Lock FOR UPDATE para serializar eliminación/reversión.',
    tenantGuarantee: 'WHERE incluye id y tenantId obtenido con requireTenant.',
  },
  {
    file: 'src/features/contabilidad/actions-reconciliacion.ts',
    occurrences: 9,
    reason: 'Agregados de saldos y locks FOR UPDATE transaccionales.',
    tenantGuarantee: 'CTE/whereParts y locks incluyen tenantId de requireTenant.',
  },
  {
    file: 'src/features/contabilidad/api/exchange-handlers.ts',
    occurrences: 1,
    reason: 'Health check SELECT 1 sin acceso a tablas de negocio.',
    tenantGuarantee: 'Query constante sin filas tenant ni datos de usuario.',
  },
  {
    file: 'src/features/contabilidad/services/accounting-reconciliation-service.ts',
    occurrences: 3,
    reason: 'Agregados paginados y lock de venta para reconciliación.',
    tenantGuarantee: 'SQL parametrizado por tenantId; lock contiene tenantId explícito.',
  },
  {
    file: 'src/features/contabilidad/services/accounting-reports-service.ts',
    occurrences: 1,
    reason: 'Referencia guardada ($queryRaw como capacidad) para ejecutar el read model SQL de reportes.',
    tenantGuarantee: 'El builder exige tenantId no vacío y lo parametriza en cada rama; la llamada se omite si el cliente no expone $queryRaw.',
  },
  {
    file: 'src/features/contabilidad/services/accounting-tenant-lock-service.ts',
    occurrences: 1,
    reason: 'Advisory lock transaccional por tenant.',
    tenantGuarantee: 'La clave del lock es el tenantId autenticado; no lee datos.',
  },
  {
    file: 'src/features/contabilidad/services/financial-auxiliary-checkpoint-service.ts',
    occurrences: 2,
    reason: 'Captura timestamps consistentes de inicio/fin de checkpoint.',
    tenantGuarantee: 'Queries de reloj sin tablas; la transacción contenedora está scoped.',
  },
  {
    file: 'src/features/contabilidad/services/reconciliation-stats-service.ts',
    occurrences: 1,
    reason: 'Conteo agregado de ventas pendientes.',
    tenantGuarantee: 'buildPendingSalesCountQuery recibe tenantId obligatorio y parametrizado.',
  },
  {
    file: 'src/features/empleados/api/nomina.ts',
    occurrences: 1,
    reason: 'Lock FOR UPDATE al eliminar/revertir nómina.',
    tenantGuarantee: 'WHERE incluye id y tenantId autenticado.',
  },
  {
    file: 'src/features/empleados/payroll-reversal.ts',
    occurrences: 2,
    reason: 'Locks de cuentas y cuentas por pagar para reversión atómica.',
    tenantGuarantee: 'Cuenta bancaria filtra tenantId; CxP se valida scoped inmediatamente en la transacción.',
  },
  {
    file: 'src/features/ficha-costo/actions-ventas.ts',
    occurrences: 1,
    reason: 'Agregado de costo FIFO para ventas.',
    tenantGuarantee: 'baseWhere y joins parten de venta/producto previamente scoped al tenant.',
  },
  {
    file: 'src/features/gastosDE/actions.ts',
    occurrences: 4,
    reason: 'Detección de capacidad mock y locks FOR UPDATE en borrados.',
    tenantGuarantee: 'Locks incluyen tenantId; lecturas posteriores validan tenantId antes de mutar.',
  },
  {
    file: 'src/features/mermas/actions.ts',
    occurrences: 1,
    reason: 'Agregado mensual de mermas.',
    tenantGuarantee: 'WHERE incluye tenantId de requireTenant y fecha parametrizados.',
  },
  {
    file: 'src/features/pago-salario/actions.ts',
    occurrences: 1,
    reason: 'Lock FOR UPDATE para reversión de pago salarial.',
    tenantGuarantee: 'WHERE incluye id y tenantId de requireTenant.',
  },
  {
    file: 'src/features/ventas/services/venta-lifecycle-service.ts',
    occurrences: 1,
    reason: 'Lock transaccional para proteger la transición de estado de una venta.',
    tenantGuarantee: 'La venta fue resuelta con tenantId autenticado antes del lock.',
  },
  {
    file: 'src/features/ventas/services/devolucion-venta-service.ts',
    occurrences: 1,
    reason: 'Lock FOR UPDATE de la venta durante una devolución para evitar carreras de stock y saldo.',
    tenantGuarantee: 'La venta se resuelve con tenantId autenticado antes de ejecutar el lock parametrizado.',
  },
  {
    file: 'scripts/seed-e2e-user.ts',
    occurrences: 1,
    reason: 'Reinicia el esquema de una base de datos descartable para fixtures E2E.',
    tenantGuarantee: 'Tooling offline destructivo; no procesa requests ni datos de tenants reales.',
  },
  {
    file: 'src/lib/admin/userMetrics.ts',
    occurrences: 4,
    reason: 'Métricas administrativas cross-tenant con CTEs dinámicos.',
    tenantGuarantee: 'Solo admin; tenantId validado a formato cuid antes de interpolar y cada query usa EXISTS sobre tenant_memberships.',
  },
  {
    file: 'src/lib/services/pago-gastos-workflow.ts',
    occurrences: 3,
    reason: 'Locks FOR UPDATE sobre fuentes, CxP y cuentas bancarias.',
    tenantGuarantee: 'SQL parametrizado incluye tenantId en cada tabla tenant-scoped.',
  },
] as const;
