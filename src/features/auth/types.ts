export interface LoginResponse {
  token: string
  user: Record<string, unknown>
}

export interface OnboardingUser {
  userId: string
  name: string | null
  email: string | null
  role: string
  isActive: boolean
  onboardingType: string | null
  onboardingStatus: string | null
  emailVerifiedAt: Date | null
}
