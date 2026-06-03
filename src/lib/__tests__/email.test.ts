import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({
	sendMock: vi.fn(),
}));

vi.mock("resend", () => ({
	Resend: vi.fn(() => ({
		emails: { send: sendMock },
	})),
}));

import { sendEmail } from "../email";

describe("sendEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("retorna null cuando RESEND_API_KEY no está configurada", async () => {
		vi.stubEnv("RESEND_API_KEY", "");

		const result = await sendEmail("test@example.com", "Asunto", "<p>hola</p>");
		expect(result).toBeNull();
		expect(sendMock).not.toHaveBeenCalled();
	});

	it("retorna el id cuando el envío es exitoso", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_abc123");
		sendMock.mockResolvedValueOnce({
			data: { id: "resend-email-123" },
			error: null,
		});

		const result = await sendEmail("test@example.com", "Asunto", "<p>hola</p>");
		expect(result).toEqual({ id: "resend-email-123" });
	});

	it("retorna null cuando el envío via Resend falla (el error se atrapa internamente)", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_abc123");
		sendMock.mockResolvedValueOnce({
			data: null,
			error: { message: "Invalid login", name: "validation_error" },
		});

		const result = await sendEmail("test@example.com", "Asunto", "<p>hola</p>");
		expect(result).toBeNull();
	});
});
