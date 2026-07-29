'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, CheckCircle2 } from 'lucide-react';

import { FEATURE_ITEMS } from '@/features/landing/data';
import { SpringSection } from '@/features/landing/utils';
import { cn } from '@/lib/utils';

const CAPABILITY_GROUPS = [
  {
    label: 'Operación diaria',
    description: 'Vendé, comprá y mové inventario sin perder el hilo entre áreas.',
    featureIndexes: [1, 2, 3, 4],
  },
  {
    label: 'Control financiero',
    description: 'Convertí cada movimiento operativo en información financiera útil.',
    featureIndexes: [0, 5, 8],
  },
  {
    label: 'Escala del negocio',
    description: 'Coordiná personas, producción y procesos con una misma base de datos.',
    featureIndexes: [6, 7],
  },
] as const;

/**
 * @description Presenta las capacidades del producto como tres capas operativas compactas.
 * @returns {JSX.Element} Sección editorial de capacidades del sistema.
 */
export function LandingFeatures(): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <section id="caracteristicas" className="space-y-12 scroll-mt-24">
      <SpringSection
        className="grid gap-6 border-b border-border/70 pb-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end"
        reduceMotion={Boolean(reduceMotion)}
      >
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary font-mono">
            Un sistema, tres capas
          </p>
          <h2 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl font-mono tracking-display">
            Todo lo que tu operación necesita en un solo lugar
          </h2>
        </div>
        <p className="max-w-2xl text-muted-foreground sm:text-lg lg:justify-self-end">
          FinanceMDM conecta el trabajo diario, el control financiero y el crecimiento del
          negocio sin obligarte a saltar entre sistemas desconectados.
        </p>
      </SpringSection>

      <div className="space-y-14">
        {CAPABILITY_GROUPS.map((group, groupIndex) => (
          <section
            key={group.label}
            aria-labelledby={`capability-group-${groupIndex}`}
            className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:gap-10"
          >
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="text-xs font-semibold text-primary font-mono">
                0{groupIndex + 1}
              </span>
              <h3
                id={`capability-group-${groupIndex}`}
                className="mt-2 text-2xl font-semibold font-mono"
              >
                {group.label}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {group.description}
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2">
              {group.featureIndexes.map((featureIndex, featurePosition) => {
                const feature = FEATURE_ITEMS[featureIndex];
                const Icon = feature.icon;

                return (
                  <motion.article
                    key={feature.title}
                    initial={reduceMotion ? false : { y: 16 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ delay: reduceMotion ? 0 : featurePosition * 0.04 }}
                    className={cn(
                      'group bg-background p-6 transition-colors hover:bg-muted/40 sm:p-7',
                      group.featureIndexes.length === 3 && featurePosition === 0 && 'sm:col-span-2',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <ArrowDownRight
                        className={cn(
                          'h-5 w-5 text-muted-foreground/50',
                          !reduceMotion &&
                            'transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5',
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <h4 className="mt-8 text-xl font-semibold font-mono">{feature.title}</h4>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                    <details className="mt-6 border-t border-border/60 pt-4">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-primary font-mono">
                        Ver capacidades
                        <span className="sr-only"> de {feature.title}</span>
                      </summary>
                      <ul className="mt-4 grid gap-2 text-xs text-foreground/75 sm:grid-cols-2">
                        {feature.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2">
                            <CheckCircle2
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </motion.article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
