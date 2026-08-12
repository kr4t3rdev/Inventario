/**
 * @description Zod schemas for backup feature.
 */
import { z } from "zod";
import { isValidCronExpression } from './cron-utils';

export const createBackupSchema = z
	.object({
		type: z.enum(["full", "tenant", "config"]),
		tenantId: z.string().min(1).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.type === "tenant" && !value.tenantId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["tenantId"],
				message: "Tenant es requerido para backups por tenant",
			});
		}
	});

export const createPlanSchema = z
	.object({
		type: z.enum(["full", "tenant", "config"]),
		tenantId: z.string().min(1).optional(),
		schedule: z.string().min(1, "Cron expression is required"),
		retention: z.number().int().min(1).max(365).default(30),
	})
	.superRefine((value, ctx) => {
		if (!isValidCronExpression(value.schedule)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["schedule"],
				message: "La expresión Cron no es válida",
			});
		}
		if (value.type === "tenant" && !value.tenantId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["tenantId"],
				message: "Tenant es requerido para planes por tenant",
			});
		}
	});

export const updatePlanSchema = z
	.object({
		planId: z.string().min(1),
		schedule: z.string().optional(),
		enabled: z.boolean().optional(),
		retention: z.number().int().min(1).max(365).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.schedule !== undefined && !isValidCronExpression(value.schedule)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["schedule"],
				message: "La expresión Cron no es válida",
			});
		}
	});

export const deleteBackupSchema = z.object({
	backupLogId: z.string().min(1),
});

export const restoreBackupSchema = z.object({
	backupLogId: z.string().min(1),
	confirmation: z.string().min(1),
});

export const importBackupSchema = z.object({
	url: z.string().url("Debe ser una URL válida").optional(),
	fileName: z.string().optional(),
	fileSize: z.number().int().positive().optional(),
});

export const getBackupsSchema = z.object({
	type: z.enum(["full", "tenant", "config", "imported"]).optional(),
	tenantId: z.string().optional(),
	status: z
		.enum(["running", "completed", "failed", "pruned", "deleted"])
		.optional(),
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).default(0),
});

export type CreateBackupInput = z.infer<typeof createBackupSchema>;
export type ImportBackupInput = z.infer<typeof importBackupSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
export type GetBackupsInput = z.infer<typeof getBackupsSchema>;
