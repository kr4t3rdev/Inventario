# Checklist de release — Reportes contables

## Gate obligatorio

- [ ] Ejecutar `pnpm run typecheck` sin errores nuevos.
- [ ] Ejecutar `pnpm run build` con un servidor limpio.
- [ ] Ejecutar E2E autenticado para `/busy/contabilidad/reportes`:
  - [ ] Resumen carga y cambia rango global.
  - [ ] Movimientos filtra por texto, moneda, cuenta y tipo.
  - [ ] Por cuentas cambia cuenta y conserva moneda.
  - [ ] CSV y PDF descargan el conjunto filtrado.
  - [ ] Estados loading, vacío y error son visibles y recuperables.
- [ ] Ejecutar suite unitaria/integración completa con `pnpm run test:run`.

## Performance mínima

- [ ] Medir al menos 10 ejecuciones del endpoint de movimientos con datos representativos.
- [ ] Registrar `count`, `minMs`, `p50Ms`, `p95Ms` y `maxMs` usando:
  `pnpm exec tsx scripts/reports-release-check.ts <duraciones-en-ms>`.
- [ ] Objetivo recomendado: p95 del JSON menor a 800 ms en staging.
- [ ] Exportaciones tienen límite máximo de 10.000 filas; cargas mayores deben paginarse o rechazarse explícitamente.
- [ ] Confirmar que CSV/PDF no mezclan monedas ni presentan conversiones no verificadas.

## Preparación y rollback

- [ ] Revisar `git diff` y separar cambios no relacionados.
- [ ] Confirmar migraciones Prisma pendientes y respaldo antes de desplegar.
- [ ] Documentar commit/tag candidato y ventana de despliegue.
- [ ] Definir rollback al commit/tag anterior y verificar que el endpoint anterior sigue disponible.
- [ ] No marcar release como aprobado si falla cualquier gate obligatorio.

## Evidencia

Registrar fecha, entorno, commit, usuario/tenant de prueba, dataset, comandos ejecutados y enlaces a reportes E2E/performance.
