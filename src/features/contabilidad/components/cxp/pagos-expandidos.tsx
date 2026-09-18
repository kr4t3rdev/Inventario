"use client";

import { m as motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { PagoCuentaPorPagar } from "@/app/models/model";

interface PagosExpandidosProps {
	pagos: PagoCuentaPorPagar[];
}

/**
 * @description Panel expandible con el historial de pagos de una cuenta por pagar.
 * @param {PagosExpandidosProps} props - Lista de pagos de la factura.
 * @returns {JSX.Element} Tabla de pagos o aviso de "sin pagos".
 */
export function PagosExpandidos({ pagos }: PagosExpandidosProps) {
	if (!pagos || pagos.length === 0) {
		return (
			<motion.div
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: "auto" }}
				exit={{ opacity: 0, height: 0 }}
				className="p-6 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed"
			>
				<div className="flex items-center gap-2">
					<AlertCircle className="h-4 w-4" />
					No hay pagos registrados para esta factura.
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, height: 0 }}
			animate={{ opacity: 1, height: "auto" }}
			exit={{ opacity: 0, height: 0 }}
			className="p-4 bg-muted/30 rounded-lg border ml-4 mt-2 mb-2"
		>
			<h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
				<CreditCard className="h-4 w-4 text-primary" />
				<span>Historial de Pagos</span>
				<Badge variant="secondary" className="text-xs font-normal">
					{pagos.length} {pagos.length === 1 ? "pago" : "pagos"}
				</Badge>
			</h4>
			<div className="rounded-md border overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/50 hover:bg-muted/50">
							<TableHead className="text-xs font-semibold">Fecha</TableHead>
							<TableHead className="text-xs font-semibold">
								N° Transacción
							</TableHead>
							<TableHead className="text-xs font-semibold">
								Cuenta Proveedor
							</TableHead>
							<TableHead className="text-xs text-right font-semibold">
								Monto
							</TableHead>
							<TableHead className="text-xs font-semibold">
								Observaciones
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{pagos.map((pago, idx) => (
							<motion.tr
								key={pago.pagoCuentaPorPagarId}
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: idx * 0.05 }}
								className="hover:bg-muted/30 border-b last:border-0"
							>
								<TableCell className="text-xs text-muted-foreground">
									{new Date(pago.fechaPago).toLocaleDateString("es-ES", {
										day: "2-digit",
										month: "short",
										year: "numeric",
									})}
								</TableCell>
								<TableCell className="text-xs font-mono font-medium">
									{pago.numeroTransaccion}
								</TableCell>
								<TableCell className="text-xs font-mono">
									{pago.cuentaProveedor}
								</TableCell>
								<TableCell className="text-xs text-right font-medium text-green-600 tabular-nums">
									{formatCurrency(pago.monto)}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
									{pago.observaciones || "-"}
								</TableCell>
							</motion.tr>
						))}
					</TableBody>
				</Table>
			</div>
		</motion.div>
	);
}