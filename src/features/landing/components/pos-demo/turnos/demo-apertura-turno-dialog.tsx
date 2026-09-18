'use client';

import { useEffect, useState } from 'react';
import {
	AlertCircle,
	DollarSign,
	Loader2,
	User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
	DEMO_EMPLEADOS,
	type DemoTurnoActivo,
	createDemoTurno,
} from '@/features/landing/components/pos-demo/mock-data';

interface DemoAperturaTurnoDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	puntoDeVentaNombre: string;
	onSuccess?: (turno: DemoTurnoActivo) => void;
}

/**
 * @description Diálogo demo para abrir un turno en el POS público del landing.
 *              Replica visual exacta del `AperturaTurnoDialog` real (mismas clases,
 *              misma estructura, mismos campos) pero con empleados mockeados
 *              y sin Server Action — createDemoTurno() mantiene el estado local.
 * @returns {JSX.Element} Diálogo de apertura de turno demo.
 */
export function DemoAperturaTurnoDialog({
	open,
	onOpenChange,
	puntoDeVentaNombre,
	onSuccess,
}: DemoAperturaTurnoDialogProps): React.JSX.Element {
	const [empleadoId, setEmpleadoId] = useState('');
	const [fondoCup, setFondoCup] = useState('');
	const [fondoUsd, setFondoUsd] = useState('');
	const [observaciones, setObservaciones] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (open) {
			setEmpleadoId('');
			setFondoCup('');
			setFondoUsd('');
			setObservaciones('');
		}
	}, [open]);

	const handleSubmit = async () => {
		setIsSubmitting(true);
		// Simula latencia de red del backend.
		await new Promise((resolve) => setTimeout(resolve, 600));

		const turno = createDemoTurno({
			empleadoId: empleadoId || null,
			fondoInicialCup: fondoCup ? Math.round(parseFloat(fondoCup) * 100) : 0,
			fondoInicialUsd: fondoUsd ? Math.round(parseFloat(fondoUsd) * 100) : 0,
			observaciones: observaciones || null,
		});

		toast.success('Turno abierto exitosamente');
		setIsSubmitting(false);
		onOpenChange(false);
		onSuccess?.(turno);
	};

	const formatCurrency = (value: string) => {
		if (!value) return '';
		const num = parseFloat(value);
		return isNaN(num) ? value : num.toFixed(2);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<DollarSign className="h-5 w-5 text-primary" />
						Abrir Turno — {puntoDeVentaNombre}
					</DialogTitle>
					<DialogDescription>
						Registre el fondo inicial de caja y el cajero responsable
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label htmlFor="demo-empleado" className="flex items-center gap-2">
							<User className="h-4 w-4 text-muted-foreground" />
							Cajero responsable
						</Label>
						<Select value={empleadoId} onValueChange={setEmpleadoId}>
							<SelectTrigger id="demo-empleado">
								<SelectValue placeholder="Seleccionar cajero..." />
							</SelectTrigger>
							<SelectContent>
								{DEMO_EMPLEADOS.map((emp) => (
									<SelectItem key={emp.empleadoId} value={emp.empleadoId}>
										{emp.nombre} {emp.apellido}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="demo-fondoCup">Fondo inicial CUP</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
								$
							</span>
							<Input
								id="demo-fondoCup"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								className="pl-7"
								value={fondoCup}
								onChange={(e) => setFondoCup(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="demo-fondoUsd">Fondo inicial USD</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
								$
							</span>
							<Input
								id="demo-fondoUsd"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								className="pl-7"
								value={fondoUsd}
								onChange={(e) => setFondoUsd(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="demo-observaciones">Observaciones</Label>
						<Textarea
							id="demo-observaciones"
							placeholder="Opcional"
							value={observaciones}
							onChange={(e) => setObservaciones(e.target.value)}
							rows={2}
						/>
					</div>

					{fondoCup && parseFloat(fondoCup) > 0 && (
						<div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground flex items-start gap-2">
							<AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
							<span>
								Fondo inicial: <strong>${formatCurrency(fondoCup)} CUP</strong>
								{fondoUsd && parseFloat(fondoUsd) > 0
									? ` + $${formatCurrency(fondoUsd)} USD`
									: ''}
							</span>
						</div>
					)}

					<div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[11px] text-muted-foreground">
						Demo sin persistencia: el turno existe solo en memoria y se pierde al
						recargar la página.
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Abriendo...
							</>
						) : (
							'Abrir Turno'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
