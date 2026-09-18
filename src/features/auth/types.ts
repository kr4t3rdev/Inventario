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
  permissions?: string[];
}

export interface AuthServiceLoginResult {
  user: AuthServiceUser;
  tokens: AuthTokens;
  redirectTo: '/admin' | '/busy/dashboard' | '/onboarding' | '/sales-agent/referidos';
  /** @description Token de onboarding (Bearer) para usuarios mid-onboarding. Lo setea el cliente en sessionStorage antes de navegar a /onboarding. */
  onboardingToken?: string;
}

export interface TenantEntry {
  tenantId: string;
  nombre: string;
  slug: string | null;
  tenantRole: string;
  isCurrent: boolean;
}
