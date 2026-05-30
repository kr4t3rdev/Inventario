'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { WordReveal } from '@/components/ui/word-reveal';
import { ParallaxLayer } from '@/features/landing/utils';

const SPRING_STIFF = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 15,
};

/**
 * @description Hero section con headline animado, CTAs e imagen con parallax.
 * @param {{ reduceMotion?: boolean }} props
 * @returns {JSX.Element} Sección hero del landing
 */
export function LandingHero({ reduceMotion }: { reduceMotion?: boolean }): React.JSX.Element {
  return (
    <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="space-y-8"
      >
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-accent bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma integral
          </span>
          <h1 className="max-w-2xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl font-mono leading-[1.05] tracking-display">
            <WordReveal text="Gestión financiera e inventario con experiencia premium." />
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            FinanceMDM conecta ventas, contabilidad, inventario y capital humano en una sola
            plataforma para que tu empresa tome mejores decisiones en menos tiempo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.03, transition: SPRING_STIFF }}
            whileTap={{ scale: 0.98, transition: SPRING_STIFF }}
          >
            <Link href="/register">
              <Button size="lg" className="group cursor-pointer gap-2">
                Empezar ahora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.03, transition: SPRING_STIFF }}
            whileTap={{ scale: 0.98, transition: SPRING_STIFF }}
          >
            <Link href="#precios">
              <Button size="lg" variant="outline" className="cursor-pointer">
                Ver planes
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Hero Image with Parallax */}
      <ParallaxLayer speed={0.2} className="relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
        >
          <motion.div
            className="overflow-hidden rounded-asymmetric-tl-br border border-primary/20 bg-card p-2 shadow-xl shadow-primary/10 glow-primary"
            whileHover={{ y: -8, scale: 1.015, transition: { type: 'spring', stiffness: 200, damping: 12 } }}
          >
            <Image
              src="/images/Finanzas3.jpeg"
              width={760}
              height={620}
              alt="Dashboard de FinanceMDM"
              className="h-auto w-full rounded-2xl object-cover transition-transform duration-700 group-hover:scale-105"
              priority
            />
          </motion.div>

          {/* Floating stat badge */}
          <motion.div
            className="absolute -bottom-7 -left-4 rounded-asymmetric-tr-bl border border-cyan-accent bg-background/95 p-4 shadow-lg backdrop-blur md:-left-8 glow-cyan"
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <TrendingUp className="h-5 w-5 text-cyan-accent" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-mono">Crecimiento</p>
                <p className="text-xl font-bold font-mono text-cyan-accent">+127%</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </ParallaxLayer>
    </section>
  );
}
