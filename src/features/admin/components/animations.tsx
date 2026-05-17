'use client';

import type { ReactNode } from 'react';
import { LazyMotion, m as motion, useReducedMotion, type Variants } from 'framer-motion';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/lib/design-system/tokens/motion-tokens';

interface AdminRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

interface AdminStaggerProps {
  children: ReactNode;
  className?: string;
  staggerChildren?: number;
  delayChildren?: number;
}

interface AdminTableLoaderProps {
  columns: number;
  rows?: number;
  className?: string;
  caption?: string;
}

interface AdminCardsLoaderProps {
  cards?: number;
  className?: string;
}

function createStaggerVariants(
  shouldReduceMotion: boolean | null,
  staggerChildren: number,
  delayChildren: number,
): Variants {
  if (shouldReduceMotion) {
    return {
      hidden: { opacity: 1 },
      visible: { opacity: 1 },
    };
  }

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}

export function AdminReveal({
  children,
  className,
  delay = 0,
}: AdminRevealProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: motionTokens.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : motionTokens.duration.fast,
        ease: motionTokens.easing.standard,
        delay: shouldReduceMotion ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

export function AdminStagger({
  children,
  className,
  staggerChildren = motionTokens.stagger.normal,
  delayChildren = motionTokens.duration.fast,
}: AdminStaggerProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const variants = createStaggerVariants(
    shouldReduceMotion,
    staggerChildren,
    delayChildren,
  );

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function AdminTableLoader({
  columns,
  rows = 6,
  className,
  caption = 'Cargando datos...',
}: AdminTableLoaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, columnIndex) => (
          <Skeleton key={`header-${columnIndex}`} className="h-4 w-3/4 animate-pulse-subtle" />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-9 w-full animate-pulse rounded-md"
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

export function AdminCardsLoader({
  cards = 4,
  className,
}: AdminCardsLoaderProps): React.JSX.Element {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={`card-loader-${index}`}
          className="rounded-xl border bg-card p-5 shadow-sm"
        >
          <Skeleton className="mb-3 h-4 w-24 animate-pulse-subtle" />
          <Skeleton className="mb-2 h-8 w-16 animate-pulse" />
          <Skeleton className="h-3 w-28 animate-pulse-subtle" />
        </div>
      ))}
    </div>
  );
}

// Re-export standard animations for convenience
export {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard,
  FadeIn,
  LoadingSpinner,
  LoadingDots,
  PulseSkeleton,
} from '@/components/ui/animations';
