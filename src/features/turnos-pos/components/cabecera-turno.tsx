/**
 * @description Cabecera que muestra el estado del turno activo en el POS.
 * Incluye indicador visual, datos del turno y botones de acción para
 * arqueo (conteo de efectivo) y cuadre (revisión de productos/ventas).
 *
 * @param {object} props - Props del componente
 * @param {object | null} props.turno - Turno activo o null
 * @param {function} props.onCerrarTurno - Callback para abrir flujo de cierre
 * @param {function} props.onArqueo - Callback para abrir arqueo
 * @param {function} props.onCuadre - Callback para ir al cuadre
 * @returns {JSX.Element} Cabecera de turno
 */
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	ClipboardList,
	BarChart3,
	User,
	DollarSign,
	ShoppingCart,
	Lock,
} from "lucide-react";
import { formatCurrency, formatCurrencyUsd } from "@/lib/utils";

interface TurnoInfo {
	id: string;
	empleado?: { nombre: string; apellido: string } | null;
	fondoInicialCup: number;
	fondoInicialUsd: number;
	_count?: { ventas: number };
	ventas?: Array<{ total?: number | null }>;
}

interface CabeceraTurnoProps {
	turno: TurnoInfo | null;
	onArqueo?: () => void;
	onCuadre?: () => void;
	onCerrarTurno?: () => void;
}

export function CabeceraTurno({
	turno,
	onCuadre,
	onArqueo,
	onCerrarTurno,
}: CabeceraTurnoProps) {
	if (!turno) return null;

	const totalVentas =
		turno.ventas?.reduce((sum, v) => sum + (v.total ?? 0), 0) ?? 0;
	const totalTickets = turno._count?.ventas ?? turno.ventas?.length ?? 0;

	return (
		<div className="rounded-lg border bg-card text-card-foreground shadow-sm">
			<div className="flex flex-col gap-3 p-3">
				{/* Top row: estado + empleado + acciones (wrap en mobile) */}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-3">
						<Badge
							variant="outline"
							className="gap-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
						>
							<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
							Turno activo
						</Badge>

						<Separator orientation="vertical" className="hidden sm:block h-6" />

						<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
							<User className="h-3.5 w-3.5" />
							<span className="font-medium text-foreground">
								{turno.empleado
									? `${turno.empleado.nombre} ${turno.empleado.apellido}`
									: "Sin asignar"}
							</span>
						</div>
					</div>

					{/* Acciones: en mobile icon-only, en sm+ con label */}
					<div className="flex flex-wrap items-center gap-2">
						{onArqueo && (
							<Button
								variant="outline"
								size="sm"
								onClick={onArqueo}
								className="gap-1.5"
								aria-label="Arqueo"
							>
								<ClipboardList className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">Arqueo</span>
							</Button>
						)}
						{onCuadre && (
							<Button
								variant="outline"
								size="sm"
								onClick={onCuadre}
								className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
								aria-label="Cuadre"
							>
								<BarChart3 className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">Cuadre</span>
							</Button>
						)}
						{onCerrarTurno && (
							<Button
								variant="default"
								size="sm"
								onClick={onCerrarTurno}
								className="gap-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 w-full sm:w-auto"
							>
								<Lock className="h-3.5 w-3.5" />
								Cerrar Turno
							</Button>
						)}
					</div>
				</div>

				{/* Bottom row: métricas */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					<div className="flex items-center gap-1.5 text-muted-foreground">
						<DollarSign className="h-3.5 w-3.5" />
						<span>
							Fondo:{" "}
							<strong>{formatCurrency(turno.fondoInicialCup / 100)}</strong>
							{turno.fondoInicialUsd > 0 &&
								` · ${formatCurrencyUsd(turno.fondoInicialUsd / 100)}`}
						</span>
					</div>

					<div className="flex items-center gap-1.5 text-muted-foreground">
						<ShoppingCart className="h-3.5 w-3.5" />
						<span>
							Ventas: <strong>{formatCurrency(totalVentas)}</strong> (
							{totalTickets} tickets)
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
