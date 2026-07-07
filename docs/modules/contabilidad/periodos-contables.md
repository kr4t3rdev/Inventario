# Periodos Contables

> Ordena las escrituras por ventanas de tiempo controladas, con apertura, cierre, reapertura, aprobacion, snapshots y hash de integridad.

## Que hace

Este submodulo gobierna cuando se puede seguir escribiendo en la contabilidad y cuando un tramo temporal queda congelado. Ademas de abrir y cerrar periodos, conserva auditoria, genera snapshots, calcula hash de integridad y permite verificar bloqueos desde otros formularios.

## Operaciones principales

- abrir un periodo contable
- listar periodos por estado o tipo
- consultar detalle y timeline de auditoria
- cerrar un periodo generando snapshot automatico
- aprobar un periodo cerrado
- reabrirlo con motivo explicito
- verificar desde cliente si una fecha quedo bloqueada

## Cuando usarlo

- Cuando necesitas congelar un mes o tramo operativo para evitar nuevas escrituras.
- Cuando queres preparar cierres con trazabilidad y evidencia.
- Cuando un formulario necesita saber si la fecha de negocio ya quedo bloqueada.

## Reglas importantes

- `checkPeriodLockAction` permite bloquear operaciones client-side antes de intentar guardar.
- El cierre genera snapshots y resumen con hash de integridad.
- Reabrir requiere motivo, y aprobar agrega una capa de validacion adicional.
- Muchas mutaciones de contabilidad consultan estos periodos indirectamente via `withPeriodValidation`.

## Que conviene cuidar

- No cierres un periodo si todavia tenes pendientes relevantes por conciliar.
- Si un periodo cerrado no tiene hash o snapshot esperado, hay que revisarlo antes de confiar en el cierre.
- Reabrir deberia ser una excepcion, no la norma.

## Referencias utiles

- `src/features/contabilidad/actions-periodos.ts`
- `src/features/contabilidad/hooks/use-period-lock.ts`
- `src/app/busy/contabilidad/periodos/page.tsx`
- `src/app/busy/contabilidad/periodos/[periodoId]/cuadre/page.tsx`

## En una frase

Define cuando la contabilidad sigue abierta y cuando queda sellada con trazabilidad verificable.
