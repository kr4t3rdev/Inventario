# Pruebas de carga y presupuesto de rendimiento — especificación nueva

## Purpose

Definir las garantías observables de rendimiento, resistencia y degradación del
sistema bajo carga, con base en la evidencia medida del programa de load
testing (registro: `docs/auditoria-load-testing-2026-10-05.md`). Incluye el
presupuesto de rendimiento vigente, el comportamiento exigible en saturación y
los requisitos de la infraestructura de pruebas. Los números aquí son límites
medidos del hardware de referencia (homelab de 8 cores / 7.1GB); cualquier
cambio de infraestructura relevante SHOULD motivar una re-medición.

## Functional Requirements

### Requirement: Operación POS sostenida sin degradación

El sistema MUST sostener el flujo del POS (login, turno activo, catálogo de
punto de venta) con al menos 30 usuarios concurrentes durante 2 horas
continuas, manteniendo la latencia p95 por debajo de 200ms y la tasa de
errores por debajo del 1%, sin crecimiento sostenido de memoria (fugas) y sin
reinicios del proceso.

#### Scenario: Soak de 2 horas en el hardware de referencia
- GIVEN el sistema desplegado en producción en el hardware de referencia
- WHEN se mantiene una carga sostenida de 30 usuarios POS durante 2 horas
- THEN la latencia p95 se mantiene plana (~91ms medidos), no hay fuga de
memoria, y el proceso no se reinicia.

#### Scenario: Regresión de rendimiento en un release
- GIVEN una corrida de soak aprobada como línea base
- WHEN se despliega un cambio que afecta ventas, catálogo o autenticación
- THEN la misma corrida de soak ejecutada sobre el nuevo release mantiene la
latencia p95 dentro del presupuesto (<200ms) y se detecta cualquier fuga
nueva comparando la tendencia de memoria contra la línea base.

### Requirement: Saturación con degradación encolada y sin pérdida

Bajo ráfagas que excedan la capacidad de proceso del catálogo POS (~120
req/s medidos en el hardware de referencia), el sistema MUST responder
eventualmente a todas las solicitudes válidas sin perder consultas ni
corromper datos, MAY encolar y elevar la latencia mientras dure la ráfaga, y
MUST recuperar su latencia de reposo una vez cede la carga.

#### Scenario: Ráfaga de 300 RPS sobre el catálogo autenticado
- GIVEN sesiones válidas de POS ya establecidas
- WHEN se recibe una ráfaga de 300 req/s durante ~50 segundos contra el
catálogo y turno activo
- THEN no se produce ningún error ni caída del proceso, las consultas se
encolan con latencia elevada, y al cesar la ráfaga el sistema vuelve a su
latencia de reposo.

### Requirement: Techo de login acotado por diseño de seguridad

El hash de contraseñas (bcrypt) acota deliberadamente la tasa de logins
exitosos (~30-80/s en el hardware de referencia). El sistema MUST no
corromper datos ni caer de forma irrecuperable ante ráfagas de login
superiores a ese techo, MAY rechazar o encolar los logins excedentes, y MUST
recuperarse al cesar la ráfaga.

#### Scenario: Tormenta de logins
- GIVEN el sistema en operación normal
- WHEN se reciben varios cientos de intentos de login por segundo sostenidos
- THEN el sistema degrada sin perder integridad, no responde con datos
erróneos, y tras la ráfaga acepta logins con normalidad.

### Requirement: Unicidad de tokens de sesión por emisión

Cada emisión de tokens de acceso y refresco MUST ser única por construcción
(reivindicación `jti` con valor aleatorio), de modo que logins concurrentes
del mismo usuario — incluso dentro del mismo segundo — no produzcan tokens
duplicados ni colisiones contra la restricción única de sesión.

#### Scenario: Logins concurrentes del mismo usuario en el mismo segundo
- GIVEN un usuario con credenciales válidas
- WHEN dos o más logins de ese usuario se procesan concurrentemente dentro
del mismo segundo de emisión
- THEN cada login obtiene tokens distintos, se persisten sesiones
independientes y no se produce error de restricción única (P2002).

### Requirement: Infraestructura de pruebas reproducible y aislada

El repositorio MUST mantener la suite de pruebas de carga (`load-tests/`) con
sus umbrales, y las pruebas MUST ejecutarse contra un tenant demo aislado
con datos sembrados, sin contaminar datos de tenants reales. El generador de
carga MUST ejecutarse fuera de la máquina bajo prueba.

#### Scenario: Campaña de pruebas contra datos reales
- GIVEN una campaña de pruebas de carga planificada
- WHEN se ejecutan las pruebas del catálogo POS
- THEN todo el tráfico incide sobre el tenant demo y ninguna venta, stock ni
usuario de tenants reales se modifica.

#### Scenario: Suite sin tenant demo disponible
- GIVEN el tenant demo expirado o inexistente
- WHEN se intenta ejecutar una prueba autenticada
- THEN la prueba falla rápido con un error claro de credenciales/entorno, sin
enviar tráfico ambiguo al sistema.

### Requirement: Despliegue de pruebas operativamente estable

El despliegue de referencia MUST ejecutarse como servicio con reinicio
automático (systemd), MUST mantener la base de datos alcanzable por loopback
para no depender de la estabilidad del enlace de red externo, y el build de
producción MUST poder ejecutarse en el hardware de referencia con la
aplicación detenida durante la ventana de compilación.

#### Scenario: Muerte del proceso bajo carga
- GIVEN el despliegue operando bajo carga
- WHEN el proceso del servidor termina inesperadamente
- THEN el servicio se reinicia automáticamente en segundos y vuelve a
responder sin intervención manual.

#### Scenario: Flap del enlace de red externo
- GIVEN la aplicación funcionando con la base de datos en loopback
- WHEN el enlace de red hacia el servidor se cae y recupera
- THEN la aplicación conserva el acceso a su base de datos en todo momento y
las pruebas o clientes externos recuperan la conectividad por sí mismos.
