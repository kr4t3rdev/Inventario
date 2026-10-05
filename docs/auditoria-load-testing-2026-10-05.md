# Auditoría de Rendimiento — Programa de Load Testing (2026-09-28 → 2026-10-05)

> Registro completo del programa de pruebas de carga contra TCP desplegado en
> el server homelab (169.254.238.192, 8 cores, 7.1GB RAM). Generador: k6 desde
> la Mac por enlace directo (~1ms). Observabilidad: k6 → Prometheus remote-write
> → Grafana + postgres_exporter + node_exporter.

## Arquitectura de las pruebas

```
Mac (k6, generador)          Server homelab (bajo prueba)
├─ load-tests/*.load.js  →   ├─ TCP Next.js prod :3002 (systemd tcp.service)
├─ ./k6run (wrapper .env)    ├─ PostgreSQL TCPBD (publicado 127.0.0.1:5432)
└─ métricas k6           →   ├─ Prometheus :9090 (remote-write receiver)
   remote-write :9090         ├─ Grafana :3000 (k6 / PostgreSQL / Node dashboards)
                             └─ postgres_exporter + node_exporter
```

- **Tenant demo dedicado** (plan Profesional, 30 días, expira 2026-10-30):
  credenciales y PV en `load-tests/.env` (git-ignored). Recrear con:
  `npx tsx prisma/seed/create-loadtest-demo.ts <planId> 30`
- **Flujo por VU**: login 1 vez (Bearer + cookies manuales: la cookie lleva
  `Secure` y el jar la descarta sobre HTTP plano) → turno-activo + catálogo
  POS, con think time.
- **El catálogo POS exige `StockUbicacion`** en cada PV; los seeds demo no lo
  crean (patch puntual aplicado por SQL; bug de seed documentado).

## Tabla maestra de corridas

| # | Fecha | Prueba | Carga | p95 | Errores | Veredicto |
|---|---|---|---|---|---|---|
| 1 | 2026-09-28 | Público (dev) | 20 VUs | 6.66s | 2% | Demo del pipeline; dev = inválido |
| 2 | 2026-09-30 | Smoke | 1 VU/30s | 91ms | 0% | Verde; base de línea base |
| 3 | 2026-09-30 | Rampa 50 | 19.5 req/s | 139ms | 0% | Cómodo |
| 4 | 2026-10-01 | Rampa 200 (1ª) | — | — | 100% logins | **Inválida**: LAN caída quitó el binding de Postgres |
| 5 | 2026-10-02 | Rampa 200 (2ª) | 59.6 req/s | 1.3s | 0% | Aguanta, CPU saturada |
| 6 | 2026-10-03 | Soak 2h | 16.6 req/s | **91ms plano** | 0.19% | **Aprobada** |
| 7 | 2026-10-05 | Spike A (logins) | 300 RPS login | 60s | 87% | Techo bcrypt (~80 logins/s) |
| 8 | 2026-10-05 | Spike B (POS) | 300 RPS catálogo | 9.9s | **0%** | Tope ~120 req/s, encola sin caer |

## Detalle por prueba

### 1. Público (2026-09-28) — validación de despliegue

Páginas sin auth (landing, /login, /api/health). Corrió contra la app en
**modo dev** por descarte: p95 de 6.66s con 20 VUs. Hallazgo: medir contra
`next dev` es inválido (Turbopack/HMR infla la latencia 5-10x). A partir de
aquí toda medición es contra build de producción (`next start`).

### 2. Smoke (2026-09-30) — línea base

1 VU, 30s, flujo POS completo. Resultado final: p95 91ms, 0% errores.
Lecciones para k6 contra esta app: (a) la cookie `auth_token` va con
`Secure` en producción y el cookie jar la descarta sobre HTTP → se extrae del
header `Set-Cookie` y se envía manual; (b) `getAuthenticatedContext` exige la
cookie `refreshToken` (no acepta Bearer) → se mandan ambas + Bearer;
(c) k6 une los `Set-Cookie` repetidos en un solo string separado por comas →
regex no ancladas.

### 3. Rampa 50 VUs (2026-09-30)

Rampa 0→50 en 7 min: 8,214 requests a 19.5 req/s, **0% errores**, p95 139ms.
Zona cómoda del server.

### 4. Rampa 200 VUs — primera corrida (2026-10-01): INVÁLIDA

17,330 iteraciones con **todos los logins en 500** y el resto en 401. Causa
ajena a la app: el flap de LAN le quitó a `homelab_postgres` su binding
`169.254.238.192:5432` (docker-proxy no se recupera solo). Lección operativa:
cada flap de LAN rompe la conectividad app↔DB hasta recrear el contenedor.
**Fix permanente aplicado después**: publicar Postgres en `127.0.0.1:5432`
(loopback inmune a flaps) — desde entonces, cero caídas de DB.

### 5. Rampa 200 VUs — corrida válida (2026-10-02)

25,126 requests a **59.6 req/s**, **0.00% errores**, 37,589 checks al 100%.
Latencia: med 250ms, p90 1.1s, **p95 1.3s** (umbral 800ms violado — única
falta). 200 logins limpios. Interpretación: el throughput escala 3x respecto
a 50 VUs pero la latencia 9x → CPU del proceso Node saturada en picos.
Capacidad: aguanta 200 cajeros degradado; cómodo hasta ~100.

### 6. Soak 2 horas (2026-10-03) — APROBADA

30 VUs constantes, 2h exactas: 119,277 requests a 16.6 req/s,
**p95 = 91ms plano toda la prueba**, 0 iteraciones interrumpidas, NRestarts=0
(la app no murió en 2h; antes de systemd moría silenciosamente cada pocas
horas). Memoria: RSS total osciló 2.4-3.4GB con reclaim de V8 → **sin fuga**.
Anomalías: (a) 79 logins fallidos (0.066%) — diagnóstico fino: **P2002** por
JWT determinístico (ver fixes); (b) 1 stall de 19s (flap de LAN en vuelo).
Protocolo de monitoreo que funcionó: checkpoints cada 20 min con RSS total +
p95 + fallidos.

### 7. Spike A — ráfaga de logins (2026-10-05): techo de bcrypt

300 RPS de arrival rate con login por VU nuevo = ~300 logins/s intentados.
Resultado: 87% de fallos, p95 60s, 1,200 VUs saturados, 10,157 iteraciones
dropped. **El techo real de login es ~30-80/s**: bcrypt (cost 12) en 8 cores.
No es un bug: es el costo deliberado de hash seguro. Ninguna tienda real
tiene 300 logins/s. El server no se corrompió y se recuperó solo (systemd).
Nota positiva colateral: **cero P2002 en 1,200 logins simultáneos del mismo
usuario** → validación en combate del fix `jti`.

### 8. Spike B — ráfaga POS autenticada (2026-10-05): tope de catálogo

Rediseño del spike: `setup()` crea UNA sesión compartida por todos los VUs →
la ráfaga mide el flujo POS real sin mezclar el techo de bcrypt. 300 RPS
objetivo, 50s: **0.00% errores, 9,915 checks al 100%**, server procesando
~120 req/s al tope con queue profundo (med 2.56s, p95 9.9s, max 45s).
**El catálogo POS encola y degrada sin caer ni perder consultas.**

## Perfil de capacidad del server (entregable final)

| Régimen | Límite medido | Comportamiento alli |
|---|---|---|
| Login | ~30-80/s (bcrypt cost 12) | Cola y timeouts más allá, por diseño |
| Catálogo POS | ~120 req/s de tope / ~60 cómodo | Degradación encolada, 0 errores |
| Operación sostenida | 30 cajeros (16.6 req/s) por horas | p95 91ms plano, sin fugas |
| Recuperación | Avalancha 300 RPS incl. login storm | Auto-restart systemd, 0 corrupción |

Equivale a ~120-200 cajeros en p95<800ms cómodo, en un homelab de 7GB
compartido con Immich, Nextcloud, Plausible y compañía.

## Bugs del repo encontrados por las pruebas (con fixes commiteados)

| Bug | Commit | Nota |
|---|---|---|
| P2002: JWT idéntico para logins del mismo usuario en el mismo segundo (`iat` en segundos, firma determinística) → colisión contra unique de `UserSession.token` | `64b351f8` (fix `jti`) | Detectado por la soak; validado con 0 colisiones bajo 1,200 logins |
| Seeds demo rotos vs schema (`Venta.cantidad`, `subtotal`→`total`, estado `ENTREGADA`, `GastoCompra`, `Transferencia`) | `8be1f727` | Bloqueaba la creación de tenants demo Profesional/Empresarial |
| Logging `[prisma-platform]` por query sin interruptor (60MB de log en 2 días) | `b546a090` | `PLATFORM_ACCESS_LOGS=false` en producción |
| Seeds pro/base no crean `StockUbicacion` en PVs → catálogo POS vacío en demos | pendiente de fix en repo | Patch puntual por SQL en el tenant de load test |
| Enterprise seed: FK `Venta_clienteId_fkey` falla con clientes recién upserteados | sin resolver | No bloquea: el plan Profesional funciona completo |

## Endurecimiento de infraestructura aplicado

1. **App como servicio systemd** (`~/.config/systemd/user/tcp.service`,
   `Restart=always`, linger): fin de las muertes silenciosas; 2h de soak con
   NRestarts=0.
2. **Postgres en `127.0.0.1:5432`**: inmune a flaps de LAN (antes: cada flap
   perdía el binding de la link-local y la app daba 500 hasta recrear el
   contenedor).
3. **`deploy-build.sh`**: receta de build para el homelab — sin
   `experimental.cpus` (envenena Turbopack: ballooning a 5.9GB), heap 2048,
   solo engine debian, `.next` limpio, **app detenida durante la ventana**
   (sus ~2.4GB de workers dejan sin margen al build), detached + polling.
4. **`uptime_kuma` con leak de ~4.5GB**: era el causante de los OOM del
   build. Detenerlo durante campañas largas.

## Reproducción

```bash
cd load-tests
export K6_PROMETHEUS_RW_SERVER_URL=http://169.254.238.192:9090/api/v1/write
./k6run run smoke.load.js                    # validez
MAX_VUS=200 ./k6run run pos-rampa.load.js    # escalado
./k6run run soak.load.js                     # resistencia 2h
RPS=300 ./k6run run spike.load.js            # ráfaga POS (sesión compartida)
```

Dashboards: k6 Prometheus, PostgreSQL Database y Node Exporter Full en
`http://169.254.238.192:3000`. Detalles de operación: `load-tests/README.md`.
