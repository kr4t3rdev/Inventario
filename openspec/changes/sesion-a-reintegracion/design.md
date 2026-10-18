# Design — Sesión A: re-integración (revert-del-revert)

## Contexto

- main (`ac651e79`) contiene la Sesión B completa: despacho `EN_TRANSITO`,
  PARCIAL acumulativo con claim condicional, kardex por recepción, higiene de
  logs (B-4) y permisos simétricos (D6).
- El revert `b4be12ba` mantiene TODO el contenido de Sesión A ausente; la rama
  original tiene 0 commits fuera del historial → re-integración = re-aplicar
  contenido.
- La superficie de solape era de 11 archivos, pero el revert-del-revert real
  produjo solo **3 conflictos**: dos headers de tests de gastosDE y el
  comentario del permiso en `transferencias/actions.ts` (el código es
  idéntico en ambos lados, tal como anticipó el design de Sesión B).

## Decisiones

### D1 — Base: revert-del-revert

`git revert --no-commit b4be12ba` recupera los 39 archivos. 36 auto-mergean
(incluidos `prisma/schema.prisma`, `periodo-contable-guard/service`, las rutas
móviles legadas de mermas/expenses y los tests de
ofertas/puntos-venta/ventas/mermas).

### D2 — Resolución preserva Sesión B y el refactor de main

- `transferencias/actions.ts`: se conserva el comentario de HEAD (B-2); el
  `requirePermission` es idéntico en ambos lados.
- Tests de gastosDE: imports fusionados (`afterEach` de A + helpers
  `expectActionSuccess/Failure` de main), bloque `PERIODO_GUARD_ENABLED` de A
  re-landed, `tenantRole: 'manager'` de main.
- **NO se re-añaden** los `console.log` de negocio que B-4 retiró (el
  revert-of-revert los reintroduce; se eliminan de nuevo — el contrato estático
  `higiene-logs.test.ts` lo exige).

### D3 — Extensión A-4 (BUG-3) con semántica de recepción

Con Sesión B, el stock solo se mueve al recibir (delta por recepción). El
agregado `getStockDisponibleEnPuntoVenta` debe:

- filtrar `deletedAt: null` y `estado notIn [CANCELADA, RECHAZADA]` (A-4);
- usar `cantidadRecibida` (no `cantidad`) como aporte de las filas con
  recepción: una PARCIAL no descuenta lo no recibido ni acredita lo pendiente;
- las filas `PENDIENTE`/`APROBADA`/`EN_TRANSITO` no han movido stock → aporte 0;
- las ventas anuladas o eliminadas no consumen stock (complemento A-4);
- las filas `COMPLETADA` creadas directamente en recepción única conservan el
  cálculo previo (`cantidadRecibida` queda igual a `cantidad` al completarse).

### D4 — Migración de cascadas re-fechada

La migración original de A-1 se re-crea con fecha 2026-10-18: un folder
2026-09-26 ordenaría antes de migraciones ya aplicadas en producción
(las de contabilidad de 2026-10-14). El SQL solo toca los ON DELETE de las
3 FKs.

### D5 — Rutas móviles legadas

A-2/A-5 tocaron `src/app/api/mobile/` (legado, no la v1). Esa API sigue en
main intacta; los cambios se re-aplican tal cual. El contrato v1/OpenAPI no
cambia (`openapi:check` lo confirma).

### D6 — Riesgo residual

- El motivo original del revert no está documentado; si existió un fallo en
  producción, los gates de esta sesión (suite completa + typecheck + lint +
  openapi) son la red de detección disponible.
- Los tests re-landed de A usan el estilo previo al refactor mecánico de
  main; se adaptan los que fallen por estilo (helpers, `as any`, manager).
