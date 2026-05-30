import type { LucideIcon } from "lucide-react";
import {
	BarChart3,
	Building2,
	CreditCard,
	Database,
	DollarSign,
	FileText,
	Globe,
	Mail,
	MessageCircle,
	Package,
	Shield,
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
			"Convertí datos de ventas, inventario y contabilidad en decisiones estratégicas en segundos con dashboards ejecutivos.",
		icon: BarChart3,
	},
	{
		title: "Un solo sistema",
		description:
			"Olvidate de las planillas y los sistemas desconectados. Ventas, stock, contabilidad y nómina en una plataforma integrada.",
		icon: Database,
	},
	{
		title: "Inventario sin quiebres",
		description:
			"Alertas automáticas de stock mínimo, sugerencias de reposición y control de mermas para que nunca te falte producto.",
		icon: Package,
	},
	{
		title: "Operación automatizada",
		description:
			"Cada venta genera asientos contables, descuenta inventario y actualiza cuentas por cobrar automáticamente. Cero doble ingreso.",
		icon: Sparkles,
	},
	{
		title: "Multi-sucursal en tiempo real",
		description:
			"Controlá todas tus sucursales desde un panel: stock consolidado, ventas por punto y transferencias auditadas entre almacenes.",
		icon: Globe,
	},
	{
		title: "Seguridad y respaldo",
		description:
			"Datos aislados por empresa, respaldos automáticos en la nube con opción de descarga local y restauración point-in-time.",
		icon: Shield,
	},
	{
		title: "Proyecciones confiables",
		description:
			"Anticipá escenarios de liquidez y rentabilidad con reportes financieros que cruzan datos reales de ventas, gastos y cobranzas.",
		icon: Wallet,
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

/* ─── FAQ ─── */

export const FAQ_ITEMS: FaqItem[] = [
	{
		question: "¿Qué módulos específicos tiene FinanceMDM?",
		answer:
			"FinanceMDM cubre nueve áreas clave: gestión financiera multi-moneda, inventario y almacenes, puntos de venta, ventas y facturación, compras y abastecimiento, contabilidad, capital humano, producción y taller, y reportes ejecutivos. Cada módulo está integrado: una venta genera automáticamente el asiento contable, descuenta del stock y actualiza las cuentas por cobrar.",
	},
	{
		question: "¿Cómo controla el acceso por roles y sucursales?",
		answer:
			"Cada usuario tiene un rol de plataforma (admin o regular) y un rol de tenant que define lo que puede ver y hacer. El sistema aísla los datos por empresa y podés restringir módulos por rol: un dependiente solo accede al POS, mientras que el gerente ve reportes, contabilidad y empleados.",
	},
	{
		question: "¿Maneja múltiples monedas y conversión automática?",
		answer:
			"Sí. El sistema opera con varias monedas (USD, CUP, ARS, etc.) y tasas de cambio configurables. Las transacciones se registran en la moneda original y se convierten automáticamente para los reportes contables. Ideal para negocios que operan con tipo de cambio variable.",
	},
	{
		question: "¿Tiene control de caja y arqueo diario?",
		answer:
			"Sí. Cada punto de venta tiene su propio arqueo de caja por turno. El sistema registra apertura, movimientos y cierre con cuadre automático. Podés tener varios turnos por día y conciliar las ventas contra el efectivo declarado.",
	},
	{
		question: "¿Cómo funcionan las copias de seguridad?",
		answer:
			"Las copias pueden ser automáticas (programadas por hora o día) o manuales. Se almacenan en la nube (S3) y también podés descargarlas localmente. Hay un historial de respaldos con logs de verificación y la opción de restaurar desde cualquier punto.",
	},
	{
		question: "¿Se puede facturar con control de series y numeración?",
		answer:
			"Sí. El sistema tiene un módulo de series de facturación donde definís prefijos, rangos numéricos y puntos de venta asociados. Cada factura se emite con numeración correlativa automática y queda registrada en el historial del cliente y en la contabilidad. También manejás notas de crédito y anulaciones.",
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
