# Unificación visual de Configuración
Alcance: destinos del grupo «Configuración» del sidebar, con Ventas como referencia visual y de movimiento.
Mantener intactos los flujos, acciones, permisos y contenido de negocio; armonizar presentación, organización y UX.

## Specs
1. S1 — «bien, ya revisado el trabajo de la rama actual quiero seguir con la implementacion del mismo, vamos con configuracion y sus opciones del menu sidebar, Mi empresa, referidos, usuarios y roles. Vas a unificar el patron de diseño entre todas estas pantallas q no coinciden en UX, organizacion dentro, colores, botones etc....usa la skill impeccable y animation designer.»
2. S2 — «Resaltar q debes guiarte por la pantalla Ventas q tiene el timing perfecto.»
3. S3 — Alcance ampliado tras la pregunta de aclaración: «Toda Configuración».
4. S4 — «los subagentes o agentes q abras de exploracion como gentle-ai-explore, lo haras con gpt-6-luna, guardalo para futuros trabajos en la configuracion».

## Tasks
- T1 — S1-S2; Implementación: armazón compartido de Configuración y Mi Empresa; slice PR1; commit: `dc3d1a26`.
- T2 — S1-S2; Implementación: Referidos; slice PR2; commit: `f6e0bfca`.
- T3 — S1-S2; Implementación: Usuarios y Roles; slice PR3; commit: `5e182c67`.
- T4 — S1-S2; Implementación: Configuración de Contratos; slice PR4; commit: pendiente.
- T5 — S1-S3; Implementación: Licencias y Planes de administración; slice PR5; commit: pendiente.
- T6 — S1-S4; Verificación funcional, responsive, reduced-motion y revisión visual; checks adjuntos a PR5; commit: pendiente.

## Delivery strategy
- Estrategia elegida por el usuario: `feature-branch-chain`.
- `codex/sidebar-interfaz-compacta` actúa como rama tracker; los futuros PRs hijos irán en orden sobre la rama tracker/inmediato padre. No se crearán ramas, PRs, ni se publicará nada sin solicitud expresa.
- Límites previstos: PR1=T1 (`dc3d1a26`); PR2=T2 (`f6e0bfca`); PR3=T3 (`5e182c67`); PR4=T4; PR5=T5 con la verificación transversal T6. Cada slice mantiene su comportamiento, tests y documentación juntos y se apunta a ~400 líneas cambiadas o menos; revisar el tamaño real al cerrar cada unidad.

## Log
- L1 — bien, ya revisado el trabajo de la rama actual quiero seguir con la implementacion del mismo, vamos con configuracion y sus opciones del menu sidebar, Mi empresa, referidos, usuarios y roles. Vas a unificar el patron de diseño entre todas estas pantallas q no coinciden en UX, organizacion dentro, colores, botones etc....usa la skill impeccable y animation designer
  Resaltar q debes guiarte por la pantalla Ventas q tiene el timing perfecto
- L2 — «Toda Configuración».
- L3 — bien, una aclaracion q vas a guardar antes de seguir, los subagentes o agentes q abras de exploracion como gentle-ai-explore, lo haras con gpt-6-luna, guardalo para futuros trabajos en la configuracion, despues de hacer esto puedes continuar
- L4 — Decisión de implementación: compartir `SettingsPageShell` para título, layout y motion de entrada; mantener la estructura de contenido propia de cada destino y no tocar lógica ni permisos. La categoría incluye destinos tenant y de administración.
- L5 — T1 completada en `dc3d1a26`. Prueba `pnpm exec vitest run src/features/configuracion/components/settings-page-shell.test.tsx`: 1/1; ESLint focal y `git diff --check`: pasan. LSP dio solo sugerencias de diccionario en español y dos respuestas inconclusas. Una invocación anterior de `pnpm run test:run -- <archivo>` ejecutó muchos tests y agotó el límite de 30 s; no se considera verificación.
- L6 — El usuario eligió la estrategia de entrega `feature-branch-chain` al superar el trabajo acumulado el presupuesto orientativo de 400 líneas. Esta elección organiza slices de revisión y no autoriza crear/publicar ramas o PRs.
- L7 — T2: Vitest focal `pnpm exec vitest run src/features/affiliate/components/affiliate-dashboard-page.test.tsx`: 1/1; ESLint focal y `git diff --check`: pasan. LSP devolvió únicamente sugerencias de diccionario en textos en español. El primer test falló por consultar el título de una tarjeta como heading aunque el componente lo renderiza como texto; se ajustó la aserción al rol realmente expuesto y el test pasó.
- L8 — T2 se cerró en `f6e0bfca` (`feat(configuracion): unifica pantalla de referidos`). ASSESS posterior devolvió `nativeRisk: unassessable` porque encontró archivos no rastreados sin declarar y no produjo candidato; `reviewDue` no fue informado y no se inició review. Se conservan las verificaciones focales; no se escaló ningún ítem de alto riesgo.
- L9 — T3: RED observado en los tests de encabezado común antes del cambio; GREEN con `pnpm exec vitest run src/features/admin/components/tenant-users-page.test.tsx src/features/roles/components/roles-manager.test.tsx` (3/3). ESLint focal y `git diff --check` pasan. LSP revisó 6 archivos, sin diagnósticos de error observados; la ejecución quedó inconclusa en 3 archivos y mostró sugerencias de diccionario en español. La lógica de datos, acciones y permisos permanece intacta.
- L10 — T3 se cerró en `5e182c67` (`feat(configuracion): unifica usuarios y roles`). ASSESS devolvió `nativeRisk: unassessable` sin candidato porque hay archivos no rastreados sin declarar; `reviewDue` no fue informado y no se inició review. PR3 contiene el commit T3 como slice separado.
- L11 — T4: RED observado antes del cambio; GREEN con `pnpm exec vitest run src/app/busy/configuracion/contratos/page.test.tsx` (1/1). ESLint focal y `git diff --check` pasan. LSP no reportó diagnósticos de error; solo sugerencias de diccionario en nombres/copy en español. La página usa `SettingsPageShell`; los movimientos del listado de tipos respetan reduced motion y el timing común; las acciones de formulario y navegación permanecen.
