'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** @description Item individual del marquee con icono opcional */
export type MarqueeItem = {
  icon?: React.ReactNode;
  label: string;
};

/**
 * @description Texto scrolleando infinito horizontal (marquee).
 *              Usado en la landing para mostrar features, stats, keywords o tech stack.
 * @param {{ text?: string; items?: MarqueeItem[]; speed?: number; direction?: 'left' | 'right'; className?: string }} props
 * @returns {JSX.Element} Marquee animado
 */
export function MarqueeText({
  text,
  items,
  speed = 30,
  direction = 'left',
  className = '',
}: {
  text?: string;
  items?: MarqueeItem[];
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const effectiveSpeed = reduceMotion ? speed * 3 : speed;

  let content: React.ReactNode;

  if (items) {
    const repeated = [...items, ...items, ...items, ...items];
    content = (
      <span className="inline-flex items-center gap-1 text-muted-foreground/40 font-mono text-sm tracking-[0.2em] uppercase">
        {repeated.map((item, i) => (
          <React.Fragment key={`${item.label}-${i}`}>
            {i > 0 && <span className="mx-3">•</span>}
            <span className="inline-flex items-center gap-1.5">
              {item.icon && (
                <span className="inline-flex h-6 w-6 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </span>
          </React.Fragment>
        ))}
      </span>
    );
  } else {
    content = (
      <span className="text-muted-foreground/40 font-mono text-sm tracking-[0.2em] uppercase">
        {`${text}  •  ${text}  •  ${text}  •  ${text}  •  `}
      </span>
    );
  }

  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <motion.div
        className="inline-block"
        animate={{ x: direction === 'left' ? ['-100%', '0%'] : ['0%', '-100%'] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: effectiveSpeed,
            ease: 'linear',
          },
        }}
      >
        {content}
      </motion.div>
    </div>
  );
}
