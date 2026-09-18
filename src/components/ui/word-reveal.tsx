'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * @description Animación de reveal palabra por palabra para el headline del hero.
 *              Cada palabra aparece con un delay incremental y efecto spring.
 * @param {{ text: string; className?: string; delayPerWord?: number; reduceMotion?: boolean }} props
 * @returns {JSX.Element} Texto con animación word-by-word reveal
 */
export function WordReveal({
  text,
  className = '',
  delayPerWord = 0.06,
  reduceMotion = false,
}: {
  text: string;
  className?: string;
  delayPerWord?: number;
  reduceMotion?: boolean;
}): React.JSX.Element {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="inline-block"
          initial={reduceMotion ? false : { y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 20,
            delay: 0.3 + index * delayPerWord,
          }}
          style={{ marginRight: word.endsWith('.') || word.endsWith(',') ? 0 : '0.3em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}
