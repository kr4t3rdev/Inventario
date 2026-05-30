'use client';

import React, { useEffect, useState } from 'react';
import { Star, TrendingUp } from 'lucide-react';

import { getReviewStatsPublicAction } from '@/features/reviews/actions';

interface ReviewStats {
  averageRating: number;
  totalApproved: number;
  totalPositive: number;
}

/**
 * @description Badge condicional para el Hero de la landing.
 * Solo se renderiza si hay >= 3 reseñas positivas aprobadas.
 * Versión cliente para usar dentro de page.tsx ('use client').
 * @returns {JSX.Element | null} Badge o null
 */
export function ReviewHeroBadge(): React.JSX.Element | null {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getReviewStatsPublicAction().then((result) => {
      setStats(result);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return null;
  if (!stats || stats.totalPositive < 3) return null;

  const fullStars = Math.floor(stats.averageRating);
  const hasHalf = stats.averageRating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const starIdx = i + 1;
          const filled = starIdx <= fullStars;
          const half = !filled && starIdx === fullStars + 1 && hasHalf;

          return (
            <Star
              key={i}
              className={`h-4 w-4 ${
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : half
                    ? 'fill-amber-400/50 text-amber-400'
                    : 'fill-muted-foreground/20 text-muted-foreground/20'
              }`}
            />
          );
        })}
      </div>
      <div className="text-left">
        <p className="text-lg font-bold font-mono leading-tight">
          {stats.averageRating.toFixed(1)}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {stats.totalApproved} reseña{stats.totalApproved !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 border-l border-border/40 pl-4">
        <TrendingUp className="h-4 w-4 text-cyan-accent" />
        <p className="text-xs text-muted-foreground font-mono">
          <span className="font-semibold text-cyan-accent">{stats.totalPositive}</span> positivas
        </p>
      </div>
    </div>
  );
}
