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
- T4 — S1-S2; Implementación: Configuración de Contratos; slice PR4; commit: `fbb07d62`.
- T5 — S1-S3; Implementación: pantalla de Licencias en contexto de administración de plataforma; ruta delegada por paralelismo; slice PR5; commit: `07e96191`.
- T6 — S1-S3; Implementación: pantalla de Planes en contexto de administración de plataforma; ruta delegada por paralelismo; slice PR6; commit: `118f4326`.
- T7 — S1-S4; Verificación funcional, responsive, reduced-motion y revisión visual; checks adjuntos a PR6; commit asociado: `118f4326`; cierre sin prueba browser aceptado explícitamente por el usuario.

## Delivery strategy
- Estrategia elegida por el usuario: `feature-branch-chain`.
- `codex/sidebar-interfaz-compacta` actúa como rama tracker; los futuros PRs hijos irán en orden sobre la rama tracker/inmediato padre. No se crearán ramas, PRs, ni se publicará nada sin solicitud expresa.
- Límites previstos: PR1=T1 (`dc3d1a26`); PR2=T2 (`f6e0bfca`); PR3=T3 (`5e182c67`); PR4=T4 (`fbb07d62`); PR5=T5 Licencias (`07e96191`); PR6=T6 Planes (`118f4326`) con la verificación transversal T7. Cada slice mantiene su comportamiento, tests y documentación juntos y se apunta a ~400 líneas cambiadas o menos; revisar el tamaño real al cerrar cada unidad.

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
- L12 — T4 se cerró en `fbb07d62` (`feat(configuracion): unifica configuración de contratos`). ASSESS devolvió `nativeRisk: unassessable` sin candidato debido a archivos no rastreados no declarados; `reviewDue` no fue informado y no se inició review. PR4 corresponde a este commit.
- L13 — Para el paralelismo, T5 se desglosa en dos unidades independientes, Licencias (T5) y Planes (T6), con superficies de edición disjuntas; verificación transversal renumerada a T7. Los writers reciben instrucción de conservar el contexto de administración de plataforma y no tocar acciones, permisos ni lógica de negocio.
- L14 — Se lanzaron en paralelo dos `gentle-ai-worker` acotados: T5 Licencias (`mw1w1wyv-3-1bgh`) y T6 Planes (`mw1w1wyz-4-tt4e`). Los edits permitidos están limitados a la página y su test correspondiente; ambos ejecutan Vitest, ESLint y `git diff --check`. No se crearán ramas ni PRs.
- L15 — T5 Licencias: writer reportó Vitest 1/1, ESLint y diff check exitosos; su detector de diseño devolvió `[]`. Spot-check parental del Vitest focal: 1/1. RED no se observó. Self-review confirma que solo cambia presentación/animación de la página; acciones, permisos y flujos administrativos quedan intactos.
- L16 — T6 Planes: writer reportó Vitest 1/1, ESLint y diff check exitosos; su detector de diseño devolvió `[]`. Spot-check parental del Vitest focal: 1/1. RED no se observó. Self-review confirma que solo se reemplazó el encabezado/layout por `SettingsPageShell`; los flujos de administración de planes permanecen intactos.
- L17 — T5 se cerró en `07e96191` (`feat(configuracion): unifica pantalla admin de licencias`). ASSESS de su rango comprometido con `baseRef=fbb07d62` falló por archivos no rastreados sin declarar y no produjo candidato; no hubo `reviewDue` ni review. No se repitió la evaluación. Las verificaciones focales del writer y el spot-check parental pasaron.
- L18 — T6 se cerró en `118f4326` (`feat(configuracion): unifica pantalla admin de planes`). Vitest focal del writer y spot-check parental: 1/1 cada uno; ESLint y diff check pasan. ASSESS con `baseRef=07e96191` no produjo candidato por archivos no rastreados no declarados; no se informó `reviewDue` y no se inició review.
- L19 — T7: la única ejecución de Playwright no pudo iniciar `pnpm run dev`; `with_server.py` salió con código 1 tras 120 s porque el servidor no estuvo listo en el puerto 3100. No se obtuvieron capturas ni medidas de navegador y no se reintentó. QA visual/responsive quedó bloqueada hasta una decisión humana.
- L20 — El usuario eligió «Accept tests without browser proof». T7 se cierra con la suite focal transversal (7 archivos, 8 tests aprobados) y el análisis estático de la shell; se acepta explícitamente la falta de evidencia visual/responsive en navegador.
