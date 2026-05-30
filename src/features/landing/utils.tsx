'use client';

import React, { useEffect, useRef } from 'react';
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  type SpringOptions,
} from 'framer-motion';
import { DollarSign } from 'lucide-react';

/* ─── Spring presets ─── */

export const SPRING_BOUNCE: SpringOptions = {
  stiffness: 50,
  damping: 20,
};

/* ─── Animated Counter ─── */

/**
 * @description Contador numérico animado con spring que se activa al entrar en viewport.
 * @param {{ value: number; suffix?: string; prefix?: string; className?: string }} props
 * @returns {JSX.Element} Span con el número animado
 */
export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  className = '',
  reduceMotion = false,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  reduceMotion?: boolean;
}): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const spring = useSpring(0, SPRING_BOUNCE);
  const display = useTransform(spring, (current) => `${prefix}${Math.round(current).toLocaleString()}${suffix}`);

  useEffect(() => {
    if (reduceMotion) {
      spring.set(value);
      spring.stop();
    } else if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value, reduceMotion]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

/* ─── Preloader ─── */

/**
 * @description Loader de precarga con animaciones para suavizar la entrada del landing.
 * @param {{ reduceMotion: boolean }} props
 * @returns {JSX.Element} Capa de precarga animada
 */
export function LandingPreloader({ reduceMotion }: { reduceMotion: boolean }): React.JSX.Element {
  return (
    <motion.div
      key="preloader"
      role="status"
      aria-live="polite"
      aria-label="Cargando página de inicio"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.35 } }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 backdrop-blur-lg"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border border-primary/20"
            animate={reduceMotion ? undefined : { scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-primary/60 border-t-transparent"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
            animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <DollarSign className="h-6 w-6 text-primary" />
          </motion.div>
        </div>
        <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground font-mono">
          CARGANDO FINANCEMDM
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Spring Section Wrapper ─── */

/**
 * @description Wrapper que aplica animación fade-in + slide-up suave al entrar en viewport.
 */
export function SpringSection({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Parallax Layer ─── */

/**
 * @description Wrapper que aplica parallax scroll — el contenido se mueve a una velocidad
 *              distinta que el scroll normal, creando profundidad.
 * @param {{ children: React.ReactNode; speed?: number; className?: string; style?: React.CSSProperties }} props
 * @returns {JSX.Element} Elemento con parallax vertical
 */
export function ParallaxLayer({
  children,
  speed = 0.3,
  className,
  style,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 60, speed * -60]);

  return (
    <div ref={ref} className={className} style={{ ...style, willChange: 'transform' }}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
