import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import { sendEmailVerificationLink } from '@/lib/email';
import { normalizeUserRole } from '@/lib/auth/roles';
import { signOnboardingToken } from '@/lib/auth/onboarding';
import { getConfiguredPublicAppUrl } from '@/features/sales-agent/public-url';
import { checkRateLimit } from '@/lib/rate-limit';
import { errorResponse, successResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(120),
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido').max(254),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});

const RATE_LIMIT_PATH = '/api/mobile/v1/auth/register';

/**
 * @description Mobile self-registration endpoint mirroring the web flow.
 * Creates an inactive user pending email verification and sends the
 * verification link. It does not return a session: the account must
 * complete onboarding and approval before mobile login works.
 * @param {Request} request - Incoming request with name, email and password.
 * @returns {Promise<Response>} Registration result.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const rate = checkRateLimit(ip, RATE_LIMIT_PATH);
  if (!rate.allowed) {
    return errorResponse(
      'Demasiados intentos. Intentalo de nuevo en unos segundos.',
      429,
      'RATE_LIMITED',
    );
  }

  let input: z.infer<typeof registerSchema>;
  try {
    input = registerSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR', error.flatten().fieldErrors);
    }
    return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR');
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      return errorResponse('El usuario ya existe', 409, 'USER_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    const createdUser = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: normalizeUserRole('user')!,
        isActive: false,
        onboardingStatus: 'pending_email_verification',
        emailVerifiedAt: null,
      },
      select: { userId: true },
    });

    const appUrl = getConfiguredPublicAppUrl();
    if (!appUrl) {
      console.error(`[MOBILE REGISTER] Sin origen público canónico — usuario: ${createdUser.userId}`);
      return errorResponse('El servicio de verificación no está disponible', 503, 'VERIFICATION_UNAVAILABLE');
    }

    const verificationToken = signOnboardingToken({
      userId: createdUser.userId,
      email: input.email,
      purpose: 'email-verification',
    });
    const verificationUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const emailResult = await sendEmailVerificationLink(input.email, verificationUrl, input.name);
    if (emailResult.success) {
      console.log(`[MOBILE REGISTER] Email de verificación enviado — usuario: ${createdUser.userId}`);
    } else {
      console.error(`[MOBILE REGISTER] Falló el envío del email de verificación — usuario: ${createdUser.userId}`);
    }

    const response = successResponse(
      {
        message: 'Revisá tu correo para verificar la cuenta y continuar con el onboarding',
        success: true,
      },
      201,
    );
    response.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    return response;
  } catch (error) {
    console.error('Error en mobile register route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}
