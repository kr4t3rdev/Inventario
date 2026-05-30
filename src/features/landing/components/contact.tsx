'use client';

import React from 'react';
import { motion } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';
import { CONTACT_ITEMS } from '@/features/landing/data';
import { SpringSection } from '@/features/landing/utils';

/**
 * @description Sección de contacto con info de correo y WhatsApp.
 * @param {{ reduceMotion?: boolean }} props
 * @returns {JSX.Element} Contact section
 */
export function LandingContact({ reduceMotion }: { reduceMotion?: boolean }): React.JSX.Element {
  return (
    <section
      id="contacto"
      className="scroll-mt-24 rounded-asymmetric-tl-br border border-border/60 bg-muted/20 p-6 md:p-10 glow-primary"
    >
      <SpringSection className="mx-auto max-w-4xl space-y-8 text-center">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
            Contacto
          </span>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
            ¿Listo para optimizar tu operación financiera?
          </h2>
          <p className="text-muted-foreground sm:text-lg">
            Nuestro equipo puede ayudarte a definir la mejor implementación para tu negocio.
          </p>
        </div>

        <Card className="border-border/60 bg-card/90 shadow-lg shadow-black/[0.03]">
          <CardContent className="grid gap-4 p-6 text-left sm:grid-cols-2">
            {CONTACT_ITEMS.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith('https') ? '_blank' : undefined}
                  rel={item.href.startsWith('https') ? 'noreferrer' : undefined}
                  className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-4 py-3 transition-colors hover:border-primary/40"
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 15 }}
                >
                  <motion.div
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"
                    animate={reduceMotion ? undefined : { rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 2.4 + index * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                  </motion.div>
                  <div className="space-y-0.5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold group-hover:text-primary">{item.value}</p>
                  </div>
                </motion.a>
              );
            })}
          </CardContent>
        </Card>
      </SpringSection>
    </section>
  );
}
