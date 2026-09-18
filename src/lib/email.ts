import { Resend } from "resend";

// Resend client singleton
let resend: Resend | null = null;

function getResend(): Resend | null {
	if (resend) return resend;

	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		return null;
	}

	resend = new Resend(apiKey);
	return resend;
}

/**
 * @description Devuelve la dirección from configurada.
 * Si RESEND_FROM no está definida, usa el dominio de prueba de Resend.
 */
function getFromAddress(): string {
	return (
		process.env.RESEND_FROM || process.env.SMTP_FROM || "onboarding@resend.dev"
	);
}

/**
 * TTL cache para rate limiting de errores (evita spam de emails).
 */
const errorCache = new Map<string, number>();
const ERROR_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos entre emails del mismo error

/**
 * @description Genera una clave única para el error basada en el mensaje
 * @param {Error} error - Error a analizar
 * @returns {string} Clave única del error
 */
function getErrorKey(error: Error): string {
	return error.message.slice(0, 100);
}

/**
 * @description Envía un email transaccional usando Resend.
 *
 * Lee RESEND_API_KEY del entorno. Si no está configurada, loguea un warning
 * y retorna null (no lanza excepción). Retorna el objeto con id en éxito,
 * o null si falla.
 *
 * @param {string} to - Destinatario
 * @param {string} subject - Asunto
 * @param {string} html - Cuerpo HTML
 * @returns {Promise<{ id: string } | null>}
 */
export async function sendEmail(
	to: string,
	subject: string,
	html: string,
): Promise<{ id: string } | null> {
	const client = getResend();
	if (!client) {
		console.warn("RESEND_API_KEY not configured. Email not sent.");
		return null;
	}

	try {
		const { data, error } = await client.emails.send({
			from: getFromAddress(),
			to,
			subject,
			html,
		});

		if (error) {
			console.error("Error sending email via Resend:", error.message);
			return null;
		}

		console.log("Email sent via Resend — id: %s, to: %s", data?.id, to);
		return data ?? null;
	} catch (error) {
		console.error("Error sending email:", error);
		return null;
	}
}

/**
 * @description Envía un enlace de verificación de email con acceso al flujo de onboarding.
 * @param {string} to - Correo del usuario.
 * @param {string} verificationUrl - URL completa con el token temporal.
 * @param {string} userName - Nombre del usuario.
 * @returns {Promise<{success: boolean, messageId?: string}>} Resultado del envío
 */
export async function sendEmailVerificationLink(
	to: string,
	verificationUrl: string,
	userName: string,
): Promise<{ success: boolean; messageId?: string }> {
	const appName =
		process.env.NEXT_PUBLIC_APP_NAME || "Sistema de Gestion FinanceMDM";

	const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h2 style="margin: 0 0 16px; color: #4f46e5;">Verificá tu correo</h2>
      <p>Hola ${userName}, gracias por registrarte en <strong>${appName}</strong>.</p>
      <p>Hacé click en el botón de abajo para verificar tu correo y continuar con el onboarding.</p>
      <p style="margin: 28px 0;">
        <a href="${verificationUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;">
          Verificar correo y continuar
        </a>
      </p>
      <p style="font-size: 14px; color: #64748b;">Si no fuiste vos, ignorá este mensaje.</p>
    </div>
  `;

	const result = await sendEmail(to, `Verificá tu correo en ${appName}`, html);
	return { success: result !== null, messageId: result?.id };
}

/**
 * @description Envía un enlace de reseteo de contraseña.
 * @param {string} to - Correo del usuario.
 * @param {string} resetUrl - URL completa con el token de reseteo.
 * @param {string} userName - Nombre del usuario.
 * @returns {Promise<{ success: boolean; messageId?: string }>} Resultado del envío
 */
export async function sendPasswordResetEmail(
	to: string,
	resetUrl: string,
	userName: string,
): Promise<{ success: boolean; messageId?: string }> {
	const appName = process.env.NEXT_PUBLIC_APP_NAME || "Sistema de Gestion FinanceMDM";

	const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h2 style="margin: 0 0 16px; color: #4f46e5;">Restablece tu contraseña</h2>
      <p>Hola ${userName}, recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${appName}</strong>.</p>
      <p>Haz clic en el botón de abajo para crear una nueva contraseña. El enlace es válido por 1 hora.</p>
      <p style="margin: 28px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size: 14px; color: #64748b;">Si no fuiste tú quien lo solicitó, ignora este mensaje y tu contraseña seguirá sin cambios.</p>
    </div>
  `;

	const result = await sendEmail(to, `Restablece tu contraseña en ${appName}`, html);
	return { success: result !== null, messageId: result?.id };
}

export async function sendNewUserNotification(
	newUserName: string,
	newUserEmail: string,
	newUserRole: string,
	createdBy: string,
): Promise<void> {
	const adminEmail = process.env.ADMIN_EMAIL;
	if (!adminEmail) {
		console.warn("ADMIN_EMAIL not configured. Skipping new user notification.");
		return;
	}

	const appName = process.env.NEXT_PUBLIC_APP_NAME || "Sistema de Inventario";
	const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #059669;">✅ Nuevo usuario registrado en ${appName}</h2>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Nombre:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${newUserName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Email:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${newUserEmail}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Rol:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${newUserRole === "admin" ? "Administrador" : "Usuario"}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Registrado por:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${createdBy}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Fecha:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${new Date().toLocaleString("es-ES")}</td>
        </tr>
      </table>

      <div style="background: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <strong>⚠️ Acción requerida:</strong> El usuario ha sido creado con estado inactivo. Active la cuenta desde el panel de administración si es apropiado.
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        Este es un mensaje automático del sistema ${appName}.
      </p>
    </div>
  `;

	await sendEmail(
		adminEmail,
		`✅ Nuevo usuario registrado: ${newUserName}`,
		html,
	);
}

export async function sendFailedLoginAttemptsNotification(
	userName: string,
	userEmail: string,
	attempts: number,
	ipAddress: string | null,
	userAgent: string | null,
): Promise<void> {
	const adminEmail = process.env.ADMIN_EMAIL;
	if (!adminEmail) {
		console.warn(
			"ADMIN_EMAIL not configured. Skipping failed login notification.",
		);
		return;
	}

	const appName = process.env.NEXT_PUBLIC_APP_NAME || "Sistema de Inventario";
	const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">🚨 Alerta de seguridad: Intentos de login fallidos</h2>

      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;">
          <strong>Se han producido ${attempts} intentos fallidos de inicio de sesión.</strong>
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Usuario:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${userName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Email:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${userEmail}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Intentos:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db; color: #dc2626; font-weight: bold;">${attempts}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>IP:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${ipAddress || "No detectada"}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Dispositivo:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${userAgent || "No detectado"}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Fecha:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${new Date().toLocaleString("es-ES")}</td>
        </tr>
      </table>

      <div style="background: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <strong>⚠️ Recomendación:</strong> Verifique si este intento es legítimo. Si considera que la cuenta está comprometida, puede bloquear el acceso desde el panel de administración.
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        Este es un mensaje automático del sistema ${appName}.
      </p>
    </div>
  `;

	await sendEmail(
		adminEmail,
		`🚨 Alerta: ${attempts} intentos fallidos para ${userName}`,
		html,
	);
}

/**
 * @description Envía una alerta por email cuando ocurre un error crítico en la aplicación
 * @param {Error} error - El error que ocurrió
 * @param {Object} context - Contexto adicional del error (opcional)
 * @param {string} context.endpoint - Endpoint donde ocurrió el error
 * @param {string} context.userId - ID del usuario que causó el error
 * @param {string} context.additionalInfo - Información adicional
 * @returns {Promise<void>}
 */
export async function sendErrorAlert(
	error: Error,
	context?: {
		endpoint?: string;
		userId?: string;
		additionalInfo?: string;
	},
): Promise<void> {
	if (!process.env.ERROR_ALERT_EMAIL) {
		return;
	}

	// Rate limiting: evitar spam de emails
	const errorKey = getErrorKey(error);
	const lastSent = errorCache.get(errorKey);
	const now = Date.now();

	if (lastSent && now - lastSent < ERROR_COOLDOWN_MS) {
		return;
	}

	errorCache.set(errorKey, now);

	// Limpiar entradas antiguas del cache (mantener solo últimas 100)
	if (errorCache.size > 100) {
		const entries = Array.from(errorCache.entries());
		const toDelete = entries.slice(0, entries.length - 100);
		toDelete.forEach(([key]) => errorCache.delete(key));
	}

	const appName = process.env.NEXT_PUBLIC_APP_NAME || "Sistema de Inventario";
	const environment = process.env.NODE_ENV || "development";

	const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">🚨 Error en ${appName}</h2>

      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Mensaje:</strong> ${error.message}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Ambiente:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${environment}</td>
        </tr>
        ${
					context?.endpoint
						? `
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Endpoint:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${context.endpoint}</td>
        </tr>
        `
						: ""
				}
        ${
					context?.userId
						? `
        <tr style="background: #f3f4f6;">
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Usuario:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${context.userId}</td>
        </tr>
        `
						: ""
				}
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;"><strong>Fecha:</strong></td>
          <td style="padding: 10px; border: 1px solid #d1d5db;">${new Date().toLocaleString("es-ES")}</td>
        </tr>
      </table>

      ${
				context?.additionalInfo
					? `
      <div style="background: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <strong>Información adicional:</strong>
        <pre style="margin: 10px 0; white-space: pre-wrap;">${context.additionalInfo}</pre>
      </div>
      `
					: ""
			}

      <div style="background: #1f2937; color: #e5e7eb; padding: 15px; border-radius: 5px; overflow-x: auto;">
        <strong style="color: #fbbf24;">Stack Trace:</strong>
        <pre style="margin: 10px 0; font-size: 12px; white-space: pre-wrap; word-break: break-all;">${error.stack || "No stack trace disponible"}</pre>
      </div>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        Este es un mensaje automático del sistema. Para evitar spam, errores similares no generarán nuevos emails durante 5 minutos.
      </p>
    </div>
  `;

	await sendEmail(
		process.env.ERROR_ALERT_EMAIL,
		`🚨 [${environment.toUpperCase()}] Error: ${error.message.slice(0, 50)}...`,
		html,
	);
}
