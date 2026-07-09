# Reviews (Reseñas del Sistema)

> Gestiona reseñas del tenant, su moderación interna y parte del contenido social que alimenta la landing pública.

## Qué hace

Este módulo permite que los usuarios califiquen el sistema, evita duplicados por tenant/usuario, decide cuándo volver a pedir reseña y ofrece una bandeja de moderación para aprobar o rechazar comentarios antes de hacerlos visibles.

## Áreas principales

- **Captura de reseñas**: rating de 1 a 5 con comentario opcional.
- **Moderación**: aprobación o rechazo por admin/manager del tenant.
- **Estadísticas**: promedio, total aprobado y total positivo.
- **Prompts**: lógica para decidir si conviene volver a pedir reseña o descartar el prompt.
- **Landing pública**: también expone testimonios aprobados, estadísticas y planes para el sitio público.

## Cuándo usarlo

- Cuando querés moderar reseñas antes de publicarlas.
- Cuando necesitás medir satisfacción real de los tenants.
- Cuando la landing debe mostrar prueba social basada en datos reales.

## Reglas importantes

- Un usuario no puede reseñar dos veces el mismo tenant.
- Solo admin o manager del tenant pueden aprobar o rechazar reseñas.
- Aprobar hace visible la reseña; rechazar la elimina.
- El mismo feature también alimenta componentes públicos de la landing, no solo la pantalla `/busy/reviews`.

## Qué conviene cuidar

- Si la moderación se descuida, la landing pública puede quedar desactualizada o sin prueba social suficiente.
- Las reseñas forman parte tanto del producto interno como del posicionamiento comercial externo.
- Conviene revisar pendientes con frecuencia para no acumular feedback sin visibilidad.

## Rutas y referencias

- `/busy/reviews`
- `src/app/busy/reviews/page.tsx`
- `src/features/reviews/actions.ts`
- `src/features/reviews/hooks/use-review-dialog.ts`
- `src/features/reviews/index.ts`

## En una frase

Convierte feedback de usuarios en reputación moderada para el producto y la landing.
