# R7.3 — Piloto Operativo Shadow (7 Días)

**Estado: PENDIENTE, NO INICIADO (actualizado 2026-10-11).** Ante la alternativa que
planteó el usuario, se conserva A9/Shadow pendiente como opción conservadora, no descartado
ni eximido. La ventana de siete días no comenzó. El Preview aislado terminó en
`ERROR/ENOENT` antes de completar las validaciones, por lo que no existe resultado verificable
de build/tests. El scope de despliegue cloud está suspendido: no realizar nuevos intentos ni
apagar los recursos Railway existentes sin una autorización específica.

Este runbook no habilita el modo, no ejecuta operaciones y no certifica cobertura. La
ventana solo comienza cuando un responsable
ejecuta operaciones legítimas en la aplicación autenticada y archiva evidencia diaria.
Tests, fixtures, replay y escrituras artificiales no cuentan como tráfico operativo.

## Límites y estado conocido

- `CONTABILIDAD_FORMAL_MODE` es una variable del proceso de servidor, compartida por
  todos los tenants atendidos por ese proceso (`shadow` o `enforce`; cualquier otro
  valor resuelve a `off`). No existe selección por tenant en esa variable.
- El tenant todavía requiere el feature/licencia aplicable como segundo gate. No asumir
  que habilitarlo en un tenant hace que el modo de proceso sea tenant-scoped.
- No se encontró implementada la ruta `GET /api/contabilidad/formal/mode` citada por
  versiones anteriores del runbook. No usarla como prueba. Verificar el modo efectivo
  en la configuración del proceso del servidor local dedicado antes de comenzar; no
  leer ni copiar archivos de secretos para hacerlo.
- `ShadowPosteoOutbox` conserva tenant, tipo de evento, origen, estado, causa, duración
  y `createdAt`. No conserva por sí solo el resultado contable simulado ni evidencia
  que permita certificar conciliación exacta. La conciliación debe quedar respaldada
  por evidencia independiente, no inferirse de un conteo del outbox.
- La consulta documentada abajo es de solo lectura y siempre limita tenant y ventana.
  Nunca ejecutar tests de integración contra los datos del piloto ni consumir/ACKear
  filas del outbox durante esta observación.

## Puerta de inicio — no avanzar si falta alguna

1. Responsable autorizado confirma por separado el servidor local dedicado, conectado
   a la instancia de prueba persistente prevista y escuchando solo localmente. No
   recrear, resetear, migrar o sembrar esa base para este piloto.
2. El responsable confirma una sesión real de usuario autenticado del tenant objetivo
   y los permisos funcionales necesarios. No inventar ni simular identidad, token,
   operación o fixture.
3. Verificar que el proceso está efectivamente en `shadow`, no `off` ni `enforce`, y
   que los demás tenants no recibirán tráfico desde ese proceso. Si no se puede aislar
   el proceso o verificar modo/licencia de forma confiable, **detenerse**: el modo es
   global y no debe activarse a ciegas.
4. Tomar y archivar una línea base de solo lectura del tenant y ventana inmediatamente
   anterior al inicio. No modificar filas de negocio para crear actividad.
5. Iniciar el reloj solo tras registrar el primer evento durable correlacionado con una
   operación real y legítima de la aplicación. Un día sin operaciones observables no
   se declara cubierto ni se rellena con tests.

## Operación y captura diaria

El usuario autorizado opera normalmente desde la aplicación autenticada; el observador
no crea ventas, compras, mermas, conciliaciones ni otros movimientos solo para producir
telemetría. Después de cada intervalo, exportar las filas del período con la consulta
de abajo y conservar la salida sin edición, junto con fecha/hora, responsable, hash del
build, evidencia del modo efectivo y referencias de las operaciones reales. Redactar
datos personales al compartir el informe, sin perder los IDs de correlación necesarios
en el repositorio local protegido.

La consulta incluye `createdAt` (timestamp de persistencia), `tipoEvento`, `origenTipo`,
`origenId`, estado, causa y latencia. Estas son las columnas de procedencia actualmente
disponibles; no equivalen a una marca temporal de origen de negocio ni a un asiento
simulado persistido.

```sql
BEGIN READ ONLY;

-- Reemplazar ambos parámetros con valores aprobados; no quitar los filtros.
SELECT id, "createdAt", "tenantId", "tipoEvento", "origenTipo", "origenId",
       estado, causa, "duracionMs", "entregadoAt"
FROM shadow_posteo_outbox
WHERE "tenantId" = :'tenant_id'
  AND "createdAt" >= :'window_start'::timestamptz
  AND "createdAt" <  :'window_end'::timestamptz
ORDER BY "createdAt", id;

COMMIT;
```

Para resumen por tipo/resultado/causa y p95, consultar dentro de la misma ventana:

```sql
BEGIN READ ONLY;
SELECT "tipoEvento", estado, causa, COUNT(*)::integer AS cantidad,
       percentile_disc(0.95) WITHIN GROUP (ORDER BY "duracionMs") AS "latenciaP95Ms"
FROM shadow_posteo_outbox
WHERE "tenantId" = :'tenant_id'
  AND "createdAt" >= :'window_start'::timestamptz
  AND "createdAt" <  :'window_end'::timestamptz
GROUP BY "tipoEvento", estado, causa
ORDER BY "tipoEvento", estado, causa;
COMMIT;
```

**Precaución:** `:'variable'` es sustitución de `psql`, no sintaxis SQL genérica. Ejecutar
en `psql` con variables definidas explícitamente y el tenant/ventana aprobados; no
poner credenciales en la línea de comandos. `BEGIN READ ONLY` es deliberado.

```text
## Observación diaria — YYYY-MM-DD (UTC)
- Tenant y ventana exacta:
- Responsable / sesión autenticada verificada:
- Build y modo efectivo del proceso (evidencia, sin secretos):
- Operaciones legítimas observadas y referencias de correlación:
- Eventos por tipo y estado (adjuntar export crudo):
- Errores/omitidos y causa:
- p95 por tipo/estado (no combinar eventos heterogéneos):
- Gaps frente a operaciones reales esperadas (no inferir de cero filas):
- Conciliación exacta: PENDIENTE hasta tener evidencia independiente comparable:
- Incidentes / decisión de continuar:
```

## Criterio de cierre

R7.3 sigue abierto hasta reunir al menos siete días consecutivos con modo comprobado,
actividad real representativa, outbox correlacionado por tenant/origen, errores
explicados, latencia aceptable y cobertura reconciliada independientemente. No declarar
`0` errores, `0` gaps o conciliación `100%` a partir de ventanas vacías. Cualquier día
sin evidencia suficiente reinicia o extiende la ventana según decisión del responsable.
La promoción a `enforce` requiere aprobación y gates separados; este runbook no la
autoriza.

## Falta para poder ejecutar

No se dispone en esta preparación de evidencia verificable de un servidor de aplicación
local ya conectado al piloto, modo efectivo aislado, sesión autenticada del usuario ni
operaciones legítimas que deban realizarse. Sin esos elementos el paso correcto es
mantener el piloto sin iniciar y pedir al responsable que los proporcione/ejecute; no
fabricar actividad, credenciales, endpoint de estado ni mecanismos de habilitación.

## Addendum A9 — preparación de captura y diagnóstico de etiqueta (2026-10-09)

Captura acotada del outbox del tenant piloto: `localA9-outbox-2026-10-09T141211Z.csv`.
Se ejecutó como transacción PostgreSQL `READ ONLY`, contra `tcp_test_local` en
`127.0.0.1:5433`, con tenant explícito `cmuwujy2z000014niitq61tn2`, desde
`2026-10-09T00:00:00Z` hasta el timestamp de captura. El artefacto contiene solo
metadatos y agregados por tipo de evento, origen, estado y causa; no exporta payloads,
identificadores de origen ni datos personales. La captura fue `NO_ROWS` (cero eventos),
por lo que los desgloses y duraciones por dimensión no están medidos. Esto no demuestra
cobertura, ausencia de gaps, continuidad de siete días ni conciliación exacta.

El artefacto registra captura UTC y zona de sesión PostgreSQL (`America/New_York`). Esa
zona describe la sesión de base de datos, no prueba la zona horaria efectiva del proceso
Next.js; la procedencia del modo shadow debe acreditarse por separado desde el arranque
del proceso, sin incorporarla como un campo supuesto del outbox. El primer intento,
`localA9-outbox-2026-10-09T141110Z.invalid-psql-status-lines.csv`, se conserva marcado
como inválido porque `psql` añadió las filas de estado `BEGIN`/`COMMIT`; no usarlo como
CSV de evidencia. La captura válida se generó en modo quiet y cada nombre de salida es
único; no sobrescribir artefactos previos.

### Etiqueta del período activo

`PeriodoBadge` en `src/features/contabilidad/components/periodos/periodo-badge.tsx`
solo presenta el estado. La etiqueta de período del encabezado la forma
`PeriodoActivoIndicator` en `src/features/contabilidad/components/periodo-activo-indicator.tsx`:
resuelve el período abierto y `formatPeriodoLabel()` obtiene mes/año con
`fechaInicio.getMonth()` y `getFullYear()`. El período observado en base de datos comienza
`2026-10-01T00:00:00Z`; con un runtime en `America/New_York`, ese instante corresponde
a 30 de septiembre local y el getter produce septiembre. Esto explica la etiqueta
observada como hipótesis fuerte, pero la zona del proceso de aplicación no quedó
verificada independientemente; no modificar la UI ni declarar el diagnóstico confirmado
hasta comprobarla y añadir primero una prueba roja que reproduzca la fecha UTC en la zona
del proceso.

En este turno el coordinador reporta el servidor `127.0.0.1:3000` en shadow aislado y
una sesión autenticada de Piloto R7.3 abierta en la UI; esos datos son contexto de
ejecución comunicado por separado, no campos derivados de la captura SQL. Aún no hay
operación legítima registrada para iniciar el reloj. Siguiente paso: que el responsable
ejecute una operación normal desde esa sesión y conserve exports acotados por ventana.
Hasta ese primer evento durable correlacionado, R7.3 permanece preparado y sin iniciar;
los eventos vacíos de esta captura no inician su reloj.

### Addendum B — prerequisitos de venta al contado (2026-10-09 11:14 EDT)

**Resultado: BLOQUEADO; no ejecutar una venta real todavía.** Comprobación de solo
lectura en `tcp_test_local` (`127.0.0.1:5433`), mediante transacción `BEGIN READ ONLY`
y `ROLLBACK`, filtrada por tenant `cmuwujy2z000014niitq61tn2`. No se crearon ni
alteraron productos, existencias, ventas, sesiones de caja, cuentas ni otras filas de
negocio.

- Licencia activa hasta `2099-01-01`, tenant no marcado como demo ni prueba de admin y
  moneda funcional CUP. El plan asociado no resolvió a un registro de `Plan`. Las
  features almacenadas incluyen `ventas=true` y `contabilidad-formal=true`, pero no
  `ventas-pos`.
- No existen puntos de venta, productos, tipos de pago, cuentas bancarias ni turnos de
  caja para el tenant. Productos con stock y precio vendible: `0`; no hay producto real
  que pueda seleccionarse y cobrarse en un PV.
- Hay un período mensual ABIERTO del 1 al 31 de octubre de 2026. Existen mappings de
  roles contables activos para `CAJA_PRINCIPAL`, `VENTAS_PRODUCTOS` e `INVENTARIOS`; el
  catálogo de plantillas incluye `VENTA_CONTADO` y `COSTO_VENTA_DEVENGADO`. Esto
  acredita configuración contable parcial, no una operación conciliada ni su resultado.
- La única membership está activa como tenant admin, pero la cuenta asociada tiene rol
  global `regularUser`. `getCurrentUser` conserva el rol global en `user.role`, y
  resuelve `user.planFeatures` desde las features legacy de esta licencia (sin plan ni
  overrides); no hay alias de `ventas` a `ventas-pos`. El writer
  `venta-mutation-service.create` exige `ventas-pos` y `ventas.venta.registrar`, mientras
  `requireFeature` solo omite ese feature gate para rol global `admin`. Por tanto, para
  esta única cuenta registrada el feature gate no se satisface con la configuración DB
  observada. La sesión efectiva del navegador no se inspeccionó.
- El writer valida PV del tenant, productos y precio vigente; antes de descontar stock
  exige un registro disponible de `StockUbicacion` para el PV (o almacén). No se ejecutó
  una venta para probar esos gates.

Esta lectura no verificó el tenant de la sesión del navegador, la identidad activa en
la UI, ni el modo efectivo del proceso Next.js. Requisitos obligatorios del writer para
una venta clásica al contado: sesión del tenant con los gates de feature/permiso
resueltos, PV existente, productos tenant-scoped con precio vigente y registro suficiente
de `StockUbicacion` en el PV. El turno no es universalmente obligatorio: si el PV es
`PRINCIPAL` (o no declara tipo de caja), el resolver permite la venta sin turno; para
otros tipos puede encontrar o abrir un turno automático con fondo inicial cero. Los
tipos de pago y cuentas bancarias no son un requisito del writer básico para una venta
sin cliente; el servicio de cobro/facturación sí busca un tipo de pago activo, y una
cuenta bancaria se vuelve pertinente para esos flujos o pagos que la requieran. El
período abierto y los mappings/plantillas contables son cobertura parcial, no bloqueos
actuales para la operación básica ni prueba de posteo conciliado. Luego de completar
los prerequisitos aplicables debe reevaluarse la preparación. Este addendum no autoriza
crear datos ni realizar la venta.
