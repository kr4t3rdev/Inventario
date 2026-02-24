'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Mail,
  MessageCircle,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';

interface FeatureItem {
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
}

interface BenefitItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface PlanItem {
  name: string;
  description: string;
  cta: string;
  featured?: boolean;
  bullets: string[];
}

interface ContactItem {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS = [
  { href: '#caracteristicas', label: 'Características' },
  { href: '#beneficios', label: 'Beneficios' },
  { href: '#precios', label: 'Planes' },
  { href: '#contacto', label: 'Contacto' },
];

const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: 'Gestión Financiera',
    description:
      'Control centralizado de ingresos, gastos y conciliaciones con múltiples monedas.',
    bullets: [
      'Panel financiero unificado',
      'Tasas automáticas por moneda',
      'Flujo de caja en tiempo real',
    ],
    icon: DollarSign,
  },
  {
    title: 'Gestión de Inventario',
    description: 'Stock inteligente con alertas, trazabilidad y reposición basada en demanda.',
    bullets: [
      'Alertas de stock mínimo',
      'Control por categoría y lote',
      'Sugerencias de reposición',
    ],
    icon: Package,
  },
  {
    title: 'Puntos de Venta',
    description:
      'Administra múltiples sucursales con transferencias y visibilidad consolidada.',
    bullets: [
      'Multi-sucursal en un panel',
      'Transferencias auditables',
      'Métricas por ubicación',
    ],
    icon: Building2,
  },
  {
    title: 'Ventas y Servicios',
    description:
      'Flujo comercial completo: cotización, venta, facturación y seguimiento al cliente.',
    bullets: ['POS integrado', 'Historial de servicios', 'Facturación automatizada'],
    icon: CreditCard,
  },
  {
    title: 'Contabilidad Avanzada',
    description:
      'Registros contables robustos con asientos automáticos y reportes para decisiones.',
    bullets: ['Plan contable configurable', 'Asientos automáticos', 'Indicadores de rentabilidad'],
    icon: BarChart3,
  },
  {
    title: 'Capital Humano',
    description: 'Gestiona equipos, comisiones y nómina conectada al desempeño real del negocio.',
    bullets: ['Nómina automatizada', 'Comisiones dinámicas', 'Control de productividad'],
    icon: TrendingUp,
  },
];

const BENEFIT_ITEMS: BenefitItem[] = [
  {
    title: 'Reportes accionables',
    description: 'Convierte datos de ventas e inventario en decisiones estratégicas en segundos.',
    icon: BarChart3,
  },
  {
    title: 'Proyecciones confiables',
    description: 'Anticipa escenarios de liquidez y crecimiento con modelos financieros claros.',
    icon: Wallet,
  },
  {
    title: 'Inventario sin quiebres',
    description: 'Reduce pérdidas con alertas preventivas y control operacional continuo.',
    icon: Package,
  },
  {
    title: 'Operación automatizada',
    description: 'Menos tareas manuales, menos errores y más foco en el crecimiento.',
    icon: Sparkles,
  },
];

const PLAN_ITEMS: PlanItem[] = [
  {
    name: 'Básico',
    description: 'Ideal para negocios en crecimiento que necesitan control operativo sólido.',
    cta: 'Comenzar',
    bullets: [
      'Gestión de gastos e ingresos',
      'Control básico de inventario',
      'Reportes operativos esenciales',
      'Soporte técnico estándar',
    ],
  },
  {
    name: 'Profesional',
    description: 'Pensado para PYMES que requieren automatización y análisis avanzado.',
    cta: 'Solicitar demo',
    featured: true,
    bullets: [
      'Todo lo del plan Básico',
      'Automatización de ventas',
      'Contabilidad y capital humano',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Empresarial',
    description: 'Configuración personalizada para operaciones de alta complejidad.',
    cta: 'Hablar con ventas',
    bullets: [
      'Todo lo del plan Profesional',
      'Integraciones personalizadas',
      'Analítica avanzada y optimizaciones',
      'Acompañamiento dedicado',
    ],
  },
];

const CONTACT_ITEMS: ContactItem[] = [
  {
    label: 'Correo',
    value: 'garciamichel894@gmail.com',
    href: 'mailto:garciamichel894@gmail.com',
    icon: Mail,
  },
  {
    label: 'WhatsApp',
    value: '+53 53917705',
    href: 'https://wa.me/5353917705',
    icon: MessageCircle,
  },
];

/**
 * @description Loader de precarga con animaciones para suavizar la entrada del landing.
 * @param {{ reduceMotion: boolean }} props - Define si se deben reducir animaciones por accesibilidad.
 * @returns {JSX.Element} Capa de precarga animada en pantalla completa.
 */
function LandingPreloader({ reduceMotion }: { reduceMotion: boolean }): React.JSX.Element {
  return (
    <motion.div
      key="preloader"
      role="status"
      aria-live="polite"
      aria-label="Cargando página de inicio"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.35 } }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 backdrop-blur-lg"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border border-primary/20"
            animate={reduceMotion ? undefined : { scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-primary/60 border-t-transparent"
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
            animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <DollarSign className="h-6 w-6 text-primary" />
          </motion.div>
        </div>
        <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground">
          CARGANDO FINANCEMDM
        </p>
      </div>
    </motion.div>
  );
}

/**
 * @description Página principal del producto con narrativa visual animada y enfoque comercial.
 * @param {Record<string, never>} _props - Este componente no recibe props externas.
 * @returns {JSX.Element} Landing page animada con secciones de producto, planes y contacto.
 */
export default function Home(_props: Record<string, never>): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsLoading(false);
    }, reduceMotion ? 240 : 1500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [reduceMotion]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <AnimatePresence>{isLoading ? <LandingPreloader reduceMotion={!!reduceMotion} /> : null}</AnimatePresence>

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          animate={
            reduceMotion
              ? undefined
              : {
                  scale: [1, 1.06, 1],
                  x: ['-50%', '-46%', '-50%'],
                }
          }
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transform: 'translateX(-50%)' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute bottom-20 right-[-7rem] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
          animate={reduceMotion ? undefined : { y: [0, -28, 0], x: [0, -18, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="group flex items-center gap-2 text-lg font-bold">
            <motion.span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10"
              animate={reduceMotion ? undefined : { rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <DollarSign className="h-4 w-4 text-primary" />
            </motion.span>
            <span>
              Fina<span className="text-primary">nce</span>MDM
            </span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {NAV_ITEMS.map((item) => (
              <motion.div
                key={item.href}
                whileHover={reduceMotion ? undefined : { y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <Link
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </motion.div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="outline" size="sm" className="cursor-pointer">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="cursor-pointer">
                Register
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' as const }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Plataforma integral
              </span>
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Gestión financiera e inventario con experiencia premium.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                FinanceMDM conecta ventas, contabilidad, inventario y capital humano en una sola
                plataforma para que tu empresa tome mejores decisiones en menos tiempo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                <Link href="/register">
                  <Button size="lg" className="group cursor-pointer gap-2">
                    Empezar ahora
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                <Link href="#precios">
                  <Button size="lg" variant="outline" className="cursor-pointer">
                    Ver planes
                  </Button>
                </Link>
              </motion.div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-4">
              {['+127% productividad', '6 módulos clave', 'Multi-sucursal', 'Tiempo real'].map((stat) => (
                <motion.div
                  key={stat}
                  className="rounded-xl border border-border/60 bg-background/60 p-3 text-center text-xs font-medium text-muted-foreground backdrop-blur"
                  whileHover={reduceMotion ? undefined : { y: -3 }}
                >
                  {stat}
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.1 }}
            className="relative"
          >
            <motion.div
              className="overflow-hidden rounded-3xl border border-primary/20 bg-card p-2 shadow-xl shadow-primary/10"
              whileHover={reduceMotion ? undefined : { y: -6 }}
              transition={{ duration: 0.3 }}
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

            <motion.div
              className="absolute -bottom-7 -left-4 rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-lg backdrop-blur md:-left-8"
              animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Crecimiento</p>
                  <p className="text-xl font-bold">+127%</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section id="caracteristicas" className="space-y-10 scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
            className="mx-auto max-w-3xl space-y-3 text-center"
          >
            <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Características
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Todo lo que tu operación necesita en un solo lugar
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              Cada módulo está diseñado para reducir fricción operativa y acelerar la toma de
              decisiones estratégicas.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_ITEMS.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.38,
                    delay: reduceMotion ? 0 : index * 0.06,
                  }}
                  whileHover={reduceMotion ? undefined : { y: -8 }}
                  className="group"
                >
                  <Card className="h-full border-border/70 bg-card/80 shadow-md shadow-black/[0.03] transition-colors group-hover:border-primary/30">
                    <CardHeader>
                      <motion.div
                        className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
                        whileHover={reduceMotion ? undefined : { rotate: -8, scale: 1.08 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 15 }}
                      >
                        <Icon className="h-6 w-6 text-primary" />
                      </motion.div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
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

        <section
          id="beneficios"
          className="grid items-start gap-8 rounded-3xl border border-border/60 bg-muted/20 p-6 md:p-10 lg:grid-cols-[1fr_1.05fr]"
        >
          <motion.div
            initial={{ opacity: 0, x: reduceMotion ? 0 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
            className="space-y-4"
          >
            <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Beneficios
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Menos tareas manuales, más control del negocio
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              FinanceMDM te permite operar con velocidad y precisión desde cualquier área:
              administración, ventas, inventario y finanzas.
            </p>
            <motion.div
              className="overflow-hidden rounded-2xl border border-primary/20 bg-card p-2"
              whileHover={reduceMotion ? undefined : { scale: 1.01 }}
            >
              <Image
                src="/images/Beneficios.jpg"
                alt="Dashboard de análisis financiero"
                width={760}
                height={560}
                className="h-auto w-full rounded-xl object-cover"
              />
            </motion.div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFIT_ITEMS.map((benefit, index) => {
              const Icon = benefit.icon;

              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.36,
                    delay: reduceMotion ? 0 : index * 0.06,
                  }}
                  whileHover={reduceMotion ? undefined : { y: -6 }}
                >
                  <Card className="h-full border-border/70 bg-card/85 shadow-sm">
                    <CardContent className="space-y-3 p-5">
                      <motion.div
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"
                        animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                        transition={{ duration: 2.5 + index * 0.2, repeat: Infinity }}
                      >
                        <Icon className="h-5 w-5 text-primary" />
                      </motion.div>
                      <h3 className="text-lg font-semibold">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section id="precios" className="space-y-10 scroll-mt-24">
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
            className="mx-auto max-w-3xl space-y-3 text-center"
          >
            <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Planes
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Escala con un plan alineado a tu operación
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              Elige una base sólida para tu negocio y evoluciona sin migraciones complejas.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {PLAN_ITEMS.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.38,
                  delay: reduceMotion ? 0 : index * 0.07,
                }}
                whileHover={reduceMotion ? undefined : { y: -8 }}
              >
                <Card
                  className={`h-full border-border/70 bg-card/85 shadow-md ${
                    plan.featured
                      ? 'border-primary/45 bg-primary/[0.06] shadow-primary/10'
                      : 'shadow-black/[0.03]'
                  }`}
                >
                  <CardHeader className="space-y-3">
                    {plan.featured ? (
                      <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                        Recomendado
                      </span>
                    ) : null}
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ul className="space-y-2">
                      {plan.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-[2px] h-4 w-4 text-primary" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="#contacto" className="block">
                      <Button
                        className="w-full cursor-pointer gap-2"
                        variant={plan.featured ? 'default' : 'outline'}
                      >
                        {plan.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section
          id="contacto"
          className="scroll-mt-24 rounded-3xl border border-border/60 bg-muted/20 p-6 md:p-10"
        >
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
            className="mx-auto max-w-4xl space-y-8 text-center"
          >
            <div className="space-y-3">
              <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Contacto
              </span>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                ¿Listo para optimizar tu operación financiera?
              </h2>
              <p className="text-muted-foreground sm:text-lg">
                Nuestro equipo puede ayudarte a definir la mejor implementación para tu negocio.
              </p>
            </div>

            <Card className="border-border/70 bg-card/90 shadow-lg shadow-black/[0.03]">
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
                      transition={{ duration: 0.2 }}
                    >
                      <motion.div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"
                        animate={reduceMotion ? undefined : { rotate: [0, -8, 8, 0] }}
                        transition={{ duration: 2.4 + index * 0.3, repeat: Infinity }}
                      >
                        <Icon className="h-5 w-5 text-primary" />
                      </motion.div>
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold group-hover:text-primary">{item.value}</p>
                      </div>
                    </motion.a>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-muted/35">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-bold">
              Fina<span className="text-primary">nce</span>MDM
            </p>
            <p className="text-sm text-muted-foreground">
              Soluciones financieras inteligentes para empresas que quieren operar con más
              precisión, velocidad y visibilidad.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Producto</p>
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <Link href="#caracteristicas" className="hover:text-foreground hover:underline">
                  Características
                </Link>
                <Link href="#beneficios" className="hover:text-foreground hover:underline">
                  Beneficios
                </Link>
                <Link href="#precios" className="hover:text-foreground hover:underline">
                  Planes
                </Link>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Acceso</p>
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <Link href="/login" className="hover:text-foreground hover:underline">
                  Login
                </Link>
                <Link href="/register" className="hover:text-foreground hover:underline">
                  Registro
                </Link>
                <Link href="#contacto" className="hover:text-foreground hover:underline">
                  Contacto
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 py-4">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} migadev. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
