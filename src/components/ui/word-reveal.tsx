'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * @description Animación de reveal palabra por palabra para el headline del hero.
 *              Cada palabra aparece con un delay incremental y efecto spring.
 * @param {{ text: string; className?: string; delayPerWord?: number }} props
 * @returns {JSX.Element} Texto con animación word-by-word reveal
 */
export function WordReveal({
  text,
  className = '',
  delayPerWord = 0.06,
}: {
  text: string;
  className?: string;
  delayPerWord?: number;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const words = text.split(' ');

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="inline-block"
          initial={{ opacity: 0, y: 30, rotateX: -40 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{
            type: 'spring',
            bounce: 0.35,
            duration: 1.2,
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
