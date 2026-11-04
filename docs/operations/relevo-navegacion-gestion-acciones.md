# Relevo: navegación y diseño de Gestión y Acciones

Fecha: 3 de noviembre de 2026. Rama: `codex/sidebar-interfaz-compacta`. Último commit de interfaz documentado: `9fd31f5c`.

La rama contiene la recuperación de la navegación flotante y la unificación visual solicitada para Gestión y Acciones. El trabajo está publicado en la rama, pendiente de revisión visual e integración en `main`.

## Retomar la sesión

1. Comprobar `git status`, la rama y los cambios ajenos antes de modificar el checkout. Hay archivos locales de Graphify y estado de herramientas que no forman parte de esta entrega.
2. Actualizar las referencias remotas y comparar la rama con el `main` vigente. Revisar el diff completo y resolver cualquier conflicto sin descartar trabajo ajeno.
3. Probar la interfaz con un tenant de prueba y revisar los puntos pendientes de abajo. Preparar la integración y volver a comprobar el CI de la versión exacta que se vaya a fusionar.

## Cambios incluidos

- `c9bcab05` — integra las vistas clásica, compacta y flotante, el selector persistente y el header, y unifica títulos y colores de Gestión y Acciones.
- `34dbec63` — actualiza pruebas de contextos de navegación y cabecera.
- `9fd31f5c` — alinea entradas de Reabastecimiento, Órdenes, Recepciones, Kardex y Ajustes con Ventas, añade el icono de Reabastecimiento y corrige los encabezados de Ofertas y Clientes.

La vista compacta identifica la ruta activa más específica también en páginas anidadas.

La navegación flotante usa las categorías en el header y un rail de iconos con leyendas. El rail conserva desplazamiento con su indicador oculto. Las opciones se obtienen de la configuración compartida y su filtro de planes y permisos. La preferencia de vista se guarda localmente.

La referencia de movimiento es `src/features/ventas/components/ventas-page-client.tsx`: encabezado de 0,5 s y contenido de 0,5 s con retraso de 0,3 s. Las pantallas ajustadas contemplan movimiento reducido. Listas de precios tiene precarga y entrada de título y contenido separados.

## Archivos para orientarse

| Área | Archivos principales |
| --- | --- |
| Layout y selección de vista | `src/app/busy/layout.tsx`, `src/components/sidebar-view.tsx` |
| Navegación y header | `src/components/floating-navigation.tsx`, `src/components/app-sidebar-compact.tsx`, `src/components/site-header.tsx`, `src/components/nav-user.tsx` |
| Planes y permisos | `src/features/sidebar/sidebar-config.ts`, `src/features/sidebar/build-visible-groups.ts` |
| Patrón visual | `src/components/management-page-title.tsx`, `src/features/ventas/components/ventas-page-client.tsx` |
| Compras e inventario | `src/app/busy/compras/reabastecimiento/`, `src/features/compras-productos/components/ordenes-compra-page-client.tsx`, `src/features/inventario/components/` |

## Validación y pendientes

- El [CI del commit 9fd31f5c](https://github.com/kr4t3rdev/Inventario/actions/runs/41737417327) terminó correctamente: lint, tipos, cuatro bloques unitarios, integración PostgreSQL, cobertura y build.
- Se probaron localmente la navegación, la precarga de listas de precios y pruebas focalizadas de inventario y compras. La última tanda pasó la comprobación de TypeScript.
- Falta una revisión visual completa de escritorio y móvil, incluidos cambio de grupo, transición del rail, tooltips, submenús, desplazamiento y recarga de la preferencia.
- Verificar con distintos planes y permisos de tenant que las opciones visibles y las rutas coincidan con la autorización efectiva.
- Revisar el movimiento reducido en las demás pantallas de Acciones que no se ajustaron en la última tanda, y comprobar las animaciones de entrada tras la precarga.
- Revisar formularios, diálogos, estados vacíos y errores de Gestión y Acciones para detectar diferencias de diseño o colores residuales.
- Antes de la integración, comparar de nuevo con `main` y comprobar el CI del resultado combinado.

## Prueba local

El entorno de esta sesión utilizó PostgreSQL local en el puerto 5433 y una base desechable de prueba. Comprobar que la base y el usuario de prueba siguen disponibles antes de arrancar el servidor; no usar datos ni credenciales de producción. El estado de la sesión del navegador puede haber caducado.
