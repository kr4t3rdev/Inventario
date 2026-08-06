'use client';

import React from 'react';
import {
  ArrowRight,
  Banknote,
  Building2,
  Check,
  Link2,
  TicketPercent,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AFFILIATE_PROGRAM_RULES,
  AFFILIATE_PROGRAM_STEPS,
  AFFILIATE_PROGRAM_TIERS,
  SALES_AGENT_PROGRAM_RULES,
  SALES_AGENT_PROGRAM_STEPS,
  SALES_AGENT_PROGRAM_TIERS,
} from '@/features/landing/data';
import { SpringSection } from '@/features/landing/utils';

/**
 * @description Presenta las dos modalidades de referidos con una navegación comercial y progresiva.
 * @returns {JSX.Element} Sección interactiva de referidos para la landing.
 */
export function LandingAffiliateProgram(): React.JSX.Element {
  return (
    <section
      id="referidos"
      className="scroll-mt-24 space-y-8 rounded-2xl border border-border/60 bg-muted/20 p-5 md:p-8"
    >
      <SpringSection className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="max-w-3xl space-y-4">
          <span className="inline-flex rounded-full border border-cyan-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-accent font-mono">
            Programa de crecimiento
          </span>
          <h2 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-display tracking-tight font-mono sm:text-5xl">
            Gana por compartir lo que ya usas
          </h2>
          <p className="max-w-2xl text-muted-foreground sm:text-lg">
            Elige tu camino, comparte FinanceMDM y convierte cada recomendación en un beneficio real.
          </p>
        </div>
        <div className="border-l-2 border-primary pl-4 text-sm text-muted-foreground lg:mb-1">
          <p className="font-semibold text-foreground">Dos formas de participar</p>
          <p className="mt-1">Si ya eres cliente, reduces tu licencia. Si lo recomiendas, cobras por cada renovación.</p>
        </div>
      </SpringSection>

      <Tabs defaultValue="tenant" className="w-full">
        <TabsList
          aria-label="Modalidad del programa de referidos"
          className="grid h-auto w-full max-w-2xl grid-cols-2 rounded-xl border border-border/70 bg-background/70 p-1"
        >
          <TabsTrigger
            value="tenant"
            className="min-h-11 gap-2 rounded-lg px-3 py-2 text-left data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Building2 className="h-4 w-4" />
            <span>
              <span className="block font-semibold">Ya uso FinanceMDM</span>
              <span className="hidden text-xs opacity-80 sm:block">Crédito para mi licencia</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="sales-agent"
            className="min-h-11 gap-2 rounded-lg px-3 py-2 text-left data-[state=active]:bg-cyan-accent data-[state=active]:text-slate-950"
          >
            <UsersRound className="h-4 w-4" />
            <span>
              <span className="block font-semibold">Quiero recomendarlo</span>
              <span className="hidden text-xs opacity-80 sm:block">Comisiones en CUP</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenant" className="mt-6 space-y-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="rounded-xl bg-primary p-6 text-primary-foreground md:p-8">
              <TicketPercent className="mb-5 h-8 w-8" />
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] opacity-80">
                Para clientes activos
              </p>
              <h3 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                Tu próxima licencia puede costarte menos
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/90 sm:text-base">
                Recomienda el sistema a otra empresa. Cuando administración confirme su pago,
                recibes crédito y perks nuevos para seguir creciendo.
              </p>
              <p className="mt-3 max-w-xl rounded-lg bg-primary-foreground/10 px-4 py-3 text-xs leading-5 text-primary-foreground/90">
                Si tu empresa se registra por un link de referido, obtiene un
                descuento de $5 USD/mes en su suscripción (el precio base se
                muestra en la sección de planes).
              </p>
              <Button asChild variant="secondary" size="lg" className="mt-6 min-h-11">
                <a href="#precios">
                  Ver planes <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Beneficio acumulativo</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  El crédito que no uses se conserva para tus próximos ciclos. Los perks son nuevos,
                  exclusivos y no reemplazan las features de tu plan.
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/70">
                <div className="hidden grid-cols-3 bg-background/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>Referidos</span>
                  <span>Beneficio</span>
                  <span>Perks</span>
                </div>
                {AFFILIATE_PROGRAM_TIERS.map((tier) => (
                  <div key={tier.range} className="grid gap-2 border-t border-border/60 px-4 py-3 text-sm sm:grid-cols-3 sm:items-center">
                    <span>
                      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Referidos</span>
                      {tier.range.replace(' ventas válidas', '')}
                    </span>
                    <span className="font-semibold text-primary">
                      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Beneficio</span>
                      {tier.commission}
                    </span>
                    <span>
                      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Perks</span>
                      {tier.perks}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Tres pasos y listo</h3>
              <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                {AFFILIATE_PROGRAM_STEPS.map((step, index) => (
                  <li key={step.title} className="relative flex gap-3 sm:block">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground sm:mb-3">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold">{step.title}</h4>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <details className="group rounded-xl border border-border/70 bg-background/50 p-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                Reglas para clientes
                <span className="text-xl text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <ul className="mt-3 space-y-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
                {AFFILIATE_PROGRAM_RULES.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </TabsContent>

        <TabsContent value="sales-agent" className="mt-6 space-y-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="rounded-xl bg-foreground p-6 text-background md:p-8 dark:bg-cyan-accent dark:text-slate-950">
              <Banknote className="mb-5 h-8 w-8 text-background dark:text-slate-950" />
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-background dark:text-slate-950/70">
                Para quienes venden el sistema
              </p>
              <h3 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                Cobra por cada renovación confirmada
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-6 text-background/70 dark:text-slate-950/75 sm:text-base">
                Regístrate como Gestor de Ventas, comparte tu código y recibe una comisión recurrente
                por cada tenant referido que siga activo.
              </p>
              <Button asChild variant="secondary" size="lg" className="mt-6 min-h-11">
                <a href="/register">
                  Registrarme como Gestor <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="space-y-5">
              <div className="flex items-end gap-3">
                <span className="font-mono text-6xl font-bold leading-none text-cyan-accent">7%</span>
                <span className="max-w-[15rem] pb-1 text-sm leading-5 text-muted-foreground">
                  de comisión máxima por cada renovación presencial confirmada
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/70">
                <div className="hidden grid-cols-3 bg-background/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>Tenants activos</span>
                  <span>Comisión</span>
                  <span>Liquidación</span>
                </div>
                {SALES_AGENT_PROGRAM_TIERS.map((tier) => (
                  <div key={tier.range} className="grid gap-2 border-t border-border/60 px-4 py-3 text-sm sm:grid-cols-3 sm:items-center">
                    <span>
                      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Tenants activos</span>
                      {tier.range.replace(' tenants activos', '')}
                    </span>
                    <span className="font-semibold text-cyan-accent">
                      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Comisión</span>
                      {tier.commission}
                    </span>
                    <span>
                      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Liquidación</span>
                      {tier.perks.replace('Pago por renovación', 'Por ciclo')}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-5 text-muted-foreground">
                El tramo depende de tus referidos activos y con licencia vigente. El pago se realiza en CUP con la tasa registrada al liquidar.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h3 className="text-xl font-bold tracking-tight">De la recomendación al cobro</h3>
              <ol className="mt-5 grid gap-4 sm:grid-cols-2">
                {SALES_AGENT_PROGRAM_STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-accent text-sm font-bold text-slate-950">
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold">{step.title}</h4>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <details className="group rounded-xl border border-border/70 bg-background/50 p-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                Reglas para Gestores de Ventas
                <span className="text-xl text-cyan-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <ul className="mt-3 space-y-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
                {SALES_AGENT_PROGRAM_RULES.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <WalletCards className="mt-0.5 h-4 w-4 shrink-0 text-cyan-accent" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">¿Quieres empezar o tienes una duda?</p>
          <p className="text-sm text-muted-foreground">Administración te acompaña en el proceso.</p>
        </div>
        <Button asChild variant="outline" size="lg" className="min-h-11">
          <a href="#contacto">
            Hablar con administración <Link2 className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </section>
  );
}
