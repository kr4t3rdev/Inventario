/**
 * @description Tab de resumen diario con acordeón animado (Framer Motion).
 * Muestra ingresos/egresos/neto por día, expandible para ver
 * operaciones individuales cargadas bajo demanda.
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
	ChevronDown,
	ChevronRight,
	CalendarDays,
	Loader2,
} from "lucide-react";
import {
	staggerContainer,
	fadeUp,
	listItem,
	cardSlideUp,
	cardHover,
} from "../cuadre/animations";
import type { ResumenDiarioItem, OperacionItem } from "../../cuadre-queries";

interface ResumenDiarioTabProps {
	items: ResumenDiarioItem[];
	onLoadDia?: (fecha: string) => Promise<OperacionItem[]>;
}

function formatMonto(monto: number): string {
	return `$${Math.abs(monto).toLocaleString("es-CU", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

/** @description Fila de acordeón con animación de expand */
function DiaRow({
	item,
	operaciones,
	isLoading,
	onToggle,
	isExpanded,
}: {
	item: ResumenDiarioItem;
	operaciones: OperacionItem[];
	isLoading: boolean;
	onToggle: () => void;
	isExpanded: boolean;
}) {
	const fechaObj = new Date(item.fecha + "T12:00:00");
	const diaSemana = format(fechaObj, "EEEE", { locale: es });
	const fechaFormatted = format(fechaObj, "d 'de' MMM", { locale: es });

	return (
		<motion.div
			variants={listItem}
			className="border rounded-lg overflow-hidden"
		>
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left cursor-pointer"
			>
				<div className="flex items-center gap-3">
					<motion.div
						animate={{ rotate: isExpanded ? 90 : 0 }}
						transition={{ duration: 0.2 }}
					>
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					</motion.div>
					<div>
						<div className="flex items-center gap-2">
							<CalendarDays className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium text-sm capitalize">
								{diaSemana} {fechaFormatted}
							</span>
						</div>
						<div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
							<span>{item.cantidadOperaciones} operaciones</span>
							{item.desglose.length > 0 && (
								<span className="flex gap-1">
									{item.desglose.map((d) => (
										<Badge
											key={d.tipo}
											variant="outline"
											className="text-[10px] px-1"
										>
											{d.tipo}: {d.cantidad}
										</Badge>
									))}
								</span>
							)}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-4 text-sm">
					{item.totalIngresos > 0 && (
						<span className="text-green-600 font-medium">
							+{formatMonto(item.totalIngresos)}
						</span>
					)}
					{item.totalEgresos > 0 && (
						<span className="text-red-600 font-medium">
							-{formatMonto(item.totalEgresos)}
						</span>
					)}
					<span
						className={`font-semibold min-w-[80px] text-right ${
							item.neto > 0
								? "text-green-700"
								: item.neto < 0
									? "text-red-700"
									: "text-muted-foreground"
						}`}
					>
						{item.neto > 0 ? "+" : ""}
						{formatMonto(item.neto)}
					</span>
				</div>
			</button>

			{/* Expandido animado */}
			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						key={`content-${item.fecha}`}
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.25, ease: "easeInOut" }}
						className="overflow-hidden"
					>
						<div className="border-t bg-muted/30 px-4 py-3">
							{isLoading ? (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
								</div>
							) : operaciones.length === 0 ? (
								<p className="text-sm text-muted-foreground text-center py-2">
									No hay operaciones este día.
								</p>
							) : (
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="text-xs">Tipo</TableHead>
												<TableHead className="text-xs">Descripción</TableHead>
												<TableHead className="text-xs text-right">
													Monto
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{operaciones.map((op) => (
												<TableRow key={`${op.tipo}-${op.id}`}>
													<TableCell>
														<Badge variant="outline" className="text-[10px]">
															{op.tipo}
														</Badge>
													</TableCell>
													<TableCell className="text-sm max-w-[200px] truncate">
														{op.descripcion}
													</TableCell>
													<TableCell className="text-sm text-right font-medium">
														{op.monto > 0 ? "+" : ""}
														{formatMonto(op.monto)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

export function ResumenDiarioTab({ items, onLoadDia }: ResumenDiarioTabProps) {
	const [expandedDia, setExpandedDia] = useState<string | null>(null);
	const [loadingDia, setLoadingDia] = useState<string | null>(null);
	const [operacionesPorDia, setOperacionesPorDia] = useState<
		Record<string, OperacionItem[]>
	>({});

	const handleToggle = async (fecha: string) => {
		if (expandedDia === fecha) {
			setExpandedDia(null);
			return;
		}

		setExpandedDia(fecha);

		if (!operacionesPorDia[fecha] && onLoadDia) {
			setLoadingDia(fecha);
			try {
				const ops = await onLoadDia(fecha);
				setOperacionesPorDia((prev) => ({ ...prev, [fecha]: ops }));
			} finally {
				setLoadingDia(null);
			}
		}
	};

	if (items.length === 0) {
		return (
			<motion.div
				variants={fadeUp}
				initial="hidden"
				animate="visible"
				className="flex flex-col items-center justify-center py-12 text-muted-foreground"
			>
				<CalendarDays className="h-12 w-12 mb-3 opacity-20" />
				<p>No hay operaciones en este período.</p>
			</motion.div>
		);
	}

	const totalIngresos = items.reduce((s, i) => s + i.totalIngresos, 0);
	const totalEgresos = items.reduce((s, i) => s + i.totalEgresos, 0);
	const totalNeto = items.reduce((s, i) => s + i.neto, 0);

	return (
		<motion.div
			variants={staggerContainer}
			initial="hidden"
			animate="visible"
			className="space-y-2"
		>
			{/* Totales del período */}
			<motion.div variants={cardSlideUp} custom={0} {...cardHover}>
				<Card className="mb-4">
					<CardContent className="p-4">
						<div className="grid grid-cols-3 gap-4 text-center">
							<div>
								<p className="text-xs text-muted-foreground">
									Total Ingresos
								</p>
								<p className="text-lg font-bold text-green-600">
									+{formatMonto(totalIngresos)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Total Egresos
								</p>
								<p className="text-lg font-bold text-red-600">
									-{formatMonto(totalEgresos)}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Neto</p>
								<p
									className={`text-lg font-bold ${
										totalNeto >= 0 ? "text-green-700" : "text-red-700"
									}`}
								>
									{totalNeto >= 0 ? "+" : ""}
									{formatMonto(totalNeto)}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</motion.div>

			{/* Acordeón por día */}
			<motion.div variants={staggerContainer} className="space-y-1">
				{items.map((item) => (
					<DiaRow
						key={item.fecha}
						item={item}
						operaciones={operacionesPorDia[item.fecha] ?? []}
						isLoading={loadingDia === item.fecha}
						onToggle={() => handleToggle(item.fecha)}
						isExpanded={expandedDia === item.fecha}
					/>
				))}
			</motion.div>
		</motion.div>
	);
}
