/**
 * @description Wrapper for Server Actions that standardizes error handling.
 *
 * Envuelve cualquier función async para que:
 * 1. Obtenga el usuario automáticamente (via getCurrentUser)
 * 2. Atrape errores de Zod, Prisma y errores genéricos
 * 3. Retorne siempre { success: boolean, data? / error? }
 *
 * @param action - La función de negocio que recibe (input, user)
 * @returns ServerAction<TInput, TOutput>
 */
import { ZodError } from "zod";
import { getCurrentUser } from "./get-current-user";
import { ActionError, type ActionResponse, type ServerAction } from "./types";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { serializePrismaData } from "@/lib/prisma-utils";
import { PeriodoError } from "@/lib/services/periodo-contable-types";

/** @description Códigos de error de Prisma mapeados a mensajes en español */
const PRISMA_ERROR_MESSAGES: Record<string, string> = {
	P2002: "Ya existe un registro con estos datos únicos",
	P2003: "No se puede eliminar porque tiene registros relacionados",
	P2005: "El valor proporcionado no es válido para este campo",
	P2007: "Error de validación en los datos enviados",
	P2014:
		"No se puede realizar la operación porque viola una relación requerida",
	P2025: "El registro solicitado no fue encontrado",
};

/**
 * @description Wrapper for Server Actions that standardizes error handling.
 *
 * Envuelve cualquier función async para que:
 * 1. Obtenga el usuario automáticamente (via getCurrentUser)
 * 2. Atrape errores de Zod, Prisma y errores genéricos
 * 3. Retorne siempre { success: boolean, data? / error? }
 *
 * @param action - La función de negocio que recibe (input, user)
 * @returns ServerAction<TInput, TOutput>
 */
export function withAction<TInput, TOutput>(
	action: (input: TInput, user: AuthenticatedUser) => Promise<TOutput>,
): ServerAction<TInput, TOutput> {
	return async (input: TInput): Promise<ActionResponse<TOutput>> => {
		try {
			const user = await getCurrentUser();
			if (!user) {
				return {
					success: false,
					error: { message: "Unauthorized", code: "AUTH_REQUIRED" },
				};
			}

			const data = await action(input, user);
			return { success: true, data: serializePrismaData(data) };
		} catch (error) {
			if (error instanceof ZodError) {
				return {
					success: false,
					error: {
						message: "Datos inválidos",
						code: "VALIDATION_ERROR",
						details: error.flatten().fieldErrors as Record<string, string[]>,
					},
				};
			}

			// Duck-typing para errores de Prisma: instanceof puede fallar
			// cuando pnpm/npm resuelve @prisma/client desde distintas ubicaciones.
			const errorObj = error as Record<string, unknown>;
			const errorName =
				(errorObj?.constructor?.name as string) ||
				(errorObj?.name as string) ||
				"";
			const isPrismaKnownError =
				errorName === "PrismaClientKnownRequestError" ||
				(typeof errorObj.code === "string" && errorObj.code.startsWith("P"));

			if (isPrismaKnownError) {
				const code = errorObj.code as string;
				return {
					success: false,
					error: {
						message: getPrismaErrorMessage(code),
						code,
					},
				};
			}

			if (errorName === "PrismaClientValidationError") {
				return {
					success: false,
					error: {
						message: "Error de validación en la base de datos",
						code: "PRISMA_VALIDATION_ERROR",
					},
				};
			}

			if (error instanceof ActionError) {
				return {
					success: false,
					error: { message: error.message, code: error.code },
				};
			}

			if (error instanceof PeriodoError) {
				return {
					success: false,
					error: { message: error.message, code: error.code },
				};
			}

			console.error("Server Action Error:", error);
			return {
				success: false,
				error: {
					message: "Error interno del servidor",
					code: "INTERNAL_ERROR",
				},
			};
		}
	};
}

/**
 * @description Mapea códigos de error de Prisma a mensajes amigables en español.
 *
 * @param code - Código de error Prisma (ej: "P2002", "42601")
 * @returns Mensaje descriptivo en español
 */
function getPrismaErrorMessage(code: string): string {
	return PRISMA_ERROR_MESSAGES[code] || `Error de base de datos (${code})`;
}
