import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  CreditCard,
  DollarSign,
  Mail,
  MessageCircle,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

/* ─── Types ─── */

export interface FeatureItem {
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
}

export interface BenefitItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface PlanItem {
  name: string;
  description: string;
  cta: string;
  featured?: boolean;
  bullets: string[];
}

export interface ContactItem {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/* ─── Navigation ─── */

export const NAV_ITEMS = [
  { href: '#caracteristicas', label: 'Características' },
  { href: '#beneficios', label: 'Beneficios' },
  { href: '#testimonios', label: 'Testimonios' },
  { href: '#precios', label: 'Planes' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contacto', label: 'Contacto' },
];

/* ─── Features ─── */

export const FEATURE_ITEMS: FeatureItem[] = [
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

/* ─── Benefits ─── */

export const BENEFIT_ITEMS: BenefitItem[] = [
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

/* ─── Pricing Plans ─── */

export const PLAN_ITEMS: PlanItem[] = [
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

/* ─── Contact ─── */

export const CONTACT_ITEMS: ContactItem[] = [
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

/* ─── Testimonials ─── */

export const TESTIMONIAL_ITEMS: TestimonialItem[] = [
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

/* ─── FAQ ─── */

export const FAQ_ITEMS: FaqItem[] = [
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

/* ─── Hero Value Props (rotating) ─── */

export const HERO_VALUE_PROPS = [
  'Control financiero en tiempo real',
  'Stock inteligente sin quiebres',
  'Facturación automatizada al instante',
  'Reportes contables con un clic',
  'Nómina y comisiones sin errores',
];

/* ─── Social Proof ─── */

export const HERO_TRUST = {
  rating: 4.9,
  reviews: 120,
  clients: '+50',
  clientLabel: 'empresas activas',
};

/* ─── Floating badges for Hero image ─── */

export const HERO_BADGES = [
  {
    icon: TrendingUp,
    label: 'Eficiencia',
    value: '+30%',
    className: '-bottom-7 -left-4 md:-left-8',
    color: 'text-cyan-accent',
  },
  {
    icon: Wallet,
    label: 'Ahorro operativo',
    value: '-40%',
    className: '-top-3 -right-4 md:-right-6',
    color: 'text-emerald-400',
  },
  {
    icon: BarChart3,
    label: 'Tiempo de cierre',
    value: '3x',
    className: 'bottom-12 -right-5 md:-right-8',
    color: 'text-primary',
  },
];

/* ─── Stats ─── */

export const STATS = [
  { value: 127, suffix: '%', label: 'Productividad operativa' },
  { value: 6, suffix: '', label: 'Módulos clave integrados' },
  { value: 3, suffix: '', label: 'Sucursales simultáneas' },
  { value: 99, suffix: '%', label: 'Disponibilidad garantizada' },
];
