# Observación shadow de aislamiento tenant en Railway

## Objetivo

Mantener `TENANT_ISOLATION_MODE=shadow` en producción durante al menos siete días y
confirmar cero violaciones inesperadas antes del gate P-1. Shadow solo observa: no
modifica consultas ni bloquea operaciones.

## Activación

1. Desplegar primero el servicio web en staging con
   `TENANT_ISOLATION_MODE=shadow` y ejecutar los smoke tests críticos.
2. Corregir cualquier violación o regresión detectada en staging.
3. En Railway, añadir `TENANT_ISOLATION_MODE=shadow` al servicio web de producción.
4. Desplegar una nueva versión y confirmar en `/api/health` que la aplicación responde.
5. Iniciar el período de observación cuando todas las réplicas ejecuten el despliegue.

Si staging no tiene un servicio web equivalente, se debe crear y validar antes de iniciar
la ventana formal de producción. No se considera cumplido AS-04 T3 solo con la base de
datos de staging.

No activar `enforce` durante esta etapa. El rollback operativo consiste en cambiar la
variable a `off` y redesplegar; no requiere revertir datos ni migraciones.

## Fuentes de evidencia

Railway Logs es la fuente agregada entre réplicas mientras los eventos permanezcan
dentro de la retención del plan. Buscar diariamente el prefijo exacto:

```text
[tenant-isolation]
```

Cada línea contiene JSON con `kind`, `model`, `operation` y `mode`. El reporte no
incluye identificadores de usuario, tenant ni payloads.

El endpoint `GET /api/ops/tenant-isolation-violations` permite inspección inmediata con
cookie o Bearer JWT de un administrador de plataforma. Responde `Cache-Control:
no-store` y expone un máximo de 500 eventos recientes de la instancia que atiende la
solicitud. `scope=single-instance` e `instanceId` evitan confundir este buffer con el
reporte global. Reinicios y balanceo pueden cambiar o vaciar ese buffer; por eso no
reemplaza Railway Logs.

Exportar diariamente los resultados a almacenamiento privado y durable, con rango UTC,
deployment ID y replica ID. La evidencia debe anotar cualquier período sin ingestión,
reinicio, rate limit o descarte. No asumir que la retención del plan conserva por sí sola
los siete días completos.

## Criterio del gate P-1

Al finalizar siete días continuos, recopilar:

- fecha/hora inicial y final del despliegue shadow;
- despliegue y réplicas observadas;
- exportaciones diarias con cobertura continua y retención verificada;
- conteo por `kind`, `model` y `operation` desde Railway Logs;
- clasificación y resolución de cada violación encontrada;
- confirmación de cero violaciones inesperadas pendientes.

Solo después de presentar ese reporte y obtener aprobación explícita se puede iniciar
AS-06 y cambiar a `TENANT_ISOLATION_MODE=enforce`. Si aparece una violación inesperada,
corregirla, desplegar de nuevo y reiniciar la ventana de siete días.
