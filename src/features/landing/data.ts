import type { LucideIcon } from "lucide-react";
import {
	BarChart3,
	Building2,
	CreditCard,
	DollarSign,
	FileText,
	Mail,
	MessageCircle,
	Package,
	ShoppingCart,
	Sparkles,
	TrendingUp,
	Wallet,
	Wrench,
} from "lucide-react";

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

export interface FaqItem {
	question: string;
	answer: string;
}

/* ─── Navigation ─── */

export const NAV_ITEMS = [
	{ href: "#caracteristicas", label: "Características" },
	{ href: "#beneficios", label: "Beneficios" },
	{ href: "#testimonios", label: "Testimonios" },
	{ href: "#precios", label: "Planes" },
	{ href: "#faq", label: "FAQ" },
	{ href: "#contacto", label: "Contacto" },
];

/* ─── Features ─── */

export const FEATURE_ITEMS: FeatureItem[] = [
	{
		title: "Gestión Financiera",
		description:
			"Control centralizado de ingresos, gastos y conciliaciones con múltiples monedas. Convierte divisas al instante con tasas automáticas.",
		bullets: [
			"Panel financiero unificado con flujo de caja en tiempo real",
			"Tasas de cambio automáticas y conversión multi-moneda",
			"Conciliación bancaria y cuadre diario automatizado",
			"Control de gastos e inyecciones de capital",
		],
		icon: DollarSign,
	},
	{
		title: "Inventario y Almacenes",
		description:
			"Stock inteligente con trazabilidad completa, alertas de reposición y gestión multi-almacén con transferencias auditables.",
		bullets: [
			"Alertas de stock mínimo y sugerencias de reposición",
			"Control por categoría, lote y ubicación física",
			"Transferencias entre almacenes con trazabilidad total",
			"Gestión de mermas y ajustes de inventario",
			"Listas de precios por producto y por cliente",
		],
		icon: Package,
	},
	{
		title: "Puntos de Venta",
		description:
			"Sistema POS moderno que opera en múltiples sucursales con cierre de caja automático, turnos y métricas consolidadas.",
		bullets: [
			"Multi-sucursal con control centralizado desde un panel",
			"Arqueo y cierre de caja automático por turno",
			"Gestión de turnos de empleados por punto de venta",
			"Ventas con múltiples formas de pago y facturación integrada",
		],
		icon: Building2,
	},
	{
		title: "Ventas y Facturación",
		description:
			"Flujo comercial completo desde la cotización hasta la factura electrónica, con historial de servicios y ofertas promocionales.",
		bullets: [
			"POS integrado con venta rápida y cotizaciones",
			"Facturación automatizada con series configurables",
			"Ofertas y promociones por producto o temporada",
			"Historial completo de servicios recurrentes",
			"Cuentas por cobrar con seguimiento de pagos",
		],
		icon: CreditCard,
	},
	{
		title: "Compras y Abastecimiento",
		description:
			"Gestión de compras a proveedores con control de documentos, precios y cuentas por pagar. Integrado al inventario automáticamente.",
		bullets: [
			"Órdenes de compra para productos y servicios",
			"Control de documentos adjuntos (facturas, remitos)",
			"Cuentas por pagar con vencimientos y alertas",
			"Historial de precios por proveedor",
		],
		icon: ShoppingCart,
	},
	{
		title: "Contabilidad Avanzada",
		description:
			"Plan contable completo con asientos automáticos desde cada módulo operativo y reportes financieros para la toma de decisiones.",
		bullets: [
			"Plan contable configurable por empresa",
			"Asientos automáticos desde ventas, compras y gastos",
			"Períodos contables y cierre fiscal automatizado",
			"Indicadores de rentabilidad y balances",
			"Reportes financieros exportables",
		],
		icon: BarChart3,
	},
	{
		title: "Capital Humano y Nómina",
		description:
			"Gestión integral de empleados con nómina automatizada, comisiones dinámicas, control de asistencia y vacaciones.",
		bullets: [
			"Nómina automatizada con cálculo de horas y aportes",
			"Comisiones dinámicas basadas en ventas reales",
			"Control de asistencia y horarios por empleado",
			"Gestión de vacaciones y licencias",
			"Pago de salarios y adelantos",
		],
		icon: TrendingUp,
	},
	{
		title: "Producción y Taller",
		description:
			"Gestión de órdenes de producción, recetas, reparaciones y trazabilidad de materiales desde la materia prima hasta el producto terminado.",
		bullets: [
			"Órdenes de producción con recetas e ingredientes",
			"Control de costos por lote producido",
			"Taller de reparaciones con seguimiento de equipos",
			"Historial de piezas y materiales utilizados",
		],
		icon: Wrench,
	},
	{
		title: "Reportes y Analítica",
		description:
			"Dashboards ejecutivos e informes operativos con datos consolidados de todos los módulos del sistema.",
		bullets: [
			"Dashboard ejecutivo con KPIs en tiempo real",
			"Reportes financieros, de ventas e inventario",
			"Analítica de rentabilidad por producto y cliente",
			"Reportes programados y exportación a PDF/CSV",
		],
		icon: FileText,
	},
];

/* ─── Benefits ─── */

export const BENEFIT_ITEMS: BenefitItem[] = [
	{
		title: "Reportes accionables",
		description:
			"Convierte datos de ventas e inventario en decisiones estratégicas en segundos.",
		icon: BarChart3,
	},
	{
		title: "Proyecciones confiables",
		description:
			"Anticipa escenarios de liquidez y crecimiento con modelos financieros claros.",
		icon: Wallet,
	},
	{
		title: "Inventario sin quiebres",
		description:
			"Reduce pérdidas con alertas preventivas y control operacional continuo.",
		icon: Package,
	},
	{
		title: "Operación automatizada",
		description:
			"Menos tareas manuales, menos errores y más foco en el crecimiento.",
		icon: Sparkles,
	},
];

/* ─── Pricing Plans ─── */

export const PLAN_ITEMS: PlanItem[] = [
	{
		name: "Básico",
		description:
			"Ideal para negocios en crecimiento que necesitan control operativo sólido.",
		cta: "Comenzar",
		bullets: [
			"Gestión de gastos e ingresos",
			"Control básico de inventario",
			"Reportes operativos esenciales",
			"Soporte técnico estándar",
		],
	},
	{
		name: "Profesional",
		description:
			"Pensado para PYMES que requieren automatización y análisis avanzado.",
		cta: "Solicitar demo",
		featured: true,
		bullets: [
			"Todo lo del plan Básico",
			"Automatización de ventas",
			"Contabilidad y capital humano",
			"Soporte prioritario",
		],
	},
	{
		name: "Empresarial",
		description:
			"Configuración personalizada para operaciones de alta complejidad.",
		cta: "Hablar con ventas",
		bullets: [
			"Todo lo del plan Profesional",
			"Integraciones personalizadas",
			"Analítica avanzada y optimizaciones",
			"Acompañamiento dedicado",
		],
	},
];

/* ─── Contact ─── */

export const CONTACT_ITEMS: ContactItem[] = [
	{
		label: "Correo",
		value: "garciamichel894@gmail.com",
		href: "mailto:garciamichel894@gmail.com",
		icon: Mail,
	},
	{
		label: "WhatsApp",
		value: "+53 53917705",
		href: "https://wa.me/5353917705",
		icon: MessageCircle,
	},
];

/* ─── Testimonials ─── */

/* ─── FAQ ─── */

export const FAQ_ITEMS: FaqItem[] = [
	{
		question: "¿Qué incluye cada plan?",
		answer:
			"Cada plan incluye acceso completo a los módulos detallados en la sección de precios. Todos incluyen soporte técnico, actualizaciones y respaldo de datos. Podés escalar de plan en cualquier momento sin perder información.",
	},
	{
		question: "¿Cuánto tiempo toma la implementación?",
		answer:
			"La implementación básica toma entre 1 y 3 días hábiles. Para operaciones complejas con integraciones personalizadas, puede extenderse hasta 2 semanas. Nuestro equipo te acompaña durante todo el proceso.",
	},
	{
		question: "¿Ofrecen soporte después de la implementación?",
		answer:
			"Sí, todos los planes incluyen soporte técnico continuo. Los planes Profesional y Empresarial cuentan con soporte prioritario y acompañamiento dedicado para garantizar que tu operación nunca se detenga.",
	},
	{
		question: "¿Puedo integrar FinanceMDM con otros sistemas?",
		answer:
			"Sí, ofrecemos integraciones vía API REST para conectar con tus sistemas existentes. El plan Empresarial incluye integraciones personalizadas desarrolladas específicamente para tu operación.",
	},
	{
		question: "¿Cómo funciona el multi-sucursal?",
		answer:
			"Podés gestionar todas tus sucursales desde un panel centralizado. Cada sucursal opera con su propio inventario y puntos de venta, pero vos tenés visibilidad consolidada de todo el negocio en tiempo real.",
	},
	{
		question: "¿Los datos están seguros?",
		answer:
			"Absolutamente. Usamos encriptación TLS en tránsito y AES-256 en reposo. Los respaldos son automáticos y diarios. Cumplimos con estándares de seguridad de datos financieros. Además, cada tenant tiene sus datos aislados.",
	},
];

/* ─── Hero Value Props (rotating) ─── */

export const HERO_VALUE_PROPS = [
	"Control financiero en tiempo real",
	"Stock inteligente sin quiebres",
	"Facturación automatizada al instante",
	"Reportes contables con un clic",
	"Nómina y comisiones sin errores",
];

/* ─── Floating badges for Hero image ─── */

export const HERO_BADGES = [
	{
		icon: TrendingUp,
		label: "Eficiencia",
		value: "+30%",
		className: "-bottom-7 -left-4 md:-left-8",
		color: "text-cyan-accent",
	},
	{
		icon: Wallet,
		label: "Ahorro operativo",
		value: "-40%",
		className: "-top-3 -right-4 md:-right-6",
		color: "text-emerald-400",
	},
	{
		icon: BarChart3,
		label: "Tiempo de cierre",
		value: "3x",
		className: "bottom-12 -right-5 md:-right-8",
		color: "text-primary",
	},
];

/* ─── Stats ─── */
