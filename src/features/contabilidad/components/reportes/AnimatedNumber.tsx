"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  currency?: string;
  prefix?: string;
  isInteger?: boolean;
}

export function AnimatedNumber({ value, currency = '', prefix = '', isInteger = false }: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const spring = useSpring(0, { stiffness: 50, damping: 15 });
  const display = useTransform(spring, (current) => {
    const formatted = current.toLocaleString('es-ES', {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    });
    return `${prefix}${currency ? currency + ' ' : ''}${formatted}`;
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      spring.jump(value);
    } else {
      spring.set(value);
    }
  }, [shouldReduceMotion, spring, value]);

  return <motion.span>{display}</motion.span>;
}
