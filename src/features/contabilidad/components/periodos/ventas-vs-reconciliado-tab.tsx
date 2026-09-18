/**
 * @description Tab de ventas, servicios y gastos vs reconciliado del cuadre de período.
 * Muestra cada operación con su estado de reconciliación, diferencias,
 * y cards de totales agregados. Incluye animaciones Framer Motion.
 */
"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
	CheckCircle2,
	XCircle,
	ChevronLeft,
	ChevronRight,
	Receipt,
	Banknote,
	AlertTriangle,
	CalendarClock,
	History,
} from "lucide-react";
import {
	staggerContainer,
	fadeUp,
	cardSlideUp,
	cardHover,
} from "../cuadre/animations";
import type {
	VentaVsReconciliadoItem,
	VentasVsReconciliadoData,
} from "../../cuadre-queries";

interface VentasVsReconciliadoTabProps {
	data: VentasVsReconciliadoData;
	onPageChange: (page: number) => void;
	isLoading?: boolean;
}

function formatMonto(monto: number): string {
	return `$${Math.abs(monto).toLocaleString("es-CU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

const METODO_PAGO_COLORS: Record<string, string> = {
	EFECTIVO: "bg-green-100 text-green-800",
	TARJETA: "bg-blue-100 text-blue-800",
	TRANSFERENCIA: "bg-purple-100 text-purple-800",
	CREDITO: "bg-amber-100 text-amber-800",
	MIXTO: "bg-indigo-100 text-indigo-800",
};

/** @description Fila de operación */
function OperacionRow({ item }: { item: VentaVsReconciliadoItem }) {
	const rowClass = cn(
		"border-b border-border/70 transition-colors hover:bg-accent/40",
		item.diferencia !== 0 && item.estaReconciliado && "bg-amber-50/50",
	);
	return (
		<TableRow className={rowClass}>

			<TableCell className="font-mono text-xs">#{item.folio}</TableCell>
			<TableCell className="text-xs text-muted-foreground">
				{item.origen ?? "—"}
			</TableCell>
			<TableCell>
				<Badge
					variant={
						item.tipo === "VENTA"
							? "default"
							: item.tipo === "SERVICIO"
								? "secondary"
								: "outline"
					}
					className="text-xs"
				>
					{item.tipo === "VENTA"
						? "Producto"
						: item.tipo === "SERVICIO"
							? "Servicio"
							: "Gasto"}
				</Badge>
			</TableCell>
			<TableCell className="text-sm">
				{format(new Date(item.fecha), "dd/MM/yy HH:mm", { locale: es })}
			</TableCell>
			<TableCell className="font-medium">{formatMonto(item.monto)}</TableCell>
			<TableCell>
				{item.metodoPago ? (
					<Badge
						variant="outline"
						className={`text-xs ${METODO_PAGO_COLORS[item.metodoPago] ?? ""}`}
					>
						{item.metodoPago}
					</Badge>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				)}
			</TableCell>
			<TableCell>
				{item.estaReconciliado ? (
					<Badge
						variant="outline"
						className="bg-green-50 text-green-700 border-green-200"
					>
						<CheckCircle2 className="h-3 w-3 mr-1" />
						Reconciliada
					</Badge>
				) : (
					<Badge
						variant="outline"
						className="bg-red-50 text-red-700 border-red-200"
					>
						<XCircle className="h-3 w-3 mr-1" />
						Pendiente
					</Badge>
				)}
			</TableCell>
			<TableCell>
				{item.montoReconciliado !== null
					? formatMonto(item.montoReconciliado)
					: "—"}
			</TableCell>
			<TableCell className="text-right">
				<span
					className={
						item.diferencia === 0
							? "text-green-600"
							: "text-amber-600 font-medium"
					}
				>
					{item.diferencia === 0 ? "✓" : formatMonto(item.diferencia)}
				</span>
			</TableCell>
		</TableRow>
	);
}

/** @description Tabla reutilizable con entrada animada y stagger en filas */
function OperacionesTable({
	items,
	emptyMessage,
	className,
}: {
	items: VentaVsReconciliadoItem[];
	emptyMessage: string;
	className?: string;
}) {
	return (
		<motion.div variants={fadeUp} initial="hidden" animate="visible">
			<Card className={className}>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Folio</TableHead>
								<TableHead>Origen</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Fecha</TableHead>
								<TableHead>Monto</TableHead>
								<TableHead>Método Pago</TableHead>
								<TableHead>Estado</TableHead>
								<TableHead>Monto Reconc.</TableHead>
								<TableHead className="text-right">Diferencia</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={9}
										className="text-center text-muted-foreground py-8"
									>
										{emptyMessage}
									</TableCell>
								</TableRow>
							) : (
								items.map((item) => (
									<OperacionRow key={item.id} item={item} />
								))
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</motion.div>
	);
}

export function VentasVsReconciliadoTab({
	data,
	onPageChange,
	isLoading = false,
}: VentasVsReconciliadoTabProps) {
	const { items, itemsAntiguos, totales, totalPages, page } = data;

	return (
		<div className="space-y-4">
			{/* Cards de totales */}
			<motion.div
				variants={staggerContainer}
				initial="hidden"
				animate="visible"
				className="grid gap-3 grid-cols-2 lg:grid-cols-4"
			>
				<motion.div variants={cardSlideUp} custom={0} {...cardHover}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-xs font-medium text-muted-foreground">
								Total Ventas
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<Receipt className="h-4 w-4 text-blue-500" />
								<span className="text-lg font-bold">
									{formatMonto(totales.totalVentas)}
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								{totales.cantidadVentas} operaciones
							</p>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div variants={cardSlideUp} custom={1} {...cardHover}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-xs font-medium text-muted-foreground">
								Total Reconciliado
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<Banknote className="h-4 w-4 text-green-500" />
								<span className="text-lg font-bold text-green-700">
									{formatMonto(totales.totalReconciliado)}
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								{totales.cantidadReconciliadas} reconciliadas
							</p>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div variants={cardSlideUp} custom={2} {...cardHover}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-xs font-medium text-muted-foreground">
								Diferencia
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<AlertTriangle
									className={`h-4 w-4 ${
										totales.diferencia === 0
											? "text-green-500"
											: "text-amber-500"
									}`}
								/>
								<span
									className={`text-lg font-bold ${
										totales.diferencia === 0
											? "text-green-700"
											: "text-amber-700"
									}`}
								>
									{formatMonto(totales.diferencia)}
								</span>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				<motion.div variants={cardSlideUp} custom={3} {...cardHover}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-xs font-medium text-muted-foreground">
								Pendientes
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<XCircle className="h-4 w-4 text-red-500" />
								<span className="text-lg font-bold text-red-700">
									{totales.cantidadPendientes}
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								sin reconciliar
							</p>
						</CardContent>
					</Card>
				</motion.div>
			</motion.div>

			{/* Card de Gastos */}
			<motion.div
				variants={staggerContainer}
				initial="hidden"
				animate="visible"
				className="grid gap-3 grid-cols-2 lg:grid-cols-4"
			>
				<motion.div variants={cardSlideUp} custom={0} {...cardHover}>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-xs font-medium text-muted-foreground">
								Total Gastos
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<Receipt className="h-4 w-4 text-orange-500" />
								<span className="text-lg font-bold">
									{formatMonto(totales.totalGastos)}
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								{totales.cantidadGastos} gastos ·{" "}
								{totales.cantidadGastosReconciliados} reconciliados ·{" "}
								{totales.cantidadGastosPendientes} pendientes
							</p>
						</CardContent>
					</Card>
				</motion.div>
			</motion.div>

			{/* Tabla del período actual */}
			<OperacionesTable
				items={items}
				emptyMessage="No hay ventas, servicios o gastos en este período."
			/>

			{/* ── Separador de operaciones antiguas ── */}
			{itemsAntiguos.length > 0 && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t-2 border-destructive" />
						</div>
						<div className="relative flex justify-center">
							<div className="bg-background px-4 flex items-center gap-2 text-destructive">
								<CalendarClock className="h-5 w-5" />
								<span className="text-sm font-medium">
									Operaciones pendientes de períodos anteriores
								</span>
							</div>
						</div>
					</div>
					<motion.p
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
						className="text-xs text-muted-foreground text-center"
					>
						Estas operaciones no fueron reconciliadas en su período y deben
						solventarse antes del cierre.
					</motion.p>

					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
						<History className="h-4 w-4" />
						<span>
							{itemsAntiguos.length} operacion(es) sin reconciliar de períodos
							anteriores
						</span>
					</div>

					<OperacionesTable
						items={itemsAntiguos}
						emptyMessage=""
						className="border-destructive/30"
					/>
				</motion.div>
			)}

			{/* Paginación */}
			{totalPages > 1 && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5 }}
					className="flex items-center justify-between"
				>
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
							<ChevronLeft className="h-4 w-4 mr-1" /> Anterior
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
				</motion.div>
			)}
		</div>
	);
}
