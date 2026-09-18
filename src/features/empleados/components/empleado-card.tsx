"use client";

/**
 * @description Sub-componente con la card de un empleado.
 *              Reusada por EmpleadosListContent (sin botones de pago)
 *              y por NominaEmpleadoSection (con todos los botones).
 *
 * @param {EmpleadoCardProps} props
 * @returns {JSX.Element}
 */
import Link from "next/link";
import { Pencil, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Empleado } from "@/app/models/model";

interface EmpleadoCardProps {
	empleado: Empleado;
	/** Si el usuario puede editar (manager o admin) */
	puedeEditar?: boolean;
	/** Mostrar el botón "Realizar Pago" (default: false) */
	showPagoButton?: boolean;
	/** Mostrar el botón "Eliminar" (default: false) */
	showDeleteButton?: boolean;
	/** Callback al hacer click en "Realizar Pago" */
	onPago?: (empleado: Empleado) => void;
	/** Callback al hacer click en "Eliminar" */
	onDelete?: (id: string) => void;
}

export function EmpleadoCard({
	empleado,
	puedeEditar = false,
	showPagoButton = false,
	showDeleteButton = false,
	onPago,
	onDelete,
}: EmpleadoCardProps) {
	const initials =
		(empleado.nombre?.charAt(0) ?? "") + (empleado.apellido?.charAt(0) ?? "");

	return (
		<Card className="border-dashed overflow-hidden group">
			<div className="h-1 bg-linear-to-r from-orange-500 to-red-600" />
			<CardHeader>
				<div className="flex justify-between items-start">
					<div>
						<CardTitle>
							{empleado.nombre} {empleado.apellido}
						</CardTitle>
						<CardDescription>{empleado.cargo}</CardDescription>
					</div>
					<Avatar className="h-12 w-12 ring-2 ring-orange-500/20">
						<AvatarFallback className="bg-linear-to-br from-orange-500/20 to-red-600/20 text-orange-500 font-semibold">
							{initials}
						</AvatarFallback>
					</Avatar>
				</div>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">
					<span className="font-medium">Teléfono:</span>{" "}
					{empleado.telefono ?? "—"}
				</p>
			</CardContent>
			{puedeEditar && (
				<CardFooter className="flex flex-wrap gap-2">
					<Button
						asChild
						variant="outline"
						size="sm"
						className="flex-1 min-w-25"
					>
						<Link href={`/busy/empleados/update/${empleado.empleadoId}`}>
							<Pencil className="h-4 w-4 mr-2" /> Editar
						</Link>
					</Button>

					{showPagoButton && onPago && (
						<Button
							onClick={() => onPago(empleado)}
							variant="outline"
							size="sm"
							className="flex-1 min-w-25"
						>
							<CreditCard className="h-4 w-4 mr-2" /> Realizar Pago
						</Button>
					)}

					{showDeleteButton && onDelete && (
						<Button
							onClick={() => onDelete(empleado.empleadoId)}
							variant="outline"
							size="sm"
							className="flex-1 min-w-25 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
						>
							<Trash2 className="h-4 w-4 mr-2" /> Eliminar
						</Button>
					)}
				</CardFooter>
			)}
		</Card>
	);
}
