'use client';

import React from 'react';
import { Banknote, Gift, Link2, ShieldCheck, TicketPercent, UsersRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AFFILIATE_PROGRAM_HIGHLIGHTS,
  AFFILIATE_PROGRAM_RULES,
  AFFILIATE_PROGRAM_STEPS,
  AFFILIATE_PROGRAM_TIERS,
  SALES_AGENT_PROGRAM_RULES,
  SALES_AGENT_PROGRAM_HIGHLIGHTS,
  SALES_AGENT_PROGRAM_STEPS,
  SALES_AGENT_PROGRAM_TIERS,
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
          Elegí cómo participar: como tenant acumulás crédito para tu licencia o como Gestor de
          Ventas cobrás comisiones recurrentes por tus referidos.
        </p>
      </SpringSection>

      <div className="grid gap-4 md:grid-cols-2">
        <SpringSection>
          <Card className="h-full border-primary/30 bg-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-xl">
                <TicketPercent className="h-5 w-5 text-primary" />
                Tenant activo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Recomendá FinanceMDM desde tu tenant y acumulá crédito para tu próxima licencia.</p>
              <p>También ganás perks nuevos y acumulativos, separados de las features comerciales.</p>
            </CardContent>
          </Card>
        </SpringSection>
        <SpringSection delay={0.05}>
          <Card className="h-full border-cyan-accent/40 bg-cyan-accent/5 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-xl">
                <UsersRound className="h-5 w-5 text-cyan-accent" />
                Gestor de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>No necesitás trabajar dentro de un tenant para recomendar el sistema.</p>
              <p>Registrate, compartí tu código y cobrá en CUP por cada ciclo confirmado.</p>
            </CardContent>
          </Card>
        </SpringSection>
      </div>

      <h3 className="text-center font-mono text-2xl font-bold">Beneficios para tenants activos</h3>
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

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SpringSection>
          <Card className="h-full border-cyan-accent/30 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-xl">
                <Banknote className="h-5 w-5 text-cyan-accent" />
                Beneficios para Gestores de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {SALES_AGENT_PROGRAM_HIGHLIGHTS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </SpringSection>

        <SpringSection delay={0.05}>
          <Card className="h-full border-cyan-accent/30 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-xl">
                <UsersRound className="h-5 w-5 text-cyan-accent" />
                Tramos del Gestor de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {SALES_AGENT_PROGRAM_TIERS.map((tier) => (
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
                    <p className="font-medium text-cyan-accent">{tier.commission}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Liquidación</p>
                    <p className="font-medium">{tier.perks}</p>
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                El tramo se calcula según la cantidad de tenants referidos que continúan activos y
                con licencia vigente.
              </p>
            </CardContent>
          </Card>
        </SpringSection>
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
        <Card className="border-cyan-accent/30 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-xl">
              <Link2 className="h-5 w-5 text-cyan-accent" />
              Cómo funciona para un Gestor de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {SALES_AGENT_PROGRAM_STEPS.map((step, index) => (
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

      <SpringSection>
        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-mono text-xl">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Reglas de cada modalidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="mb-3 font-mono font-semibold text-primary">Tenant activo</h3>
                <ul className="grid gap-3">
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
              </div>
              <div>
                <h3 className="mb-3 font-mono font-semibold text-cyan-accent">Gestor de Ventas</h3>
                <ul className="grid gap-3">
                  {SALES_AGENT_PROGRAM_RULES.map((rule) => (
                    <li
                      key={rule}
                      className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground"
                    >
                      <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </SpringSection>

      <SpringSection className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="cursor-pointer">
          <a href="#precios">Ver planes</a>
        </Button>
        <Button asChild variant="outline" size="lg" className="cursor-pointer">
          <a href="/register">Registrarme como Gestor</a>
        </Button>
      </SpringSection>
    </section>
  );
}
