export interface LoginResponse {
  token: string;
  user: Record<string, unknown>;
}

export interface OnboardingUser {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  onboardingType: string | null;
  onboardingStatus: string | null;
  emailVerifiedAt: Date | null;
}

export interface AuthClientContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  tenantId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
}

export interface AuthServiceUser extends Record<string, unknown> {
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  tenantId?: string;
  tenantRole?: string;
  planFeatures?: Record<string, boolean>;
}

export interface AuthServiceLoginResult {
  user: AuthServiceUser;
  tokens: AuthTokens;
  redirectTo: '/admin' | '/busy/dashboard' | '/onboarding' | '/sales-agent/referidos';
}

export interface TenantEntry {
  tenantId: string;
  nombre: string;
  slug: string | null;
  tenantRole: string;
  isCurrent: boolean;
}
