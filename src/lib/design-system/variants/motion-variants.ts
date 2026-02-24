/**
 * @description Variantes de animación predefinidas para toda la aplicación.
 *              Usar estas variantes para mantener consistencia visual.
 */

import type { Variants } from 'framer-motion';
import { motionTokens } from '../tokens/motion-tokens';

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.medium },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.slow,
      ease: motionTokens.easing.enter,
    },
  },
  exit: {
    opacity: 0,
    y: -motionTokens.distance.small,
    transition: { duration: motionTokens.duration.fast },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.medium, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.enter,
    },
  },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.standard,
    },
  },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.enter,
    },
  },
};

export const slideInFromRightVariants: Variants = {
  hidden: { opacity: 0, x: motionTokens.distance.medium },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.standard,
    },
  },
};

export const slideInFromLeftVariants: Variants = {
  hidden: { opacity: 0, x: -motionTokens.distance.medium },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.standard,
    },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: motionTokens.stagger.normal,
      delayChildren: motionTokens.duration.fast,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.medium },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.normal,
      ease: motionTokens.easing.standard,
    },
  },
};

export const tableRowVariants = (index: number): Variants => ({
  hidden: { opacity: 0, x: -motionTokens.distance.small },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      delay: index * motionTokens.stagger.tight,
      duration: motionTokens.duration.fast,
      ease: motionTokens.easing.standard,
    },
  },
});

export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: motionTokens.distance.small },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.fast,
      ease: motionTokens.easing.standard,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: motionTokens.distance.small,
    transition: {
      duration: motionTokens.duration.fast,
      ease: motionTokens.easing.exit,
    },
  },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// --- Aliases para backwards compatibility ---

export const fadeInUp = fadeInVariants;
export const fadeIn = fadeInVariants;
export const staggerContainer = staggerContainerVariants;
export const scaleIn = scaleInVariants;
export const slideInFromRight = slideInFromRightVariants;
export const slideInFromLeft = slideInFromLeftVariants;
