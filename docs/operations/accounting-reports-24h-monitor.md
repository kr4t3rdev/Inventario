# Monitor de reportes contables durante 24 horas

## Objetivo y límites

Este monitor verifica en producción, sin modificar datos, las superficies de Resumen,
Movimientos, exportación CSV/PDF y movimientos por cuenta. Cada ejecución realiza seis
solicitudes `GET`, registra una sola línea JSON y termina.

No es un benchmark de carga. Su objetivo es detectar durante 24 horas errores HTTP,
timeouts, redirecciones inesperadas, degradación de latencia o contratos de contenido
incorrectos. No sustituye el benchmark aislado con datos representativos.

## Variables requeridas

Configurar como secretos del servicio cron de Railway, nunca en el repositorio:

- `REPORT_MONITOR_BASE_URL`: URL pública HTTPS, por ejemplo `https://app.example.com`.
- `REPORT_MONITOR_AUTH_COOKIE`: cabecera Cookie completa de una sesión exclusiva de
  monitoreo, con permisos mínimos y caducidad limitada.
- `REPORT_MONITOR_ACCOUNT_ID`: identificador de una cuenta del mismo tenant de la sesión.
- `REPORT_MONITOR_TIMEOUT_MS`: opcional, entre 500 y 30000; por defecto 8000.
- `REPORT_MONITOR_RUN_UNTIL`: instante ISO UTC que cierra la ventana. Después de esa fecha,
  cada ejecución termina correctamente sin enviar solicitudes.

La salida no incluye la cookie, el tenant ni el identificador de cuenta. No se debe reutilizar
una sesión personal o administrativa. Revocar la sesión al cerrar la ventana de observación.

## Prueba local sin secretos persistidos

```bash
REPORT_MONITOR_BASE_URL='https://host' \
REPORT_MONITOR_AUTH_COOKIE='nombre_cookie=valor' \
REPORT_MONITOR_ACCOUNT_ID='cuenta' \
REPORT_MONITOR_RUN_UNTIL='2026-09-04T00:00:00.000Z' \
pnpm exec tsx scripts/ops/accounting-reports-monitor.ts
```

El proceso termina con código `0` si todos los contratos pasan y `1` si una comprobación
falla. Cada resultado contiene `status`, `latencyMs`, `contentType`, `bytes` y un código de
error estable cuando corresponda.

## Configuración propuesta en Railway

Crear un **servicio cron separado** apuntando al mismo commit de la aplicación. No cambiar
el comando del servicio web.

- Start command: `pnpm exec tsx scripts/ops/accounting-reports-monitor.ts`
- Cron schedule: `*/15 * * * *` (cada 15 minutos, UTC)
- Duración: 24 horas, equivalentes a 96 ejecuciones previstas
- Restart policy: no reiniciar al terminar correctamente

Railway inicia el servicio según la expresión cron. Por eso el script debe ejecutar una sola
muestra y finalizar; no contiene bucles ni temporizadores de 24 horas. Railway no desactiva
automáticamente el cron al completar 24 horas: se debe deshabilitar manualmente al cumplirse
la ventana y revocar la sesión de monitoreo.

## Operación

1. Crear una sesión exclusiva de monitoreo con acceso de solo lectura a contabilidad.
2. Verificar manualmente una ejecución antes de habilitar el cron.
3. Habilitar el cron y registrar hora UTC inicial y commit desplegado.
4. Revisar los logs estructurados durante la ventana. Una ejecución con `ok:false` requiere
   revisar el `errorCode` y el check afectado.
5. Al completar 24 horas, deshabilitar el cron y revocar la sesión.
6. Exportar las 96 líneas JSON y calcular por check: disponibilidad, p50, p95, máximo,
   número de timeouts, errores HTTP y contratos de contenido inválidos.

## Umbrales del gate

- Disponibilidad de cada check: 100 % durante la ventana controlada.
- Cero `TIMEOUT`, `HTTP_ERROR`, `UNEXPECTED_CONTENT_TYPE` y `UNEXPECTED_BODY`.
- p95 recomendado para endpoints JSON: menor de 800 ms.
- Cualquier redirección 3xx se considera fallo para detectar sesiones vencidas o pérdida de
  autenticación.

## Rollback operativo

Deshabilitar el cron no afecta al servicio web ni a la base de datos. Si genera carga no
prevista, deshabilitarlo inmediatamente y revocar la sesión. El monitor solo usa `GET`, limita
las consultas de listado a 10 elementos y nunca ejecuta migraciones ni escrituras.

`REPORT_MONITOR_RUN_UNTIL` evita solicitudes fuera de la ventana, pero no elimina el servicio
cron. El servicio debe deshabilitarse manualmente para no acumular ejecuciones omitidas.
