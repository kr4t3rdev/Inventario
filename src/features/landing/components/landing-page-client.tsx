'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';

import { LandingBenefits } from '@/features/landing/components/benefits';
import { LandingContact } from '@/features/landing/components/contact';
import { LandingFaq } from '@/features/landing/components/faq';
import { LandingFeatures } from '@/features/landing/components/features';
import { LandingFooter } from '@/features/landing/components/footer';
import { LandingHeader } from '@/features/landing/components/header';
import { LandingHero } from '@/features/landing/components/hero';
import { LandingStatsDynamic, PricingDynamic, RealTestimonials } from '@/features/reviews';

/**
 * @description Contenedor cliente de la home con la composición completa del landing.
 * @returns {JSX.Element} Página principal del producto
 */
export function LandingPageClient(): React.JSX.Element {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-20 right-[-7rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <LandingHeader reduceMotion={reduceMotion} />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <LandingHero reduceMotion={reduceMotion} />
        <LandingStatsDynamic />
        <LandingFeatures />
        <LandingBenefits />
        <PricingDynamic />
        <RealTestimonials />
        <LandingFaq />
        <LandingContact reduceMotion={reduceMotion} />
      </main>

      <LandingFooter />
    </div>
  );
}
