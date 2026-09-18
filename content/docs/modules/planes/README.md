# Planes y Licencias

> Define los planes de suscripción y su matriz de features, límites y presentación pública o administrativa.

## Qué hace

Este módulo describe la oferta comercial del sistema. A nivel de dominio, organiza planes, límites y features mediante un registry central. A nivel operativo, se usa tanto para renderizar planes en la landing como para administrarlos desde el panel global.

## Qué incluye

- lectura de planes desde base de datos
- presentación pública lista para landing
- agrupación de features por categoría
- límites por usuarios, almacenes, productos, clientes y puntos de venta
- gestión admin de planes desde `/admin/planes`

## Cuándo usarlo

- Cuando querés revisar qué capacidades incluye cada plan.
- Cuando necesitás exponer pricing en la landing.
- Cuando admin debe crear, editar o eliminar planes comerciales.

## Reglas importantes

- El feature registry centraliza etiquetas, categorías y agrupación de capacidades.
- Los límites y features del plan condicionan acceso real a muchos módulos del sistema.
- La vista pública y la vista admin consumen el mismo dominio, pero con formatos distintos.
- No es lo mismo plan que licencia: el plan define oferta; la licencia la asigna a un tenant.

## Qué conviene cuidar

- Cambiar features de un plan puede alterar acceso real en módulos productivos.
- Conviene pensar este módulo junto con `licencias`, pero no mezclarlos conceptualmente.

## Rutas y referencias

- `/admin/planes`
- `src/features/planes/actions.ts`
- `src/features/planes/feature-registry.ts`

## En una frase

Es la definición comercial y funcional de qué puede hacer cada tipo de cliente en la plataforma.
