'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

import { SpringSection } from '@/features/landing/utils';
import { getLandingStatsPublicAction, type LandingStats } from '@/features/reviews/actions';

interface StatCard {
  value: number;
  suffix: string;
  label: string;
}

/**
 * @description Sección de estadísticas con datos reales del sistema.
 * Cada valor se consulta de la BD (almacenes, ventas, clientes).
 * Módulos activos es un valor fijo (rutas /busy/).
 * @returns {JSX.Element | null} Grid de stats animados o null si no hay datos
 */
export function LandingStatsDynamic(): React.JSX.Element | null {
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLandingStatsPublicAction().then((data) => {
      setStats(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return null;
  if (!stats) return null;

  const cards: StatCard[] = [
    { value: stats.modulosActivos, suffix: '', label: 'Módulos clave integrados' },
    { value: stats.almacenes, suffix: '', label: 'Sucursales activas' },
    { value: stats.ventasProcesadas, suffix: '+', label: 'Ventas procesadas' },
    { value: stats.clientesRegistrados, suffix: '+', label: 'Clientes registrados' },
  ];

  return (
    <section className="space-y-10">
      <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
        <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
          En números
        </span>
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
          Resultados que hablan solos
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          Datos reales de la plataforma FinanceMDM.
        </p>
      </SpringSection>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <AnimatedStatCard key={card.label} {...card} index={i} />
        ))}
      </div>
    </section>
  );
}

function AnimatedStatCard({ value, suffix, label, index }: StatCard & { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const duration = 1800;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), value);
      setDisplayed(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayed(value);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
      className="rounded-xl border border-border/60 bg-card/80 p-6 text-center shadow-md transition-all duration-300 hover:border-primary/25 hover:shadow-lg"
    >
      <p className="text-4xl font-bold font-mono tracking-tight text-cyan-accent">
        {displayed.toLocaleString()}
        <span className="text-2xl">{suffix}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground font-mono">{label}</p>
    </motion.div>
  );
}
