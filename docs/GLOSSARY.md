# Glosario

Términos transversales del proyecto. Para el detalle funcional, ver `content/docs/modules/` y la fuente en `openspec/changes/`.

## Contabilidad formal

- **Asiento (de partida doble)**: registro contable con líneas de debe/haber que siempre cuadran en moneda funcional antes de persistirse.
- **CuentaContable / rol (`RolCuenta`)**: cuenta del plan del tenant; el rol semántico (ej. `CAJA_PRINCIPAL`) se remapea por tenant vía `CuentaRolTenant` sin cambiar plantillas.
- **Plantilla de asiento (`PlantillaAsiento`)**: regla global que traduce un evento de negocio a líneas con roles; el tenant no la edita.
- **Apertura / cierre formal**: asientos que trasladan saldos entre períodos; el cierre vacía cuentas de resultado contra `RESULTADO_PERIODO` y la apertura traslada ese resultado a `RESULTADOS_ACUMULADOS` una sola vez.
- **Revisión de apertura (`AperturaRevision`)**: autoridad append-only de la apertura inicial (maker/checker, digest SHA-256, congelada al presentar; tras aprobación no hay revisiones sustitutivas, la corrección es asiento inverso).
- **Hash encadenado**: cada asiento incluye `hashAnterior`; permite verificar offline que la historia no fue alterada.
- **Outbox shadow**: evidencia transaccional de los intentos del modo `shadow`, visible solo tras commit; `SIMULADO` no es `CONTABILIZADO`.
- **Preflight / aprobación de replay**: dry-run persistido con digest; la ejecución del backfill histórico requiere aprobación de manager dentro de 24 horas y sin hallazgos bloqueantes.
- **NO_EVALUABLE (conciliación)**: un rubro o período sin fuente comparable; bloquea el paso a `enforce`.
- **Moneda funcional 4-decimales exactos**: los importes posteados no se redondean; precisión mayor se rechaza (R0.1). Las tasas se conservan en `Decimal(20,10)` heredadas de la evidencia FX, nunca recalculadas.

## Operación

- **Base caja**: fuente operativa de reportes actuales; la capa formal no la reescribe.
- **Guard de períodos**: bloquea escrituras en períodos cerrados y registra `INTENTO_BYPASS` con actor real; el fallo de esa auditoría es `AUDITORIA_FALLIDA` y revierte la operación (fail-closed).
