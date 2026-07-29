'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

import { BENEFIT_ITEMS } from '@/features/landing/data';
import { ParallaxLayer } from '@/features/landing/utils';

/**
 * @description Explica los beneficios como una secuencia de decisiones operativas, junto a una vista del producto.
 * @returns {JSX.Element} Sección de beneficios
 */
export function LandingBenefits(): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <section id="beneficios" className="grid items-start gap-10 scroll-mt-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div className="space-y-6">
        <h2 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl font-mono tracking-display">
          Menos tareas manuales, más control del negocio
        </h2>
        <p className="max-w-xl text-muted-foreground sm:text-lg">
          FinanceMDM te permite operar con velocidad y precisión desde cualquier área: administración, ventas, inventario y finanzas.
        </p>
        <ParallaxLayer speed={0.12} reduceMotion={Boolean(reduceMotion)}>
          <div className="overflow-hidden rounded-asymmetric-tr-bl border border-primary/20 bg-card p-2">
            <Image src="/images/Beneficios.jpg" alt="Dashboard de análisis financiero" width={760} height={560} className="h-auto w-full rounded-xl object-cover" />
          </div>
        </ParallaxLayer>
      </div>
      <ol className="space-y-0 border-t border-border/70">
        {BENEFIT_ITEMS.map((benefit, index) => {
          const Icon = benefit.icon;
          return (
            <motion.li key={benefit.title} initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: reduceMotion ? 0 : index * 0.05 }} className="grid gap-4 border-b border-border/70 py-6 sm:grid-cols-[3rem_1fr]">
              <span className="text-sm font-semibold text-primary font-mono">0{index + 1}</span>
              <div>
                <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><h3 className="text-xl font-semibold font-mono">{benefit.title}</h3></div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
