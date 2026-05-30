'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FEATURE_ITEMS } from '@/features/landing/data';
import { SpringSection } from '@/features/landing/utils';

/**
 * @description Sección de características con cards animadas.
 * @returns {JSX.Element} Grid de features
 */
export function LandingFeatures(): React.JSX.Element {
  return (
    <section id="caracteristicas" className="space-y-10 scroll-mt-24">
      <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
        <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
          Características
        </span>
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
          Todo lo que tu operación necesita en un solo lugar
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          Cada módulo está diseñado para reducir fricción operativa y acelerar la toma de
          decisiones estratégicas.
        </p>
      </SpringSection>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {FEATURE_ITEMS.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.08 }}
              whileHover={{ y: -8, scale: 1.02, transition: { type: 'spring', stiffness: 200, damping: 12 } }}
              className="group"
            >
              <Card className="h-full border-border/60 bg-card/80 shadow-md shadow-black/[0.03] transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-xl group-hover:shadow-primary/5">
                <CardHeader>
                  <motion.div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15"
                    whileHover={{ rotate: -10, scale: 1.12, transition: { type: 'spring', stiffness: 200, damping: 10 } }}
                  >
                    <Icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </motion.div>
                  <CardTitle className="text-xl font-mono">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-[2px] h-4 w-4 text-primary" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
