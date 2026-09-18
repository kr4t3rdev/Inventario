/**
 * @description Componente que muestra el resumen de diferencias entre esperado y contado
 * para todos los métodos de pago (efectivo CUP, efectivo USD, tarjeta, transferencia, crédito).
 *
 * @param {object} props - Props del componente
 * @param {EsperadosArqueo} props.esperados - Valores esperados desde las ventas
 * @param {object} props.contados - Valores contados físicamente
 * @param {number} props.contados.totalEfectivoCup - Efectivo CUP contado (centavos)
 * @param {number} props.contados.totalEfectivoUsd - Efectivo USD contado (centavos)
 * @param {number} props.contados.totalTarjeta - Tarjeta contada (centavos)
 * @param {number} props.contados.totalTransferencia - Transferencia contada (centavos)
 * @param {number} props.contados.totalCredito - Crédito contado (centavos)
 * @returns {JSX.Element} Resumen de diferencias
 */
"use client";

import { cn } from "@/lib/utils";
import {
	DollarSign,
	CreditCard,
	ArrowRightLeft,
	Banknote,
	Plus,
	Minus,
} from "lucide-react";
import type { EsperadosArqueo } from "../types";

interface Contados {
	totalEfectivoCup: number;
	totalEfectivoUsd: number;
	totalTarjeta: number;
	totalTransferencia: number;
	totalCredito: number;
}

interface ResumenDiferenciasProps {
	esperados: EsperadosArqueo;
	contados: Contados;
}

interface FilaDetalle {
	label: string;
	icon: React.ReactNode;
	esperado: number;
	contado: number;
	moneda: string;
}

function Fila({ label, icon, esperado, contado, moneda }: FilaDetalle) {
	const diff = contado - esperado;
	const hayDiff = Math.abs(diff) > 0;

	return (
		<div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5 text-sm">
			<div className="flex items-center gap-2">
				{icon}
				<span>{label}</span>
			</div>
			<span className="tabular-nums text-muted-foreground">
				${(esperado / 100).toFixed(2)}
			</span>
			<span className="tabular-nums font-medium">
				${(contado / 100).toFixed(2)}
			</span>
			<span
				className={cn(
					"tabular-nums font-medium text-right min-w-[5rem]",
					hayDiff
						? diff > 0
							? "text-green-600 dark:text-green-400"
							: "text-red-600 dark:text-red-400"
						: "text-muted-foreground",
				)}
			>
				{diff >= 0 ? "+" : ""}${(diff / 100).toFixed(2)} {moneda}
				{!hayDiff && <span className="text-xs ml-1">✓</span>}
			</span>
		</div>
	);
}

export function ResumenDiferencias({
	esperados,
	contados,
}: ResumenDiferenciasProps) {
	const totalEsperado =
		esperados.esperadoEfectivoCup +
		esperados.esperadoTarjeta +
		esperados.esperadoTransferencia +
		esperados.esperadoCredito;

	// Neto CUP = efectivo contado - fondo inicial (para comparar contra ventas sin fondo)
	const netoEfectivoCup = contados.totalEfectivoCup - esperados.fondoInicialCup;

	const totalContado =
		netoEfectivoCup +
		contados.totalEfectivoUsd +
		contados.totalTarjeta +
		contados.totalTransferencia +
		contados.totalCredito;

	const totalDiff = totalContado - totalEsperado;

	const filas: FilaDetalle[] = [
		{
			label: "Efectivo CUP",
			icon: <DollarSign className="h-4 w-4 text-green-600" />,
			esperado: esperados.esperadoEfectivoCup,
			contado: netoEfectivoCup, // neto: efectivo contado - fondo inicial
			moneda: "CUP",
		},
		{
			label: "Efectivo USD",
			icon: <Banknote className="h-4 w-4 text-blue-600" />,
			esperado: esperados.esperadoEfectivoUsd,
			contado: contados.totalEfectivoUsd,
			moneda: "USD",
		},
		{
			label: "Tarjeta",
			icon: <CreditCard className="h-4 w-4 text-purple" />,
			esperado: esperados.esperadoTarjeta,
			contado: contados.totalTarjeta,
			moneda: "CUP",
		},
		{
			label: "Transferencia",
			icon: <ArrowRightLeft className="h-4 w-4 text-cyan-600" />,
			esperado: esperados.esperadoTransferencia,
			contado: contados.totalTransferencia,
			moneda: "CUP",
		},
		{
			label: "Crédito",
			icon: <Plus className="h-4 w-4 text-amber-600" />,
			esperado: esperados.esperadoCredito,
			contado: contados.totalCredito,
			moneda: "CUP",
		},
	];

	return (
		<div className="rounded-lg border">
			<div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
				<Minus className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium">Resumen de diferencias</span>
			</div>

			<div className="px-4 py-2">
				{/* Encabezados */}
				<div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
					<span>Método</span>
					<span>Esperado</span>
					<span>Contado</span>
					<span className="text-right">Diferencia</span>
				</div>

				<div className="divide-y">
					{filas.map((f) => (
						<Fila key={f.label} {...f} />
					))}
				</div>
			</div>

			{/* Total general */}
			<div className="border-t bg-muted/30 px-4 py-3">
				<div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm font-semibold">
					<span>Total</span>
					<span className="tabular-nums">
						${(totalEsperado / 100).toFixed(2)}
					</span>
					<span className="tabular-nums">
						${(totalContado / 100).toFixed(2)}
					</span>
					<span
						className={cn(
							"tabular-nums text-right",
							totalDiff >= 0
								? "text-green-600 dark:text-green-400"
								: "text-red-600 dark:text-red-400",
						)}
					>
						{totalDiff >= 0 ? "+" : ""}${(totalDiff / 100).toFixed(2)} CUP
					</span>
				</div>
			</div>
		</div>
	);
}
