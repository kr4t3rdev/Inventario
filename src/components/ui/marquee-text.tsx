'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * @description Texto scrolleando infinito horizontal (marquee).
 *              Usado en la landing para mostrar features, stats o keywords.
 * @param {{ text: string; speed?: number; direction?: 'left' | 'right'; className?: string }} props
 * @returns {JSX.Element} Marquee animado
 */
export function MarqueeText({
  text,
  speed = 30,
  direction = 'left',
  className = '',
}: {
  text: string;
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const content = `${text}  •  ${text}  •  ${text}  •  ${text}  •  `;
  const effectiveSpeed = reduceMotion ? speed * 3 : speed;

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
        <span className="text-muted-foreground/40 font-mono text-sm tracking-[0.2em] uppercase">
          {content}
        </span>
      </motion.div>
    </div>
  );
}
