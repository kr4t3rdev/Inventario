/**
 * @description Helpers compartidos para rutas mobile de administración global.
 *
 * Centraliza autenticación Bearer, verificación de rol admin y el mapeo de
 * ActionError/ZodError a respuestas HTTP estandarizadas.
 *
 * @module app/api/mobile/v1/admin/_shared
 */

import { ZodError } from "zod";
import { authenticateUser } from "@/lib/auth-middleware";
import { errorResponse, successResponse } from "@/lib/api-response";
import { ActionError } from "@/lib/server-actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
  AUTH_REQUIRED: 401,
};

/**
 * @description Traduce un código de ActionError a su estado HTTP.
 * @param {string} code - Código de error de dominio.
 * @returns {number} Estado HTTP correspondiente.
 */
function actionErrorStatus(code: string): number {
  return STATUS_BY_CODE[code] ?? 400;
}

type AdminHandler<TInput, TOutput> = (
  input: TInput,
  user: AuthenticatedUser,
) => Promise<TOutput>;

/**
 * @description Ejecuta un handler admin con autenticación Bearer, rol admin y manejo de errores.
 * @template TInput - Tipo de entrada del handler.
 * @template TOutput - Tipo de salida del handler.
 * @param {Request} request - Request HTTP entrante.
 * @param {(request: Request) => Promise<TInput>} readInput - Extrae la entrada tipada de la request.
 * @param {AdminHandler<TInput, TOutput>} handler - Lógica de negocio reutilizada.
 * @returns {Promise<Response>} Respuesta JSON estandarizada.
 */
export async function handleAdminRequest<TInput, TOutput>(
  request: Request,
  readInput: (request: Request) => Promise<TInput>,
  handler: AdminHandler<TInput, TOutput>,
): Promise<Response> {
  const authResult = await authenticateUser(request as never);
  if ("status" in authResult) {
    return authResult as Response;
  }

  const { user } = authResult;
  if (user.role !== "admin") {
    return errorResponse("Acceso restringido", 403, "FORBIDDEN");
  }

  try {
    const input = await readInput(request);
    const data = await handler(input, user);
    return successResponse(data);
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(
        error.message,
        actionErrorStatus(error.code),
        error.code,
      );
    }
    if (error instanceof ZodError) {
      return errorResponse(
        "Datos inválidos",
        400,
        "VALIDATION_ERROR",
        error.flatten().fieldErrors,
      );
    }
    console.error("Error en mobile admin route:", error);
    return errorResponse("Error interno del servidor", 500, "INTERNAL_ERROR");
  }
}

/**
 * @description Lee el cuerpo JSON de la request.
 * @param {Request} request - Request HTTP entrante.
 * @returns {Promise<unknown>} Payload JSON parseado (o undefined si está vacío).
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}