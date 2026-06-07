/**
 * @description Componente para conteo de billetes por denominación.
 * Renderiza filas de denominación + input de cantidad para una moneda (CUP o USD).
 * Muestra el fondo inicial, neto después de deducir fondo, y diferencia vs esperado.
 *
 * @param {object} props - Props del componente
 * @param {'CUP' | 'USD'} props.moneda - Tipo de moneda
 * @param {Denominacion[]} props.denominaciones - Array de denominaciones a mostrar
 * @param {Record<string, number>} props.valores - Valores actuales por key
 * @param {function} props.onChange - Callback al cambiar un valor
 * @param {number} props.totalCalculado - Total calculado en centavos
 * @param {number} props.esperado - Total esperado en centavos (solo ventas, sin fondo)
 * @param {number} props.fondoInicial - Fondo inicial en centavos
 * @param {boolean} props.disabled - Si está deshabilitado
 * @returns {JSX.Element} Tabla de conteo
 */
"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DollarSign, Wallet } from "lucide-react";
import type { Denominacion } from "./denominaciones";

interface ConteoBilletesProps {
	moneda: "CUP" | "USD";
	denominaciones: Denominacion[];
	valores: Record<string, number>;
	onChange: (key: string, value: number) => void;
	totalCalculado: number;
	esperado: number;
	fondoInicial?: number;
	disabled?: boolean;
}

export function ConteoBilletes({
	moneda,
	denominaciones,
	valores,
	onChange,
	totalCalculado,
	esperado,
	fondoInicial = 0,
	disabled = false,
}: ConteoBilletesProps) {
	const neto = totalCalculado - fondoInicial;
	const diferencia = neto - esperado;
	const hayDiferencia = Math.abs(diferencia) > 0;

	return (
		<div className="rounded-lg border">
			<div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
				<DollarSign className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium">
					Efectivo {moneda === "CUP" ? "CUP" : "USD"}
				</span>
			</div>

			<div className="divide-y">
				{denominaciones.map((den) => {
					const cantidad = valores[den.key] ?? 0;
					const subtotal = cantidad * den.valor;

					return (
						<div
							key={den.key}
							className="flex items-center gap-3 px-4 py-2 text-sm"
						>
							<span className="w-24 font-medium">{den.label}</span>
							<Input
								type="number"
								min="0"
								step="1"
								value={cantidad || ""}
								placeholder="0"
								className="h-8 w-20"
								disabled={disabled}
								onChange={(e) => {
									const v = parseInt(e.target.value, 10);
									onChange(den.key, isNaN(v) ? 0 : Math.max(0, v));
								}}
							/>
							<span className="w-28 text-right text-muted-foreground tabular-nums">
								= ${(subtotal / 100).toFixed(2)}
							</span>
						</div>
					);
				})}
			</div>

			<div className="border-t bg-muted/30 px-4 py-3 space-y-1">
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">Total contado</span>
					<span className="font-medium tabular-nums">
						${(totalCalculado / 100).toFixed(2)}
					</span>
				</div>
				{fondoInicial > 0 && (
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">- Fondo inicial</span>
						<span className="font-medium tabular-nums text-amber-600">
							-${(fondoInicial / 100).toFixed(2)}
						</span>
					</div>
				)}
				<div className="flex justify-between text-sm border-t border-dotted pt-1">
					<span className="text-muted-foreground font-medium">
						{fondoInicial > 0 ? "Neto en caja" : "Total contado"}
					</span>
					<span className="font-semibold tabular-nums">
						${(neto / 100).toFixed(2)}
					</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">Esperado (ventas)</span>
					<span className="font-medium tabular-nums">
						${(esperado / 100).toFixed(2)}
					</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">Diferencia</span>
					<span
						className={cn(
							"font-medium tabular-nums",
							hayDiferencia
								? diferencia > 0
									? "text-green-600 dark:text-green-400"
									: "text-red-600 dark:text-red-400"
								: "text-muted-foreground",
						)}
					>
						{diferencia >= 0 ? "+" : ""}${(diferencia / 100).toFixed(2)}
					</span>
				</div>
			</div>
		</div>
	);
}
