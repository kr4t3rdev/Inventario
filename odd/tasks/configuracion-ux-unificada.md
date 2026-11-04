# Unificación visual de Configuración
Alcance: destinos del grupo «Configuración» del sidebar, con Ventas como referencia visual y de movimiento.
Mantener intactos los flujos, acciones, permisos y contenido de negocio; armonizar presentación, organización y UX.

## Specs
1. S1 — «bien, ya revisado el trabajo de la rama actual quiero seguir con la implementacion del mismo, vamos con configuracion y sus opciones del menu sidebar, Mi empresa, referidos, usuarios y roles. Vas a unificar el patron de diseño entre todas estas pantallas q no coinciden en UX, organizacion dentro, colores, botones etc....usa la skill impeccable y animation designer.»
2. S2 — «Resaltar q debes guiarte por la pantalla Ventas q tiene el timing perfecto.»
3. S3 — Alcance ampliado tras la pregunta de aclaración: «Toda Configuración».
4. S4 — «los subagentes o agentes q abras de exploracion como gentle-ai-explore, lo haras con gpt-6-luna, guardalo para futuros trabajos en la configuracion».

## Tasks
- T1 — S1-S2; Implementación: armazón compartido de Configuración y Mi Empresa; commit: pendiente.
- T2 — S1-S2; Implementación: Referidos; commit: pendiente.
- T3 — S1-S2; Implementación: Usuarios y Roles; commit: pendiente.
- T4 — S1-S2; Implementación: Configuración de Contratos; commit: pendiente.
- T5 — S1-S3; Implementación: Licencias y Planes de administración; commit: pendiente.
- T6 — S1-S4; Verificación funcional, responsive, reduced-motion y revisión visual; commit: pendiente.

## Log
- L1 — bien, ya revisado el trabajo de la rama actual quiero seguir con la implementacion del mismo, vamos con configuracion y sus opciones del menu sidebar, Mi empresa, referidos, usuarios y roles. Vas a unificar el patron de diseño entre todas estas pantallas q no coinciden en UX, organizacion dentro, colores, botones etc....usa la skill impeccable y animation designer
  Resaltar q debes guiarte por la pantalla Ventas q tiene el timing perfecto
- L2 — «Toda Configuración».
- L3 — bien, una aclaracion q vas a guardar antes de seguir, los subagentes o agentes q abras de exploracion como gentle-ai-explore, lo haras con gpt-6-luna, guardalo para futuros trabajos en la configuracion, despues de hacer esto puedes continuar
- L4 — Decisión de implementación: compartir `SettingsPageShell` para título, layout y motion de entrada; mantener la estructura de contenido propia de cada destino y no tocar lógica ni permisos. La categoría incluye destinos tenant y de administración.
