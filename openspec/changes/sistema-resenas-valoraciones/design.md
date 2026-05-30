## SDD Design: Sistema de Reseñas y Valoraciones

### 1. Prisma Schema Changes

Agregar al final de `prisma/schema.prisma`, antes del último `}`:

```prisma
/// Reseña de un usuario sobre el sistema.
model Review {
  reviewId    String   @id @default(cuid())
  tenantId    String
  userId      String
  rating      Int      // 1-5
  comment     String?
  isApproved  Boolean  @default(false)
  isPositive  Boolean
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([tenantId, isApproved])
  @@index([tenantId, isPositive, isApproved])
  @@map("reviews")
}

/// Traza de solicitudes de reseña.
model ReviewPrompt {
  promptId    String   @id @default(cuid())
  tenantId    String
  userId      String
  promptedAt  DateTime @default(now())
  dismissedAt DateTime?
  submittedAt DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [tenantId], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@index([tenantId, userId, promptedAt])
  @@map("review_prompts")
}
```

### 2. File Structure

```
src/features/reviews/
├── actions.ts                # Todas las server actions
├── schemas.ts                # Validación Zod
├── components/
│   ├── review-dialog.tsx     # Modal de calificación (client)
│   ├── review-stars.tsx      # Componente de estrellas (client)
│   ├── review-hero-badge.tsx # Badge para landing (server component)
│   └── real-testimonials.tsx # Testimonios reales (server component)
├── hooks/
│   └── use-review-dialog.ts  # Hook para orquestar dialog
└── index.ts                  # Barrel export
```

### 3. Server Actions Detail

```typescript
// src/features/reviews/actions.ts
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { reviewSchema } from './schemas';
import { revalidatePath } from 'next/cache';

// submitReviewAction — crea reseña
export const submitReviewAction = withAction(async (input, user) => {
  const parsed = reviewSchema.parse(input);
  const tenantId = requireTenant(user);

  // Verificar unique
  const existing = await prisma.review.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.userId } },
  });
  if (existing) throw new ActionError('Ya calificaste el sistema', 'DUPLICATE');

  const review = await prisma.review.create({
    data: {
      tenantId,
      userId: user.userId,
      rating: parsed.rating,
      comment: parsed.comment,
      isPositive: parsed.rating >= 4,
    },
  });

  // Vincular prompt si existe
  await prisma.reviewPrompt.updateMany({
    where: { tenantId, userId: user.userId, submittedAt: null },
    data: { submittedAt: new Date() },
  });

  revalidatePath('/');
  return { review };
});

// approveReviewAction — admin aprueba
export const approveReviewAction = withAction(async (reviewId, user) => {
  const tenantId = requireTenant(user);
  const review = await prisma.review.findFirst({
    where: { reviewId, tenantId },
  });
  if (!review) throw new ActionError('Reseña no encontrada', 'NOT_FOUND');
  if (user.role !== 'admin' && user.role !== 'manager')
    throw new ActionError('No autorizado', 'FORBIDDEN');

  const updated = await prisma.review.update({
    where: { reviewId },
    data: { isApproved: true },
  });

  revalidatePath('/busy/reviews');
  revalidatePath('/');
  return { review: updated };
});

// rejectReviewAction — admin rechaza (elimina)
export const rejectReviewAction = withAction(async (reviewId, user) => {
  const tenantId = requireTenant(user);
  const review = await prisma.review.findFirst({
    where: { reviewId, tenantId },
  });
  if (!review) throw new ActionError('Reseña no encontrada', 'NOT_FOUND');
  if (user.role !== 'admin' && user.role !== 'manager')
    throw new ActionError('No autorizado', 'FORBIDDEN');

  await prisma.review.delete({ where: { reviewId } });
  revalidatePath('/busy/reviews');
  revalidatePath('/');
  return { success: true };
});

// getReviewStatsAction — stats agregados para landing
export const getReviewStatsAction = withAction(async (_, user) => {
  const tenantId = requireTenant(user);

  const [totalApproved, positiveApproved, ratingAgg] = await Promise.all([
    prisma.review.count({ where: { tenantId, isApproved: true } }),
    prisma.review.count({
      where: { tenantId, isApproved: true, isPositive: true },
    }),
    prisma.review.aggregate({
      where: { tenantId, isApproved: true },
      _avg: { rating: true },
    }),
  ]);

  return {
    averageRating: ratingAgg._avg.rating ?? 0,
    totalApproved,
    totalPositive: positiveApproved,
  };
});

// getReviewStatsPublicAction — para landing pública (usa env var tenant)
export const getReviewStatsPublicAction = async () => {
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
  if (!tenantId) return { averageRating: 0, totalApproved: 0, totalPositive: 0 };

  const [totalApproved, positiveApproved, ratingAgg] = await Promise.all([
    prisma.review.count({ where: { tenantId, isApproved: true } }),
    prisma.review.count({
      where: { tenantId, isApproved: true, isPositive: true },
    }),
    prisma.review.aggregate({
      where: { tenantId, isApproved: true },
      _avg: { rating: true },
    }),
  ]);

  return {
    averageRating: ratingAgg._avg.rating ?? 0,
    totalApproved,
    totalPositive: positiveApproved,
  };
};

// getApprovedReviewsAction — listar aprobadas para testimonios
export const getApprovedReviewsAction = withAction(async (input, user) => {
  const tenantId = requireTenant(user);
  const { limit = 3, orderBy = 'rating_desc' } = input ?? {};

  const order: Prisma.ReviewOrderByWithRelationInput =
    orderBy === 'newest' ? { createdAt: 'desc' } : { rating: 'desc' };

  const reviews = await prisma.review.findMany({
    where: { tenantId, isApproved: true },
    orderBy: [order, { createdAt: 'desc' }],
    take: limit,
    include: {
      user: { select: { name: true, avatar: true } },
    },
  });

  return { reviews };
});

// getApprovedReviewsPublicAction — para landing pública
export const getApprovedReviewsPublicAction = async (input?: { limit?: number }) => {
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
  if (!tenantId) return { reviews: [] };

  const { limit = 3 } = input ?? {};

  const reviews = await prisma.review.findMany({
    where: { tenantId, isApproved: true },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      user: { select: { name: true, avatar: true } },
    },
  });

  return { reviews };
};

// canPromptReviewAction — verifica si debe mostrar dialog
export const canPromptReviewAction = withAction(async (_, user) => {
  const tenantId = requireTenant(user);

  const [existingReview, todayPrompt, lastSession] = await Promise.all([
    prisma.review.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.userId } },
    }),
    prisma.reviewPrompt.findFirst({
      where: {
        tenantId,
        userId: user.userId,
        promptedAt: { gte: startOfDay(new Date()) },
      },
    }),
    prisma.userSession.findFirst({
      where: { userId: user.userId, isActive: true },
      orderBy: { lastActive: 'desc' },
      select: { lastActive: true },
    }),
  ]);

  if (existingReview) return { canPrompt: false };
  if (todayPrompt) return { canPrompt: false };

  const isActiveRecently =
    lastSession &&
    lastSession.lastActive > new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (!isActiveRecently) return { canPrompt: false };

  return { canPrompt: true };
});

// dismissReviewPromptAction — cerrar dialog sin enviar
export const dismissReviewPromptAction = withAction(async (_, user) => {
  const tenantId = requireTenant(user);

  await prisma.reviewPrompt.create({
    data: { tenantId, userId: user.userId, dismissedAt: new Date() },
  });

  return { success: true };
});
```

### 4. Component Implementations

#### 4.1 ReviewStars (client component)
- Estado local `hoveredRating` para hover highlight
- SVG星星 clickeables con colores condicionales
- `size` prop → 'sm': h-4 w-4, 'md': h-5 w-5, 'lg': h-6 w-6
- `interactive` prop → permite hover+click vs solo display

#### 4.2 ReviewDialog (client component)
- `useReviewDialog` hook retorna `{ show, setShow }`
- Dialog de shadcn/ui (`Dialog`, `DialogContent`, `DialogHeader`)
- 5 ReviewStars interactivos + TextArea + botones
- Al submit: loading state, call action, toast success/error

#### 4.3 ReviewHeroBadge (server component)
- Async component que llama `getReviewStatsPublicAction()`
- Si `totalPositive < 3` → retorna null
- Renderiza: estrellas + rating + "X reseñas" + "X empresas activas"

#### 4.4 RealTestimonials (server component)
- Async component que llama `getApprovedReviewsPublicAction({ limit: 3 })`
- Si `reviews.length === 0` → retorna null
- Renderiza: misma estructura de cards que testimonios actuales

### 5. Integration Points

#### 5.1 Landing Page (page.tsx)
```tsx
// Hero section — ReviewHeroBadge se renderiza dentro del hero si hay datos
<LandingHero ... />
  {/* Dentro de LandingHero, junto a la imagen: */}
  <ReviewHeroBadge />

// Testimonios section — reemplazar LandingTestimonials
{/* @ts-expect-error Async Server Component */}
<RealTestimonials />
```

#### 5.2 Authenticated Layout
```tsx
// src/app/busy/layout.tsx — agregar hook
'use client';
import { useReviewDialog } from '@/features/reviews/hooks/use-review-dialog';
// ...
function BusyLayout({ children }) {
  useReviewDialog(); // orquesta check + display
  return ( ... );
}
```

#### 5.3 Admin Reviews Page
```tsx
// src/app/busy/reviews/page.tsx — server component
// Llama getApprovedReviewsAction + getReviewStatsAction
// Muestra tabla con pendientes y aprobadas
// Botones de aprobar/rechazar
```

### 6. Validation Split

| Capa | Validación |
|---|---|
| **Client** (ReviewDialog) | Rating requerido (1-5), comment max 500 chars |
| **Server** (submitReviewAction) | Zod schema + unique constraint + isPositive calc |
| **Server** (approve/reject) | Rol admin/manager + tenant match |
| **Database** | Unique constraint (tenantId + userId), check rating IN(1-5) |

### 7. Toast Messages

| Acción | Success | Error |
|---|---|---|
| Enviar reseña | "¡Gracias por tu reseña! Será visible tras revisión." | "No se pudo enviar tu reseña. Intentalo de nuevo." |
| Aprobar reseña | "Reseña aprobada y visible en la página." | "Error al aprobar reseña." |
| Rechazar reseña | "Reseña rechazada y eliminada." | "Error al rechazar reseña." |
| Cerrar dialog | — | — |
