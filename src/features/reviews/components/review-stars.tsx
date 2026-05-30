'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

/**
 * @description Componente de estrellas para calificar. Soporta modo interactivo
 *              (hover + click) y solo lectura. Escalable por prop size.
 * @param {{ rating: number; size?: 'sm' | 'md' | 'lg'; interactive?: boolean; onChange?: (r: number) => void }} props
 * @returns {JSX.Element} 5 estrellas SVG
 */
export function ReviewStars({
  rating,
  size = 'md',
  interactive = false,
  onChange,
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (r: number) => void;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(0);

  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const starClass = sizeClasses[size];

  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'} aria-label={`${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const starIndex = i + 1;
        const filled = starIndex <= (hovered || rating);
        const isHovered = hovered >= starIndex;

        return (
          <motion.button
            key={i}
            type="button"
            disabled={!interactive}
            whileHover={interactive ? { scale: 1.2 } : undefined}
            whileTap={interactive ? { scale: 0.9 } : undefined}
            onClick={() => {
              if (interactive && onChange) onChange(starIndex);
            }}
            onMouseEnter={() => {
              if (interactive) setHovered(starIndex);
            }}
            onMouseLeave={() => {
              if (interactive) setHovered(0);
            }}
            className={`${starClass} transition-colors ${
              interactive ? 'cursor-pointer' : 'cursor-default'
            } ${
              filled || isHovered
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted-foreground/20 text-muted-foreground/20'
            }`}
            aria-label={`${starIndex} estrella${starIndex > 1 ? 's' : ''}`}
            role={interactive ? 'radio' : undefined}
            aria-checked={interactive ? filled : undefined}
          >
            <Star className="h-full w-full" />
          </motion.button>
        );
      })}
    </div>
  );
}
