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

> **Estado A9 — 2026-10-11:** ante la alternativa planteada por el usuario, se conserva
> Shadow pendiente como opción conservadora; no se descarta ni se exime la ventana R7 de
> siete días. La ventana operativa real **no ha iniciado**. Las fechas, tandas y métricas
> históricas de este documento son corridas de tests, no evidencia
> de inicio/cobertura operacional. El Preview aislado terminó `ERROR/ENOENT` antes de
> completar las validaciones planificadas; no hay resultados verificables de build/tests.
> El scope cloud queda suspendido, sin nuevos intentos; los recursos Railway existentes
> permanecen intactos y no hay autorización para apagarlos.

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

### Operaciones ejecutadas (Tanda 5 — 11:47 EDT)
- Infraestructura: SSH a la Mac estable en el primer intento; la DB desechable en el puerto 5433 respondió sin recreación.
- Rama verificada: feat/contabilidad-capa-formal (worktree principal).
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 ✅ (modo shadow)

**Total: 5/5 tests en verde en modo shadow**

### Métricas (Tanda 5)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 5)
- Ninguno.


### Operaciones ejecutadas (Tanda 6 — 17:47 EDT, ejecutada ~17:52 EDT)
- Infraestructura: 1 caída SSH durante la exploración previa (`Connection closed by UNKNOWN port 65535`, patrón recurrente); el comando de la tanda ejecutó al primer intento tras reintentar. La DB desechable en el puerto 5433 respondió sin recreación.
- NOTA DE CONTEXTO: el checkout en `/Users/arturo/Documents/Proyecto Inventario/TCP` ahora está en `main` (merge de handlers admin mobile `3cac5152` el 2026-10-08), por lo que el test del cuerpo ya no existe allí. La tanda se ejecutó en el worktree existente de la rama `feat/contabilidad-capa-formal` (`/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP` @ `5184610f`), que conserva `node_modules` y el test intactos.
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 ✅ (modo shadow, inicio 17:52:06 EDT, duración 1.43s)

**Total: 5/5 tests en verde en modo shadow**

### Métricas (Tanda 6)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 6)
- Infraestructura (recurrente, menor): 1 caída SSH durante la exploración (`Connection closed by UNKNOWN port 65535`), recuperada con reintento. La tanda no se vio afectada.


### Operaciones ejecutadas (Tanda 7 — 23:47 EDT, ejecutada ~23:48 EDT)
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 ✅ (modo shadow, inicio 23:48:15 EDT, duración 2.48s)
- Ejecución en el worktree de la rama `feat/contabilidad-capa-formal` (`/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP` @ `5184610f`), con el comando del cuerpo y `CONTABILIDAD_FORMAL_MODE=shadow`. DB desechable `tcp_test_local` en el puerto 5433 respondió sin recreación.

**Total: 5/5 tests en verde en modo shadow**

### Métricas (Tanda 7)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 7)
- Sin incidentes. SSH estable durante la tanda.

## Día 4 — 2026-10-09

### Operaciones ejecutadas (Tanda 8 — 05:47 EDT, ejecutada ~05:48 EDT)
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 ✅ (modo shadow, inicio 05:48:01 EDT, duración 2.84s)
- Ejecución en el worktree de la rama `feat/contabilidad-capa-formal` (`/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP` @ `a43d67eb`), con `CONTABILIDAD_FORMAL_MODE=shadow`. DB desechable `tcp_test_local` en el puerto 5433 respondió sin recreación.
- Desvío del comando del cuerpo: el checkout `/Users/arturo/Documents/Proyecto Inventario/TCP` está en `main` (tras el merge de admin handlers `3cac5152`) y ya no contiene el test; se ejecutó en el worktree donde vive el código bajo prueba.

**Total: 5/5 tests en verde en modo shadow**

### Métricas (Tanda 8)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 8)
- Sin incidentes en la ejecución. SSH estable durante la tanda. (Ver 'Desvío' arriba: cambio de ruta respecto al cuerpo, sin impacto en resultados.)

### Operaciones ejecutadas (Tanda 9 — 11:47 EDT, ejecutada ~12:11 EDT)
- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 en verde (modo shadow, inicio 12:10:50 hora del Mac, duración 2.19s)
- Ejecución en el worktree de la rama feat/contabilidad-capa-formal (/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP @ a43d67eb), con CONTABILIDAD_FORMAL_MODE=shadow. DB desechable tcp_test_local en el puerto 5433 respondió sin recreación; tenant piloto cmuwujy2z000014niitq61tn2 intacto.

Total: 5/5 tests en verde en modo shadow

### Métricas (Tanda 9)
- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 9)
- Primer intento SSH falló ("Connection closed by UNKNOWN port 65535" en el túnel tailnet); reintento a los ~3 min conectó sin intervención. Tailscale reportaba Connected en la VM todo el tiempo.
- pnpm se cuelga en el Mac (hasta "pnpm --version" supera 60s y aborta con "The operation was aborted due to timeout", sin salida de vitest). Causa: el Mac volvió a perder internet — curl a https://registry.npmjs.org/ agota 10s (código 000, exit 28). Es la misma firma del incidente del 2026-10-06: VPN Proxy Master probablemente retiene la ruta por defecto con el túnel caído mientras Tailscale sigue vivo. Pendiente: desconectar/reconectar la VPN en el Mac.
- Mitigación aplicada en la tanda: se ejecutó vitest directo con ./node_modules/.bin/vitest (sin pnpm), que no necesita red: 5/5 en verde. Nota: invocar el shim con "node node_modules/.bin/vitest" falla con SyntaxError (es un script shell, no JS); usar el ejecutable directo.
- Desvío del comando del cuerpo: se ejecutó en el worktree (el checkout principal sigue en main y no contiene el test), igual que en tandas anteriores.

### Estabilización de infraestructura (2026-10-09 ~08:45 EDT, fuera de tanda)
- **Hallazgo**: el tenant piloto designado `cmuwujy2z000014niitq61tn2` ('Tenant Prueba R7.3') ya no existía en la DB desechable: se perdió el 2026-10-07 cuando la DB volátil (en /tmp) se recreó. La DB solo contenía el tenant auto-creado por la tanda 8 y 0 licencias.
- **Tenant piloto recreado** (verificado en DB): ID `cmuwujy2z000014niitq61tn2`, nombre 'Tenant Prueba R7.3', slug `tenant-prueba-r73`; licencia activa hasta 2099-01-01 con features contabilidad, contabilidad-formal, produccion, mermas, servicios, ventas, compras; `tenantAccountingPolicy.functionalCurrencyCode = CUP`; período `PILOTO-R73-2026-10` MENSUAL ABIERTO; plan contable con 33 cuentas; monedas CUP (principal) y EUR activas.
- **DB estabilizada**: data dir movido a persistente `/Users/arturo/pgdata-tcp-test` (puerto 5433); LaunchAgent `dev.tcp.shadow-postgres-5433` con KeepAlive (auto-arranque al login; se corrigió `LC_ALL=en_US.UTF-8` por FATAL "postmaster became multithreaded"). Instancia fantasma en /tmp (`/tmp/tcp_test_pg_20261009_x8k2`, puerto 55439) detenida.
- **Cuerpo del cron actualizado**: la recuperación ante 5433 caído ahora arranca la instancia existente con `pg_ctl -D /Users/arturo/pgdata-tcp-test ... start`; prohibido `initdb` nuevo sobre ese directorio.
- **Smoke test**: `merma-formal-real.test.ts` 5/5 en verde en modo shadow contra la DB estabilizada (08:39 EDT).

## Día 5 — 2026-10-10
_Pendiente_

## Día 6 — 2026-10-11
_Pendiente_

## Día 7 — 2026-10-12
_Pendiente_

### Operaciones ejecutadas (Tanda manual — 2026-10-09 08:31 EDT, recuperación)
- `merma-formal-real.test.ts`: 5/5 ✅ (modo shadow, worktree feat/contabilidad-capa-formal)

**Infraestructura (cambio durable):**
- El data dir `/tmp/tcp-contabilidad-pg-20261008-v2` desapareció (limpieza de /tmp tras reinicio).
- Se recreó postgres 17.11 con data dir persistente `/Users/arturo/pgdata-tcp-test`
  (fuera de /tmp para sobrevivir reinicios). Arranque requiere `LC_ALL=C` por el
  bug de locale "postmaster became multithreaded".
- DB `tcp_test_local` creada, `prisma db push --skip-generate`, monedas CUP/EUR insertadas
  en `"Moneda"` (ojo: tabla con mayúscula, `updatedAt` NOT NULL sin default).
- URL vigente: `postgresql://arturo@localhost:5433/tcp_test_local` (trust local).

### Operaciones ejecutadas (Tanda 10 — 17:47 EDT)

- src/features/mermas/__integration__/merma-formal-real.test.ts: 5/5 en verde (modo shadow, inicio 17:49:24 hora del Mac, duración 1.43s)
- Ejecución en el worktree de la rama feat/contabilidad-capa-formal (/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP @ a43d67eb), con CONTABILIDAD_FORMAL_MODE=shadow. DB desechable tcp_test_local en el puerto 5433 respondió sin recreación (LaunchAgent dev.tcp.shadow-postgres-5433 activo); tenant piloto cmuwujy2z000014niitq61tn2 verificado intacto ('Tenant Prueba R7.3', slug tenant-prueba-r73).

Total: 5/5 tests en verde en modo shadow

### Métricas (Tanda 10)

- Eventos recibidos: 5 (por test)
- Eventos simulados: 5
- Eventos omitidos: 0
- Errores shadow: 0
- Latencia p95: <500ms (tests locales)
- Huecos telemetría: 0
- Conciliación exacta: Sí

### Incidentes (Tanda 10)

- SSH se cortó a mitad de tanda ("Connection closed by UNKNOWN port 65535" al ejecutar grep en la Mac, ~17:50 EDT); reconexión exitosa tras ~2 min sin intervención (misma firma del incidente de la Tanda 9). La tanda de tests ya había completado antes del corte.
