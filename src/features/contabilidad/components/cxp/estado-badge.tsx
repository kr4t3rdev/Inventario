"use client";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const configs = {
	PENDIENTE: {
		variant: "destructive" as const,
		icon: AlertCircle,
		label: "Pendiente",
		className:
			"bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
	},
	PAGADA: {
		variant: "default" as const,
		icon: CheckCircle2,
		label: "Pagada",
		className:
			"bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
	},
	PARCIAL: {
		variant: "secondary" as const,
		icon: Clock,
		label: "Parcial",
		className:
			"bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
	},
};

/**
 * @description Badge de estado de una cuenta por pagar con color e icono semánticos.
 * @param {{ estado: string }} props - Estado canónico de la cuenta.
 * @returns {JSX.Element} Badge con icono y etiqueta.
 */
export function EstadoBadge({ estado }: { estado: string }) {
	const config = configs[estado as keyof typeof configs] || configs.PENDIENTE;
	const Icon = config.icon;

	return (
		<Badge
			variant={config.variant}
			className={`flex items-center gap-1.5 w-fit ${config.className}`}
		>
			<Icon className="h-3 w-3" />
			{config.label}
		</Badge>
	);
}