# R6-BASELINE por entorno — 2026-10-11

## Dictamen vigente

**Local: catálogos de guards verificados; historial Prisma no acreditado.**
**Producción: diagnóstico Railway ejecutado; guards formales incompletos y drift de checksums.**
R6-BASELINE global sigue abierto; ninguna evidencia local se atribuye a producción.

Checkout de la revisión: `feat/contabilidad-capa-formal`, `8d6167fa`, con cambios
compartidos. Sesión OpenCode: `ses_ed5d804d0ffe0YPOrinAXLfcKy`.

## Diagnóstico disponible

`scripts/ops/audit-accounting-baseline.sql` usa una transacción
`REPEATABLE READ READ ONLY`, `statement_timeout=30s`, `lock_timeout=5s` y exige un
nombre de base esperado, suministrado independientemente de la conexión.

Emite un JSON con:
- Identidad SQL, versión, recovery y configuración read-only/isolation efectiva.
- 11 triggers asociados a la tabla correcta en `public`, activos para sesiones normales.
- 11 constraints CHECK asociadas a la tabla correcta y validadas (incluye gasto).
- Índice de idempotencia de reconciliación de servicios: tabla correcta, unique,
  válido, ready y no parcial. Conserva su definición para contrastar columnas.
- Definiciones de triggers/checks/índice y hashes MD5 de funciones como identificadores
  de comparación, no como evidencia de integridad criptográfica ni validación funcional.
- Historial `_prisma_migrations`, si existe, sin logs ni credenciales.

El diagnóstico complementa `verify-accounting-sql-guards.mjs`, cuya comprobación
histórica busca nombres existentes. No modifica ese verificador ni migra/baselinea
objetos. `guardsReady` solo expresa los checks de catálogo enumerados: no certifica
todo el schema, definiciones esperadas por versión ni comportamiento de cada guard.
El exit 0 del diagnóstico acredita ejecución; revisar el JSON antes de aceptar guards.

## Evidencia local

```bash
psql -X -w -qAt 'postgresql://arturo@127.0.0.1:5433/tcp_test_local' \
  -v ON_ERROR_STOP=1 -v expected_database=tcp_test_local \
  -f scripts/ops/audit-accounting-baseline.sql
```

Artifact: `r6-baseline-local-2026-10-11.json`.

| Check | Resultado |
|---|---|
| Base / rol / puerto | `tcp_test_local` / `arturo` / `5433` |
| Recovery | false |
| Transacción | read-only `on`, repeatable read |
| Triggers / checks / índice | 11/11 + 11/11 + 1/1 ready |
| `_prisma_migrations` | Ausente |
| Migraciones SQL en el checkout | 146; no hay historial con el que comparar checksums |
| Prueba negativa de identidad | `expected_database=wrong_database` → exit 3, `BASELINE_DATABASE_IDENTITY_MISMATCH` |

La ausencia de historial **no significa que las 146 migraciones estén sin aplicar**;
pueden existir objetos creados por otra vía. Tampoco permite afirmar que sus checksums
coincidan con el repositorio. No se creó historial ni se ejecutó `migrate resolve`,
`deploy`, `db push`, reset, seed o cambio de modo operativo.

## Producción: acceso Railway y resultado

El responsable confirmó acceso a Railway. La CLI autenticada permitió obtener las
variables de `FinanceMDM` y `Postgres`, en el proyecto FinanceMDM
`0dbb20f0-2d06-4de0-ad0b-509121846ccd`, entorno `production`
`415edf54-171b-4777-b58e-8b65ae1e4ed2`. Se comprobó igualdad exacta entre las URLs
internas de aplicación y base antes de usar la URL pública de Postgres. Credenciales
capturadas en memoria y transmitidas a psql por entorno, sin imprimirlas ni persistirlas.
No se leyeron archivos `.env` ni se cambiaron variables Railway.

Preparar por un canal seguro, accesible al proceso que ejecutará herramientas:
- `PRODUCTION_DATABASE_URL`: conexión directa autorizada para diagnóstico.
- `PRODUCTION_DATABASE_NAME`: nombre esperado de la base de producción.

No pegar contraseñas en actas, chat o argumentos literales del historial. Una vez
disponibles las variables, ejecutar desde este checkout:

```bash
psql -X -w -qAt "$PRODUCTION_DATABASE_URL" \
  -v ON_ERROR_STOP=1 -v expected_database="$PRODUCTION_DATABASE_NAME" \
  -f scripts/ops/audit-accounting-baseline.sql \
  > openspec/changes/contabilidad-capa-formal/r6-baseline-production-2026-10-11.json
```

La ejecución efectiva usó `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
en el entorno del proceso y además `default_transaction_read_only=on`.
Base esperada: `railway`, obtenida de `PGDATABASE` del servicio Postgres y contrastada
con la URL pública. Transacción verificada: read-only `on`, repeatable read.

Artefactos:
- `r6-baseline-production-2026-10-11.json`: catálogo e historial (123 filas).
- `r6-baseline-production-history-2026-10-11.json`: comparación SHA-256 contra el
  árbol Git del commit desplegado, sin usar el contenido modificado del checkout.

Railway reporta despliegue `46cd7a49-4711-4507-9d7c-13eb3e246c38`, `SUCCESS`, creado
`2026-10-11T09:58:49.470Z`, rama `main`, commit
`e6c20706e8658766187fb648fe6950c2f25dd249`. Esto acredita metadata del despliegue,
no constituye una prueba funcional o aceptación contable del release.

| Check de producción | Resultado |
|---|---|
| PostgreSQL / base | 17.11 / `railway` |
| Guards del alcance formal | 9/11 triggers, 0/11 CHECKs, 0/1 índice ready |
| Historial aplicado distinto | 119 migraciones; 0 incompletas sin revertir |
| Migraciones del commit desplegado | 117; todas registradas como aplicadas |
| Checksums diferentes del commit desplegado | 13 |
| Migraciones solo en historial | 2 |

Faltan los triggers nominados de `apertura_revisiones` y `lineas_apertura_periodo`,
los 11 CHECKs y el índice idempotente de servicios enumerados en el JSON. La ausencia
corresponde a los nombres/tablas del alcance; no certifica ausencia de toda protección
equivalente. No se valida la semántica de los nueve triggers presentes.

Las dos migraciones solo en historial son
`20260722130000_make_tenant_id_required_tipo_pago` y
`20260926000000_hardening_catalog_on_delete`. Los 13 checksums discrepantes se listan
en el artefacto de historial; requieren reconstruir el SQL realmente aplicado y
comparar objetos para determinar su causa, sin sobrescribir el historial.

Contra el checkout contable hay 146 migraciones, 29 sin registro aplicado. Esas 29
no pertenecen al árbol de 117 migraciones del release desplegado: no se clasifican
como fallo de ejecución de ese release ni se aplica el checkout a producción.

**Dictamen:** el acceso deja de ser bloqueo. R6-BASELINE permanece abierto por drift
del historial y preparación/despliegue pendiente del alcance formal. Siguiente paso:
reconciliar las 13 discrepancias y dos entradas adicionales con sus objetos SQL,
y preparar un plan de actualización contable basado en el estado real heredado.
Esta corrida no ejecuta migraciones, resolve, reset ni cambios de negocio.
La continuación `r6-baseline-production-reconciliacion-2026-10-11.md` recupera SQL
histórico exacto para 15/15 entradas, contrasta catálogos de 27 tablas y confirma los
efectos focales de las dos migraciones adicionales. No cierra equivalencia global:
documenta diferencias de FK, límites de datos y plan de actualización heredado.

R6-ROLLBACK y R0.5 global mantienen sus límites de cobertura; A9/R7 requieren proceso
y sesión operativos verificados y una ventana real de siete días. Este reporte no
inicia ese reloj ni certifica un release.
