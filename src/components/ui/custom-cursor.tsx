'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useReducedMotion } from 'framer-motion';

/**
 * @description Cursor personalizado que sigue el mouse con animación spring.
 *              Se agranda al hacer hover sobre elementos interactivos.
 *              Se oculta automáticamente en touch devices y reduced motion.
 */
export function CustomCursor(): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const [isPointer, setIsPointer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Spring-tracked mouse position
  const x = useSpring(0, { stiffness: 300, damping: 25 });
  const y = useSpring(0, { stiffness: 300, damping: 25 });

  useEffect(() => {
    // Hide on touch devices or reduced motion
    if (reduceMotion || 'ontouchstart' in window) {
      return;
    }

    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') !== null ||
        target.closest('button') !== null ||
        target.closest('[data-cursor-hover]') !== null ||
        target.closest('[role="button"]') !== null ||
        target.closest('input') !== null ||
        target.closest('select') !== null ||
        target.closest('textarea') !== null ||
        getComputedStyle(target).cursor === 'pointer';
      setIsPointer(!!isInteractive);
    };

    const handleMouseLeave = () => setIsPointer(false);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseover', handleMouseOver, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [x, y, reduceMotion]);

  if (!isVisible || reduceMotion) return null;

  return (
    <>
      {/* Outer ring — follows with spring lag */}
      <motion.div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40 mix-blend-difference"
        style={{
          x,
          y,
          width: isPointer ? 48 : 32,
          height: isPointer ? 48 : 32,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      />
      {/* Inner dot — follows precisely */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70 mix-blend-difference"
        style={{
          x,
          y,
          width: isPointer ? 8 : 6,
          height: isPointer ? 8 : 6,
        }}
      />
    </>
  );
}
