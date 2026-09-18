# Spec: Reportes contables en la app móvil

## Requisitos

### RF-1 — Superficie de reportes

En Contabilidad, el botón "Reportes" abre una superficie que muestra:
- Summary (`/accounting/reports/summary`): totales (total/pendiente/pagado/vencido).
- Movements (`/accounting/reports/movements`): número de items del último lote.

### RF-2 — Acceso y errores

Los mismos estándares: Bearer, broadcasts 401 → sign-out, respuestas de error del servidor muestran el mensaje recibido.

## Escenarios (Given/When/Then)

- DADO que el usuario abre Contabilidad, ENTONCES el módulo "Reportes" aparece (7° módulo).
- DATO: pulsa "Reportes", CUANDO la llamada devuelve datos, ENTONCES la superficie renderiza los totales y el count de movimientos.