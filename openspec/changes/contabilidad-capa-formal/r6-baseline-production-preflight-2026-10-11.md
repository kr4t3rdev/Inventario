# R6 — Preflight de objetos pendientes e invariantes heredadas

## Resultado: actualización aún bloqueada

El inventario nominativo cubre las **29 migraciones del checkout no registradas en
producción**. La consulta agregada detecta **13 reconciliaciones con TipoPago de otro
tenant** y **1 CompraProducto sin la fuente exigida por el guard de R5**.

Este corte no modifica producción. Todos los catálogos/agregados se obtuvieron en
`READ ONLY`, `REPEATABLE READ`, base esperada `railway`, por el mismo servicio Postgres
que utiliza FinanceMDM production. Los snapshots se capturaron en transacciones
separadas; no se atribuye un snapshot único a todo el conjunto de artefactos.

## Inventario nominativo de las 29 migraciones

- Catálogo completo de `public`: **143 tablas, 9 triggers y 6 funciones**; incluye
  columnas/tipos/defaults/nullability, constraints/índices y valores de enums.
- Comparador: `scripts/ops/compare-accounting-migration-catalog.py`.
- **523 declaraciones nominadas extraídas; 78 presentes/operativas.**
- `20260929000000_r5_formal_schema_dependencies`: **78/78 nombres presentes**.
- Otras 28 migraciones: **0 objetos nominados presentes por migración**.

El comparador inventaría declaraciones con nombres entre comillas de CREATE TABLE,
INDEX, TRIGGER y ALTER TABLE ADD COLUMN/CONSTRAINT. Asocia cada objeto a su tabla;
verifica valid/ready de índices, validación de constraints y activación de triggers.
Su resultado **no compara semántica, tipos/defaults esperados, funciones, cambios
de enums, ALTER COLUMN ni DML**. No se presenta como un diff completo del schema ni
como aprobación de migración. Los valores reales están en el catálogo para ese diff.

Los nueve triggers existentes corresponden a objetos previos; no convierten en
presentes los objetos extraídos de las 28 migraciones. R5 sí tiene efectos
estructurales previamente existentes pese a carecer de entrada aplicada.

Reproducción local del inventario (sin conexión):

```bash
python3 scripts/ops/compare-accounting-migration-catalog.py . \
  openspec/changes/contabilidad-capa-formal/r6-baseline-production-2026-10-11.json \
  openspec/changes/contabilidad-capa-formal/r6-baseline-production-full-catalog-2026-10-11.json \
  openspec/changes/contabilidad-capa-formal/r6-baseline-production-pending-objects-2026-10-11.json
```

## Invariantes de datos agregadas

Consulta: `scripts/ops/audit-production-accounting-invariants.sql`.
Artefacto: `r6-baseline-production-invariants-2026-10-11.json`.
Solo se emitieron conteos, sin nombres, IDs o importes de filas de negocio.

| Dominio | Filas | Resultado focal |
|---|---:|---|
| Nómina | 10 | Sin empleado ausente, tenant nulo ni diferencia con empleado |
| CompraProducto | 1 | Tenant no nulo y coherente con producto/proveedor; fuente R5 no verificable en 1 |
| CxP | 3 | Sin fuentes directas ausentes, ambigüedad, tenant nulo/diferente o falta de fuente resoluble |
| Reconciliación gasto | 32 | Sin huérfanos ni diferencias tenant cuenta/tipo de pago |
| Reconciliación servicio | 11 | Cuenta correcta; **11 TipoPago de otro tenant** |
| Reconciliación venta | 14 | Cuenta correcta; **2 TipoPago de otro tenant** |
| Restock GastoCompra | — | 0 grupos duplicados `(tenantId, numeroFactura)` con factura no nula |

También: 0 fuentes CxP con tenant nulo y 0 referencias inversas a CxP ausente.
La comprobación de duplicados cubre solamente el índice de restock y el snapshot
actual; no se generaliza a todas las claves nuevas.
La validación del comparador pasó **3/3 pruebas**: rechaza nombre en otra tabla,
índice inválido/CHECK no validado/trigger desactivado y no omite columnas con tipo
enum entre comillas ni múltiples ADD COLUMN. Comando:
`python3 -m unittest discover -s scripts/ops -p test_compare_accounting_migration_catalog.py`.

### Bloqueo 1 — CompraProducto y guard R5

`tenant_unverifiable_by_r5_source=1`, `source_missing=0`: el enlace `gastoCompraId`
es nulo, no un FK huérfano. El tenant ya está definido y coincide con producto y
proveedor. Sin embargo, R5 exige fuente GastoCompra para **todas** las compras, incluso
las que ya tienen tenant. Por ello el guard vigente abortaría sobre este estado.

El ensayo debe contemplar explícitamente esta variante heredada y validar su
procedencia. No inventar un GastoCompra para satisfacer el guard ni asumir que una
fila con tenant existente requiere backfill. La decisión sobre el guard debe conservar
fail-closed para tenants nulos, fuentes inconsistentes o procedencia no verificable.

### Bloqueo 2 — Referencias cross-tenant a TipoPago

Son **13 filas**, no cuentas cruzadas: cuenta y reconciliación tienen el mismo tenant;
TipoPago tiene otro. Se buscaron candidatos del mismo nombre en el tenant destino:
**0 para las 13 filas**. No hay una sustitución nominativa directa acreditada.

Preparar en la copia de ensayo una reparación trazable de configuración/referencias,
respetando significado, `requiereCuenta`, cuenta por defecto y estado del tipo de pago.
La coincidencia de nombre tampoco bastaría para asumir equivalencia. No cambiar
tenants de cuentas ni de documentos para ocultar la inconsistencia.

## Siguiente ensayo, condicionado por estos resultados

1. Completar comparación semántica del schema objetivo con el catálogo, particularmente
   el bloque R5 existente y diferencias históricas de FK/nombres.
2. Obtener una copia desechable representativa, conservando snapshots del historial y
   objetos; la base local existente no es una copia certificada de producción.
3. Incorporar ambos bloqueos como fixtures de la copia y como precondiciones explícitas
   del plan de actualización. Probar reparación de configuración y variante R5.
4. Ejecutar plan versionado sobre la copia, comparar objetos y conservar el historial
   original sin reescribir checksums. Verificar unicidad restante, evidencia FX y gates.
5. Solo después de ensayo satisfactorio, preparar ejecución y reverificación operativa.

R6-BASELINE, R0.5 y A9/R7 siguen abiertos. Este preflight no ejecuta reparación,
migración, DDL, resolve, deploy ni activación operacional.

## Verificación de herramientas y límites de ejecución

El inventario produjo 29 entradas únicas y hashes de los SQL fuente. El SQL de
invariantes pasó en local y producción. Una primera tentativa de producción devolvió
exit no cero con salida retenida por protección de conexión; no se conservó su error,
por lo que no se atribuye una causa. La reproducción posterior terminó con exit 0;
las dos ampliaciones de desglose también pasaron. No hay resultado parcial firmado
de aquella tentativa. No se han repetido corridas después de completar el desglose.
