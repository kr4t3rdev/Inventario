'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { BookOpenCheck, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';

import { useAuth } from '@/contexts/auth-context';
import {
	inicializarPlanContableAction,
	obtenerEstadoPlanContableAction,
	type EstadoPlanContable,
} from '@/features/contabilidad-formal/actions';

/**
 * @description Tarjeta de activación del plan de cuentas (CTA-0). Solo se
 * renderiza cuando el tenant tiene el flag `contabilidad-formal`; el seed es
 * idempotente, por lo que el mismo botón sirve para inicializar y actualizar.
 * @returns {JSX.Element | null} Tarjeta de configuración o null si no aplica.
 */
export function PlanContableCard(): JSX.Element | null {
	const { user } = useAuth();
	const habilitado =
		user?.role === 'admin' || user?.planFeatures?.['contabilidad-formal'] === true;

	const [estado, setEstado] = useState<EstadoPlanContable | null>(null);
	const [cargando, setCargando] = useState(true);
	const [ejecutando, setEjecutando] = useState(false);

	const cargarEstado = useCallback(async () => {
		const respuesta = await obtenerEstadoPlanContableAction();
		if (respuesta.success && respuesta.data) {
			setEstado(respuesta.data as EstadoPlanContable);
		}
	}, []);

	useEffect(() => {
		if (!habilitado) return;
		setCargando(true);
		void cargarEstado().finally(() => setCargando(false));
	}, [habilitado, cargarEstado]);

	if (!habilitado) return null;

	const manejarInicializar = async () => {
		setEjecutando(true);
		try {
			const respuesta = await inicializarPlanContableAction();
			if (!respuesta.success || !respuesta.data) {
				throw new Error(
					(respuesta.success ? undefined : respuesta.error?.message) ??
						'No se pudo inicializar el plan de cuentas',
				);
			}
			toast.success('Plan de cuentas listo', {
				description: `${respuesta.data.cuentas} cuentas, ${respuesta.data.diarios} diarios y ${respuesta.data.roles} roles mapeados.`,
			});
			await cargarEstado();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'No se pudo inicializar el plan de cuentas',
			);
		} finally {
			setEjecutando(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<BookOpenCheck className="h-6 w-6 text-blue-600" aria-hidden="true" />
						<div>
							<CardTitle>Contabilidad formal</CardTitle>
							<CardDescription>
								Plan de cuentas y asientos de partida doble generados desde las
								operaciones existentes.
							</CardDescription>
						</div>
					</div>
					{estado?.inicializado ? (
						<Badge variant="secondary">Activo</Badge>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{cargando ? (
					<p className="text-sm text-muted-foreground">
						Consultando el estado del plan de cuentas…
					</p>
				) : estado?.inicializado ? (
					<>
						<p className="text-sm text-muted-foreground">
							Plan activo con {estado.cuentas} cuentas, {estado.diarios} diarios y{' '}
							{estado.roles} roles semánticos mapeados.
						</p>
						<Button
							variant="outline"
							onClick={manejarInicializar}
							disabled={ejecutando}
						>
							{ejecutando ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							) : (
								<RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
							)}
							Verificar y actualizar plan
						</Button>
					</>
				) : (
					<>
						<p className="text-sm text-muted-foreground">
							Aún no tienes un plan de cuentas. Al inicializarlo se crean los 7
							diarios, el plan por defecto (33 cuentas) y el mapeo de roles, sin
							afectar tus operaciones actuales.
						</p>
						<Button onClick={manejarInicializar} disabled={ejecutando}>
							{ejecutando ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							) : null}
							Inicializar plan de cuentas
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
}
