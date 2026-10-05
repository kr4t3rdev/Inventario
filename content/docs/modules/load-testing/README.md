# Pruebas de Carga (Load Testing)

> Suite de pruebas de rendimiento y resistencia del sistema TCP con k6, métricas en vivo en Prometheus/Grafana y tenant demo aislado. Existe para conocer los límites reales del server antes de que los descubran los usuarios.

## Qué hace

Ejercita el flujo del POS (login, turno activo, catálogo) contra el TCP desplegado en producción en el server homelab, generando carga desde la Mac con k6. Mide latencia por percentiles, tasa de errores, consumo de memoria y conexiones de base de datos, y envía todo en vivo a Prometheus para verlo en Grafana durante la corrida.

Cada tipo de prueba responde una pregunta distinta:

| Prueba | Pregunta | Script |
|---|---|---|
| Smoke | ¿El flujo funciona? | `smoke.load.js` |
| Rampa | ¿Hasta cuántos cajeros escala sin degradarse? | `pos-rampa.load.js` |
| Spike | ¿Qué pasa con una ráfaga de golpe y se recupera? | `spike.load.js` |
| Soak | ¿Tiene fugas o se degrada en horas de uso? | `soak.load.js` |
| Público | ¿El despliegue responde sin sesión? | `publico.load.js` |

## Qué incluye

- Scripts k6 con autenticación real (Bearer + cookies de sesión extraídas del `Set-Cookie`, porque la cookie `Secure` no viaja por HTTP plano).
- Wrapper `./k6run` que carga el `.env` del directorio con las credenciales del tenant demo.
- Tenant demo aislado (plan Profesional) con punto de venta propio: las pruebas no tocan datos reales.
- Infraestructura de observabilidad: remote-write de k6 a Prometheus, dashboards de k6, PostgreSQL y Node Exporter en Grafana.
- Umbrales de calidad que rompen la corrida si se cruzan (`p95 < 800ms`, errores `< 1%`, cero fallos de login).

## Cuándo usarlo

- Antes de liberar un cambio que afecte ventas, catálogo o autenticación.
- Al cambiar infraestructura del server (RAM, contenedores, red).
- Cuando el sistema "se siente lento" y hace falta un número objetivo.
- Al investigar si existe fuga de memoria (la soak de 2 horas es la herramienta para eso).

## Reglas importantes

- **Nunca medir contra `next dev`**: infla la latencia 5-10x. Siempre build de producción (`systemctl --user restart tcp` en el server).
- **El k6 corre en la Mac, no en el server**: la máquina bajo prueba no debe competir por CPU con el generador.
- **Detener `uptime_kuma` en campañas largas**: tiene un leak de ~4.5GB que desestabiliza el server.
- **El login tiene un techo por diseño**: bcrypt limita a ~30-80 logins/s en 8 cores. Ráfagas de login masivo no son un bug de la app.
- **El catálogo POS exige stock por ubicación** (`StockUbicacion` en cada PV): sin eso la prueba mide una lista vacía.

## Qué conviene cuidar

- Si los errores se concentran en una ventana de un minuto, probablemente es un flap de la red, no de la app: cruzar con el dashboard de Node Exporter antes de culpar al código.
- p95 subiendo con la carga pero RPS estancado = CPU saturada del proceso Node.
- Errores 500 en login con la DB accesible: revisar `app.log` en el server; históricamente fueron P2002 (tokens duplicados, ya corregido con `jti`).
- La licencia del tenant demo expira (revisar `expiresAt`); recrearlo con el comando del registro de auditoría si caduca.

## Resultados medidos (2026-10-05)

| Régimen | Límite del server |
|---|---|
| Operación sostenida (30 cajeros, 2h) | p95 91ms plano, sin fugas, 0 muertes |
| Catálogo POS | ~120 req/s de tope (0 errores, encola sin caer); ~60 req/s cómodo |
| Rampa 200 VUs | aguanta con p95 1.3s (CPU saturada) |
| Login | ~30-80/s (bcrypt, por diseño) |

Registro completo corrida por corrida: `docs/auditoria-load-testing-2026-10-05.md`.

## Rutas y referencias

- `load-tests/` — scripts, wrapper y README operativo
- `prisma/seed/create-loadtest-demo.ts` — CLI que crea el tenant demo
- `docs/auditoria-load-testing-2026-10-05.md` — registro detallado de todas las corridas
- Server: `~/.config/systemd/user/tcp.service` (app), `deploy-build.sh` (build), `~/postgresql/docker-compose.yml` (DB en 127.0.0.1)
- Grafana: `http://169.254.238.192:3000` (dashboards k6 Prometheus, PostgreSQL, Node Exporter)

## En una frase

Un arsenal de pruebas k6 con observabilidad completa que ya midió los límites del server (120 req/s de POS, 91ms sostenidos) y detecta regresiones antes de que lleguen a los cajeros.
