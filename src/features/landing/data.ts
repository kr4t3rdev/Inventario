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
	Sparkles,
	Shield,
	ShoppingCart,
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

export interface AffiliateHighlightItem {
	title: string;
	description: string;
}

export interface AffiliateTierItem {
	range: string;
	commission: string;
	perks: string;
}

export interface AffiliateStepItem {
	title: string;
	description: string;
}

/* ─── Navigation ─── */

export const NAV_ITEMS = [
	{ href: "#caracteristicas", label: "Características" },
	{ href: "#beneficios", label: "Beneficios" },
	{ href: "#testimonios", label: "Testimonios" },
	{ href: "#precios", label: "Planes" },
	{ href: "#referidos", label: "Referidos" },
	{ href: "#faq", label: "FAQ" },
	{ href: "/docs", label: "Documentación" },
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
];

/* ─── Pricing Plans ─── */

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

/* ─── Affiliate Program ─── */

export const AFFILIATE_PROGRAM_HIGHLIGHTS: AffiliateHighlightItem[] = [
	{
		title: "Hasta 10% de comisión",
		description:
			"Escalá tu beneficio según la cantidad de ventas válidas confirmadas.",
	},
	{
		title: "Crédito en licencia",
		description:
			"La comisión se aplica como saldo a tu próxima renovación o licencia.",
	},
	{
		title: "Perks exclusivos",
		description:
			"Ganás ventajas nuevas del programa, separadas de los planes comerciales.",
	},
	{
		title: "Ventas reales confirmadas",
		description:
			"Solo cuentan compras pagadas y confirmadas manualmente por administración.",
	},
];

export const SALES_AGENT_PROGRAM_HIGHLIGHTS: AffiliateHighlightItem[] = [
	{
		title: "Sin tener un tenant",
		description:
			"Podés registrarte como Gestor de Ventas aunque no uses FinanceMDM para administrar una empresa.",
	},
	{
		title: "Comisión recurrente",
		description:
			"Cobrás por cada renovación futura de los tenants referidos que continúen activos y con licencia vigente.",
	},
	{
		title: "Pagos en CUP",
		description:
			"Administración confirma cada pago presencial y liquida tu saldo en CUP usando la tasa del momento.",
	},
	{
		title: "Seguimiento claro",
		description:
			"Consultás tenants referidos, comisiones disponibles, pagos realizados y notificaciones desde tu panel.",
	},
];

export const AFFILIATE_PROGRAM_TIERS: AffiliateTierItem[] = [
	{ range: "1–10 ventas válidas", commission: "5%", perks: "1 perk" },
	{ range: "11–50 ventas válidas", commission: "7%", perks: "2 perks" },
	{ range: "51+ ventas válidas", commission: "10%", perks: "3 perks" },
];

export const AFFILIATE_PROGRAM_STEPS: AffiliateStepItem[] = [
	{
		title: "Compartís tu link",
		description:
			"Cada tenant activo recibe un código o link de referido para recomendar la plataforma.",
	},
	{
		title: "El referido compra",
		description:
			"La referencia cuenta cuando el nuevo tenant realiza su primera compra y el admin confirma el pago.",
	},
	{
		title: "Recibís crédito y perks",
		description:
			"Tu comisión se convierte en saldo para la próxima licencia y además ganás perks exclusivos del programa.",
	},
];

export const SALES_AGENT_PROGRAM_TIERS: AffiliateTierItem[] = [
	{ range: "1–10 tenants activos", commission: "3%", perks: "Pago por renovación" },
	{ range: "11–31 tenants activos", commission: "5%", perks: "Pago por renovación" },
	{ range: "32+ tenants activos", commission: "7%", perks: "Pago por renovación" },
];

export const SALES_AGENT_PROGRAM_STEPS: AffiliateStepItem[] = [
	{
		title: "Te registrás como Gestor de Ventas",
		description:
			"Creás tu cuenta, verificás tu correo y completás el onboarding seleccionando este tipo de usuario.",
	},
	{
		title: "Compartís tu código",
		description:
			"Usás tu link, código, QR o WhatsApp para invitar empresas y consultar tus referidos desde el panel.",
	},
	{
		title: "Administración confirma el pago",
		description:
			"Cada pago presencial y renovación se confirma manualmente para proteger la trazabilidad de la comisión.",
	},
	{
		title: "Cobrás en CUP",
		description:
			"Podés solicitar un pago parcial o total. El monto se calcula en CUP con la tasa de cambio registrada.",
	},
];

export const AFFILIATE_PROGRAM_RULES: string[] = [
	"Disponible solo para tenants activos con licencia vigente.",
	"La comisión aplica sobre la primera compra del referido.",
	"El beneficio se entrega como crédito para la próxima licencia.",
	"Si sobra saldo, se arrastra a ciclos futuros.",
	"Los perks son acumulativos y exclusivos del programa.",
	"Los perks no reemplazan features del plan comercial base.",
];

export const SALES_AGENT_PROGRAM_RULES: string[] = [
	"Disponible para personas registradas como Gestor de Ventas y con la cuenta aprobada.",
	"La comisión se genera por cada pago presencial confirmado, incluida cada renovación.",
	"El porcentaje depende de los tenants referidos activos y con licencia vigente.",
	"El pago se realiza en CUP con la tasa de cambio registrada al momento de liquidar.",
	"Se permiten pagos parciales o totales del saldo disponible.",
	"Para comenzar o resolver dudas, contactá a administración por teléfono.",
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
		question: "¿Quién puede participar en el programa de referidos?",
		answer:
			"Solo tenants activos con licencia vigente pueden acumular beneficios dentro del programa de referidos.",
	},
	{
		question: "¿Cuándo se acredita la comisión de un referido?",
		answer:
			"La comisión se acredita cuando el referido realiza su primera compra y el pago es confirmado manualmente por administración.",
	},
	{
		question: "¿Cómo se entrega el beneficio del programa?",
		answer:
			"La comisión se transforma en crédito para la próxima licencia, y además se habilitan perks exclusivos del programa según el tramo alcanzado.",
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

export const HERO_DEFINITION =
	"FinanceMDM es un sistema de gestión empresarial para pymes que centraliza inventario, ventas, contabilidad, compras y operaciones en una sola plataforma, para que cada movimiento impacte en tiempo real y el equipo trabaje con datos consistentes.";

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
		value: "Flujos conectados",
		className: "-bottom-7 -left-4 md:-left-8",
		color: "text-cyan-accent",
	},
	{
		icon: Wallet,
		label: "Ahorro operativo",
		value: "Menos tareas manuales",
		className: "-top-3 -right-4 md:-right-6",
		color: "text-emerald-400",
	},
	{
		icon: BarChart3,
		label: "Tiempo de cierre",
		value: "Visión en tiempo real",
		className: "bottom-12 -right-5 md:-right-8",
		color: "text-primary",
	},
];

/* ─── Stats ─── */
