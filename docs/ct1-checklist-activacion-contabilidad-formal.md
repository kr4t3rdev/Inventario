# Checklist corto — activar la contabilidad formal

**Qué es esto:** la vía operativa mínima para pasar la contabilidad formal de
`off` a `shadow` o `enforce` en un tenant real, y para revertirla.

**Qué NO es:** no es un acta, no exige firmas y no bloquea nada del
desarrollo. El código, los tests y la CI no dependen de este documento. Solo
importa el día que quieras **contabilizar de verdad** a tenants con dinero
real. Para el trámite formal con acta y firmas existe
`docs/ct1-plantillas-firmas-gates.md`; para el detalle de la capa formal,
`docs/ct1-cierre-integracion-capa-formal.md`.

**Estado actual:** todo está en `off`. La capa formal no toca ningún flujo de
negocio. Nada de esto corre automáticamente.

---

## 1. Los 3 interruptores

| Interruptor | Valor por defecto | Efecto |
|---|---|---|
| `CONTABILIDAD_FORMAL_MODE` | `off` (global) | `off` no-op · `shadow` simula · `enforce` asienta **o rechaza** |
| `CONTABILIDAD_FORMAL_NO_CASH_MODE` | `off` | Mismo, para los emisores no Cash |
| `CONTABILIDAD_FORMAL_MODO_TENANT` | sin definir | Si vale `1`, cada tenant aprueba su propio modo |

Además, la flag de plan **`contabilidad-formal`** debe estar activa: sin ella
el motor devuelve `OMITIDO / FLAG_INACTIVO` y no contabiliza nada.

**Aprobación por tenant (R7.4):** solo si `CONTABILIDAD_FORMAL_MODO_TENANT=1`.
Entonces manda `TenantLicense.featureOverrides` con las claves
`contabilidad-formal-shadow` o `contabilidad-formal-enforce` (tiene prioridad
`enforce`). **Quitar la variable de entorno revierte toda la flota al modo
global** — ese es el interruptor de reversión.

Referencia: `src/features/contabilidad-formal/lib/modo-tenant.ts`.

---

## 2. Antes de tocar un tenant real

Ocho checks. Si uno falla, **no se sigue**.

- [ ] **Backup restaurable y probado** (un restore verificado, no solo un dump).
- [ ] **Migraciones observadas** en ese entorno. En producción **no se aplican
      en el deploy** salvo opt-in `PRISMA_SCHEMA_SYNC_ON_START=true`, y hay
      migraciones registradas como `rolled_back_at` que un
      `prisma migrate deploy` intentaría re-aplicar. Verificar el estado real,
      no asumirlo.
- [ ] **Fecha de devengo del costo de venta repuesta.** La columna
      `Venta.costoVentaFecha` la persiste el writer desde el despliegue de esta
      capa; las ventas anteriores no la tienen y el replay las omite con
      `FECHA_COSTO_FIFO_NO_PERSISTIDA`. El backfill repone la fecha solo de las
      ventas cuyo devengo ocurrió en el acto de crearse (la fila nunca fue
      modificada después): es la misma población que el criterio anterior
      admitía. El resto se deja sin fecha a propósito, porque su devengo real
      es desconocido.

      ```bash
      # simulación (no escribe)
      DATABASE_URL="$DATABASE_URL_<ENTORNO>" \
        pnpm exec tsx scripts/ops/backfill-venta-costo-fecha.ts
      # aplicación (idempotente)
      DATABASE_URL="$DATABASE_URL_<ENTORNO>" \
        pnpm exec tsx scripts/ops/backfill-venta-costo-fecha.ts --apply
      ```

      El script hace falta aunque las migraciones se apliquen: el sincronizado
      de esquema por defecto del proyecto es `prisma db push`, que **no ejecuta
      el SQL de las migraciones** (`scripts/run-prisma-schema-sync.sh`).
- [ ] **Configuración efectiva observada** (no inferida): los 3 interruptores
      y los overrides de licencia de los tenants afectados.
- [ ] **Ventana acordada** y responsables de ejecutar y de aprobar **distintos**.
- [ ] **Tenant objetivo identificado** con su owner y su aprobador.
- [ ] **Saldos base registrados** por tenant y moneda (verificador forense,
      §4), para poder comparar después.
- [ ] **Plan de reversión escrito**: a quién se avisa, qué se revierte, con
      qué backup, y qué umbral dispara el corte.

---

## 3. Los 3 comandos del rollout

```bash
pnpm exec tsx scripts/ops/accounting-policy-rollout.ts <preflight|dry-run|apply> ...
```

| Paso | Qué hace | Flags obligatorios |
|---|---|---|
| `preflight` | Inspecciona, no muta datos de negocio | `--tenants <ids>` `--executor <usuario>` |
| `dry-run` | Proyecta el resultado por tenant | `--manifest <ruta.json>` `--executor <usuario>` |
| `apply` | **Escribe**. Sin `--apply` no hace nada | `--apply` `--manifest` `--dry-run-id` `--correlation-id` `--executor` + 4 proofs |

**Reglas que impone el script** (`scripts/ops/accounting-policy-rollout.ts`):

- El `--dry-run-id` debe venir de un dry-run **exitoso del contenido exacto**
  del manifiesto, y ese dry-run debe cubrir **exactamente los mismos tenants**.
- El `--executor` debe ser **distinto del aprobador**.
- Las **4 pruebas** son obligatorias; si falta una → `ROLLOUT_NOT_READY`.
  Cada una exige `verified === true` **y** una referencia de evidencia no
  vacía:

  | Proof | Qué acredita |
  |---|---|
  | `--capability-mappings-proof` | Que las capacidades del plan están mapeadas |
  | `--tenant-responsibles-proof` | Que hay responsable nominated por tenant |
  | `--database-backup-proof` | Que hay backup restaurable |
  | `--pilot-proof` | Que el piloto ya se ejecutó |

**Resultados del dry-run:** `CREATE` · `NO_OP` · `CONFLICT` · `BLOCKED`.
**Clasificaciones del preflight:** `POLICY_PRESENT` · `MISSING_NO_EVIDENCE` ·
`MISSING_WITH_EVIDENCE` · `REVIEW_REQUIRED`.
`MISSING_WITH_EVIDENCE` sin aprobación de tenant válida → `BLOCKED`.

---

## 4. Baseline de saldos (solo lectura)

```bash
DATABASE_URL="$DATABASE_URL_<ENTORNO>" \
pnpm exec tsx scripts/accounting/verificador-forense-report.ts \
  --all-tenants --out ../ct1-evidencias/r6-<entorno>-<fecha>.json

DATABASE_URL="$DATABASE_URL_<ENTORNO>" \
pnpm exec tsx scripts/ops/verify-formal-postings-production.ts \
  > ../ct1-evidencias/r6-<entorno>-cobertura-<fecha>.txt
```

Ejecutar **antes y después** del cambio y comparar saldos por tenant y
moneda. El origen de los valores es siempre el informe forense
(`saldosPorCuenta` con la moneda funcional del tenant y los cruces contra la
base operativa) — nunca un cálculo manual. Una diferencia no explicada
bloquea.

Los artefactos van **fuera del repositorio**: contienen IDs de tenant, saldos
y nombres.

---

## 5. Monitorizar durante `shadow`

```bash
export REPORT_MONITOR_BASE_URL="https://<host>"      # HTTPS obligatorio
export REPORT_MONITOR_AUTH_COOKIE="<cookie>"          # sin \r ni \n
export REPORT_MONITOR_ACCOUNT_ID="<id-cuenta>"
export REPORT_MONITOR_TIMEOUT_MS="8000"               # 500..30000
export REPORT_MONITOR_RUN_UNTIL="<ISO>"

pnpm run ops:monitor:accounting-reports
```

Comprueba 6 superficies: `reports-page`, `summary`, `movements`,
`csv-export`, `pdf-export` (valida el prefijo `%PDF-`) y `account-history`.
Códigos de error: `HTTP_ERROR` · `TIMEOUT` · `NETWORK_ERROR` ·
`UNEXPECTED_CONTENT_TYPE` · `UNEXPECTED_BODY`. Si la ventana terminó:
`skipReason: OBSERVATION_WINDOW_EXPIRED`.

**Métricas shadow** (`getMetricasShadowAction`): exige la feature
`contabilidad-formal` y el permiso `financiero.auditoria.ver`; el tenant sale
de la sesión. Devuelve `tipoEvento`, `estado` (`SIMULADO` · `ERROR_SHADOW` ·
`OMITIDO`), `causa`, `cantidad` y `latenciaP95Ms`.

---

## 6. Manifiesto V1

```jsonc
{
  "version": 1,
  "reason": "<motivo>",
  "platformApproval": {
    "approverUserId": "<id>", "reference": "<ref>", "approvedAt": "<ISO>"
  },
  "entries": [{
    "tenantId": "<id>",                       // sin duplicados
    "functionalCurrencyCode": "<CÓDIGO>",     // literal; no '*', 'DEFAULT', 'PRIMARY'
    "expectedClassification": "MISSING_NO_EVIDENCE" | "MISSING_WITH_EVIDENCE",
    "origin": "ROLLOUT",                      // literal
    "reason": "<motivo>",
    "tenantApprovalId": "<id>"                // exigida si hay evidencia
  }]
}
```

Validado por Zod en `scripts/ops/lib/accounting-policy-manifest.ts`.

---

## 7. Brechas que hay que declarar (no son bloqueantes, pero son reales)

1. Préstamos Cash: se crean **sin emisor formal**.
2. Préstamos Cash: `cuentaBancaria.findUnique/update` y `clienteId` **no
   filtran por tenant**.
3. Producción: `/api/produccion/ordenes/[id]/completar` completa **sin emisión
   ni `fechaContabilizacion`**.
4. `TRANSFERENCIA_BANCARIA` y `PAGO_DEUDA_CAPITAL`: sin writer.
5. 8 tipos de movimiento con disposición "solo plantilla".
6. **Costo FIFO sin factura trazada.** En modo `enforce`, la venta de un
   producto recibido **sin factura de compra trazada** no se puede valorar, el
   motor formal rechaza la operación completa (`VALORACION_MONETARIA_AUSENTE`)
   y la venta no se registra. En `shadow` la venta se registra y el fallo queda
   como telemetría. En la devolución, en cambio, solo se omite la línea de
   costo. Decisión pendiente del responsable del tenant: facturar la recepción
   antes de vender, o aceptar que ese producto no se venda con la capa
   activa.

Detalle: `docs/ct1-r0-5-matriz-canonica.md`.

---

## 8. Evidencia y entornos

| Qué | Dónde |
|---|---|
| Rama de la capa formal | `main` · merge commit `04cc55b5` (PR #192 fusionado: <https://github.com/kr4t3rdev/Inventario/pull/192>) |
| Manifiesto de evidencia | `../ct1-evidencias/manifest-r6-local-20261110.md` (§11 = ronda de remediación) |
| Logs de los gates | `../ct1-evidencias/logs/` (todos `EXIT=0`) |
| Producción | `https://financemdm.kr4t3rdev.xyz` (Railway) · Env `FinanceMDM / production` |
| Staging | GitHub Environment `FinanceMDM / staging` |
| Verificar el SHA desplegado | Actions → **"Smoke post-deploy"** (`workflow_dispatch`), input `expected_sha`. No corre automático |

**La integración PostgreSQL debe correr aislada.** Una corrida paralela dio
267/267 verdes pero 1 archivo falló por timeout del teardown de Prisma con el
host saturado (load 88 en 8 cores). Log conservado en
`../ct1-evidencias/logs/integration-test-run-parallel-saturation-20261110.log`.

---

## 9. Lo que sigue pendiente

1. **R6-BASELINE** por entorno: backup restaurable, migraciones observadas,
   saldos base, config remota observada.
2. **R6-ROLLBACK**: plan y ventana de reversión, ensayado fuera de producción.
3. **R7**: siete días completos en `shadow` con monitor y métricas.
4. **R7.4**: tenant objetivo, owner y aprobador reales.
5. **R0.5-ACCEPT**: acta global con firmas (opcional si no se requiere
   trazabilidad formal).

Nada de esto bloquea el desarrollo ni la CI.
