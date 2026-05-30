## SDD Proposal: Sistema de Reseñas y Valoraciones

### Problem
La landing page muestra datos ficticios en badges de rating, reseñas y contador de empresas. No hay un mecanismo real para que usuarios califiquen el sistema ni un flujo de moderación. Las secciones de Hero y Testimonios no pueden validarse con datos reales.

### Proposed Solution
Sistema completo de reseñas de usuario con modelo de datos, server actions, dialog diario para usuarios activos sin reseñar, moderación admin, y display condicional en landing basado en datos reales.

### Requirements

1. **Modelo de datos**: `Review` (calificación 1-5, comentario opcional, aprobación admin) y `ReviewPrompt` (traza de solicitudes para evitar spam)
2. **Server Actions**: CRUD de reseñas, stats agregados, gestión de prompts
3. **ReviewDialog**: Modal que pide calificar al sistema. Aparece 1 vez al día para usuarios activos que nunca hayan reseñado
4. **Hero badge condicional**: Muestra rating real + contador solo si hay ≥3 reseñas positivas aprobadas. Si no, no se renderiza
5. **Testimonios reales**: Máximo 3 reseñas destacadas aprobadas. Si no hay, la sección no se renderiza
6. **Moderación admin**: Panel en /busy para aprobar/rechazar reseñas

### What changes

| Layer | Change |
|---|---|
| **Prisma** | Nuevos modelos `Review` y `ReviewPrompt` |
| **Schema** | `reviewSchema` (Zod) para validación |
| **Feature** | `src/features/reviews/` con actions, components, hooks |
| **Landing** | Hero badge → `ReviewHeroBadge` condicional; Testimonios → `RealTestimonials` condicional |
| **Admin** | Sección de moderación de reseñas en /busy |
| **Layout/Context** | Provider o hook global `useReviewDialog` para mostrar el prompt diario |

### Modelo Propuesto

```prisma
/// Reseña de un usuario miembro de un tenant sobre el sistema.
model Review {
  reviewId    String   @id @default(cuid())
  tenantId    String
  userId      String
  rating      Int      // 1-5
  comment     String?  // texto opcional
  isApproved  Boolean  @default(false)
  isPositive  Boolean  // rating >= 4 (campo calculado al insert)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@unique([tenantId, userId])  // una reseña por usuario por tenant
  @@index([tenantId, isApproved])
  @@index([tenantId, isPositive, isApproved])
  @@map("reviews")
}

/// Traza de solicitudes de reseña para evitar notificar repetidamente.
model ReviewPrompt {
  promptId    String   @id @default(cuid())
  tenantId    String
  userId      String
  promptedAt  DateTime @default(now())
  dismissedAt DateTime?  // cuándo cerró el dialog sin enviar
  submittedAt DateTime?  // cuándo envió la reseña (vinculado opcional)

  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([tenantId, userId, promptedAt])
  @@map("review_prompts")
}
```

### Active User Detection
Un usuario se considera "activo" si tiene un `UserSession.lastActive` dentro de las últimas 24h. Al cargar cualquier página de la app (en el layout authenticated), si el usuario no tiene `Review` para su tenant y no se le ha mostrado un `ReviewPrompt` hoy, se muestra el `ReviewDialog`.

### Hero Badge Logic
```
if (approvedPositiveReviews >= 3) {
  mostrar badge con:
    - rating promedio (estrellas + número)
    - total de reseñas aprobadas
    - total de reseñas positivas
} else {
  no renderizar nada
}
```

### Testimonios Logic
```
const destacadas = getApprovedReviews({ orderBy: 'rating_desc', limit: 3 });
if (destacadas.length > 0) {
  renderizar sección con cards
} else {
  no renderizar la sección
}
```

### ReviewDialog Flow
1. Usuario activo sin reseña previa → al cargar página, si no hay prompt hoy → mostrar dialog
2. Dialog: "¿Cómo calificás tu experiencia con FinanceMDM?" + estrellas + campo opcional de comentario
3. Al enviar → `submitReviewAction` → guarda `Review` + actualiza `ReviewPrompt.submittedAt`
4. Al cerrar sin enviar → `dismissReviewPromptAction` → guarda `ReviewPrompt.dismissedAt`
5. No se vuelve a mostrar hasta el día siguiente

### Affected modules
- `prisma/schema.prisma` — 2 nuevos modelos
- `src/features/reviews/` — Nueva feature completa
  - `actions.ts` — submitReviewAction, approveReviewAction, dismissReviewPromptAction, getReviewsAction, getReviewStatsAction
  - `components/review-dialog.tsx` — Modal de calificación
  - `components/review-stars.tsx` — Display de estrellas (interactivo y de solo lectura)
  - `components/review-hero-badge.tsx` — Badge condicional para el Hero
  - `components/real-testimonials.tsx` — Sección de testimonios con datos reales
  - `hooks/use-review-dialog.ts` — Hook que orquesta la lógica de mostrar el dialog
  - `schemas.ts` — Validación Zod
- `src/features/landing/` — Hero badge y testimonios se vuelven condicionales
- `src/app/busy/reviews/` — Panel de moderación admin
- Layout authenticated → integración del hook `useReviewDialog`

### Rollback plan
1. Eliminar modelos `Review` y `ReviewPrompt` de Prisma
2. Eliminar `src/features/reviews/`
3. Revertir cambios en landing page
4. Correr migración

### Risks
- **UX**: Dialog diario puede ser intrusivo. Mitigación: solo aparece 1 vez/día, se puede cerrar, y desaparece permanentemente al enviar reseña
- **Moderación**: Reseñas no aprobadas no se muestran. Riesgo bajo si hay admin revisando periódicamente
- **Performance**: Consultas de stats deben ser eficientes (índices cubren los filtros)
- **Datos semilla**: Al migrar, tenant sin reseñas no mostrará badges — comportamiento esperado
