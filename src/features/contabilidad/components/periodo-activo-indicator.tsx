/**
 * @description Indicador de período contable activo para el header global.
 *
 * Muestra el período activo actual (DIARIO → MENSUAL → TRIMESTRAL → SEMESTRAL → ANUAL) con su estado
 * y color correspondiente. Se actualiza al navegar.
 */
import { PeriodoContableService } from "@/lib/services/periodo-contable-service";
import { Badge } from "@/components/ui/badge";
import {
	Calendar,
	Lock,
	ShieldCheck,
	AlertTriangle,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const ESTADO_CONFIG: Record<
	string,
	{ label: string; className: string; Icon: LucideIcon }
> = {
	ABIERTO: {
		label: "Abierto",
		className:
			"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200",
		Icon: Calendar,
	},
	EN_CIERRE: {
		label: "En Cierre",
		className:
			"bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-200",
		Icon: Calendar,
	},
	CERRADO: {
		label: "Cerrado",
		className:
			"bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200",
		Icon: Lock,
	},
	APROBADO: {
		label: "Aprobado",
		className:
			"bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300 hover:bg-red-300",
		Icon: ShieldCheck,
	},
	REABIERTO: {
		label: "Reabierto",
		className:
			"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200",
		Icon: AlertTriangle,
	},
	BORRADOR: {
		label: "Borrador",
		className:
			"bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200",
		Icon: Calendar,
	},
};

const MESES = [
	"Ene",
	"Feb",
	"Mar",
	"Abr",
	"May",
	"Jun",
	"Jul",
	"Ago",
	"Sep",
	"Oct",
	"Nov",
	"Dic",
];

function formatPeriodoLabel(
	fechaInicio: Date,
	fechaFin: Date,
	tipo: string,
): string {
	if (tipo === "DIARIO") {
		return `${fechaInicio.getDate()} ${MESES[fechaInicio.getMonth()]} ${fechaInicio.getFullYear()}`;
	}
	if (tipo === "MENSUAL") {
		return `${MESES[fechaInicio.getMonth()]} ${fechaInicio.getFullYear()}`;
	}
	if (tipo === "TRIMESTRAL") {
		const trim = Math.ceil((fechaInicio.getMonth() + 1) / 3);
		return `T${trim} ${fechaInicio.getFullYear()}`;
	}
	if (tipo === "SEMESTRAL") {
		const sem = fechaInicio.getMonth() < 6 ? "S1" : "S2";
		return `${sem} ${fechaInicio.getFullYear()}`;
	}
	return `${fechaInicio.getFullYear()}`;
}

/**
 * @description Server component que busca el período activo para el tenant
 *              y renderiza un badge clickeable que lleva a /busy/contabilidad/periodos.
 *
 * @returns {Promise<JSX.Element | null>} Badge del período activo o null si no hay.
 */
async function getPeriodoActivoData() {
	try {
		const { getCurrentUser } = await import(
			"@/lib/server-actions/get-current-user"
		);
		const user = await getCurrentUser();
		if (!user?.tenantId) return null;

		const ahora = new Date();
		const resultado = await PeriodoContableService.resolverPeriodoActivo(
			ahora,
			user.tenantId,
		);

		if (!resultado.periodo) return null;

		const { periodo } = resultado;
		const config =
			ESTADO_CONFIG[periodo.estado as string] ?? ESTADO_CONFIG.ABIERTO;
		const label = formatPeriodoLabel(
			periodo.fechaInicio,
			periodo.fechaFin,
			periodo.tipo,
		);

		return { config, label };
	} catch {
		return null;
	}
}

/**
 * @description Server component que busca el período activo para el tenant
 *              y renderiza un badge clickeable que lleva a /busy/contabilidad/periodos.
 *
 * @returns {Promise<JSX.Element | null>} Badge del período activo o null si no hay.
 */
export async function PeriodoActivoIndicator(): Promise<JSX.Element | null> {
	const data = await getPeriodoActivoData();
	if (!data) return null;

	const { config, label } = data;
	const { Icon } = config;

	return (
		<Link
			href="/busy/contabilidad/periodos"
			className="hover:opacity-80 transition-opacity"
		>
			<Badge
				className={`gap-1.5 px-2.5 py-1 text-xs font-medium border-0 ${config.className}`}
			>
				<Icon className="h-3 w-3" />
				<span>{label}</span>
				<span className="opacity-70">—</span>
				<span>{config.label}</span>
			</Badge>
		</Link>
	);
}
