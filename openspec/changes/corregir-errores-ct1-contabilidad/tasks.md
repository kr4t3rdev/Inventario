# Tareas: errores CT-1

- [x] 1. Revalidar rama, cambios locales y versión de la implementación; preservar trabajo ajeno.
  - Rama `fix/ct1-contabilidad-errores` basada en `origin/main` (fb7cea6cc). Cambios sin commit del checkout principal preservados (no se tocaron). Worktree: `/Volumes/Server/Proyectos/TCP-worktrees/ct1-contabilidad-fixes`.
- [x] 2. Reproducir en PostgreSQL aislado el caso de compra sin período y registrar el error subyacente.
  - Causa confirmada: FK `auditoria_periodos_periodoId_fkey` rechaza `periodoId='N/A'` (SQLSTATE 23503); el catch enmascaraba el diagnóstico como `AUDITORIA_FALLIDA`. Test RED reproducido contra base desechable (`tcp_test_ct1_guard_20261114`).
- [x] 3. Corregir el manejo y la auditoría de período ausente; probar política de auditoría y atomicidad.
  - `AuditoriaPeriodo.periodoId` nullable (schema + migración `20261114000000_auditoria_periodo_sin_periodo_nullable`); guard registra `null` y persiste el error subyacente. Tests: `periodo-guard-auditoria.test.ts` (2/2) y E2E `compra-sin-periodo-postgres.test.ts` (diagnóstico correcto, snapshot antes/después idéntico, auditoría INTENTO_BYPASS con periodoId null).
- [x] 4. Reproducir la venta y localizar el evento y campo de valoración faltante; corregir solo la causa demostrada y probar éxito y rechazo atómico.
  - Causa reproducida: fuente FIFO en moneda extranjera sin tasa publicada → `montoFuncional=null` → mensaje genérico de `validarEventoMonetario`. Fix: el mensaje identifica el emisor (tipo de evento) y el dato faltante. No se pre-lanza error en venta-mutation-service (preserva modo shadow). Tests: `venta-costo-sin-valoracion-postgres.test.ts` 2/2 (rechazo atómico + flujo válido con asiento de costo).
- [x] 5. Reproducir la discrepancia de moneda funcional y corregir su causa demostrada; probar política CUP, ausencia y errores de consulta según corresponda.
  - `abrir-periodo-dialog.tsx` distingue `success:false` (error de consulta) de política ausente (lista vacía). Tests 7/7 (`abrir-periodo-dialog.test.tsx`).
- [x] 6. Investigar el selector vacío de cajeros con datos aislados y distinguir falta de empleados de defecto.
  - `apertura-turno-dialog.tsx`: `success:false` muestra el mensaje de error del action; lista realmente vacía muestra "No hay empleados registrados". Tests 2/2 (`apertura-turno-dialog.test.tsx`). Limitación: la causa raíz en PonzTest (falta de empleados vs. error de permiso/plan) no es verificable desde esta sesión; el fix hace observable el estado real para diagnosticarla ahí.
- [x] 7. Ejecutar pruebas focales y verificaciones pertinentes; documentar fallos o limitaciones.
  - Integración focal (DB desechable): 5 archivos / 11 tests en verde (guard, compra sin período, venta sin valoración, rollback formales de compra y venta). Unitarios modificados: guard/service 114, motor 96, abrir-periodo 7/7, apertura-turno 2/2. `pnpm run lint`: 0 errores. Pendiente de reportar: typecheck (en ejecución al momento del commit; ver PR).
- [ ] 8. Preparar commits y PRs encadenadas de menos de 200 líneas por PR, si el alcance y las verificaciones permiten hacerlo sin mezclar trabajo ajeno.
- [ ] 9. Entregar a la sesión original los commits/PRs y un protocolo de verificación en PonzTest; no ejecutar pruebas de producción desde esta tarea.
