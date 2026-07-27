import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { getJwtSecret } from '@/lib/secrets';

interface ProtectedRouteIdentity {
  role: string;
  isActive: boolean;
  tenantId?: string;
  onboardingStatus?: string | null;
}

/**
 * @description Obtiene identidad para guards de layout, incluyendo sesiones mid-onboarding.
 * @returns {Promise<ProtectedRouteIdentity | null>} Identidad verificada o null.
 */
export async function getProtectedRouteIdentity(): Promise<ProtectedRouteIdentity | null> {
  const currentUser = await getCurrentUser();
  if (currentUser) return currentUser;

  const token = (await cookies()).get('auth_token')?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      onboardingStatus?: string;
    };
    if (payload.onboardingStatus === 'awaiting_sales_agent_approval') {
      return {
        role: 'salesAgent',
        isActive: false,
        onboardingStatus: payload.onboardingStatus,
      };
    }
  } catch {
    return null;
  }

  return null;
}
