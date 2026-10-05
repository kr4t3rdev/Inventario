# Load testing de TCP

Suite de pruebas de carga con [k6](https://k6.io) para el sistema TCP, apuntando a la instancia desplegada en el servidor Linux local. Las métricas fluyen en vivo a Prometheus/Grafana del servidor.

## Arquitectura

```
TU MAC (generador)                      LINUX 169.254.238.192 (bajo prueba)
┌─────────────────┐  carga HTTP         ┌────────────────────────────────────┐
│ k6               │ ───────────────────→ │  TCP (app Next.js) ──→ PostgreSQL  │
│                 │                      │  Prometheus :9090                   │
│ métricas k6      │  remote-write        │   ├── node_exporter (CPU/RAM)       │
│                 │ ───────────────────→ │   └── postgres_exporter (DB)        │
└─────────────────┘                      │  Grafana :3000                      │
                                         └────────────────────────────────────┘
```

La carga se genera desde la Mac, nunca desde el servidor: la máquina bajo
prueba no debe competir por CPU con el generador.

## Infraestructura ya configurada en el servidor

- Prometheus con `--web.enable-remote-write-receiver` (receptor de métricas de k6).
- `postgres_exporter` conectado a `homelab_postgres` (PostgreSQL 17.10) con rol de solo monitoreo `postgres_exporter`.
- Dashboards en Grafana (`http://169.254.238.192:3000`):
  - **k6 Prometheus** → `/d/ccbb2351-2ae2-462f-ae0e-f2c893ad1028/k6-prometheus`
  - **PostgreSQL Database** → `/d/000000039/postgresql-database`
  - **Node Exporter Full** → `/d/rYdddlPWk/node-exporter-full`
- Backups de la configuración previa en `/home/kr4t3rdev/prometheus/*.bak.*`.

## Preparación (una sola vez, cuando la app esté desplegada)

1. **Despliegue en modo producción**: `pnpm build && pnpm start` con
   `NODE_ENV=production`. Nunca medir contra `pnpm dev` (HMR/Turbopack
   infla la latencia 5-10x).
2. **Crear tenant demo**: iniciar sesión como admin → `/admin/licencias` →
   crear demo con plan **Enterprise** (seed con +50 productos y 2 almacenes,
   el catálogo del POS queda con datos reales). Anota las credenciales.
3. **Crear usuario cajero** dentro del tenant demo con permisos de POS.
4. **Obtener el `PV_ID`**: el seed Enterprise crea puntos de venta; copia su ID
   desde la administración de puntos de venta del tenant.
5. **Completar `.env`**: `cp .env.loadtest.example .env` y llenar
   `BASE_URL`, `EMAIL`, `PASSWORD`, `PV_ID`.

## Ejecución

Ejecutar siempre desde este directorio con el wrapper `./k6run` (carga `.env`
automáticamente; k6 v2 ya no lo hace por sí solo):

```bash
export K6_PROMETHEUS_RW_SERVER_URL=http://169.254.238.192:9090/api/v1/write
export K6_PROMETHEUS_RW_TREND_STATS="p(95),p(99),avg"

# 0. Público: páginas sin autenticación (valida despliegue, línea base SSR)
BASE_URL=http://169.254.238.192:3002 ./k6run --out experimental-prometheus-rw publico.load.js

# 1. Smoke: 1 VU durante 30s — valida el flujo y mide la línea base
./k6run --out experimental-prometheus-rw smoke.load.js

# 2. Rampa: sube gradualmente hasta 200 VUs (ajustable)
./k6run --out experimental-prometheus-rw pos-rampa.load.js
MAX_VUS=500 ./k6run --out experimental-prometheus-rw pos-rampa.load.js

# 3. Pico: 300 RPS de golpe (ajustable)
./k6run --out experimental-prometheus-rw spike.load.js
RPS=600 ./k6run --out experimental-prometheus-rw spike.load.js

# 4. Resistencia: 30 VUs durante 2 horas (detecta fugas de memoria)
./k6run --out experimental-prometheus-rw soak.load.js
VUS=50 DURATION=4h ./k6run --out experimental-prometheus-rw soak.load.js
```

Sin Prometheus, cualquier script corre igual (solo pierdes los dashboards en vivo):

```bash
./k6run smoke.load.js
```

## Flujo que ejercita cada VU

1. **Login** una sola vez por VU (`POST /api/auth/login`), sesión reutilizada
   por cookie jar — como un cajero real que inicia turno.
2. **Turno activo** (`GET /api/ventas/punto-venta/{pvId}/turno-activo`).
3. **Catálogo POS** (`GET /api/ventas/punto-venta/{pvId}/productos`), con lista
   de precios del cliente si `CLIENTE_ID` está configurado.
4. Tiempo de pensamiento pseudo-aleatorio entre 1 y 3 segundos.

La creación de ventas vive en Server Actions y no es accesible por HTTP puro;
la fase de escritura (hot path transaccional con motor de precios) requiere una
ruta API dedicada; se diseñará por separado.

## Qué observar y cómo interpretar

| Señal | Dónde | Qué significa |
|---|---|---|
| `k6_http_req_duration_p95` | Dashboard k6 Prometheus | Latencia percibida por los cajeros |
| `k6_http_req_failed_rate` | Dashboard k6 Prometheus | Errores HTTP (sesiones, 5xx) |
| Conexiones PostgreSQL activas | Dashboard PostgreSQL Database | Saturación del pool de Prisma |
| CPU / RAM del servidor | Dashboard Node Exporter Full | Saturación del proceso Node |
| Tendencia creciente de latencia en soak | Dashboard k6 | Fuga de memoria o degradación lenta |

Cuellos de botella típicos en orden de probabilidad:

1. **Pool de conexiones Prisma agotado**: los 5xx crecen, el dashboard de
   PostgreSQL muestra conexiones al límite. Se resuelve con `connection_limit`
   en `DATABASE_URL` o PgBouncer.
2. **CPU del proceso Node saturada**: la latencia p95 crece con la carga,
   RPS se estanca. Revisar queries N+1 y carga del catálogo.
3. **PostgreSQL**: `pg_stat_activity` con muchas queries `active` sostenidas.

## Advertencias

- **La app corre como servicio systemd** (`systemctl --user status tcp` en el
  server): se auto-reinicia sola. Logs en `app.log`. Relanzarla a mano ya no es
  necesario; tras un build nuevo basta `systemctl --user restart tcp`.
- **Flaps de LAN**: al caer el enlace, `homelab_postgres` pierde su binding
  `169.254.238.192:5432` (recuperación: `cd ~/postgresql && docker compose up -d`)
  y la app arroja 500 en login hasta que la DB vuelva. El servicio systemd
  mantiene la app viva; verificar el login tras cualquier flap.
- **Homelab compartido**: el servidor corre Immich, Nextcloud y Plausible.
  Sus picos de CPU contaminan mediciones. Revisar el dashboard Node Exporter
  antes de cada corrida y, de ser posible, pausar `immich_machine_learning`
  durante campañas. `uptime_kuma` presentó un leak de ~4.5GB: mantenerlo
  detenido durante pruebas largas (`docker stop uptime_kuma`).
- **Pool de Prisma**: bajo cargas altas se observaron errores transitorios de
  conexión en logins concurrentes. Si la soak o pruebas mayores aumentan los
  500, subir `connection_limit` en `DATABASE_URL` (o usar PgBouncer).
- **Crons**: pausar los crones del sistema (demos, backups) durante la ventana
  de pruebas o anotar su hora para filtrar en Grafana.
- **Dirección link-local**: `169.254.x.x` no es rutable y depende del enlace
  directo Mac↔servidor. Si la IP cambia al reiniciar la interfaz, actualizar
  `BASE_URL` y `K6_PROMETHEUS_RW_SERVER_URL`.
- **Puerto 5432 expuesto solo al enlace directo** (bind a la link-local).
  Para endurecer, ejecutar en el servidor con sudo:

  ```bash
  sudo ufw allow from 169.254.238.50 to any port 5432 proto=tcp  # IP de la Mac
  sudo ufw deny 5432/tcp
  ```

  (Sustituir por la IP link-local real de la Mac: `ipconfig getifaddr en0` o
  la que use el enlace directo.)

## Umbrales (thresholds)

Los scripts fallan (exit code != 0) si:

- Tasa de error HTTP > 1% (> 5% en pico).
- p95 de latencia > 800ms (p99 > 3000ms en pico).
- Algún login falla.

Ajustar los umbrales en `lib/helpers.js` (`umbralesBase`) según la línea base
real medida con el smoke test antes de usarlos como gate en CI.
