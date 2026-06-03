/**
 * @description Script de prueba para verificar conectividad con Resend.
 * Uso: RESEND_API_KEY=re_xxx npx tsx scripts/test-resend.ts
 */
import { Resend } from "resend";

async function main() {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		console.error("❌ RESEND_API_KEY no está configurada.");
		console.error(
			"   Uso: RESEND_API_KEY=re_xxx npx tsx scripts/test-resend.ts",
		);
		process.exit(1);
	}

	const resend = new Resend(apiKey);

	// Test: enviar un email de prueba
	const testEmail = process.env.TEST_TO || "garciamichel894@gmail.com";
	console.log(`\n📧 Enviando email de prueba a ${testEmail}...`);

	const { data, error } = await resend.emails.send({
		from: process.env.RESEND_FROM || `onboarding@resend.dev`,
		to: testEmail,
		subject: "🧪 Test Resend - Conexión exitosa",
		html: `
      <div style="font-family: Arial; max-width: 600px; margin: 24px auto; padding: 24px;">
        <h2 style="color: #4f46e5;">✅ Resend funciona!</h2>
        <p>Este es un email de prueba para verificar que la migración de Nodemailer a Resend se completó correctamente.</p>
        <p style="color: #64748b; font-size: 14px;">Enviado desde FinanceMDM</p>
      </div>
    `,
	});

	if (error) {
		console.error("❌ Error al enviar email:", error.message);
		process.exit(1);
	}

	console.log("✅ Email enviado exitosamente!");
	console.log(`   ID: ${data?.id}`);
}

main().catch((e) => {
	console.error("Error inesperado:", e);
	process.exit(1);
});
