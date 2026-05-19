'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type SpringOptions,
  type Transition,
} from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarqueeText } from '@/components/ui/marquee-text';
import { WordReveal } from '@/components/ui/word-reveal';
import { ThemeToggle } from '@/components/theme-toggle';

/* ─── Shared Spring Configuration ─── */

const SPRING_UP: Transition = {
  type: 'spring',
  bounce: 0.3,
  duration: 1.1,
};

const SPRING_STIFF: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 15,
};

const SPRING_BOUNCE: SpringOptions = {
  stiffness: 50,
  damping: 20,
};

/* ─── Types ─── */

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

interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

/* ─── Data ─── */

const NAV_ITEMS = [
  { href: '#caracteristicas', label: 'Características' },
  { href: '#beneficios', label: 'Beneficios' },
  { href: '#testimonios', label: 'Testimonios' },
  { href: '#precios', label: 'Planes' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contacto', label: 'Contacto' },
];

const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: 'Gestión Financiera',
    description:
      'Control centralizado de ingresos, gastos y conciliaciones con múltiples monedas.',
    bullets: ['Panel financiero unificado', 'Tasas automáticas por moneda', 'Flujo de caja en tiempo real'],
    icon: DollarSign,
  },
  {
    title: 'Gestión de Inventario',
    description: 'Stock inteligente con alertas, trazabilidad y reposición basada en demanda.',
    bullets: ['Alertas de stock mínimo', 'Control por categoría y lote', 'Sugerencias de reposición'],
    icon: Package,
  },
  {
    title: 'Puntos de Venta',
    description: 'Administra múltiples sucursales con transferencias y visibilidad consolidada.',
    bullets: ['Multi-sucursal en un panel', 'Transferencias auditables', 'Métricas por ubicación'],
    icon: Building2,
  },
  {
    title: 'Ventas y Servicios',
    description: 'Flujo comercial completo: cotización, venta, facturación y seguimiento al cliente.',
    bullets: ['POS integrado', 'Historial de servicios', 'Facturación automatizada'],
    icon: CreditCard,
  },
  {
    title: 'Contabilidad Avanzada',
    description: 'Registros contables robustos con asientos automáticos y reportes para decisiones.',
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

const TESTIMONIAL_ITEMS: TestimonialItem[] = [
  {
    quote: 'FinanceMDM transformó nuestra operación. Pasamos de 3 sistemas a uno solo. La implementación fue rápida y el soporte excepcional.',
    author: 'María García',
    role: 'CFO, TechCorp LATAM',
  },
  {
    quote: 'El control de inventario en tiempo real nos ahorró miles de dólares en pérdidas. Y la contabilidad automatizada nos devolvió horas todos los días.',
    author: 'Carlos Mendoza',
    role: 'Director de Operaciones, Distribuidora RM',
  },
  {
    quote: 'Tener ventas, inventario y contabilidad en un solo lugar nos dio una visibilidad que nunca tuvimos. Las decisiones ahora son mucho más rápidas.',
    author: 'Ana Lucía Pérez',
    role: 'CEO, Grupo Nova',
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: '¿Qué incluye cada plan?',
    answer: 'Cada plan incluye acceso completo a los módulos detallados en la sección de precios. Todos incluyen soporte técnico, actualizaciones y respaldo de datos. Podés escalar de plan en cualquier momento sin perder información.',
  },
  {
    question: '¿Cuánto tiempo toma la implementación?',
    answer: 'La implementación básica toma entre 1 y 3 días hábiles. Para operaciones complejas con integraciones personalizadas, puede extenderse hasta 2 semanas. Nuestro equipo te acompaña durante todo el proceso.',
  },
  {
    question: '¿Ofrecen soporte después de la implementación?',
    answer: 'Sí, todos los planes incluyen soporte técnico continuo. Los planes Profesional y Empresarial cuentan con soporte prioritario y acompañamiento dedicado para garantizar que tu operación nunca se detenga.',
  },
  {
    question: '¿Puedo integrar FinanceMDM con otros sistemas?',
    answer: 'Sí, ofrecemos integraciones vía API REST para conectar con tus sistemas existentes. El plan Empresarial incluye integraciones personalizadas desarrolladas específicamente para tu operación.',
  },
  {
    question: '¿Cómo funciona el multi-sucursal?',
    answer: 'Podés gestionar todas tus sucursales desde un panel centralizado. Cada sucursal opera con su propio inventario y puntos de venta, pero vos tenés visibilidad consolidada de todo el negocio en tiempo real.',
  },
  {
    question: '¿Los datos están seguros?',
    answer: 'Absolutamente. Usamos encriptación TLS en tránsito y AES-256 en reposo. Los respaldos son automáticos y diarios. Cumplimos con estándares de seguridad de datos financieros. Además, cada tenant tiene sus datos aislados.',
  },
];

/* ─── Animated Counter ─── */

/**
 * @description Contador numérico animado con spring que se activa al entrar en viewport.
 * @param {{ value: number; suffix?: string; prefix?: string; className?: string }} props
 * @returns {JSX.Element} Span con el número animado
 */
function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  className = '',
  reduceMotion = false,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  reduceMotion?: boolean;
}): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const spring = useSpring(0, SPRING_BOUNCE);
  const display = useTransform(spring, (current) => `${prefix}${Math.round(current).toLocaleString()}${suffix}`);

  useEffect(() => {
    if (reduceMotion) {
      spring.set(value);
      spring.stop();
    } else if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value, reduceMotion]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

/* ─── Preloader ─── */

/**
 * @description Loader de precarga con animaciones para suavizar la entrada del landing.
 * @param {{ reduceMotion: boolean }} props
 * @returns {JSX.Element} Capa de precarga animada
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
        <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground font-mono">
          CARGANDO FINANCEMDM
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Spring wrapper components ─── */

/**
 * @description Wrapper que aplica animación fade-in + slide-up suave al entrar en viewport.
 *              Siempre se anima — no depende de reduced motion.
 */
function SpringSection({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * @description Wrapper que aplica parallax scroll — el contenido se mueve a una velocidad
 *              distinta que el scroll normal, creando profundidad.
 * @param {{ children: React.ReactNode; speed?: number; className?: string; style?: React.CSSProperties }} props
 * @returns {JSX.Element} Elemento con parallax vertical
 */
function ParallaxLayer({
  children,
  speed = 0.3,
  className,
  style,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 60, speed * -60]);

  return (
    <div ref={ref} className={className} style={{ ...style, willChange: 'transform' }}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/* ─── Main Page ─── */

/**
 * @description Página principal del producto con narrativa visual animada
 *              y enfoque Bungee-inspired (dark industrial + animaciones spring).
 * @returns {JSX.Element} Landing page con spring animations y tipografía Chivo Mono.
 */
export default function Home(): React.JSX.Element {
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

      {/* Background blobs — parallax + floating */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          animate={reduceMotion ? undefined : { scale: [1, 1.1, 1], x: ['-50%', '-42%', '-50%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transform: 'translateX(-50%)' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute bottom-32 right-[-7rem] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
          animate={reduceMotion ? undefined : { y: [0, -32, 0], x: [0, -22, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute left-[-5rem] top-1/3 h-56 w-56 rounded-full bg-primary/5 blur-3xl"
          animate={reduceMotion ? undefined : { y: [0, 24, 0], x: [0, 16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ─── Header ─── */}
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
            <span className="font-mono tracking-tight">
              Fina<span className="text-primary">nce</span>MDM
            </span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {NAV_ITEMS.map((item) => (
              <motion.div
                key={item.href}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
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

      {/* ─── Main Content ─── */}
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 pb-20 pt-10 md:px-6 md:pt-14">

        {/* ═══ HERO ═══ */}
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

        {/* ═══ STATS ═══ */}
        <SpringSection>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: 127, suffix: '%', label: 'Productividad operativa' },
              { value: 6, suffix: '', label: 'Módulos clave integrados' },
              { value: 3, suffix: '', label: 'Sucursales simultáneas' },
              { value: 99, suffix: '%', label: 'Disponibilidad garantizada' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
                whileHover={{ y: -6, scale: 1.03, transition: { type: 'spring', stiffness: 200, damping: 15 } }}
                className="group rounded-2xl border border-border/60 bg-card/50 p-5 text-center transition-colors hover:border-primary/30"
              >
                <p className="text-4xl font-bold tracking-tight text-cyan-accent sm:text-5xl font-mono">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} reduceMotion={!!reduceMotion} />
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </SpringSection>

        {/* ═══ MARQUEE ═══ */}
        <MarqueeText text="Ventas · Inventario · Contabilidad · Capital Humano · Reportes · Automatización" speed={25} />

        {/* ═══ FEATURES ═══ */}
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

        {/* ═══ BENEFITS ═══ */}
        <section
          id="beneficios"
          className="grid items-start gap-8 rounded-3xl border border-border/60 bg-muted/20 p-6 md:p-10 lg:grid-cols-[1fr_1.05fr]"
        >
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="space-y-4"
          >
            <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
              Beneficios
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
              Menos tareas manuales, más control del negocio
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              FinanceMDM te permite operar con velocidad y precisión desde cualquier área:
              administración, ventas, inventario y finanzas.
            </p>
            <ParallaxLayer speed={0.15}>
              <motion.div
                className="overflow-hidden rounded-asymmetric-tr-bl border border-primary/20 bg-card p-2"
                whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              >
                <Image
                  src="/images/Beneficios.jpg"
                  alt="Dashboard de análisis financiero"
                  width={760}
                  height={560}
                  className="h-auto w-full rounded-xl object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </motion.div>
            </ParallaxLayer>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFIT_ITEMS.map((benefit, index) => {
              const Icon = benefit.icon;

              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
                  whileHover={{ y: -6, scale: 1.02, transition: { type: 'spring', stiffness: 200, damping: 15 } }}
                >
                  <Card className="h-full border-border/60 bg-card/85 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/25">
                    <CardContent className="space-y-3 p-5">
                      <motion.div
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 3 + index * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Icon className="h-5 w-5 text-primary" />
                      </motion.div>
                      <h3 className="text-lg font-semibold font-mono">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ═══ MARQUEE 2 ═══ */}
        <MarqueeText text="Control total · Decisiones inteligentes · Operación fluida · Escalabilidad garantizada" speed={30} direction="right" />

        {/* ═══ TESTIMONIALS ═══ */}
        <section id="testimonios" className="space-y-10 scroll-mt-24">
          <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
            <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
              Testimonios
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              Empresas que ya confían en FinanceMDM para operar con más precisión y velocidad.
            </p>
          </SpringSection>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIAL_ITEMS.map((item, index) => (
              <motion.div
                key={item.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
                whileHover={{ y: -6, scale: 1.02, transition: { type: 'spring', stiffness: 200, damping: 15 } }}
              >
                <Card className="h-full border-border/60 bg-card/80 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-lg">
                  <CardContent className="flex flex-col gap-4 p-6">
                    <svg
                      className="h-8 w-8 text-primary/40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M10 11h-4v-4h4v4zm8 0h-4v-4h4v4z" />
                      <path d="M10 13l-4 5h4l-4-5zm8 0l-4 5h4l-4-5z" />
                    </svg>
                    <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{item.quote}&rdquo;</p>
                    <div className="mt-auto flex items-center gap-3 pt-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary font-mono">
                        {item.author.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold font-mono">{item.author}</p>
                        <p className="text-xs text-muted-foreground">{item.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="precios" className="space-y-10 scroll-mt-24">
          <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
            <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
              Planes
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
              Escalá con un plan alineado a tu operación
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              Elegí una base sólida para tu negocio y evolucioná sin migraciones complejas.
            </p>
          </SpringSection>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {PLAN_ITEMS.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: plan.featured ? 1.025 : 1.015, transition: { type: 'spring', stiffness: 200, damping: 12 } }}
              >
                <Card
                  className={`h-full border-border/60 bg-card/85 shadow-md transition-all duration-300 ${
                    plan.featured
                      ? 'border-primary/35 bg-primary/[0.05] shadow-primary/10 hover:shadow-primary/20'
                      : 'shadow-black/[0.03] hover:shadow-lg hover:border-primary/20'
                  }`}
                >
                  <CardHeader className="space-y-3">
                    {plan.featured ? (
                      <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary font-mono">
                        Recomendado
                      </span>
                    ) : null}
                    <CardTitle className="text-2xl font-mono">{plan.name}</CardTitle>
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

        {/* ═══ MARQUEE 3 ═══ */}
        <MarqueeText text="Soporte dedicado · Integraciones · Analytics · Crecimiento sin límites" speed={35} />

        {/* ═══ FAQ ═══ */}
        <section id="faq" className="space-y-10 scroll-mt-24">
          <SpringSection className="mx-auto max-w-3xl space-y-3 text-center">
            <span className="inline-flex rounded-full border border-cyan-accent bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-accent font-mono">
              FAQ
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl font-mono leading-[1.05] tracking-display">
              Preguntas frecuentes
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              Todo lo que necesitás saber antes de dar el próximo paso.
            </p>
          </SpringSection>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="mx-auto max-w-3xl"
          >
            <Accordion type="single" collapsible className="space-y-3">
              {FAQ_ITEMS.map((item, index) => (
                <motion.div
                  key={item.question}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20, delay: index * 0.05 }}
                >
                  <AccordionItem
                    value={`item-${index}`}
                    className="rounded-xl border border-border/60 bg-card/60 px-5"
                  >
                    <AccordionTrigger className="text-left font-medium font-mono text-sm hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </motion.div>
        </section>

        {/* ═══ CONTACT ═══ */}
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
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/50 bg-muted/35">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-bold font-mono tracking-tight">
              Fina<span className="text-primary">nce</span>MDM
            </p>
            <p className="text-sm text-muted-foreground">
              Soluciones financieras inteligentes para empresas que quieren operar con más
              precisión, velocidad y visibilidad.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold font-mono">Producto</p>
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
              <p className="text-sm font-semibold font-mono">Acceso</p>
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
          <p className="text-center text-sm text-muted-foreground font-mono">
            © {new Date().getFullYear()} migadev. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
