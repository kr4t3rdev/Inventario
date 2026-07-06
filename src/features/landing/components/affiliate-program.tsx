'use client';

import React from 'react';
import { Gift, Link2, ShieldCheck, TicketPercent } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AFFILIATE_PROGRAM_HIGHLIGHTS,
  AFFILIATE_PROGRAM_RULES,
  AFFILIATE_PROGRAM_STEPS,
  AFFILIATE_PROGRAM_TIERS,
} from '@/features/landing/data';
import { SpringSection } from '@/features/landing/utils';

/**
 * @description Sección comercial del programa de referidos para la landing.
 * @returns {JSX.Element} Bloque con beneficios, tiers, flujo y reglas del programa.
 */
export function LandingAffiliateProgram(): React.JSX.Element {
  return (
    <section
      id="referidos"
      className="space-y-10 scroll-mt-24 rounded-3xl border border-border/60 bg-muted/20 p-6 md:p-10"
    >
      <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
        <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
          Referidos
        </span>
        <h2 className="text-4xl font-bold leading-[1.05] tracking-display tracking-tight font-mono sm:text-5xl">
          Convertí cada recomendación en crédito para tu próxima licencia
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          Programa exclusivo para tenants activos: compartís tu link, el referido compra,
          administración confirma el pago y vos acumulás crédito más perks exclusivos.
        </p>
      </SpringSection>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {AFFILIATE_PROGRAM_HIGHLIGHTS.map((item, index) => (
          <SpringSection key={item.title} delay={index * 0.05}>
            <Card className="h-full border-border/60 bg-card/85 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-mono">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </SpringSection>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SpringSection>
          <Card className="h-full border-border/60 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-xl">
                <TicketPercent className="h-5 w-5 text-primary" />
                Escalá tus beneficios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {AFFILIATE_PROGRAM_TIERS.map((tier) => (
                <div
                  key={tier.range}
                  className="grid gap-2 rounded-2xl border border-border/60 bg-background/60 p-4 md:grid-cols-3"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Tramo</p>
                    <p className="font-medium">{tier.range}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Comisión</p>
                    <p className="font-medium">{tier.commission}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Perks</p>
                    <p className="font-medium">{tier.perks}</p>
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Los perks son acumulativos y se asignan manualmente para mantener control y
                calidad sobre cada beneficio.
              </p>
            </CardContent>
          </Card>
        </SpringSection>

        <SpringSection delay={0.05}>
          <Card className="h-full border-border/60 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-xl">
                <Link2 className="h-5 w-5 text-primary" />
                Cómo funciona
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {AFFILIATE_PROGRAM_STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
                    Paso {index + 1}
                  </p>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </SpringSection>
      </div>

      <SpringSection>
        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-xl">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Reglas del programa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 md:grid-cols-2">
              {AFFILIATE_PROGRAM_RULES.map((rule) => (
                <li
                  key={rule}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground"
                >
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </SpringSection>

      <SpringSection className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="cursor-pointer">
          <a href="#precios">Ver planes</a>
        </Button>
        <Button asChild variant="outline" size="lg" className="cursor-pointer">
          <a href="#contacto">Solicitar demo</a>
        </Button>
      </SpringSection>
    </section>
  );
}
