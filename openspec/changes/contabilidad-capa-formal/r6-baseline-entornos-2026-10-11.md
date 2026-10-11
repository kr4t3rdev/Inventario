# R6-BASELINE por entorno — 2026-10-11

## Dictamen vigente

**Local: catálogos de guards verificados; historial Prisma no acreditado.**
**Producción: seleccionado por el responsable, pendiente de acceso y ejecución.**
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

## Producción: preparación y bloqueo

El responsable eligió **Producción** y **Configurar conexión**. Esta sesión no tiene
`PRODUCTION_DATABASE_URL`, `DATABASE_URL_PRODUCTION`, `DATABASE_URL` ni `DIRECT_URL`
exportadas; tampoco un acceso cloud disponible por token. No se leyeron archivos `.env`.

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

Aún no existe resultado de esa corrida. El próximo dictamen debe contrastar los
objetos/definiciones e historial con la versión efectivamente desplegada en producción,
no asumir que el checkout local es esa versión. Si el historial existe, comparar los
checksums SHA-256 de `migration.sql` y distinguir aplicadas, revertidas e incompletas.
Si no existe o hay drift, documentar el baseline heredado y su plan específico;
este diagnóstico no ejecuta el plan ni marca migraciones como aplicadas.

R6-ROLLBACK y R0.5 global mantienen sus límites de cobertura; A9/R7 requieren proceso
y sesión operativos verificados y una ventana real de siete días. Este reporte no
inicia ese reloj ni certifica un release.
