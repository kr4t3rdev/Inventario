import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configuración Inicial — FinanceMDM',
  description:
    'Completá tu registro eligiendo el tipo de usuario y la organización para empezar a usar FinanceMDM.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
