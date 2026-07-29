'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { WordReveal } from '@/components/ui/word-reveal';
import { HERO_BADGES, HERO_DEFINITION, HERO_VALUE_PROPS } from '@/features/landing/data';
import { HeroSocialProof } from '@/features/reviews';
import { ParallaxLayer } from '@/features/landing/utils';

const SPRING_STIFF = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 15,
};

const ROTATION_INTERVAL = 3500;

/**
 * @description Hero section con headline animado, value props rotativos,
 *              social proof, CTAs e imagen con badges flotantes.
 * @param {{ reduceMotion?: boolean }} props
 * @returns {JSX.Element} Sección hero del landing
 */
export function LandingHero({ reduceMotion }: { reduceMotion?: boolean }): React.JSX.Element {
  const [propIndex, setPropIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setPropIndex((prev) => (prev + 1) % HERO_VALUE_PROPS.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  return (
    <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
      {/* ─── Left Column: Text + CTAs ─── */}
      <motion.div
        initial={reduceMotion ? false : { y: 30 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { type: 'spring', stiffness: 120, damping: 20 }}
        className="space-y-8"
      >
        <div className="space-y-5">
          {/* Badge */}
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary font-mono">
	            Plataforma B2B para operar mejor
          </span>

          {/* Headline */}
          <h1 className="max-w-2xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl font-mono leading-[1.05] tracking-display">
            <WordReveal text="Tu negocio entero en un solo panel. Sin fricción, en tiempo real." reduceMotion={reduceMotion} />
          </h1>

          {/* Subtítulo */}
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            {HERO_DEFINITION}
          </p>
          <p className="max-w-xl text-sm text-muted-foreground/80 sm:text-base">
            Equipos de comercio, servicios y operación lo usan para reducir trabajo duplicado,
            mantener el stock y la contabilidad alineados, y tomar decisiones con mejor visibilidad.
          </p>
          <p className="max-w-xl text-sm text-cyan-accent/90 sm:text-base">
            Además, los tenants elegibles pueden activar un programa de referidos con crédito en
            licencia y perks exclusivos por crecimiento.
          </p>

          {/* Rotating value prop */}
          <div className="h-7 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={HERO_VALUE_PROPS[propIndex]}
                initial={reduceMotion ? { opacity: 1 } : { y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { y: -20 }}
                transition={{ duration: 0.3 }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-accent font-mono"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {HERO_VALUE_PROPS[propIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.03, transition: SPRING_STIFF }}
              whileTap={reduceMotion ? undefined : { scale: 0.98, transition: SPRING_STIFF }}
            >
              <Button asChild size="lg" className="group cursor-pointer gap-2">
                <Link href="/register">
                  Empezar ahora
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.03, transition: SPRING_STIFF }}
              whileTap={reduceMotion ? undefined : { scale: 0.98, transition: SPRING_STIFF }}
            >
              <Button asChild size="lg" variant="outline" className="cursor-pointer">
                <Link href="#precios">
                  Ver planes
                </Link>
              </Button>
            </motion.div>
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.03, transition: SPRING_STIFF }}
              whileTap={reduceMotion ? undefined : { scale: 0.98, transition: SPRING_STIFF }}
            >
              <Button asChild size="lg" variant="ghost" className="cursor-pointer gap-2">
                <Link href="#demo-pos">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-xs font-bold text-primary">▶</span>
                  </span>
                  Ver demo POS
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Trust text */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70 font-mono">
            <span>Sin compromiso</span>
            <span className="hidden sm:inline">·</span>
            <span>Implementación desde 48h</span>
            <span className="hidden sm:inline">·</span>
            <span>Soporte incluido</span>
            <span className="hidden sm:inline">·</span>
            <span>Programa de referidos para tenants activos</span>
          </p>
        </div>

        {/* Social proof */}
        <HeroSocialProof />
      </motion.div>

      {/* ─── Right Column: Image + Floating Badges ─── */}
      <ParallaxLayer speed={0.2} className="relative" reduceMotion={reduceMotion}>
        <motion.div
          initial={reduceMotion ? false : { y: 30 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
        >
          {/* Main image */}
          <motion.div
            className="relative overflow-hidden rounded-asymmetric-tl-br border border-primary/20 bg-card p-2 shadow-xl shadow-primary/10 glow-primary"
            whileHover={reduceMotion ? undefined : {
              y: -8,
              scale: 1.015,
              transition: { type: 'spring', stiffness: 200, damping: 12 },
            }}
          >
            <Image
              src="/images/Finanzas3.jpeg"
              width={760}
              height={620}
              alt="Dashboard de FinanceMDM"
              className="h-auto w-full rounded-2xl object-cover"
              priority
            />
          </motion.div>

          {/* Floating badges */}
          {HERO_BADGES.map((badge, index) => {
            const Icon = badge.icon;

            return (
              <motion.div
                key={badge.label}
                className={`absolute ${badge.className} rounded-asymmetric-tr-bl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur md:p-4`}
                animate={
                  reduceMotion
                    ? undefined
                    : { y: [0, -(6 + index * 2), 0] }
                }
                transition={{
                  duration: 3.5 + index * 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: index * 0.4,
                }}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="rounded-full bg-primary/10 p-1.5 md:p-2">
                    <Icon className={`h-4 w-4 md:h-5 md:w-5 ${badge.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono md:text-xs">
                      {badge.label}
                    </p>
                    <p className={`text-base font-bold font-mono md:text-xl ${badge.color}`}>
                      {badge.value}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </ParallaxLayer>
    </section>
  );
}
