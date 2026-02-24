/**
 * @description Tokens de animación para consistencia visual corporativa.
 *              Todos los valores de animación deben usar estos tokens.
 */

export const motionTokens = {
  duration: {
    instant: 0,
    fast: 0.15,
    normal: 0.3,
    slow: 0.5,
    slower: 0.7,
  },
  distance: {
    small: 8,
    medium: 20,
    large: 40,
  },
  easing: {
    enter: [0.25, 0.46, 0.45, 0.94] as const,
    standard: 'easeOut' as const,
    exit: 'easeIn' as const,
  },
  stagger: {
    tight: 0.03,
    normal: 0.08,
    loose: 0.15,
  },
} as const;

export type MotionTokens = typeof motionTokens;
