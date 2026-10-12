# R6 — Ensayo Prisma real sobre el estado heredado de main

## Dictamen vigente

**Prisma migrate deploy: 29/29 pendientes aplicadas en copia local, replay sin cambios.**
**Comparación contra schema.prisma: diff no vacío, 17 tablas.**
Se verifica el flujo real sobre este estado heredado; no se acepta todavía el baseline
global ni el release contable. No se ejecutó el SQL generado por el diff.

Origen: dump ya capturado de Railway producción **main/e6c20706**. Destino de trabajo:
**feat/contabilidad-capa-formal/076baf3f + cambios compartidos**, incluida la corrección
R5 autorizada. Este corte no vuelve a consultar Railway ni certifica que el commit
desplegado siga siendo el mismo: ensaya exclusivamente el estado capturado.

## Paquete histórico reconciliado del ensayo

El paquete privado contiene **148 migraciones**:
- 119 nombres aplicados en el historial heredado, con bytes que coinciden con sus
  checksums registrados.
- 29 SQL pendientes de la rama contable, iguales a los congelados para trial2.

Se sustituyeron solo dentro del paquete las 13 variantes históricas reescritas en
el release y se incorporaron las dos migraciones solo en historial. Los 15 SQL se
recuperaron previamente de Git con SHA-256 exacto. No se sobrescribieron los archivos
históricos del checkout ni los checksums de la base.

El manifiesto por nombre/hash/procedencia y el hash de schema.prisma están en
`r6-production-prisma-trial5-2026-10-12.json`. La ruta del paquete es privada, fuera
del repositorio, junto al dump inicial. El dump con datos no se versiona.

**Alcance de esta estrategia:** estado heredado concreto. Los SQL históricos pueden
depender de objetos creados por otra vía; no se certificó replay desde base vacía ni
se aprobó este paquete como estrategia universal de bootstrap o release limpio.

## Aislamiento de Prisma y conexión

La configuración del checkout (`prisma.config.ts`) llama a `process.loadEnvFile()`.
Para respetar la restricción de lectura de `.env`, se creó una configuración propia
en el paquete, sin esa llamada, con DATABASE_URL/DIRECT_URL exportadas únicamente al
destino local. No existen `.env` en el paquete ni en su directorio Prisma.

Se ejecutó directamente el CLI instalado (`Prisma 6.19.1`), con cwd del paquete y
`--config` explícito. El stderr confirmó:

```text
Loaded Prisma config from prisma.config.ts.
Prisma config detected, skipping environment variable loading.
```

Destino trial5: `tcp_r6_prod_clone_4ae12d4e4c1f_trial5`, `127.0.0.1:5433`, derivado de
la línea base intacta `tcp_r6_prod_clone_4ae12d4e4c1f`. No se utilizó trial2/trial4 como
origen del primer migrate deploy: sus DDL directos carecían de entradas Prisma nuevas.

## Ejecución, replay e historial

1. `prisma migrate deploy`: exit 0, aplica las 29 pendientes.
2. Repetición de deploy: exit 0, **No pending migrations to apply**.
3. `prisma migrate status`: exit 0, **Database schema is up to date**.

Reverificación SQL de solo lectura:
- Historial: **152 filas**, **148 nombres aplicados distintos**.
- Las **123 filas originales** se conservan, incluidas las revertidas. Comparación de
  instantes normalizada a UTC: producción los serializó con +00:00 y el servidor local
  con -04:00. La primera comparación literal detectó esa diferencia de representación;
  no se editaron timestamps ni filas para resolverla.
- Los checksums de las 148 aplicadas coinciden con el paquete.
- Guards enumerados: **23/23 ready**.
- **142 tablas originales**, excluyendo _prisma_migrations: conteos y digests de todas
  sus columnas originales sin diferencias. Proyección JSON ordenada, snapshots de
  solo lectura en UTC; las nuevas columnas y tablas no se confunden con cambios de
  datos heredados. MD5 es detector de cambios, no firma criptográfica.
- Las 13 referencias cross-tenant a TipoPago permanecían en trial5: el deploy de schema
  no ejecuta la reparación operacional local por sí mismo.

`migrate status` acredita el historial del paquete, no la equivalencia del schema.

## Diff semántico contra el schema objetivo

Se ejecutó `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...
--exit-code`, con schema/config congelados del paquete, y su variante `--script`.
Ambas devolvieron **exit 2**: diff no vacío, 17 tablas, 33 líneas de cambios en el
resumen. Se generó el SQL solo como evidencia; no se aplicó.

### Diferencias funcionales a reconciliar

| Objeto | Estado migrado | Schema objetivo actual |
|---|---|---|
| Categoria.parentId | ON DELETE RESTRICT | CASCADE |
| Producto.categoriaId | ON DELETE RESTRICT | CASCADE |
| Producto.puntoDeVentaId | ON DELETE SET NULL | CASCADE |
| CompraDocumento.tasaCambio | numeric(20,10) | Decimal sin native type → (65,30) |
| CompraDocumento.montoConvertido | numeric(20,4) | (65,30) |
| InyeccionCapital.tasaCambio | numeric(20,10) | (65,30) |
| InyeccionCapital.montoConvertido | numeric(20,4) | (65,30) |
| PagoDeuda.tasaCambio | numeric(20,10) | (65,30) |
| PagoDeuda.montoConvertido | numeric(20,4) | (65,30) |
| TransferenciaBancaria.montoConvertido | numeric(20,4) | (65,30) |

Las tres FK endurecidas están confirmadas en la migración adicional histórica
`20260926000000_hardening_catalog_on_delete`. El schema actual volvería a declarar
cascadas; el ensayo no las reemplazó. La alineación debe conservar el endurecimiento
aceptado y fijar los tipos nativos consistentes con las migraciones/precios.

### Otras diferencias

- Default DB de RecetaIngrediente.id: `gen_random_uuid()::text` frente al default de
  cliente Prisma; no cambiar silenciosamente la estrategia de generación de IDs.
- Default de apertura_revisiones.updatedAt.
- FK simple adicional en apertura_periodos, además de su FK compuesta por tenant.
- Nombres de FK en aperturas/líneas/series y nombres de índices en stock, reglas,
  policy approvals, checkpoints, fx_evidence y saldos_snapshot.

Este diff cubre objetos representables por Prisma; no compara por sí solo todo el
SQL auxiliar, cuerpos de triggers/funciones o semántica completa de guards. Por eso
se conserva la comprobación independiente de catálogos y pruebas físicas.

## Cadena integrada con reparación local

Trial6 se deriva de trial5: `tcp_r6_prod_clone_4ae12d4e4c1f_trial6`. Se ejecutó el SQL
final de reparación de TipoPago, verificando su hash contra el ensayo trial4:
- Primera ejecución: **2 tipos + 13 referencias + 15 AuditLog sintéticos del ensayo**.
- Segunda ejecución: **0 cambios**.
- Nuevo `prisma migrate deploy`: exit 0, sin pendientes.
- Guards: **23/23**, historial **152 filas**, **0 diferencias de tenant** en las
  reconciliaciones verificadas.

Esto conecta el deploy real con la reparación ya probada. No convierte el script
local en una migración de producción ni resuelve el diff de schema pendiente.

## Artefactos

- `r6-production-prisma-trial5-2026-10-12.json`: paquete/procedencia/deploy.
- `r6-production-prisma-trial5-replay-2026-10-12.json`: deploy repetido y status.
- `r6-production-prisma-trial5-verification-2026-10-12.json`: historial/checksums y
  comparación de datos heredados, solo conteos/digests.
- `r6-production-prisma-trial5-guards-2026-10-12.json`, `...-invariants-...json`.
- `r6-production-prisma-trial5-schema-diff-2026-10-12.{json,txt,sql}`: diff no aplicado.
- `r6-production-prisma-trial6-chain-2026-10-12.json`: deploy + reparación + replay.
- `r6-production-prisma-trial6-{guards,invariants}-2026-10-12.json`.

## Próximo bloque y límites

Alinear en la rama contable schema/migraciones para las discrepancias detectadas,
sin ejecutar el diff generado a ciegas; reverificar el schema congelado y conservar
las reglas de catálogo endurecidas. Después completar regresión de negocio sobre el
estado heredado, paquete de release revisado y estrategia de bootstrap por entorno.

R6-BASELINE y R0.5 global siguen abiertos; A9/R7 requieren sus propias condiciones y
ventana real. No se hizo resolve, reset, merge, push, deploy cloud o escritura en
producción. Las evidencias y cambios previos continúan pendientes de commit.
