'use client';

import { LazyMotion, m as motion, AnimatePresence, useReducedMotion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/lib/design-system/tokens/motion-tokens';
import {
  pageVariants,
  cardVariants,
  dialogVariants,
  backdropVariants,
  tableRowVariants,
} from '@/lib/design-system/variants/motion-variants';

// Hook para evitar hydration mismatch en animaciones
function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  return hasMounted;
}

// --- Page Transition ---

interface PageTransitionProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

export function PageTransition({ children, className, ...props }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  const variants: Variants = {
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : motionTokens.distance.medium },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -motionTokens.distance.small },
  };

  return (
    <motion.div
      initial={hasMounted ? "initial" : false}
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.enter }}
      className={cn("w-full", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Stagger Container ---

interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  staggerDelay?: number;
  delay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = motionTokens.stagger.normal,
  delay = 0,
  ...props
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  const container: Variants = shouldReduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay || motionTokens.duration.fast,
          },
        },
      };

  return (
    <motion.div
      variants={container}
      initial={hasMounted ? "hidden" : false}
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Stagger Item ---

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  const item: Variants = shouldReduceMotion
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: motionTokens.distance.medium },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: motionTokens.duration.normal,
            ease: motionTokens.easing.standard,
          },
        },
      };

  return (
    <motion.div
      variants={item}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Animated Card ---

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  hoverEffect?: boolean;
}

export function AnimatedCard({ children, className, hoverEffect = true, ...props }: AnimatedCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : cardVariants}
      initial={hasMounted ? (shouldReduceMotion ? undefined : "hidden") : false}
      animate={shouldReduceMotion ? undefined : "visible"}
      whileHover={!shouldReduceMotion && hoverEffect ? { y: -4, transition: { duration: motionTokens.duration.fast } } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Fade In ---

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
}

export function FadeIn({ children, className, delay = 0, duration = motionTokens.duration.normal, ...props }: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  return (
    <motion.div
      initial={hasMounted ? (shouldReduceMotion ? undefined : { opacity: 0 }) : false}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : duration, delay: shouldReduceMotion ? 0 : delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Slide In ---

interface SlideInProps extends HTMLMotionProps<'div'> {
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
}

export function SlideIn({ children, className, direction = 'up', delay = 0, ...props }: SlideInProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  const directions = {
    up: { y: motionTokens.distance.medium },
    down: { y: -motionTokens.distance.medium },
    left: { x: motionTokens.distance.medium },
    right: { x: -motionTokens.distance.medium },
  };

  return (
    <motion.div
      initial={hasMounted ? (shouldReduceMotion ? undefined : directions[direction]) : false}
      animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
      transition={{ duration: motionTokens.duration.normal, delay: shouldReduceMotion ? 0 : delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Dialog Animation ---

interface DialogAnimationProps {
  children: ReactNode;
  isOpen: boolean;
}

export function DialogAnimation({ children, isOpen }: DialogAnimationProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={dialogVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Backdrop Animation ---

interface BackdropAnimationProps {
  children: ReactNode;
  isOpen: boolean;
}

export function BackdropAnimation({ children, isOpen }: BackdropAnimationProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Table Row ---

interface TableRowProps extends HTMLMotionProps<'tr'> {
  children: ReactNode;
  index?: number;
}

export function AnimatedTableRow({ children, className, index = 0, ...props }: TableRowProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  return (
    <motion.tr
      variants={shouldReduceMotion ? undefined : tableRowVariants(index)}
      initial={hasMounted ? (shouldReduceMotion ? undefined : "hidden") : false}
      animate={shouldReduceMotion ? undefined : "visible"}
      className={className}
      {...props}
    >
      {children}
    </motion.tr>
  );
}

// --- Loading Spinner ---

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 24, className }: LoadingSpinnerProps) {
  return (
    <motion.div
      className={cn("border-2 border-primary border-t-transparent rounded-full", className)}
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// --- Loading Dots ---

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-primary rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// --- Pulse Skeleton ---

interface PulseSkeletonProps {
  className?: string;
}

export function PulseSkeleton({ className }: PulseSkeletonProps) {
  return (
    <motion.div
      className={cn("bg-muted rounded animate-pulse", className)}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// --- Hover Scale ---

interface HoverScaleProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function HoverScale({ children, className, scale = 1.02 }: HoverScaleProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { scale }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: motionTokens.duration.fast }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// --- Animated Number ---

interface AnimatedNumberProps {
  value: number;
  formatter?: (value: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, formatter, className }: AnimatedNumberProps) {
  return (
    <span className={className}>
      {formatter ? formatter(value) : value}
    </span>
  );
}

// --- Re-export tokens and variants for advanced usage ---

export { motionTokens };
