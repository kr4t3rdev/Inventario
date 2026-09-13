/**
 * @description Server Actions para empleados (CRUD básico).
 *
 * @module features/empleados/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant, requirePermission } from "@/lib/services/tenant-scope";
import { empleadoSchema, empleadoUpdateSchema } from "./schemas";
import type { EmpleadoInput, EmpleadoUpdateInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import {
	calcularMontoHorasExtras,
	calculatePayrollFormulas,
	getPayrollConfig,
	STANDARD_MONTHLY_HOURS,
} from "@/lib/payroll-formulas";

export const getEmpleadosAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		const tenantId = requireTenant(user);
		return prisma.empleado.findMany({
			where: { tenantId },
			orderBy: { salarioBases: "desc" },
		});
	},
);

export const getEmpleadoByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		const tenantId = requireTenant(user);
		const empleado = await prisma.empleado.findFirst({
			where: { empleadoId: id, tenantId },
			include: {
				ventas: {
					include: { producto: true },
					orderBy: { createdAt: "desc" as const },
					take: 10,
				},
			},
		});
		if (!empleado) throw new ActionError("Empleado no encontrado", "NOT_FOUND");
		return empleado;
	},
);

export const createEmpleadoAction = withAction(
	async (input: EmpleadoInput, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		requirePermission(user, "rrhh.empleados.crear", "crear empleados");
		const parsed = empleadoSchema.parse(input);
		const tenantId = requireTenant(user);

		const empleado = await prisma.empleado.create({
			data: {
				nombre: parsed.nombre,
				apellido: parsed.apellido,
				telefono: parsed.telefono ?? null,
				cargo: parsed.cargo,
				salarioBases: parsed.salarioBases,
				fechaContratacion: parsed.fechaContratacion
					? new Date(parsed.fechaContratacion)
					: new Date(),
				esTiempoCompleto: parsed.esTiempoCompleto ?? true,
				diasVacacionesAnuales: parsed.diasVacacionesAnuales ?? 15,
				tenantId,
			},
		});

		revalidatePath("/busy/empleados");
		return empleado;
	},
);

export const updateEmpleadoAction = withAction(
	async (input: EmpleadoUpdateInput, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		requirePermission(user, "rrhh.empleados.editar", "editar empleados");
		const parsed = empleadoUpdateSchema.parse(input);
		const { empleadoId, ...data } = parsed;
		const tenantId = requireTenant(user);

		const existing = await prisma.empleado.findFirst({
			where: { empleadoId, tenantId },
		});
		if (!existing) throw new ActionError("Empleado no encontrado", "NOT_FOUND");

		const empleado = await prisma.empleado.update({
			where: { empleadoId },
			data: {
				...(data.nombre !== undefined && { nombre: data.nombre }),
				...(data.apellido !== undefined && { apellido: data.apellido }),
				...(data.telefono !== undefined && { telefono: data.telefono }),
				...(data.cargo !== undefined && { cargo: data.cargo }),
				...(data.salarioBases !== undefined && {
					salarioBases: data.salarioBases,
				}),
				...(data.esTiempoCompleto !== undefined && {
					esTiempoCompleto: data.esTiempoCompleto,
				}),
				...(data.diasVacacionesAnuales !== undefined && {
					diasVacacionesAnuales: data.diasVacacionesAnuales,
				}),
			},
		});

		revalidatePath("/busy/empleados");
		return empleado;
	},
);

export const deleteEmpleadoAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		requirePermission(user, "rrhh.empleados.eliminar", "eliminar empleados");
		const tenantId = requireTenant(user);
		const existing = await prisma.empleado.findFirst({
			where: { empleadoId: id, tenantId },
		});
		if (!existing) throw new ActionError("Empleado no encontrado", "NOT_FOUND");

		await prisma.empleado.delete({ where: { empleadoId: id } });
		revalidatePath("/busy/empleados");
		return { success: true };
	},
);

/**
 * @description Obtiene registros de asistencia con filtros opcionales.
 * Reemplaza GET /api/empleados/asistencia.
 */
export const getAsistenciaAction = withAction(
	async (
		input: {
			employeeId?: string;
			date?: string;
			startDate?: string;
			endDate?: string;
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'asistencia', 'gestionar asistencia');
		const tenantId = requireTenant(user);
		const where: any = { employee: { tenantId } };

		if (input.employeeId) where.employeeId = input.employeeId;

		if (input.date) {
			const targetDate = new Date(input.date);
			where.date = {
				gte: new Date(
					targetDate.getFullYear(),
					targetDate.getMonth(),
					targetDate.getDate(),
				),
				lt: new Date(
					targetDate.getFullYear(),
					targetDate.getMonth(),
					targetDate.getDate() + 1,
				),
			};
		}

		if (input.startDate && input.endDate) {
			where.date = {
				gte: new Date(input.startDate),
				lte: new Date(input.endDate),
			};
		} else if (input.startDate) {
			where.date = { gte: new Date(input.startDate) };
		}

		const records = await prisma.attendance.findMany({
			where,
			include: {
				employee: {
					select: { nombre: true, apellido: true, cargo: true },
				},
			},
			orderBy: { date: "desc" },
		});

		// Enrich with work schedule info
		const enriched = await Promise.all(
			records.map(async (record) => {
				const dayOfWeek = new Date(record.date).getDay();
				const workSchedule = await prisma.employeeWorkSchedule.findFirst({
					where: {
						employeeId: record.employeeId,
						dayOfWeek,
						isWorkingDay: true,
					},
				});
				return {
					...record,
					scheduledHours: workSchedule?.scheduledHours ?? null,
					workSchedule: workSchedule
						? {
								startTime: workSchedule.startTime,
								endTime: workSchedule.endTime,
								breakStartTime: workSchedule.breakStartTime,
								breakEndTime: workSchedule.breakEndTime,
							}
						: null,
				};
			}),
		);

		return enriched;
	},
);

const registerAsistenciaSchema = z.object({
	employeeId: z.string().min(1, "ID de empleado requerido"),
	action: z.enum(["checkin", "checkout"]),
});

/**
 * @description Registra entrada (checkin) o salida (checkout) de un empleado.
 * Reemplaza POST /api/empleados/asistencia (checkin/checkout).
 */
export const registerAsistenciaAction = withAction(
	async (
		input: z.infer<typeof registerAsistenciaSchema>,
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'asistencia', 'gestionar asistencia');
		requirePermission(user, "rrhh.asistencia.registrar", "registrar asistencia");
		const tenantId = requireTenant(user);
		const parsed = registerAsistenciaSchema.parse(input);

		const empleado = await prisma.empleado.findFirst({
			where: { empleadoId: parsed.employeeId, tenantId },
		});
		if (!empleado) throw new ActionError("Empleado no encontrado", "NOT_FOUND");

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let asistencia = await prisma.attendance.findFirst({
			where: {
				employeeId: parsed.employeeId,
				date: {
					gte: today,
					lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
				},
			},
		});

		if (parsed.action === "checkin") {
			if (asistencia?.checkIn) {
				throw new ActionError("Ya se registró entrada para hoy", "CONFLICT");
			}
			if (!asistencia) {
				asistencia = await prisma.attendance.create({
					data: {
						employeeId: parsed.employeeId,
						date: today,
						checkIn: now,
						status: "PRESENT",
					},
				});
			} else {
				asistencia = await prisma.attendance.update({
					where: { attendanceId: asistencia.attendanceId },
					data: { checkIn: now, status: "PRESENT" },
				});
			}
		} else {
			// checkout
			if (!asistencia?.checkIn) {
				throw new ActionError("Debe registrar entrada primero", "BAD_REQUEST");
			}
			if (asistencia.checkOut) {
				throw new ActionError("Ya se registró salida para hoy", "CONFLICT");
			}

			const checkInTime = asistencia.checkIn.getTime();
			const hoursWorked = (now.getTime() - checkInTime) / (1000 * 60 * 60);
			const totalHours = new Decimal(hoursWorked);

			asistencia = await prisma.attendance.update({
				where: { attendanceId: asistencia.attendanceId },
				data: { checkOut: now, totalHours, status: "PRESENT" },
				include: {
					employee: { select: { nombre: true, apellido: true, cargo: true } },
				},
			});
		}

		return asistencia;
	},
);

const manualAsistenciaSchema = z.object({
	attendanceId: z.string().min(1, "ID de asistencia requerido"),
	manualCheckIn: z.string().optional(),
	manualCheckOut: z.string().optional(),
	notes: z.string().optional(),
	approvedBy: z.string().optional(),
});

/**
 * @description Actualiza manualmente un registro de asistencia.
 * Reemplaza POST /api/empleados/asistencia (manual edit).
 */
export const updateAsistenciaAction = withAction(
	async (
		input: z.infer<typeof manualAsistenciaSchema>,
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'asistencia', 'gestionar asistencia');
		requirePermission(user, "rrhh.asistencia.editar", "editar asistencia");
		const tenantId = requireTenant(user);
		const parsed = manualAsistenciaSchema.parse(input);

		const existing = await prisma.attendance.findUnique({
			where: { attendanceId: parsed.attendanceId },
			include: { employee: { select: { tenantId: true } } },
		});
		if (!existing)
			throw new ActionError(
				"Registro de asistencia no encontrado",
				"NOT_FOUND",
			);
		if (existing.employee.tenantId !== tenantId)
			throw new ActionError("No autorizado", "FORBIDDEN");

		let totalHours = existing.totalHours;
		let overtimeHours = existing.overtimeHours;

		if (parsed.manualCheckIn && parsed.manualCheckOut) {
			const checkInTime = new Date(parsed.manualCheckIn).getTime();
			const checkOutTime = new Date(parsed.manualCheckOut).getTime();
			const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
			totalHours = new Decimal(hoursWorked);

			const dayOfWeek = new Date(existing.date).getDay();
			const workSchedule = await prisma.employeeWorkSchedule.findFirst({
				where: {
					employeeId: existing.employeeId,
					dayOfWeek,
					isWorkingDay: true,
				},
			});
			if (workSchedule) {
				const scheduledHours = Number(workSchedule.scheduledHours);
				if (hoursWorked > scheduledHours) {
					overtimeHours = new Decimal(hoursWorked - scheduledHours);
				}
			}
		}

		const updated = await prisma.attendance.update({
			where: { attendanceId: parsed.attendanceId },
			data: {
				...(parsed.manualCheckIn && {
					manualCheckIn: new Date(parsed.manualCheckIn),
				}),
				...(parsed.manualCheckOut && {
					manualCheckOut: new Date(parsed.manualCheckOut),
				}),
				...(totalHours && { totalHours }),
				...(overtimeHours && { overtimeHours }),
				...(parsed.notes !== undefined && { notes: parsed.notes }),
				isManualEntry: true,
				...(parsed.approvedBy && {
					approvedBy: parsed.approvedBy,
					approvedAt: new Date(),
				}),
			},
			include: {
				employee: { select: { nombre: true, apellido: true, cargo: true } },
			},
		});

		return updated;
	},
);

// ── Vacaciones ─────────────────────────────────────────

/**
 * @description Obtiene solicitudes de vacaciones con filtros opcionales.
 * Reemplaza GET /api/empleados/vacaciones.
 */
export const getVacacionesAction = withAction(
	async (
		input: { employeeId?: string; status?: string },
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'vacaciones', 'gestionar vacaciones');
		const tenantId = requireTenant(user);
		const where: any = { employee: { tenantId } };
		if (input.employeeId) where.employeeId = input.employeeId;
		if (input.status) where.status = input.status;

		return prisma.vacationRequest.findMany({
			where,
			include: {
				employee: {
					select: {
						nombre: true,
						apellido: true,
						cargo: true,
						vacationDaysAccrued: true,
						vacationDaysUsed: true,
						fechaContratacion: true,
						diasVacacionesAnuales: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});
	},
);

const createVacacionSchema = z.object({
	employeeId: z.string().min(1),
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	reason: z.string().optional(),
});

/**
 * @description Crea una solicitud de vacaciones.
 * Reemplaza POST /api/empleados/vacaciones.
 */
export const createVacacionAction = withAction(
	async (
		input: z.infer<typeof createVacacionSchema>,
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'vacaciones', 'gestionar vacaciones');
		requirePermission(user, "rrhh.vacaciones.solicitar", "crear solicitudes de vacaciones");
		const tenantId = requireTenant(user);
		const parsed = createVacacionSchema.parse(input);

		const empleado = await prisma.empleado.findFirst({
			where: { empleadoId: parsed.employeeId, tenantId },
			select: {
				vacationDaysAccrued: true,
				vacationDaysUsed: true,
				fechaContratacion: true,
				diasVacacionesAnuales: true,
				nombre: true,
				apellido: true,
			},
		});

		if (!empleado) throw new ActionError("Empleado no encontrado", "NOT_FOUND");
		if (!empleado.fechaContratacion) {
			throw new ActionError(
				"El empleado debe tener fecha de contratación configurada",
				"BAD_REQUEST",
			);
		}

		const start = new Date(parsed.startDate);
		const end = new Date(parsed.endDate);
		const daysRequested =
			Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const daysAvailable =
			empleado.vacationDaysAccrued - empleado.vacationDaysUsed;

		if (daysRequested > daysAvailable) {
			throw new ActionError(
				`Días solicitados (${daysRequested}) exceden días disponibles (${daysAvailable})`,
				"BAD_REQUEST",
			);
		}

		return prisma.vacationRequest.create({
			data: {
				employeeId: parsed.employeeId,
				startDate: start,
				endDate: end,
				daysRequested,
				reason: parsed.reason ?? null,
				status: "PENDING",
			},
			include: {
				employee: {
					select: {
						nombre: true,
						apellido: true,
						cargo: true,
						vacationDaysAccrued: true,
						vacationDaysUsed: true,
					},
				},
			},
		});
	},
);

/**
 * @description Obtiene el resumen de acumulación de vacaciones para un empleado.
 * Reemplaza GET /api/empleados/vacaciones/acumulacion.
 */
export const getVacacionAccumulacionAction = withAction(
	async (input: { employeeId: string }, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		const tenantId = requireTenant(user);
		const empleado = await prisma.empleado.findFirst({
			where: { empleadoId: input.employeeId, tenantId },
			select: { empleadoId: true },
		});
		if (!empleado) throw new ActionError("Empleado no encontrado", "NOT_FOUND");
		const { VacationAccrualService } = await import(
			"@/lib/vacation-accrual-service"
		);
		const service = new VacationAccrualService();
		return service.getAccrualSummary(input.employeeId);
	},
);

const nominaInclude = {
	empleado: {
		select: {
			nombre: true,
			apellido: true,
			cargo: true,
			salarioBases: true,
		},
	},
} as const;

export const getNominaAction = withAction(
	async (
		input: { periodo?: string; employeeId?: string } = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		const tenantId = requireTenant(user);
		return prisma.pagosalario.findMany({
			where: {
				tenantId,
				...(input.periodo ? { periodo: input.periodo } : {}),
				...(input.employeeId ? { empleadoId: input.employeeId } : {}),
			},
			include: nominaInclude,
			orderBy: { createdAt: "desc" },
		});
	},
);

const calculateNominaSchema = z.object({
	periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM)"),
	employeeIds: z.array(z.string()).optional(),
	includeVacationAccrual: z.boolean().default(true),
	forceRecalculate: z.boolean().default(false),
});

export const calculateNominaAction = withAction(
	async (
		input: z.infer<typeof calculateNominaSchema>,
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		requirePermission(user, "rrhh.nomina.calcular", "calcular nómina");
		const tenantId = requireTenant(user);
		const parsed = calculateNominaSchema.parse(input);
		const {
			periodo,
			employeeIds,
			includeVacationAccrual = true,
			forceRecalculate = false,
		} = parsed;

		const [year, month] = periodo.split("-").map(Number);
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0);

		if (forceRecalculate) {
			const replacementEmployees = await prisma.empleado.findMany({
				where: {
					tenantId,
					...(employeeIds?.length ? { empleadoId: { in: employeeIds } } : {}),
					fechaContratacion: { not: undefined },
				},
				select: { empleadoId: true },
			});
			if (replacementEmployees.length === 0) {
				throw new ActionError(
					"No se encontraron empleados con fecha de contratación para calcular nómina",
					"NOT_FOUND",
				);
			}
			await getPayrollConfig(periodo);
		}

		const existingPayrolls = await prisma.pagosalario.findMany({
			where: { tenantId, periodo },
			include: nominaInclude,
		});
		if (existingPayrolls.length > 0) {
			if (forceRecalculate) {
				throw new ActionError(
					"La nómina existente debe eliminarse mediante el flujo de reversión antes de recalcular",
					"FINANCIAL_REVERSAL_REQUIRED",
				);
			}
			return {
				payrolls: existingPayrolls,
				message: `Ya existe nómina calculada para este período con ${existingPayrolls.length} empleados`,
				existing: true,
			};
		}

		const empleados = await prisma.empleado.findMany({
			where: {
				tenantId,
				...(employeeIds?.length ? { empleadoId: { in: employeeIds } } : {}),
				fechaContratacion: { not: undefined },
			},
		});

		if (empleados.length === 0) {
			throw new ActionError(
				"No se encontraron empleados con fecha de contratación para calcular nómina",
				"NOT_FOUND",
			);
		}

		const payrollConfig = await getPayrollConfig(periodo);
		const { VacationAccrualService } = await import(
			"@/lib/vacation-accrual-service"
		);
		const vacationService = new VacationAccrualService();
		const payrollRecords: Array<Record<string, unknown>> = [];
		const vacationResults: Array<Record<string, unknown>> = [];

		for (const empleado of empleados) {
			try {
				const attendances = await prisma.attendance.findMany({
					where: {
						employeeId: empleado.empleadoId,
						date: {
							gte: startDate,
							lte: endDate,
						},
					},
				});

				let totalHours = 0;
				let overtimeHours = 0;

				for (const attendance of attendances) {
					if (attendance.totalHours) {
						const hours = Number(attendance.totalHours);
						totalHours += hours;
						if (hours > 8) overtimeHours += hours - 8;
					}
				}

				const standardHours = STANDARD_MONTHLY_HOURS;
				const bonificaciones = 0;
				// Las horas extras no entran al devengado base: se pagan aparte a 1.5×
				// en `montoHorasExtras` (B-05). Sin asistencias se asume mes completo.
				const baseHoursWorked =
					totalHours > 0 ? totalHours - overtimeHours : standardHours;
				const devengadoReal =
					(baseHoursWorked / standardHours) * empleado.salarioBases + bonificaciones;
				const calculations = calculatePayrollFormulas(
					devengadoReal,
					payrollConfig,
				);
				const horasExtrasHoras = Math.round(overtimeHours);
				const montoHorasExtras = calcularMontoHorasExtras(
					horasExtrasHoras,
					empleado.salarioBases,
				);

				const payroll = await prisma.pagosalario.create({
					data: {
						empleadoId: empleado.empleadoId,
						// Bruto del período (base imponible); las deducciones van aparte,
						// en su campo, para no descontarlas dos veces al total.
						salario: Math.round(calculations.baseImponible),
						bonificaciones,
						deducciones: Math.round(calculations.deducciones.total),
						horasExtrasHoras,
						montoHorasExtras,
						periodo,
						tenantId,
						observaciones:
							`Devengado: ${devengadoReal.toFixed(2)}, Vacaciones (9.09%): ${calculations.vacaciones.toFixed(2)}. ` +
							`Deducciones: 5%($${calculations.deducciones.p5.toFixed(2)}), 3%($${calculations.deducciones.p3.toFixed(2)})` +
							(payrollConfig.aplicar12_5y1_5
								? `, 12.5%($${calculations.deducciones.p12_5.toFixed(2)}), 1.5%($${calculations.deducciones.p1_5.toFixed(2)})`
								: "") +
							(horasExtrasHoras > 0
								? `. Horas extras: ${horasExtrasHoras} h × 1.5 = $${montoHorasExtras}`
								: ""),
					},
					include: nominaInclude,
				});

				payrollRecords.push(payroll);

				if (includeVacationAccrual) {
					try {
						const vacationResult =
							await vacationService.calculateAccrualForEmployee(
								empleado.empleadoId,
								endDate,
								periodo,
							);
						vacationResults.push({
							empleadoId: empleado.empleadoId,
							empleado: `${empleado.nombre} ${empleado.apellido}`,
							...vacationResult,
						});
					} catch (vacationError) {
						vacationResults.push({
							empleadoId: empleado.empleadoId,
							empleado: `${empleado.nombre} ${empleado.apellido}`,
							error:
								vacationError instanceof Error
									? vacationError.message
									: "Error calculando vacaciones",
							processed: false,
						});
					}
				}
			} catch (error) {
				payrollRecords.push({
					empleadoId: empleado.empleadoId,
					empleado: `${empleado.nombre} ${empleado.apellido}`,
					error:
						error instanceof Error ? error.message : "Error procesando empleado",
					processed: false,
				});
			}
		}

		return {
			payrolls: payrollRecords,
			vacationAccruals: vacationResults.length > 0 ? vacationResults : undefined,
			message: `Nómina procesada para ${payrollRecords.length} empleados${vacationResults.length > 0 ? ` y acumulación de vacaciones para ${vacationResults.filter((v) => v.processed).length} empleados` : ""}`,
		};
	},
);

const workScheduleSchema = z.object({
	employeeId: z.string().min(1, "ID de empleado requerido"),
	dayOfWeek: z.number().min(0).max(6, "Día de la semana debe ser 0-6"),
	startTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
	endTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)"),
	breakStartTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
		.optional(),
	breakEndTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
		.optional(),
	isWorkingDay: z.boolean().default(true),
	scheduledHours: z.number().min(0).max(24),
});

export const getWorkSchedulesAction = withAction(
	async (input: { employeeId?: string } = {}, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		const tenantId = requireTenant(user);
		return prisma.employeeWorkSchedule.findMany({
			where: {
				...(input.employeeId ? { employeeId: input.employeeId } : {}),
				employee: { tenantId },
			},
			include: {
				employee: {
					select: { nombre: true, apellido: true, cargo: true },
				},
			},
			orderBy: [{ employeeId: "asc" }, { dayOfWeek: "asc" }],
		});
	},
);

export const upsertWorkScheduleAction = withAction(
	async (
		input: z.infer<typeof workScheduleSchema>,
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		requirePermission(user, "rrhh.horarios.gestionar", "guardar horarios de trabajo");
		const tenantId = requireTenant(user);
		const parsed = workScheduleSchema.parse(input);

		const empleado = await prisma.empleado.findFirst({
			where: { empleadoId: parsed.employeeId, tenantId },
			select: { empleadoId: true },
		});
		if (!empleado) throw new ActionError("Empleado no encontrado", "NOT_FOUND");

		return prisma.employeeWorkSchedule.upsert({
			where: {
				employeeId_dayOfWeek: {
					employeeId: parsed.employeeId,
					dayOfWeek: parsed.dayOfWeek,
				},
			},
			update: {
				startTime: parsed.startTime,
				endTime: parsed.endTime,
				breakStartTime: parsed.breakStartTime,
				breakEndTime: parsed.breakEndTime,
				isWorkingDay: parsed.isWorkingDay,
				scheduledHours: parsed.scheduledHours,
			},
			create: {
				employeeId: parsed.employeeId,
				dayOfWeek: parsed.dayOfWeek,
				startTime: parsed.startTime,
				endTime: parsed.endTime,
				breakStartTime: parsed.breakStartTime,
				breakEndTime: parsed.breakEndTime,
				isWorkingDay: parsed.isWorkingDay,
				scheduledHours: parsed.scheduledHours,
			},
			include: {
				employee: {
					select: { nombre: true, apellido: true, cargo: true },
				},
			},
		});
	},
);

export const deleteWorkScheduleAction = withAction(
	async (input: { scheduleId: string }, user: AuthenticatedUser) => {
		requireFeature(user, 'empleados', 'gestionar empleados');
		requirePermission(user, "rrhh.horarios.eliminar", "eliminar horarios de trabajo");
		const tenantId = requireTenant(user);
		const existing = await prisma.employeeWorkSchedule.findFirst({
			where: {
				scheduleId: input.scheduleId,
				employee: { tenantId },
			},
			select: { scheduleId: true },
		});
		if (!existing)
			throw new ActionError("Horario de trabajo no encontrado", "NOT_FOUND");

		await prisma.employeeWorkSchedule.delete({
			where: { scheduleId: input.scheduleId },
		});
		return { success: true };
	},
);
