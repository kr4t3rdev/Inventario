# Revisión previa al commit — baseline, reparación y alineación R6

## Contexto de decisiones y specs

Se revisa el corte documentado por `design.md`, `tasks.md`, los actos de reconciliación
del baseline y los ensayos trial2/trial4/trial5/trial7. Las decisiones explícitas del
responsable son validar el tenant de compra existente mediante producto/proveedor y
dejar vacía la cuenta por defecto de los tipos copiados. Se mantienen transacciones,
aislamiento tenant, reglas endurecidas y límites de firma global del change.

## Alcance revisado

- Diagnósticos SQL de catálogos/invariantes, comparador nominativo y su prueba Python.
- Corrección del guard R5 y sus 13 pruebas físicas.
- Reparación exclusivamente local de TipoPago, auditoría transaccional y 10 pruebas.
- Alineación del schema y migración de FK redundante, con 3 pruebas físicas.
- Evidencias agregadas y catálogos públicos del baseline/ensayos, sin el dump de datos.

Revisión realizada por el asistente en esta sesión: seguridad, SQL transaccional,
procedencia tenant, rollback/replay, preservación de datos, compatibilidad del cliente
y correspondencia con los actos de decisión. No es una revisión independiente externa.

## Resultado

Sin hallazgos críticos o altos en este alcance. Los scripts diagnósticos son de solo
lectura; el repair exige identidad explícita, loopback/5433 y nombre de trial, bloquea
tablas, verifica configuración y audita dentro de la misma transacción. R5 conserva
el tenant solo con fuentes válidas. La migración de alineación valida la FK compuesta
antes de retirar la simple. Los mapas Prisma conservan los selectores lógicos.

Comprobaciones ya aprobadas: regresión física 26/26, ESLint de las suites y typecheck.
La prueba Python del comparador y el diff staged se verifican en el corte de commit.

## Límites del corte

El checkout comparte otros cambios de idempotencia, adapters y SDKs. El commit de este
corte no incorpora esos cambios automáticamente. Los paquetes privados ensayados
contenían dos migraciones de idempotencia todavía no versionadas en este corte;
sus hashes están en el manifiesto. Por tanto el schema exacto ensayado y su diff vacío
no se atribuyen a HEAD aislado. El siguiente bloque debe identificar las dependencias
del paquete reproducible y verificar desde un commit fijo, antes de aceptación release.

No se incluyen dump, datos de negocio crudos, credenciales, cachés de grafos o salidas
de tests no pertenecientes al corte. R6/R0.5 y rollout siguen pendientes.
