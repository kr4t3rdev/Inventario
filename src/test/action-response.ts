import type { ActionResponse } from "@/lib/server-actions/types";

/**
 * @description Validates and narrows a Server Action success response in tests.
 * @param {ActionResponse<T>} response - The response to validate.
 * @returns {Extract<ActionResponse<T>, { success: true }>} The success variant.
 */
export function expectActionSuccess<T>(
	response: ActionResponse<T>,
): Extract<ActionResponse<T>, { success: true }> {
	if (!response.success) throw new Error(response.error.message);
	return response;
}

/**
 * @description Validates and narrows a Server Action failure response in tests.
 * @param {ActionResponse<T>} response - The response to validate.
 * @returns {Extract<ActionResponse<T>, { success: false }>} The failure variant.
 */
export function expectActionFailure<T>(
	response: ActionResponse<T>,
): Extract<ActionResponse<T>, { success: false }> {
	if (response.success) throw new Error("Expected the Server Action to fail");
	return response;
}
