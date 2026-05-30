'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Building2, Users } from 'lucide-react';

import {
  getActiveTenantsCountAction,
  getReviewStatsPublicAction,
} from '@/features/reviews/actions';

interface ReviewStats {
  averageRating: number;
  totalApproved: number;
  totalPositive: number;
}

/**
 * @description Social proof dinámico para el Hero de la landing.
 * Rating de reseñas: solo si >= 3 reseñas positivas aprobadas.
 * Empresas activas: solo si hay tenants con licencia activa.
 * Si ninguno tiene datos, retorna null (se oculta todo).
 * @returns {JSX.Element | null} Barra de social proof o null
 */
export function HeroSocialProof(): React.JSX.Element | null {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [activeTenants, setActiveTenants] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getReviewStatsPublicAction(),
      getActiveTenantsCountAction(),
    ]).then(([s, tenants]) => {
      setStats(s);
      setActiveTenants(tenants);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return null;

  const hasReviews = stats && stats.totalPositive >= 3;
  const hasTenants = activeTenants > 0;

  // Si nada tiene datos, no se muestra
  if (!hasReviews && !hasTenants) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="flex flex-wrap items-center gap-6 border-t border-border/40 pt-6"
    >
      {/* Rating — solo si hay >= 3 reseñas positivas */}
      {hasReviews && (
        <div className="flex items-center gap-2">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i < Math.floor(stats.averageRating);
              const half =
                !filled &&
                i === Math.floor(stats.averageRating) &&
                stats.averageRating - Math.floor(stats.averageRating) >= 0.5;

              return (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
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
          <span className="text-sm font-semibold font-mono">
            {stats.averageRating.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground/60 font-mono">
            ({stats.totalApproved} reseña{stats.totalApproved !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* Empresas activas — solo si hay tenants reales */}
      {hasTenants && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold font-mono">{activeTenants}</span>
          <span className="text-xs text-muted-foreground/60 font-mono">
            empresa{activeTenants !== 1 ? 's' : ''} activa{activeTenants !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </motion.div>
  );
}
