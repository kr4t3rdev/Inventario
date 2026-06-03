/**
 * @description Tab de operaciones del período en el cuadre de cierre.
 * Muestra todas las transacciones del período con filtros y paginación.
 */
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
	ChevronLeft,
	ChevronRight,
	Receipt,
	Wrench,
	ShoppingCart,
	ArrowLeftRight,
	SlidersHorizontal,
	Banknote,
	Landmark,
	HandCoins,
} from "lucide-react";
import type { OperacionItem, OperacionesData } from "../../cuadre-queries";

interface OperacionesTabProps {
	data: OperacionesData;
	onPageChange: (page: number) => void;
	onFiltroChange: (filtro: string) => void;
	filtroActivo: string;
	isLoading?: boolean;
}

function formatMonto(monto: number): string {
	return `$${Math.abs(monto).toLocaleString("es-CU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

const TIPO_CONFIG: Record<
	string,
	{ label: string; icon: React.ElementType; color: string }
> = {
	VENTA: {
		label: "Venta",
		icon: Receipt,
		color: "bg-blue-100 text-blue-800 border-blue-200",
	},
	SERVICIO: {
		label: "Servicio",
		icon: Wrench,
		color: "bg-teal-100 text-teal-800 border-teal-200",
	},
	GASTO: {
		label: "Gasto",
		icon: ShoppingCart,
		color: "bg-red-100 text-red-800 border-red-200",
	},
	TRANSFERENCIA: {
		label: "Transferencia",
		icon: ArrowLeftRight,
		color: "bg-purple-100 text-purple-800 border-purple-200",
	},
	AJUSTE: {
		label: "Ajuste",
		icon: SlidersHorizontal,
		color: "bg-amber-100 text-amber-800 border-amber-200",
	},
	CAPITAL: {
		label: "Capital",
		icon: Banknote,
		color: "bg-green-100 text-green-800 border-green-200",
	},
	PAGO_DEUDA: {
		label: "Pago Deuda",
		icon: Landmark,
		color: "bg-orange-100 text-orange-800 border-orange-200",
	},
	PRESTAMO: {
		label: "Préstamo",
		icon: HandCoins,
		color: "bg-indigo-100 text-indigo-800 border-indigo-200",
	},
};

const OPCIONES_FILTRO = [
	{ value: "todas", label: "Todas" },
	{ value: "venta", label: "Ventas" },
	{ value: "servicio", label: "Servicios" },
	{ value: "gasto", label: "Gastos" },
	{ value: "transferencia", label: "Transferencias" },
	{ value: "ajuste", label: "Ajustes" },
];

export function OperacionesTab({
	data,
	onPageChange,
	onFiltroChange,
	filtroActivo,
	isLoading = false,
}: OperacionesTabProps) {
	const { items, totalPages, page, totalCount } = data;

	return (
		<div className="space-y-4">
			{/* Filtro y contador */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Select value={filtroActivo} onValueChange={onFiltroChange}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Filtrar por tipo" />
						</SelectTrigger>
						<SelectContent>
							{OPCIONES_FILTRO.map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{o.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<p className="text-sm text-muted-foreground">
					{totalCount} operación{totalCount !== 1 ? "es" : ""}
				</p>
			</div>

			{/* Tabla */}
			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Fecha</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Descripción</TableHead>
								<TableHead>Monto</TableHead>
								<TableHead>Moneda</TableHead>
								<TableHead>Referencia</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="text-center text-muted-foreground py-8"
									>
										No hay operaciones con el filtro seleccionado.
									</TableCell>
								</TableRow>
							) : (
								items.map((item) => {
									const cfg = TIPO_CONFIG[item.tipo] ?? {
										label: item.tipo,
										icon: Receipt,
										color: "bg-gray-100 text-gray-800",
									};
									const Icon = cfg.icon;
									return (
										<TableRow key={`${item.tipo}-${item.id}`}>
											<TableCell className="text-sm">
												{format(new Date(item.fecha), "dd/MM/yy HH:mm", {
													locale: es,
												})}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={`text-xs ${cfg.color}`}
												>
													<Icon className="h-3 w-3 mr-1" />
													{cfg.label}
												</Badge>
											</TableCell>
											<TableCell className="text-sm max-w-[250px] truncate">
												{item.descripcion}
											</TableCell>
											<TableCell className="font-medium">
												{formatMonto(item.monto)}
											</TableCell>
											<TableCell>
												<Badge variant="secondary" className="text-xs">
													{item.moneda}
												</Badge>
											</TableCell>
											<TableCell className="text-xs text-muted-foreground font-mono">
												{item.referencia ?? "—"}
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Paginación */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Página {page} de {totalPages}
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(page - 1)}
							disabled={page <= 1 || isLoading}
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							Anterior
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(page + 1)}
							disabled={page >= totalPages || isLoading}
						>
							Siguiente
							<ChevronRight className="h-4 w-4 ml-1" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
