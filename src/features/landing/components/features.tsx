'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

import { FEATURE_ITEMS } from '@/features/landing/data';
import { SpringSection } from '@/features/landing/utils';

/**
 * @description Muestra las capacidades principales como una matriz modular con una capacidad destacada.
 * @returns {JSX.Element} Sección de características
 */
export function LandingFeatures(): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [featured, ...supporting] = FEATURE_ITEMS;
  const FeaturedIcon = featured.icon;

  return (
    <section id="caracteristicas" className="space-y-12 scroll-mt-24">
      <SpringSection className="max-w-3xl space-y-4" reduceMotion={Boolean(reduceMotion)}>
        <h2 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl font-mono tracking-display">
          Todo lo que tu operación necesita en un solo lugar
        </h2>
        <p className="max-w-2xl text-muted-foreground sm:text-lg">
          Cada módulo está diseñado para reducir fricción operativa y acelerar la toma de decisiones estratégicas.
        </p>
      </SpringSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <motion.article
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          className="rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9"
        >
          <FeaturedIcon className="mb-12 h-8 w-8" aria-hidden="true" />
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] opacity-75">Base operativa</p>
          <h3 className="text-2xl font-bold font-mono sm:text-3xl">{featured.title}</h3>
          <p className="mt-4 max-w-xl text-primary-foreground/80">{featured.description}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {featured.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </motion.article>

        <div className="divide-y divide-border/70 rounded-2xl border border-border/60 bg-card/50 px-6">
          {supporting.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.04 }}
                className="grid gap-4 py-5 sm:grid-cols-[auto_1fr] sm:items-start"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold font-mono">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  <ul className="mt-3 grid gap-1.5 text-xs text-foreground/75" aria-label={`Capacidades de ${feature.title}`}>
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
