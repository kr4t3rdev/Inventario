'use client';

import React from 'react';
import { motion } from 'framer-motion';

import { STATS } from '@/features/landing/data';
import { AnimatedCounter, SpringSection } from '@/features/landing/utils';

/**
 * @description Sección de estadísticas animadas con contadores.
 * @param {{ reduceMotion?: boolean }} props
 * @returns {JSX.Element} Grid de estadísticas
 */
export function LandingStats({ reduceMotion }: { reduceMotion?: boolean }): React.JSX.Element {
  return (
    <SpringSection>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
            whileHover={{ y: -6, scale: 1.03, transition: { type: 'spring', stiffness: 200, damping: 15 } }}
            className="group rounded-2xl border border-border/60 bg-card/50 p-5 text-center transition-colors hover:border-primary/30"
          >
            <p className="text-4xl font-bold tracking-tight text-cyan-accent sm:text-5xl font-mono">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} reduceMotion={!!reduceMotion} />
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </SpringSection>
  );
}
