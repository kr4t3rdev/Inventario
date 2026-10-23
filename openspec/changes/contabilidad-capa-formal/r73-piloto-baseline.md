# R7.3 — Línea base del piloto (pre-inicio)

**Fecha/hora:** 2026-10-09 09:15 EDT (13:15 UTC)
**Método:** transacción `BEGIN READ ONLY ... COMMIT` (solo lectura, sin modificar filas de negocio)

## Infraestructura (evidencia, sin secretos)
- Servidor: MacBook Pro del responsable, PostgreSQL 17.11 (Homebrew)
- Data dir: `/Users/arturo/pgdata-tcp-test` (persistente, fuera de /tmp)
- Puerto 5433, escuchando **solo** en `127.0.0.1` y `::1` (verificado con `lsof -i :5433`)
- Arranque: LaunchAgent `dev.tcp.shadow-postgres-5433` con `KeepAlive`
- DB: `tcp_test_local`, usuario `arturo` (trust local)

## Estado del tenant piloto `cmuwujy2z000014niitq61tn2`
| Elemento | Valor |
|---|---|
| Nombre / slug | Tenant Prueba R7.3 / tenant-prueba-r73 |
| Licencia | activa, expiración 2099-01-01, features: contabilidad, contabilidad-formal, produccion, mermas, servicios, ventas, compras |
| Policy contable | `functionalCurrencyCode = CUP` |
| Período | `PILOTO-R73-2026-10`, MENSUAL, ABIERTO |
| Cuentas contables | 33 |
| Asientos | 0 |
| Filas en `shadow_posteo_outbox` | 0 (sin eventos: aún no hay operaciones) |

## Puerta de inicio (runbook-r73-shadow.md)
1. ✅ Servidor dedicado confirmado: instancia persistente, solo local. **No recrear, resetear, migrar ni sembrar esta base para el piloto** a partir de esta línea base.
2. ❌ Sesión real de usuario autenticado del tenant: pendiente — la proporciona el responsable.
3. ❌ Proceso de aplicación en `shadow` verificado y aislado: pendiente — no hay proceso de app corriendo; el modo es variable de entorno del proceso servidor.
4. ✅ Línea base de solo lectura: este archivo.
5. ❌ Reloj no iniciado: se inicia al registrar el primer evento durable correlacionado con una operación real y legítima.

## Nota sobre las tandas del cron
Las tandas de `r73-shadow-operations` (tests de integración que se auto-aprovisionan su propio tenant) **no cuentan como tráfico operativo** según el runbook y no hacen avanzar el reloj de 7 días. Siguen siendo evidencia útil de regresión (el modo shadow funciona), pero el gate R7.3 exige operaciones legítimas desde la aplicación autenticada.

## Addendum — usuario piloto (2026-10-09 ~09:35 EDT)
- Usuario piloto-r73@local.invalid (Piloto R7.3), activo, con password hasheado en bcrypt (12 rounds) verificado con bcrypt.compare (mismo mecanismo que el login de la app).
- Membership en el tenant piloto: rol admin, activo. (El seed inicial había creado el usuario sin membership y con password en texto plano; se corrigió antes de cualquier operación.)
