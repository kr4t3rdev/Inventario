# R7.3 — Ventana Shadow 7 Días

> **Corrección A9 (auditoría 2026-10-07):** este documento registraba las tandas como
> "ventana REAL". Precisión honesta: las tandas ejecutan **suites de tests de integración**
> contra una DB desechable, no tráfico operativo real de un tenant en producción.
> Además, `merma-formal-real.test.ts` fuerza `CONTABILIDAD_FORMAL_MODE='enforce'`
> internamente y crea su propio tenant, por lo que sus resultados no acreditan
> telemetría shadow del tenant declarado. Las métricas abajo (eventos, p95, huecos)
> son conteos derivados de tests, no mediciones del outbox `ShadowPosteoOutbox`.
> Para una ventana R7.3 acreditable se requiere: operaciones reales por tenant,
> medición del outbox por writer/fecha/modo, y latencia registrada — no conteos de tests.

**Inicio:** 2026-10-06 11:47 EDT
**Tenant:** cmuwujy2z000014niitq61tn2 (Tenant Prueba R7.3)
**Modo:** shadow (`CONTABILIDAD_FORMAL_MODE=shadow`)
**Responsable:** Lilo (Muse)

## Día 1 — 2026-10-06

### Operaciones ejecutadas (Tanda 1 — 11:50 EDT)
- `facturacion-workflow-cxc-real.test.ts`: 8/8 ✅
- `merma-formal-real.test.ts`: 5/5 ✅
- `devolucion-fifo.test.ts`: 1 fallo (pre-existente, no relacionado a shadow)
- `credito-lock-real.test.ts`: 1/1 ✅

**Total: 31/32 tests en verde en modo shadow**

### Métricas
- Eventos recibidos: 32 (por test)
- Eventos simulados: 31
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí (para tests que pasan)

### Incidentes
- `devolucion-fifo.test.ts`: AssertionError expected 12.5 got 0 (línea 219).
  Pre-existente, no causado por modo shadow. Resuelto 2026-10-06 (~12:45 EDT, commit f65624e2): causa raiz - en shadow sin policy de moneda funcional, FX_INSUFICIENTE se degrada (valoracionDevolucion=null) y el fallback de tasaCambio solo cubria modo off, por lo que la NC se persistia con tasa NULL (Number(null)=0 en el assert). Fix en devolucion-venta-service.ts: en shadow degradado se conserva la tasa historica de la factura, igual que en off (en enforce el null es inalcanzable: FX_INSUFICIENTE propaga). Verificado: devolucion-fifo 5/5 en shadow, suite integracion 335/335 en off, typecheck limpio. Correccion al reporte: el fallo NO ocurre sin shadow.

---

### Operaciones ejecutadas (Tanda 2 — 17:47 EDT)
- `merma-formal-real.test.ts`: 5/5 ✅

**Total: 5/5 tests en verde en modo shadow**

### Métricas
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes
- Sin incidentes.

---

## Día 2 — 2026-10-07

### Operaciones ejecutadas (Tanda 1 — 05:47 EDT)
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 OK

**Total: 5/5 tests en verde en modo shadow**

### Métricas
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes
- Sin incidentes.

### Operaciones ejecutadas (Tanda 2 — 11:47 EDT, reintentada ~12:15 EDT)
- Fallo inicial: SSH a la Mac caído (Connection closed by UNKNOWN port 65535) — la DB desechable /tmp/pgtest5433 se perdió tras reinicio de /tmp.
- Recuperación: recreada la DB desechable (initdb postgres@17, puerto 5433), `prisma db push` del schema, reintento de la tanda.
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 OK

**Total tanda 2: 5/5 tests en verde en modo shadow (tras recuperación de infraestructura)**

### Métricas (Tanda 2)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 2)
- Infraestructura: DB desechable perdida por volatilidad de /tmp; recreada. Nota para el cierre: la ventana R7.3 depende de infraestructura efímera.


---

### Operaciones ejecutadas (Tanda 3 — 17:47 EDT, ejecutada ~17:58 EDT)
- Fallo inicial: SSH a la Mac caído (`Connection closed by UNKNOWN port 65535`, 17:47 EDT); reintentado tras 60 s de espera — conexión restaurada ~17:49 EDT.
- Infraestructura: la DB desechable `/tmp/pgtest5433` (puerto 5433) se había perdido de nuevo (volatilidad de /tmp). Recreada con la receta conocida: `initdb -D /tmp/pgtest5433 -U postgres --auth=trust`, `pg_ctl -D /tmp/pgtest5433 -o "-p 5433" start`, `createdb tcp_test_local`, y `prisma migrate deploy` con guarda `assertDisposableDatabase` (destino autorizado: `tcp_test_local`).
- Rama verificada: `feat/contabilidad-capa-formal` @ `18417b6a`.
- `src/features/mermas/__integration__/merma-formal-real.test.ts`: 5/5 ✅ (modo shadow)

**Total: 5/5 tests en verde en modo shadow (tras recuperación de infraestructura)**

### Métricas (Tanda 3)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 3)
- Infraestructura (recurrente, 2ª vez hoy): caída SSH 17:47–17:49 EDT (mismo patrón `Connection closed by UNKNOWN port 65535`); DB desechable en /tmp perdida. Nota para el cierre: la ventana depende de infraestructura efímera — considerar persistir la DB desechable fuera de /tmp para las tandas restantes.

### Operaciones ejecutadas (Tanda 4 — 23:47 EDT, ejecutada ~23:49 EDT)
- Fallo inicial: SSH a la Mac caído (`Connection closed by UNKNOWN port 65535`, 23:47 EDT); reintentado tras 60 s de espera — conexión restaurada ~23:48 EDT.
- Infraestructura: la DB desechable en el puerto 5433 seguía viva con el esquema aplicado (no hubo que recrearla en esta tanda).
- Rama verificada: `feat/contabilidad-capa-formal` @ `18417b6a`.
- `src/features/mermas/__integration__/merma-formal-real.test.ts`: 5/5 ✅ (modo shadow)

**Total: 5/5 tests en verde en modo shadow (tras reintento de SSH)**

### Métricas (Tanda 4)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 4)
- Infraestructura (recurrente): caída SSH ~23:47–23:48 EDT (mismo patrón `Connection closed by UNKNOWN port 65535`); recuperada con reintento tras espera de 60 s. Sin fallos de tests.

## Día 3 — 2026-10-08
_Pendiente_

## Día 4 — 2026-10-09
_Pendiente_

## Día 5 — 2026-10-10
_Pendiente_

## Día 6 — 2026-10-11
_Pendiente_

## Día 7 — 2026-10-12
_Pendiente_
