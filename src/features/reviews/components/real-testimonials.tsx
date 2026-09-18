'use client';

import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';
import { SpringSection } from '@/features/landing/utils';
import { getApprovedReviewsPublicAction, type ReviewWithUser } from '@/features/reviews/actions';

const MINIMUM_TESTIMONIALS = 10;
const DISPLAYED_TESTIMONIALS = 3;

/**
 * @description Sección de testimonios con reseñas reales aprobadas.
 * Solo aparece cuando existen al menos diez testimonios aprobados.
 * @returns {JSX.Element | null} Cards de testimonios o null
 */
export function RealTestimonials(): React.JSX.Element | null {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    getApprovedReviewsPublicAction({ limit: MINIMUM_TESTIMONIALS })
      .then((result) => setReviews(result.reviews as any))
      .catch(() => setReviews([]))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || reviews.length < MINIMUM_TESTIMONIALS) return null;

  const displayedReviews = reviews.slice(0, DISPLAYED_TESTIMONIALS);

  return (
    <section id="testimonios" className="space-y-10 scroll-mt-24">
      <SpringSection className="max-w-3xl space-y-3" reduceMotion={Boolean(reduceMotion)}>
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
          Testimonios de clientes
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          Usuarios reales de FinanceMDM comparten su experiencia.
        </p>
      </SpringSection>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {displayedReviews.map((review, index) => (
          <motion.div key={review.reviewId} initial={reduceMotion ? false : { y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={reduceMotion ? undefined : { delay: index * 0.06 }} className={index === 0 ? 'lg:row-span-2' : ''}>
          <Card
            key={review.reviewId}
            className="h-full border-border/60 bg-card/80 shadow-sm transition-colors hover:bg-muted/20"
          >
            <CardContent className="flex flex-col gap-4 p-6">
              <svg aria-hidden="true"
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
                <span className="sr-only">Calificación: {review.rating} de 5 estrellas</span>
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
                  {(review.user as any)?.name
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold font-mono">{(review.user as any)?.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
