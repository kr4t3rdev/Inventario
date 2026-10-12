# R6 — Reconciliación histórica de producción y plan de actualización

## Dictamen

**15/15 entradas tienen SQL histórico recuperado con SHA-256 exacto al registrado.**
Se explica documentalmente la procedencia de los 13 checksums discrepantes y de las
dos migraciones adicionales. **No equivale a baseline aceptado**: el release conserva
archivos históricos reescritos, existen diferencias de objetos y no se ha ensayado la
actualización formal sobre una copia representativa del entorno heredado.

Producción revisada: FinanceMDM / Railway / `production` / Postgres / base `railway`.
Release informado por Railway: `e6c20706e8658766187fb648fe6950c2f25dd249`.
Todas las consultas fueron `REPEATABLE READ READ ONLY`, con identidad esperada y
timeouts. Se consultaron catálogos de 27 tablas y cuatro enums, sin filas de negocio.

## Evidencia reproducible

- `r6-baseline-production-historical-sql-2026-10-11.json`: para cada entrada,
  checksum registrado, versiones históricas distintas examinadas, commit coincidente
  y SQL recuperado. Búsqueda sobre commits locales alcanzables con `git log --all`.
- `r6-baseline-production-objects-2026-10-11.json`: columnas, tipos, nullability,
  defaults, constraints validadas e índices con definición/valid/ready de las tablas.
- `scripts/ops/audit-production-migration-objects.sql`: consulta limitada a catálogos.
- `r6-baseline-production-history-2026-10-11.json`: comparación con el árbol del
  release, no con archivos modificados del checkout.

La coincidencia de checksum demuestra que los bytes del SQL registrado existen en
Git. No demuestra que cada sentencia se haya ejecutado: una entrada pudo ser marcada
aplicada mediante baseline. Los objetos actuales constituyen evidencia independiente.

## Crosswalk de discrepancias

Los nombres de la primera columna omiten el prefijo de fecha, conservado íntegro en
los JSON. Los resultados son focales y no una comparación exhaustiva de cada tabla.

| Migración | Cambio en SQL del release respecto del SQL registrado | Objeto actual / límite |
|---|---|---|
| `add_stock_ubicacion` | Compatibilidad `IF NOT EXISTS` y normalización `stockId → id` | `id` existe, `stockId` no; PK, tres índices y FK de producto presentes |
| `remove_ultima_actualizacion_from_stock_ubicacion` | `DROP COLUMN IF EXISTS` | `ultimaActualizacion` ausente |
| `add_compra_documento_cabecera_detalle` | Suprime creación duplicada de soft-delete/auditoría | `deletedAt` en CompraProducto/GastoCompra/CuentaPorPagar; `updatedById` y los dos índices de soft-delete presentes |
| `add_purchase_allocations` | Corrige referencia `Tenant → tenants` | FK validada hacia `tenants`; **RESTRICT actual frente a CASCADE en ambos SQL** |
| `add_max_clientes_to_tenant_license` | Añade creación previa de `Plan.maxClientes` | Plan y tenant_licenses tienen `maxClientes NOT NULL`; no se verifica el backfill de valores |
| `ficha_costo_enterprise_only` | Añade `Plan.features` y copia condicional de `funcionalidades` | `features` jsonb NOT NULL, `funcionalidades` ausente; no se certifican valores ni restricciones comerciales |
| `add_tenant_id_tipo_pago` | Añade reparación de cuentas/reconciliaciones, clonación y aislamiento por tenant | `tenantId NOT NULL`, índices y FK validadas en TipoPago/cuentas/reconciliaciones; no se comprueban datos ni correspondencia de tenants |
| `add_tenant_scope_gastos_conceptos` | Añade tablas legacy y columnas/FK de GastosDE | Catálogos con tenant NOT NULL y unicidad por tenant; dos FK de GastosDE validadas |
| `add_fecha_operacion_ajuste_bancario` | Añade reparación tenant de ajustes/transferencias | tenant NOT NULL, índices y FK validadas; fechaOperacion NOT NULL actual; no se verifica backfill |
| `merma_trazabilidad` | Añade reparación tenant y FK | tenant NOT NULL, creadoPorId nullable, índices y FK presentes |
| `cliente_lista_precio` | Creación condicional de columna/FK/índice | listaPrecioId nullable, FK SET NULL validada e índice presente |
| `ordenes_compra_recepciones_reabastecimiento` | Añade reparación tenant de documentos/items | tenant NOT NULL, índices y FK presentes; no se verifica cada objeto de órdenes/recepciones |
| `add_devoluciones_nota_credito` | Añade base legacy de anticipos, enums y creación condicional | Tablas/enum NOTA_CREDITO y contratoId nullable presentes; FK de creador se llama **Anticipo_createdById_fkey**, no `Anticipo_creador_fkey` del release |

La modificación de archivos ya registrados explica el drift de checksum observado,
pero no autoriza a actualizar `_prisma_migrations` ni a repetir estas migraciones.
Las diferencias de FK prueban que el estado actual incluye cambios posteriores o por
otra vía; su procedencia completa todavía debe reconstruirse.

## Dos migraciones solo en historial

| Nombre | Commit histórico con checksum exacto | Confirmación en catálogo |
|---|---|---|
| `20260722130000_make_tenant_id_required_tipo_pago` | `7d5e41c34d631f6f331788c9d19a26454c70328e` | TipoPago.tenantId NOT NULL |
| `20260926000000_hardening_catalog_on_delete` | `868b48db07ff0ac47c408241a56779ddcf471012` | Producto.puntoDeVentaId SET NULL; Producto.categoriaId RESTRICT; Categoria.parentId RESTRICT; tres FK validadas |

No se recrean: sus efectos focales ya están presentes. Su ausencia del árbol del
release debe resolverse en la estrategia de historial, manteniendo sus nombres/bytes
originales y trazabilidad.

## Plan de actualización basado en el estado real

1. **Fijar manifiesto heredado.** Conservar commit desplegado, historial, SQL históricos
   exactos y snapshot de objetos. Distinguir migraciones registradas de objetos presentes.
   Los artefactos de este corte completan la trazabilidad nominativa de las 15 entradas.
2. **Resolver estrategia de historial en un cambio dedicado.** Preservar bytes de las
   migraciones aplicadas y las dos entradas adicionales. Las reparaciones necesarias
   para una base nueva deben vivir en una estrategia explícita de bootstrap/baseline o
   nuevas migraciones; validar tanto base vacía como heredada. No restaurar a ciegas
   SQL antiguo: algunos históricos dependen de objetos creados fuera de migraciones.
3. **Completar el diff estructural contra el schema objetivo.** Identificar qué objetos
   de las 29 migraciones del checkout formal ya existen total/parcialmente; los nueve
   triggers formales presentes pese a historial incompleto impiden asumir base virgen.
   Comparar definiciones, tipos, defaults, FK, índices, funciones y enums; conservar
   RESTRICT de purchase_allocations y resolver nombre de FK de creador sin duplicarla.
4. **Verificar invariantes de datos con agregados focales.** Antes de cualquier backfill,
   comprobar nulls/orphans, pertenencia tenant, duplicados de claves nuevas y evidencia
   FX necesaria. Este corte no leyó datos ni acredita esas invariantes.
5. **Ensayar sobre una copia desechable representativa.** Ejecutar el plan versionado,
   verificar schema/historial y fallos/reintentos, luego regresión contable y guards.
   La base local existente no representa por sí sola el estado de producción.
6. **Ejecutar el rollout operativo correspondiente.** Registrar backup/restauración,
   versión y plan ensayado, actualizar y reverificar en producción. Completar R6 y los
   demás gates A9/R7 con sus propias evidencias antes de firma global.

## Estado al cierre de este corte

- Acceso Railway y diagnóstico de producción: verificados.
- Recuperación de SQL registrado: 15/15 exactos.
- Dos entradas adicionales: efectos focales confirmados.
- Causa de drift de bytes: variantes históricas frente a reparaciones del release.
- Equivalencia estructural/datos completa, ensayo heredado y rollout: pendientes.
- R6-BASELINE, R0.5 global y ventana operacional: abiertos.

No se ejecutó DDL, backfill, resolve, migración, deploy ni alteración de variables.

## Continuación del preflight

`r6-baseline-production-preflight-2026-10-11.md` amplía el catálogo a 143 tablas y
extrae 523 declaraciones nominadas de las 29 migraciones: 78 presentes (R5), 445
ausentes; no equivale a diff semántico completo. Los agregados confirman dos bloqueos:
una compra sin fuente GastoCompra exigida por R5 y 13 reconciliaciones que apuntan a
TipoPago de otro tenant, sin candidato del mismo nombre en el tenant correcto.
Las cuentas de esas reconciliaciones sí son del tenant correcto. Reparación y ensayo
permanecen pendientes; estas consultas no modifican las filas.
