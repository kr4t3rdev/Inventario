'use client';

import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  currency?: string;
  prefix?: string;
  isInteger?: boolean;
  className?: string;
}

export function AnimatedNumber({ 
  value, 
  currency = '', 
  prefix = '', 
  isInteger = false,
  className 
}: AnimatedNumberProps) {
  const spring = useSpring(0, { stiffness: 50, damping: 15 });
  const display = useTransform(spring, (current) => {
    // Format the number as currency
    const formatted = current.toLocaleString('es-ES', {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    });
    return `${prefix}${currency ? currency + ' ' : ''}${formatted}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
