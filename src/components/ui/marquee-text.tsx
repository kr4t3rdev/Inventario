'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** @description Item individual del marquee con icono opcional */
export type MarqueeItem = {
  icon?: React.ReactNode;
  label?: string;
};

/**
 * @description Texto scrolleando infinito horizontal (marquee).
 *              Usado en la landing para mostrar features, stats, keywords o tech stack.
 * @param {{ text?: string; items?: MarqueeItem[]; speed?: number; direction?: 'left' | 'right'; className?: string; iconSize?: number }} props
 * @returns {JSX.Element} Marquee animado
 */
export function MarqueeText({
  text,
  items,
  speed = 30,
  direction = 'left',
  className = '',
  iconSize = 14,
}: {
  text?: string;
  items?: MarqueeItem[];
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
  iconSize?: number;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const effectiveSpeed = reduceMotion ? speed * 3 : speed;

  const iconPx = `${iconSize * 4}px`;

  let content: React.ReactNode;

  if (items) {
    const repeated = [...items, ...items, ...items, ...items];
    const hasLabels = items.some((item) => item.label && item.label.length > 0);

    content = (
      <span
        className={`inline-flex items-center ${
          hasLabels
            ? 'gap-1 text-muted-foreground/40 font-mono text-sm tracking-[0.2em] uppercase'
            : 'gap-8'
        }`}
      >
        {repeated.map((item, i) => (
          <React.Fragment key={`${item.label ?? 'icon'}-${i}`}>
            {i > 0 && hasLabels && <span className="mx-3">•</span>}
            <span className="inline-flex items-center gap-1.5">
              {item.icon && (
                <motion.span
                  className="icon-float flex items-center justify-center"
                  style={{
                    width: iconPx,
                    height: iconPx,
                    animationDelay: `${(i % items.length) * 0.15}s`,
                    animationDuration: `${reduceMotion ? 0 : 3 + (i % items.length) * 0.2}s`,
                  }}
                  whileHover={reduceMotion ? undefined : { scale: 1.2, filter: 'brightness(1.3)' }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                >
                  {React.isValidElement(item.icon)
                    ? React.cloneElement(item.icon as React.ReactElement<{ style?: React.CSSProperties }>, {
                        style: { width: '100%', height: '100%' },
                      })
                    : item.icon}
                </motion.span>
              )}
              {item.label && <span>{item.label}</span>}
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
      <style>{`
        @keyframes icon-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        .icon-float {
          animation: icon-float ease-in-out infinite;
        }
      `}</style>
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
