"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Clock,
	LogIn,
	LogOut,
	Edit,
	Save,
	Calendar,
	User,
	History,
	CheckCircle2,
	AlertCircle,
	Timer,
} from "lucide-react";
import { toast } from "sonner";
import { LazyMotion, m as motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import {
	getEmpleadosAction,
	getAsistenciaAction,
	registerAsistenciaAction,
	updateAsistenciaAction,
} from "@/features/empleados/actions";

interface Empleado {
	empleadoId: string;
	nombre: string;
	apellido: string;
	cargo: string;
}

interface Asistencia {
	attendanceId: string;
	date: string;
	status: string;
	checkIn: string | null;
	checkOut: string | null;
	totalHours: number | null;
	manualCheckIn?: string | null;
	manualCheckOut?: string | null;
	isManualEntry?: boolean;
	notes?: string;
	scheduledHours?: number | null;
	overtimeHours?: number | null;
	workSchedule?: {
		startTime: string;
		endTime: string;
		breakStartTime?: string;
		breakEndTime?: string;
	} | null;
}

/**
 * Componente mejorado para registro y edición manual de asistencia de empleados
 * @returns Componente de formulario de asistencia mejorado con UI/UX Pro Max
 */
export function EnhancedAsistenciaForm() {
	const { user } = useAuth();
	const puedeEditar = user?.tenantRole === "manager" || user?.role === "admin";
	const [empleados, setEmpleados] = useState<Empleado[]>([]);
	const [selectedEmpleado, setSelectedEmpleado] = useState("");
	const [asistenciaHoy, setAsistenciaHoy] = useState<Asistencia | null>(null);
	const [historialAsistencia, setHistorialAsistencia] = useState<Asistencia[]>(
		[],
	);
	const [loading, setLoading] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<Asistencia | null>(null);
	const [editForm, setEditForm] = useState({
		manualCheckIn: "",
		manualCheckOut: "",
		notes: "",
	});

	// Cargar lista de empleados
	useEffect(() => {
		getEmpleadosAction()
			.then((r: any) => {
				if (r.success) setEmpleados(r.data ?? []);
			})
			.catch((error: any) => console.error("Error cargando empleados:", error));
	}, []);

	// Verificar asistencia de hoy y cargar historial para el empleado seleccionado
	useEffect(() => {
		if (selectedEmpleado) {
			const today = new Date().toISOString().split("T")[0];
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			// Fetch today's attendance
			getAsistenciaAction({ employeeId: selectedEmpleado, date: today })
				.then((r: any) => {
					if (r.success && r.data) {
						setAsistenciaHoy(r.data.length > 0 ? r.data[0] : null);
					}
				})
				.catch((error: any) =>
					console.error("Error cargando asistencia de hoy:", error),
				);

			// Fetch attendance history (last 30 days)
			getAsistenciaAction({
				employeeId: selectedEmpleado,
				startDate: thirtyDaysAgo.toISOString().split("T")[0],
				endDate: today,
			})
				.then((r: any) => {
					if (r.success) setHistorialAsistencia(r.data ?? []);
				})
				.catch((error: any) =>
					console.error("Error cargando historial de asistencia:", error),
				);
		} else {
			setAsistenciaHoy(null);
			setHistorialAsistencia([]);
		}
	}, [selectedEmpleado]);

	/**
	 * Registra entrada o salida del empleado
	 * @param action - Acción a realizar ('checkin' o 'checkout')
	 */
	const handleAttendanceAction = async (action: "checkin" | "checkout") => {
		if (!selectedEmpleado) {
			toast.error("Seleccioná un empleado primero");
			return;
		}

		setLoading(true);
		try {
			const r = await registerAsistenciaAction({
				employeeId: selectedEmpleado,
				action,
			});

			if (r.success) {
				setAsistenciaHoy(r.data as any);
				toast.success(
					action === "checkin"
						? "Entrada registrada correctamente"
						: "Salida registrada correctamente",
				);

				// Refresh history
				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
				const today = new Date().toISOString().split("T")[0];
				getAsistenciaAction({
					employeeId: selectedEmpleado,
					startDate: thirtyDaysAgo.toISOString().split("T")[0],
					endDate: today,
				}).then((hr: any) => {
					if (hr.success) setHistorialAsistencia(hr.data ?? []);
				});
			} else {
				toast.error(r.error?.message || "Error al registrar asistencia");
			}
		} catch (error) {
			console.error("Error registrando asistencia:", error);
			toast.error("Error interno del servidor");
		} finally {
			setLoading(false);
		}
	};

	/**
	 * Abre el diálogo de edición para un registro de asistencia
	 */
	const openEditDialog = (record: Asistencia) => {
		setEditingRecord(record);
		setEditForm({
			manualCheckIn: record.manualCheckIn || record.checkIn || "",
			manualCheckOut: record.manualCheckOut || record.checkOut || "",
			notes: record.notes || "",
		});
		setIsEditDialogOpen(true);
	};

	/**
	 * Guarda los cambios manuales en un registro de asistencia
	 */
	const handleSaveManualEdit = async () => {
		if (!editingRecord) return;

		setLoading(true);
		try {
			const r = await updateAsistenciaAction({
				attendanceId: editingRecord.attendanceId,
				manualCheckIn: editForm.manualCheckIn || undefined,
				manualCheckOut: editForm.manualCheckOut || undefined,
				notes: editForm.notes || undefined,
				approvedBy: "admin", // TODO: Get from current user context
			});

			if (r.success) {
				const data = r.data;
				// Update the record in the history
				setHistorialAsistencia((prev) =>
					prev.map((record) =>
						record.attendanceId === editingRecord.attendanceId ? (data as any) : record,
					),
				);

				// Update today's record if it's the same
				if (asistenciaHoy?.attendanceId === editingRecord.attendanceId) {
					setAsistenciaHoy(data as any);
				}

				setIsEditDialogOpen(false);
				setEditingRecord(null);
				toast.success("Registro actualizado correctamente");
			} else {
				toast.error(r.error?.message || "Error al actualizar registro");
			}
		} catch (error) {
			console.error("Error actualizando asistencia:", error);
			toast.error("Error interno del servidor");
		} finally {
			setLoading(false);
		}
	};

	const getStatusBadge = (status: string, isManual?: boolean) => {
		const variants = {
			present: "default",
			absent: "destructive",
			late: "secondary",
			"half-day": "outline",
		};

		const colors = {
			present:
				"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
			absent:
				"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
			late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
			"half-day":
				"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
			default:
				"bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
		};

		const statusKey = status as keyof typeof colors;
		const colorClass = colors[statusKey] || colors.default;

		return (
			<div className="flex items-center gap-2">
				<Badge
					variant="outline"
					className={`${colorClass} px-2 py-0.5 font-medium border`}
				>
					{status === "present"
						? "Presente"
						: status === "absent"
							? "Ausente"
							: status === "late"
								? "Tarde"
								: status === "half-day"
									? "Medio día"
									: status}
				</Badge>
				{isManual && (
					<Badge
						variant="outline"
						className="text-[10px] px-1.5 h-5 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800"
					>
						Manual
					</Badge>
				)}
			</div>
		);
	};

	const formatTime = (timeString: string | null) => {
		if (!timeString) return "N/A";
		return new Date(timeString).toLocaleTimeString("es-ES", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("es-ES", {
			weekday: "long",
			day: "numeric",
			month: "long",
		});
	};

	return (
		<div className="space-y-8">
			<Card className="w-full border-none shadow-none bg-transparent">
				<CardContent className="p-0 space-y-6">
					{/* Selector de empleado con diseño mejorado */}
					<div className="border rounded-xl p-6 shadow-sm">
						<div className="space-y-4">
							<div className="flex items-center gap-3 mb-2">
								<div className="p-2 rounded-lg text-primary">
									<User className="h-5 w-5 text-orange-500" />
								</div>
								<div>
									<Label
										htmlFor="empleado-select"
										className="text-base font-semibold"
									>
										Seleccionar Empleado
									</Label>
									<p className="text-sm text-muted-foreground">
										Elige un empleado para gestionar su asistencia
									</p>
								</div>
							</div>
							<Select
								value={selectedEmpleado}
								onValueChange={setSelectedEmpleado}
							>
								<SelectTrigger id="empleado-select" className="h-12 text-lg">
									<SelectValue placeholder="Buscar empleado..." />
								</SelectTrigger>
								<SelectContent>
									{empleados.map((empleado) => (
										<SelectItem
											key={empleado.empleadoId}
											value={empleado.empleadoId}
											className="py-3"
										>
											<div className="flex items-center gap-3">
												<div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800/10 flex items-center justify-center text-xs font-bold">
													{empleado.nombre.charAt(0)}
													{empleado.apellido.charAt(0)}
												</div>
												<div className="flex flex-col text-left">
													<span className="font-light text-sm from-orange-500 to-red-600">
														{empleado.nombre} {empleado.apellido}
													</span>
													<span className="text-xs text-muted-foreground">
														{empleado.cargo}
													</span>
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<AnimatePresence mode="wait">
						{selectedEmpleado && (
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ duration: 0.3 }}
								className="grid gap-6 md:grid-cols-2"
							>
								{/* Panel de Control Principal */}
								<Card className="border shadow-sm overflow-hidden md:col-span-2 lg:col-span-1 bg-linear-to-br from-card to-secondary/10">
									<CardHeader className="pb-2">
										<CardTitle className="flex items-center gap-2 text-xl">
											<Clock className="h-5 w-5 text-orange-500" />
											Registro de Hoy
										</CardTitle>
										<CardDescription>
											{new Date().toLocaleDateString("es-ES", {
												weekday: "long",
												day: "numeric",
												month: "long",
												year: "numeric",
											})}
										</CardDescription>
									</CardHeader>
									<CardContent className="pt-4">
										{asistenciaHoy ? (
											<div className="space-y-6">
												<div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border">
													<span className="font-medium text-muted-foreground">
														Estado Actual
													</span>
													{getStatusBadge(
														asistenciaHoy.status,
														asistenciaHoy.isManualEntry,
													)}
												</div>

												<div className="grid grid-cols-2 gap-4">
													<div
														className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-2 transition-colors ${asistenciaHoy.checkIn || asistenciaHoy.manualCheckIn ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900" : "bg-muted/30 border-dashed"}`}
													>
														<div
															className={`p-2 rounded-full ${asistenciaHoy.checkIn || asistenciaHoy.manualCheckIn ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" : "bg-muted text-muted-foreground"}`}
														>
															<LogIn className="h-5 w-5" />
														</div>
														<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
															Entrada
														</span>
														<span className="text-xl font-bold font-mono">
															{formatTime(
																asistenciaHoy.manualCheckIn ||
																	asistenciaHoy.checkIn,
															)}
														</span>
													</div>

													<div
														className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-2 transition-colors ${asistenciaHoy.checkOut || asistenciaHoy.manualCheckOut ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" : "bg-muted/30 border-dashed"}`}
													>
														<div
															className={`p-2 rounded-full ${asistenciaHoy.checkOut || asistenciaHoy.manualCheckOut ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-muted text-muted-foreground"}`}
														>
															<LogOut className="h-5 w-5" />
														</div>
														<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
															Salida
														</span>
														<span className="text-xl font-bold font-mono">
															{formatTime(
																asistenciaHoy.manualCheckOut ||
																	asistenciaHoy.checkOut,
															)}
														</span>
													</div>
												</div>

												{puedeEditar && (
													<div className="grid grid-cols-2 gap-3">
														<Button
															onClick={() => handleAttendanceAction("checkin")}
															disabled={
																loading ||
																!!(
																	asistenciaHoy &&
																	(asistenciaHoy.checkIn ||
																		asistenciaHoy.manualCheckIn)
																)
															}
															className="w-full bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:shadow-lg transition-all"
															size="lg"
														>
															<LogIn className="h-5 w-5 mr-2" />
															Registrar Entrada
														</Button>
														<Button
															onClick={() => handleAttendanceAction("checkout")}
															disabled={
																loading ||
																!asistenciaHoy ||
																(!asistenciaHoy.checkIn &&
																	!asistenciaHoy.manualCheckIn) ||
																!!(
																	asistenciaHoy.checkOut ||
																	asistenciaHoy.manualCheckOut
																)
															}
															variant="outline"
															className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
															size="lg"
														>
															<LogOut className="h-5 w-5 mr-2" />
															Registrar Salida
														</Button>
													</div>
												)}

												{puedeEditar && (
													<div className="flex justify-center pt-2">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => openEditDialog(asistenciaHoy)}
															className="text-muted-foreground hover:text-primary"
														>
															<Edit className="h-4 w-4 mr-2" />
															Editar registro manualmente
														</Button>
													</div>
												)}
											</div>
										) : (
											<div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
												<div className="p-4 bg-muted rounded-full">
													<Clock className="h-8 w-8 text-muted-foreground" />
												</div>
												<div className="space-y-1">
													<h3 className="font-medium">Sin registro hoy</h3>
													<p className="text-sm text-muted-foreground">
														El empleado aún no ha registrado asistencia
													</p>
												</div>
												{puedeEditar && (
													<Button
														onClick={() => handleAttendanceAction("checkin")}
														disabled={loading}
														className="mt-4 from-orange-500 bg-linear-30 to-red-600"
													>
														<LogIn className="h-4 w-4 mr-2" />
														Iniciar Jornada
													</Button>
												)}
											</div>
										)}
									</CardContent>
								</Card>

								{/* Resumen de Estadísticas */}
								<div className="grid gap-4 content-start">
									<Card className="border shadow-sm">
										<CardHeader className="pb-2">
											<CardTitle className="text-lg flex items-center gap-2">
												<Timer className="h-5 w-5 text-orange-500" />
												Métricas del Día
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4 pt-2">
											{asistenciaHoy ? (
												<>
													<div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border">
														<span className="text-sm font-medium">
															Horas Trabajadas
														</span>
														<span className="text-lg font-bold font-mono">
															{asistenciaHoy.totalHours
																? Number(asistenciaHoy.totalHours).toFixed(2)
																: "0.00"}
															h
														</span>
													</div>

													<div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border">
														<span className="text-sm font-medium">
															Horas Programadas
														</span>
														<span className="text-lg font-bold font-mono text-muted-foreground">
															{asistenciaHoy.scheduledHours
																? Number(asistenciaHoy.scheduledHours).toFixed(
																		2,
																	)
																: "8.00"}
															h
														</span>
													</div>

													<div className="flex justify-between items-center p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900">
														<span className="text-sm font-medium text-orange-700 dark:text-orange-400">
															Horas Extras
														</span>
														<span className="text-lg font-bold font-mono text-orange-700 dark:text-orange-400">
															+
															{asistenciaHoy.overtimeHours
																? Number(asistenciaHoy.overtimeHours).toFixed(2)
																: "0.00"}
															h
														</span>
													</div>
												</>
											) : (
												<div className="py-8 text-center text-muted-foreground text-sm">
													No hay datos disponibles para mostrar
												</div>
											)}
										</CardContent>
									</Card>

									{asistenciaHoy?.workSchedule && (
										<Card className="border shadow-sm bg-blue-50/50 dark:bg-blue-950/10">
											<CardHeader className="pb-2">
												<CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
													Horario Asignado
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className="flex justify-between text-sm">
													<span>
														Entrada:{" "}
														<span className="font-semibold">
															{formatTime(
																`2000-01-01T${asistenciaHoy.workSchedule.startTime}`,
															)}
														</span>
													</span>
													<span>
														Salida:{" "}
														<span className="font-semibold">
															{formatTime(
																`2000-01-01T${asistenciaHoy.workSchedule.endTime}`,
															)}
														</span>
													</span>
												</div>
											</CardContent>
										</Card>
									)}
								</div>

								{/* Historial Reciente - Ancho completo en mobile, 2 columnas en desktop grande */}
								<div className="md:col-span-2">
									<div className="flex items-center justify-between mb-4 mt-2">
										<h3 className="text-xl font-bold flex items-center gap-2">
											<History className="h-5 w-5 text-orange-500" />
											Historial Reciente
										</h3>
										<Badge variant="outline" className="font-normal">
											Últimos 30 días
										</Badge>
									</div>

									<div className="rounded-xl border shadow-sm bg-card overflow-hidden">
										<div className="overflow-x-auto">
											<table className="w-full text-sm">
												<thead className="bg-muted/50 border-b">
													<tr>
														<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
															Fecha
														</th>
														<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
															Estado
														</th>
														<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
															Entrada
														</th>
														<th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
															Salida
														</th>
														<th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
															Total
														</th>
														<th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">
															Acciones
														</th>
													</tr>
												</thead>
												<tbody>
													{historialAsistencia.length > 0 ? (
														historialAsistencia.map((record) => (
															<tr
																key={record.attendanceId}
																className="border-b last:border-0 hover:bg-muted/30 transition-colors"
															>
																<td className="p-4 align-middle font-medium">
																	<div className="flex flex-col">
																		<span className="capitalize">
																			{formatDate(record.date)}
																		</span>
																	</div>
																</td>
																<td className="p-4 align-middle">
																	{getStatusBadge(
																		record.status,
																		record.isManualEntry,
																	)}
																</td>
																<td className="p-4 align-middle font-mono text-xs">
																	{formatTime(
																		record.manualCheckIn || record.checkIn,
																	)}
																</td>
																<td className="p-4 align-middle font-mono text-xs">
																	{formatTime(
																		record.manualCheckOut || record.checkOut,
																	)}
																</td>
																<td className="p-4 align-middle text-right font-mono">
																	{record.totalHours
																		? Number(record.totalHours).toFixed(2) + "h"
																		: "-"}
																</td>
																<td className="p-4 align-middle text-right">
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-8 w-8"
																		onClick={() => openEditDialog(record)}
																	>
																		<Edit className="h-4 w-4" />
																		<span className="sr-only">Editar</span>
																	</Button>
																</td>
															</tr>
														))
													) : (
														<tr>
															<td
																colSpan={6}
																className="h-24 text-center text-muted-foreground"
															>
																No hay registros recientes
															</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</CardContent>
			</Card>

			{/* Dialogo de Edición */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Editar Registro</DialogTitle>
						<DialogDescription>
							Modifica manualmente las horas de entrada y salida para el día
							seleccionado.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="manual-checkin">Entrada Manual</Label>
								<Input
									id="manual-checkin"
									type="datetime-local"
									value={editForm.manualCheckIn}
									onChange={(e) =>
										setEditForm((prev) => ({
											...prev,
											manualCheckIn: e.target.value,
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="manual-checkout">Salida Manual</Label>
								<Input
									id="manual-checkout"
									type="datetime-local"
									value={editForm.manualCheckOut}
									onChange={(e) =>
										setEditForm((prev) => ({
											...prev,
											manualCheckOut: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="notes">Notas / Justificación</Label>
							<Textarea
								id="notes"
								placeholder="Explica la razón del cambio manual..."
								className="resize-none"
								rows={3}
								value={editForm.notes}
								onChange={(e) =>
									setEditForm((prev) => ({ ...prev, notes: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsEditDialogOpen(false)}
						>
							Cancelar
						</Button>
						<Button onClick={handleSaveManualEdit} disabled={loading}>
							{loading ? "Guardando..." : "Guardar Cambios"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
