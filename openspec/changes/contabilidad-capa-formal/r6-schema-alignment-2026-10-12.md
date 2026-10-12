# R6 — Alineación del schema con el baseline heredado

## Resultado

Trial7, derivado de trial6 en PostgreSQL local, aplica la migración adicional
`20261012090000_align_formal_schema_baseline` con Prisma. Deploy y replay: exit 0.
El diff del schema congelado contra la base devuelve **exit 0, No difference detected**.
El paquete contiene 149 migraciones; el historial resultante tiene 153 filas.
Los 23 guards siguen ready y las reconciliaciones no tienen diferencias de tenant.

## Cambios

- `prisma/schema.prisma` conserva RESTRICT para categoría padre y categoría de producto,
  y SET NULL para el punto de venta del producto, según el catálogo endurecido heredado.
- Declara tipos nativos FX: tasas numeric(20,10), importes convertidos numeric(20,4),
  solo en los siete campos que diferían del SQL ensayado.
- Añade mapas de nombres físicos a los índices/FK existentes sin cambiar los nombres
  lógicos del cliente, incluido el selector `eventoKey`.
- Representa el default SQL existente de RecetaIngrediente.id y el default de
  apertura_revisiones.updatedAt. No cambia los datos ni el generador SQL existente.
- La nueva migración elimina únicamente la FK simple redundante de apertura_periodos.
  Antes verifica columnas, tabla referenciada, validación y acciones CASCADE de la FK
  compuesta por tenant/período. Si existe la FK simple también verifica su definición.
  Una definición inesperada provoca rollback; el replay directo es idempotente.

Se preservaron los cambios compartidos que ya existían en schema.prisma. No se
reescribieron migraciones históricas del checkout ni se ejecutó el diff anterior.

## Pruebas

La nueva suite física falló 3/3 antes de implementar la migración y pasó 3/3 después:
retirada solo de la FK simple, rechazo cross-tenant, cascade válido, replay y rechazo
de FK compuesta ausente o incorrecta con protección original conservada.

Regresión conjunta PostgreSQL: **26/26** (13 provenance R5, 10 reparación TipoPago,
3 alineación). Usa fixtures temporales en tcp_test_local; no restaura ni borra el piloto.
ESLint de la nueva suite, typecheck de tests y git diff --check aprobados.

## Evidencias

- `r6-schema-alignment-validation-2026-10-12.json`: hash schema/migración y validate.
- `r6-schema-alignment-trial7-2026-10-12.json`: deploy/replay/diff del paquete congelado.
- `r6-schema-alignment-trial7-guards-2026-10-12.json`: guards e historial.
- `r6-schema-alignment-trial7-invariants-2026-10-12.json`: invariantes agregados.

El paquete aislado evita cargar archivos de entorno del checkout. Trial7 permanece
en 127.0.0.1:5433; producción no recibió cambios.

## Alcance pendiente

Diff Prisma vacío acredita equivalencia de objetos representables por Prisma en este
snapshot, no cuerpos de funciones/triggers ni aceptación de todos los adapters/FX.
La regresión conjunta anterior usa fixtures y no constituye regresión de negocio
completa sobre datos heredados. Quedan el paquete de release revisado y reproducible,
la estrategia de bootstrap vacío, la cobertura R6 restante y las condiciones A9/R7
con ventana real. R6/R0.5 global siguen abiertos. Cambios pendientes de commit.
