"use client";

/**
 * @description Vista cliente con la lista de empleados.
 *              No incluye pagos/nómina — esa vista vive en /busy/empleados/nomina.
 *              Usa el sub-componente EmpleadoCard.
 *
 * @param {EmpleadosListContentProps} props - Datos iniciales precargados por el server.
 * @returns {JSX.Element} Lista de empleados.
 */
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, CreditCard, Users } from "lucide-react";
import { EmpleadoCard } from "./empleado-card";
import type { Empleado } from "@/app/models/model";

interface EmpleadosListContentProps {
	initialEmpleados: Empleado[];
	/** Si el plan tiene el feature `nomina`, muestra link a la subruta de pagos */
	hasNomina?: boolean;
}

export function EmpleadosListContent({
	initialEmpleados,
	hasNomina = false,
}: EmpleadosListContentProps) {
	const { user } = useAuth();
	const puedeEditar = user?.tenantRole === "manager" || user?.role === "admin";

	return (
		<div className="container mx-auto py-6 px-4">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
						<Users className="h-5 w-5 text-white" />
					</div>
					<h1 className="text-2xl font-bold bg-linear-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
						Empleados
					</h1>
				</div>

				{puedeEditar && (
					<Button
						asChild
						className="bg-linear-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-shadow"
					>
						<Link href="/busy/empleados/new">
							<Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
						</Link>
					</Button>
				)}
			</div>

			{initialEmpleados.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="pt-6 text-center text-muted-foreground">
						No hay empleados registrados todavía.
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{initialEmpleados.map((empleado) => (
						<EmpleadoCard
							key={empleado.empleadoId}
							empleado={empleado}
							puedeEditar={puedeEditar}
						/>
					))}
				</div>
			)}

			{hasNomina && (
				<div className="mt-8 text-center">
					<Button asChild variant="outline">
						<Link href="/busy/empleados/nomina">
							<CreditCard className="h-4 w-4 mr-2" /> Ver historial de pagos
						</Link>
					</Button>
				</div>
			)}
		</div>
	);
}
