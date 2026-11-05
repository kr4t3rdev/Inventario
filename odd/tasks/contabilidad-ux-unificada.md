# Unificación visual de Contabilidad

Referencia: Ventas y Configuración; preservar lógica financiera, acciones y permisos.
Entrega: cadena de PRs encadenados, menos de 200 líneas de código por PR. Auditar cada fase con Impeccable y hacer un commit por fase. Crear un Issue asociado y verificar el CI de cada PR para dejarlos listos para merge a main; no mergear.

## Specs

- S1: «bien vamos a aplicar lo mismo para contabilidad, audita este modulo inmenso e intenta ajustar el patron de diseno»
- S2: «recupera la sesion anterior en la q estabamos trabajando»
- S3: «bien iniciamos con el plan y la unificacion del diseno, apoyate en la skill impeccable, animation designer y UI UX Pro MAx, al terminar cada fase haz una auditoria con impeccable, commit, crea el Issue para los PRs encadenados con menos de 200 lineas de codigo y despues verifica el CI de cada uno para dejarlos listos para el merge a main»

## Tasks

- [x] T1 (S1-S3, inline): Contrato visual compartido y pruebas; auditoría Impeccable aprobada; commit `fc6864cf0e3cb06784a1b50c0fb132e3fdd6aa87`.
- [x] T2 (S1-S3, inline): Configuración, ajustes y exchange; Impeccable detector `[]`, auditoría técnica sin hallazgos bloqueantes; commits `50f2400a0b44` (194 líneas), `962baf6f6ebf` (155), `6f6b44954920` (199).
- [ ] T3 (S1-S3, inline, en progreso; slices `2c763054`, `e6ec0b72`): Logs, reportes y transferencias; queda Transferencias y cerrar auditoría.
- [ ] T4 (S1-S3, inline, commit pendiente): Anticipos, préstamos y deudas; auditar con Impeccable.
- [ ] T5 (S1-S3, inline, commit pendiente): Cuentas y accesibilidad estructural; auditar con Impeccable.
- [ ] T6 (S1-S3, inline, commit pendiente): Reconciliación y subpáginas; auditar con Impeccable.
- [ ] T7 (S1-S3, inline, commit pendiente): Libros, períodos y cierres, preservando gates; auditar con Impeccable.
- [ ] T8 (S1-S3, inline, commit pendiente): Dashboard y balance; verificación transversal y auditoría Impeccable.
- [ ] T9 (S3, inline, pendiente): Crear Issue y PRs encadenados (<200 líneas de código cada uno); ejecutar y verificar CI de todos, sin merge.

## Log

- L1: «bien vamos a aplicar lo mismo para contabilidad, audita este modulo inmenso e intenta ajustar el patron de diseno»
- L2: «recupera la sesion anterior en la q estabamos trabajando»
- L3: Referencia recuperada: Ventas/Configuración, encabezado 0,5 s y contenido 0,5 s con retraso 0,3 s; respetar movimiento reducido y conservar comportamiento, acciones y permisos.
- L4: El usuario seleccionó cadena con rama de seguimiento. Hallazgos de permisos y sidebars anidados se revisarán sin alterar autorización como parte de un cambio cosmético.
- L5: «bien iniciamos con el plan y la unificacion del diseno, apoyate en la skill impeccable, animation designer y UI UX Pro MAx, al terminar cada fase haz una auditoria con impeccable, commit, crea el Issue para los PRs encadenados con menos de 200 lineas de codigo y despues verifica el CI de cada uno para dejarlos listos para el merge a main».
- L6: La entrega ahora sí solicita Issue, PRs encadenados y CI; cada PR queda limitado a menos de 200 líneas de código. El merge sigue excluido. T1 tenía ya un shell y pruebas sin seguimiento en el worktree; se verificará su estado antes de adoptarlos.
- L7: T1 adoptó el shell y las pruebas ya presentes. Vitest focal: 4/4; detector Impeccable: `[]`; revisión técnica Impeccable manual: sin hallazgos bloqueantes (movimiento transform/opacity, alternativa reduced-motion, estructura semántica y responsive). LSP terminó inconcluso en ambos archivos; no se afirmó limpieza por ese resultado. El CLI de UI/UX Pro Max no está instalado en el directorio de skill (solo contiene `SKILL.md`); se aplicaron las guías disponibles. Commit local: `fc6864cf0e3cb06784a1b50c0fb132e3fdd6aa87`.
- L8: Antes de la próxima fase, se detectó que la rama actual incluye 6 commits/configuración previos frente a `origin/main` y el PR no existe. No publicar esa rama como PR de Contabilidad; aislar la cadena contable del trabajo de Configuración. T1 suma 203 líneas entre fuente y test en esta forma y requerirá mantener cada PR futuro bajo el límite pedido.
- L9: Estrategia de entrega concretada según `feature-branch-chain`: crear un tracker de integración desde `origin/main`; publicar slices contables cohesivos con menos de 200 líneas de código, cada hijo contra el padre inmediato, y mantener el tracker draft/no-merge. La historia de Configuración se conserva local y fuera de los PRs contables. Para la cadena final, reconstruir solo commits/archivos contables en un worktree limpio; la rama actual no se publicará. No hacer lecturas ni escrituras remotas de GitHub hasta tener autorización humana explícita del host/repositorio y sesión `gh`.
- L10: T2 completada con RED observado antes de usar el shell en Configuración, Ajustes y Exchange. Vitest focal conjunto 9/9; ESLint focal, `git diff --check` e Impeccable detector sin hallazgos; revisión estructural confirma que se mantienen cargas dinámicas, acciones, regreso y gates (incluida redirección de acceso y feature multi-moneda). Los cambios se rebanaron en tres commits contables locales, de 194, 155 y 199 líneas modificadas respectivamente. ASSESS posterior a writers fue `nativeRisk: unassessable` por archivos intencionales no rastreados; su plan pidió self-verification, completada. LSP quedó inconcluso en los archivos del turno; no se declaró limpio. Sin verificación browser por ahora.
- L11: T3 RED observado en las tres rutas; tras unificar con `AccountingPageShell`, los tests focales pasaron 9/9, ESLint y `git diff --check` pasaron, y el detector Impeccable devolvió `[]`. Slice de Logs committed como `2c763054` (140 líneas cambiadas, bajo el límite). El hook informa 1,684 líneas authored en 11 commits desde `origin/main`; se registra el límite de slice aquí antes del siguiente commit. No publicar esta rama; reconstruir la cadena desde `origin/main` en un worktree limpio.
- L12: Slice de Reportes committed como `e6ec0b72` (181 líneas cambiadas, incluyendo el historial de planificación requerido). Antes del siguiente commit, registrar la advertencia del hook: 1,859 líneas authored en 12 commits desde `origin/main`; mantener el slice boundary y la rama local, sin publicar. Transferencias sigue pendiente de commit.
