'use client';

import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { SpringSection } from '@/features/landing/utils';
import { getApprovedReviewsPublicAction, type ReviewWithUser } from '@/features/reviews/actions';

/**
 * @description Sección de testimonios con reseñas reales aprobadas.
 * Si no hay reseñas, retorna null y la sección no se renderiza.
 * Versión cliente para usar dentro de page.tsx ('use client').
 * @returns {JSX.Element | null} Cards de testimonios o null
 */
export function RealTestimonials(): React.JSX.Element | null {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getApprovedReviewsPublicAction({ limit: 3 }).then((result) => {
      setReviews(result.reviews);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return null;
  if (reviews.length === 0) return null;

  return (
    <section id="testimonios" className="space-y-10 scroll-mt-24">
      <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
        <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
          Testimonios
        </span>
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
          Lo que dicen nuestros clientes
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          Usuarios reales de FinanceMDM comparten su experiencia.
        </p>
      </SpringSection>

      <div className="grid gap-5 md:grid-cols-3">
        {reviews.map((review) => (
          <Card
            key={review.reviewId}
            className="h-full border-border/60 bg-card/80 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-lg"
          >
            <CardContent className="flex flex-col gap-4 p-6">
              <svg
                className="h-8 w-8 text-primary/40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M10 11h-4v-4h4v4zm8 0h-4v-4h4v4z" />
                <path d="M10 13l-4 5h4l-4-5zm8 0l-4 5h4l-4-5z" />
              </svg>

              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < review.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-muted-foreground/20 text-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>

              {review.comment && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{review.comment}&rdquo;
                </p>
              )}

              <div className="mt-auto flex items-center gap-3 pt-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary font-mono">
                  {review.user.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold font-mono">{review.user.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
